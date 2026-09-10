/**
 * Lane A — routine payment (M2).
 *
 * Owner signs one meta-transaction; the broadcaster submits `requestAndApproveExecution`, which requests
 * and approves in the same transaction so there is no timelock to wait out. The inner call is a plain
 * `transfer(address,uint256)` on the demo token, which the account's guards only permit because the
 * token was whitelisted for that selector at Account Opening.
 *
 * **Multi-token (2026-09-10, HANDOFF-fx-bidirectional §C):** the counter also pays out **Practice EUR** and
 * **Practice ILS** — the same `transfer` schema, a different whitelisted target. Those two targets are granted by the
 * exchange desk (`fx.enableFx`, first Johnny visit), never by Iris, and only exist on the Live wing, where the Main
 * account *is* the Sepolia FX till. Developer Mode's Main account is on 1337, where no practice fiat lives, so a fiat
 * pay there is refused `PAY_TOKEN` in words rather than left to revert. Lane A only: no fiat wire, Priority or faucet.
 */
import { encodeAbiParameters, formatUnits, keccak256, parseAbiParameters, parseUnits, toBytes, type Address, type Hex } from 'viem';
import {
  EngineBlox,
  GuardController,
  GUARD_CONTROLLER_FUNCTION_SELECTORS as GC_SEL,
  TxAction,
} from '@bloxchain/sdk';
import { erc20Abi } from '@branch-zero/shared';
import { broadcaster, broadcasterAddress, chain, metaTxDuration, publicClient } from '../chain.ts';
import { config, deployments } from '../config.ts';
import { signMetaTx, type AuditSink } from '../signing/privySigner.ts';
import { emitStage, type Player } from '../store.ts';
import { receiptFee } from '../fees.ts';
import { FX_PAIRS, fxDeployment } from './fx.ts';

/** A currency the counter can move: the practice dollar, or (Live only) one of Johnny's practice fiats. */
export interface PayToken {
  address: Address;
  symbol: string;
  decimals: number;
}

/**
 * `USD` (default, also the token's own on-chain symbol) or `EUR` | `ILS`. Anything else — and fiat on a wing whose
 * Main account cannot hold it — is `PAY_TOKEN`, refused before a signature. Whether the account's guard actually
 * *lists* the fiat is a separate question the chain answers (`FX_NOT_ENABLED` in `pay`).
 */
export function payTokenOf(symbol: unknown): PayToken {
  const { token } = deployments();
  const usd: PayToken = { address: token.address, symbol: token.symbol, decimals: token.decimals };
  const s = String(symbol ?? '').trim().toUpperCase();
  if (s === '' || s === 'USD' || s === token.symbol.toUpperCase() || s.toLowerCase() === token.address.toLowerCase()) return usd;
  const pair = FX_PAIRS.find((p) => p === s);
  if (pair) {
    if (config.target !== 'sepolia') {
      throw Object.assign(new Error(`${pair} is a Sepolia practice currency; this wing's Main account is on chain ${config.chainId} and holds practice dollars only`), { statusCode: 400, code: 'PAY_TOKEN' });
    }
    const t = fxDeployment().pairs[pair].token;
    return { address: t.address, symbol: t.symbol, decimals: t.decimals };
  }
  // an address that is one of the fiat tokens is accepted too, so a payee form can carry the contract rather than a word
  if (config.target === 'sepolia' && /^0x[0-9a-fA-F]{40}$/.test(s)) {
    const d = fxDeployment();
    for (const p of FX_PAIRS) if (d.pairs[p].token.address.toLowerCase() === s.toLowerCase()) return { ...d.pairs[p].token };
  }
  throw Object.assign(new Error(`the counter pays USD${config.target === 'sepolia' ? ', EUR or ILS' : ' only on this wing'}; "${String(symbol)}" is not a currency it moves`), { statusCode: 400, code: 'PAY_TOKEN' });
}

/** Every currency the passbook should show for this wing — the dollar always, the two fiats on Live. */
export function passbookTokens(): PayToken[] {
  const { token } = deployments();
  const usd: PayToken = { address: token.address, symbol: token.symbol, decimals: token.decimals };
  if (config.target !== 'sepolia') return [usd];
  try {
    const d = fxDeployment();
    return [usd, ...FX_PAIRS.map((p) => ({ address: d.pairs[p].token.address, symbol: d.pairs[p].token.symbol, decimals: d.pairs[p].token.decimals }))];
  } catch {
    return [usd]; // FX not configured on this desk: the passbook is honest and dollar-only
  }
}

/**
 * Meta-transaction validity window. Re-exported for the kill tests; `metaTxDuration()` is what the lanes
 * actually pass, because the contract adds the duration to a possibly-stale block timestamp (see chain.ts).
 */
export { META_TX_TTL_SEC } from '../chain.ts';

/** Operation type registered by the default guard schema for ERC-20 transfers. */
const ERC20_TRANSFER_OPERATION = keccak256(toBytes('ERC20_TRANSFER'));

export interface PayResult {
  hash: Hex;
  txId?: string;
  to: Address;
  amount: string;
  /** The currency moved — `USDC` (the practice dollar's on-chain symbol), `EUR` or `ILS`. */
  symbol: string;
  token: Address;
  /** Balance of **that** currency after the pay. */
  balanceAfter: string;
}

export async function pay(player: Player, to: Address, amount: string, jobId: string, audit?: AuditSink, token: PayToken = payTokenOf(undefined)): Promise<PayResult> {
  const account = player.account;
  if (!account) throw Object.assign(new Error('No account opened for this player'), { code: 'NO_ACCOUNT' });
  const { token: usd } = deployments();

  const stage = (s: 'signing' | 'broadcasting' | 'mined' | 'failed', bankLine: string, extra: Record<string, unknown> = {}) =>
    emitStage(player.privyUserId, { type: 'stage', jobId, lane: 'A', stage: s, bankLine, ...extra });

  const value = parseUnits(amount, token.decimals);
  const executionParams = encodeAbiParameters(parseAbiParameters('address, uint256'), [to, value]);

  const gc = new GuardController(publicClient, broadcaster, account, chain);

  // A fiat target is Johnny's grant, not Iris's: read the guard rather than let the account revert `TargetNotWhitelisted`.
  if (token.address.toLowerCase() !== usd.address.toLowerCase()) {
    const listed = await gc.getFunctionWhitelistTargets(EngineBlox.ERC20_TRANSFER_SELECTOR).catch(() => [] as Address[]);
    if (!listed.some((a) => a.toLowerCase() === token.address.toLowerCase())) {
      throw Object.assign(new Error(`${token.symbol} is not on this account's transfer list yet — the exchange desk grants it (/fx/enable)`), { statusCode: 409, code: 'FX_NOT_ENABLED' });
    }
    const balance = (await publicClient.readContract({ address: token.address, abi: erc20Abi, functionName: 'balanceOf', args: [account] })) as bigint;
    if (balance < value) {
      throw Object.assign(new Error(`the account holds ${formatUnits(balance, token.decimals)} ${token.symbol}; the payment needs ${amount}`), { statusCode: 400, code: 'FX_TILL_SHORT' });
    }
  }

  // `handlerSelector` must be the exact external function the broadcaster will call, because the
  // contract checks it against `msg.sig` when it verifies the signature. `deadline` is a duration the
  // contract adds to `block.timestamp`, not an absolute time — see provision.ts.
  const metaTxParams = await gc.createMetaTxParams(
    account,
    GC_SEL.REQUEST_AND_APPROVE_EXECUTION_SELECTOR,
    TxAction.SIGN_META_REQUEST_AND_APPROVE,
    await metaTxDuration(),
    0n,
    player.ownerAddress,
  );
  const unsigned = await gc.generateUnsignedMetaTransactionForNew(
    player.ownerAddress,
    token.address,
    0n,
    200_000n,
    ERC20_TRANSFER_OPERATION,
    EngineBlox.ERC20_TRANSFER_SELECTOR,
    executionParams,
    metaTxParams,
  );

  stage('signing', 'Stamping your slip…');
  const signed = await signMetaTx(publicClient, chain, unsigned, { owner: player.ownerAddress, walletId: player.walletId, account }, audit);

  stage('broadcasting', 'Taking it to the counter…');
  const res = await gc.requestAndApproveExecution(signed, { from: broadcasterAddress });
  const receipt = await res.wait();
  if (receipt.status !== 'success') {
    stage('failed', 'The counter could not complete that payment.', { hash: res.hash });
    throw new Error(`requestAndApproveExecution reverted (${res.hash})`);
  }

  const txId = await latestTxId(account);
  const balanceAfter = (await publicClient.readContract({
    address: token.address,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account],
  })) as bigint;

  const fee = await receiptFee(res.hash as Hex);
  stage('mined', `Paid ${amount} ${token.symbol}.`, { hash: res.hash, txId, fee, symbol: token.symbol });
  return { hash: res.hash as Hex, txId, to, amount, symbol: token.symbol, token: token.address, balanceAfter: formatUnits(balanceAfter, token.decimals) };
}

/**
 * V5 — read the record id back after a request-and-approve.
 *
 * The account keeps a monotonic transaction counter, so the record this call created is the highest id
 * in history. Reading it back (rather than decoding a log) also confirms the record reached COMPLETED.
 */
export async function latestTxId(account: Address): Promise<string | undefined> {
  try {
    // Registry views are permission-checked, and the SDK passes `walletClient.account` as the `eth_call`
    // sender — so an anonymous reader gets `NoPermission(0x0)`. Read as the broadcaster, which holds a role.
    const reader = new GuardController(publicClient, broadcaster, account, chain);
    const history = await reader.getTransactionHistory(1n, 64n);
    if (!history.length) return undefined;
    const last = history[history.length - 1];
    return String((last as { txId?: bigint }).txId ?? history.length);
  } catch {
    return undefined;
  }
}

/**
 * Passbook numbers for the overlay and the Godot HUD. `balance` / `symbol` stay the dollar line every reader already
 * knows; `balances[]` adds one row per currency the wing can hold (Live: USD, EUR, ILS; Dev: the dollar alone — a
 * 1337 account never holds Sepolia fiat, and the passbook must not pretend it does).
 */
export async function passbook(account: Address) {
  const tokens = passbookTokens();
  const reader = new GuardController(publicClient, broadcaster, account, chain);
  const [pending, ...raw] = await Promise.all([
    reader.getPendingTransactions().catch(() => [] as bigint[]),
    ...tokens.map((t) => publicClient.readContract({ address: t.address, abi: erc20Abi, functionName: 'balanceOf', args: [account] }) as Promise<bigint>),
  ]);
  const balances = tokens.map((t, i) => ({ symbol: t.symbol, token: t.address, balance: formatUnits(raw[i], t.decimals) }));
  return {
    account,
    balance: balances[0].balance,
    symbol: balances[0].symbol,
    balances,
    pending: pending.length,
  };
}
