/**
 * Lane A — routine payment (M2).
 *
 * Owner signs one meta-transaction; the broadcaster submits `requestAndApproveExecution`, which requests
 * and approves in the same transaction so there is no timelock to wait out. The inner call is a plain
 * `transfer(address,uint256)` on the demo token, which the account's guards only permit because the
 * token was whitelisted for that selector at Account Opening.
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
import { deployments } from '../config.ts';
import { signMetaTx, type AuditSink } from '../signing/privySigner.ts';
import { emitStage, type Player } from '../store.ts';

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
  balanceAfter: string;
}

export async function pay(player: Player, to: Address, amount: string, jobId: string, audit?: AuditSink): Promise<PayResult> {
  const account = player.account;
  if (!account) throw Object.assign(new Error('No account opened for this player'), { code: 'NO_ACCOUNT' });
  const { token } = deployments();

  const stage = (s: 'signing' | 'broadcasting' | 'mined' | 'failed', bankLine: string, extra: Record<string, unknown> = {}) =>
    emitStage(player.privyUserId, { type: 'stage', jobId, lane: 'A', stage: s, bankLine, ...extra });

  const value = parseUnits(amount, token.decimals);
  const executionParams = encodeAbiParameters(parseAbiParameters('address, uint256'), [to, value]);

  const gc = new GuardController(publicClient, broadcaster, account, chain);

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

  stage('mined', `Paid ${amount} ${token.symbol}.`, { hash: res.hash, txId });
  return { hash: res.hash as Hex, txId, to, amount, balanceAfter: formatUnits(balanceAfter, token.decimals) };
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

/** Passbook numbers for the overlay and the Godot HUD. */
export async function passbook(account: Address) {
  const { token } = deployments();
  const reader = new GuardController(publicClient, broadcaster, account, chain);
  const [balance, pending] = await Promise.all([
    publicClient.readContract({ address: token.address, abi: erc20Abi, functionName: 'balanceOf', args: [account] }) as Promise<bigint>,
    reader.getPendingTransactions().catch(() => [] as bigint[]),
  ]);
  return {
    account,
    balance: formatUnits(balance, token.decimals),
    symbol: token.symbol,
    pending: pending.length,
  };
}
