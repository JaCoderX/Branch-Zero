/**
 * S1 — the FX desk: a Uniswap v4 swap executed **by the player's AccountBlox** on Sepolia, through GuardController.
 *
 * **Fiat pairs (2026-09-09, docs/HANDOFF-fx-fiat-pairs.md):** Johnny trades practice dollars against **Practice EUR**
 * and **Practice ILS** — two deep v4 pools (≈ $100M TVL each, seeded at a pinned Frankfurter mid by
 * `infra/scripts/fx-pools-fiat.ts`). The old USDC/WETH pool stays on chain and is no longer quoted.
 * `currency0`/`currency1` follow the address sort per pool (`usdIsCurrency0`, re-derived from the addresses), never an
 * assumption that USD is token0.
 *
 * **Bidirectional (2026-09-10, docs/missions/HANDOFF-fx-bidirectional.md):** every pair trades **both ways** —
 * `side: 'buy'` is USD → fiat (the player buys euros), `side: 'sell'` is fiat → USD (the player sells them back).
 * The **amount is always in the sold currency**: buying euros quotes a dollar size, selling euros quotes a euro size.
 * Reverse trades need the account to approve the fiat token for Permit2, so opening the till now whitelists
 * **three** `approve` targets (USD, EUR, ILS) instead of one, and — because fiat held in the till should be spendable
 * as account money — adds EUR + ILS as `transfer` targets on the built-in Lane A schema. Those grants belong to the
 * exchange desk (`enableFx`, first Johnny visit, idempotent heal on revisit), **not** to Iris's Account Opening.
 * There is still no EUR ↔ ILS cross (no pool) and no fiat Lane B / Priority / wire.
 *
 * What makes this a bank operation rather than a swap UI (docs/UNISWAP.md §3): the account, not the player's wallet,
 * is `msg.sender` to Permit2 and to the Universal Router, and it may only call the three functions the FX guard batch
 * registered and whitelisted —
 *
 *     {USD|EUR|ILS}.approve(address,uint256)               → Permit2 may pull the currency the account is selling
 *     Permit2.approve(address,address,uint160,uint48)      → the Universal Router may spend it, once, with an expiry
 *     UniversalRouter.execute(bytes,bytes[],uint256)       → the V4_SWAP itself
 *
 * — plus the counter's own `transfer(address,uint256)` on EUR / ILS, so Lane A can pay out fiat. Each write is a
 * Lane A meta-transaction: the owner's session signer signs (silently, the same `SIGN_META_REQUEST_AND_APPROVE`
 * action the counter uses), the Sepolia broadcaster submits `requestAndApproveExecution`. Nothing Johnny says can make
 * the account talk to any other contract or function: a wrong router is `TargetNotWhitelisted`, a wrong selector has
 * no schema. The first swap in a currency is three meta-transactions; later ones are one, because the two approvals
 * are read back from the chain (per input token) and skipped while they still cover the amount.
 *
 * Like `ens.ts`, this is a lazy Sepolia module inside the Main-wing Teller Desk: payments and the vault stay on Remote
 * EVM 1337; only the FX till lives on Sepolia. Everything Uniswap is hand-encoded with viem from the published
 * v4-periphery / universal-router encodings — no Uniswap npm package (REFLECTION §8). Pool + addresses come from
 * infra/deployments/sepolia.json (`infra/scripts/fx-pools-fiat.ts`).
 *
 * Bank words: the Sepolia account is the player's "FX till"; opening it = the guard batch; the quote board = V4Quoter.
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  defineChain,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  formatUnits,
  getAddress,
  http,
  isAddress,
  keccak256,
  maxUint160,
  maxUint256,
  parseAbi,
  parseAbiParameters,
  parseEther,
  parseGwei,
  parseUnits,
  toBytes,
  toFunctionSelector,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  EngineBlox,
  GuardController,
  GuardConfigActionType,
  GUARD_CONTROLLER_FUNCTION_SELECTORS as GC_SEL,
  GUARD_CONTROLLER_OPERATION_TYPES as GC_OP,
  RoleConfigActionType,
  RuntimeRBAC,
  RUNTIME_RBAC_FUNCTION_SELECTORS as RB_SEL,
  RUNTIME_RBAC_OPERATION_TYPES as RB_OP,
  SecureOwnable,
  TxAction,
  createBitmapFromActions,
  encodeAddFunctionToRole,
  encodeAddTargetToWhitelist,
  encodeRegisterFunction,
  guardConfigBatchExecutionParams,
  roleConfigBatchExecutionParams,
  toContractValue,
} from '@bloxchain/sdk';
import { SEPOLIA_CHAIN_ID, copyBloxAbi, isGanacheParityAddress, sepolia, type StageEvent } from '@branch-zero/shared';
import { config, REPO_ROOT } from '../config.ts';
import { ensureTypedDataRule, pinPolicyToAccount } from '../privy.ts';
import { signMetaTx, type AuditSink } from '../signing/privySigner.ts';
import { emitStage, patchPlayer, type Player } from '../store.ts';
import { maybeTopUp } from '../treasury.ts';
import { explainRevert } from './laneB.ts';
import { BROADCASTER_ROLE, OWNER_ROLE } from './provision.ts';

// ---------------------------------------------------------------- constants (read from the published sources 2026-09-08)

/** universal-router `Commands.V4_SWAP`. */
const CMD_V4_SWAP = 0x10;
/** v4-periphery `Actions`. */
const ACT_SWAP_EXACT_IN_SINGLE = 0x06;
const ACT_SETTLE_ALL = 0x0c;
const ACT_TAKE_ALL = 0x0f;

/** Slippage Johnny quotes with (docs/UNISWAP.md §3.3) and how long a quote stays on the board. */
export const SLIPPAGE_BPS = 100n;
export const QUOTE_TTL_SEC = 300;
/** Permit2 allowance to the router is set once with a long expiry, so repeat swaps are one meta-transaction. */
const PERMIT2_EXPIRY_SEC = 30 * 24 * 3600;
/** Meta-transaction validity, aligned with the quote (docs/UNISWAP.md §3.3). */
const META_TX_TTL_SEC = 600n;

const erc20 = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
]);
const permit2Abi = parseAbi([
  'function approve(address token, address spender, uint160 amount, uint48 expiration)',
  'function allowance(address owner, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)',
]);
const routerAbi = parseAbi(['function execute(bytes commands, bytes[] inputs, uint256 deadline) payable']);
const quoterAbi = parseAbi([
  'function quoteExactInputSingle(((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, bool zeroForOne, uint128 exactAmount, bytes hookData) params) returns (uint256 amountOut, uint256 gasEstimate)',
]);
const stateViewAbi = parseAbi([
  'function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)',
  'function getLiquidity(bytes32 poolId) view returns (uint128 liquidity)',
]);
const POOL_KEY_TUPLE = '(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks)';

/**
 * The two events every AccountBlox emits when a transaction reaches a terminal state (`EngineBlox`
 * `_completeTransaction`). We read them because **a mined meta-transaction is not a successful one**: the account
 * catches the inner revert, records the transaction `FAILED`, and returns normally, so the outer receipt says
 * `success` either way. See `assertInnerSuccess`.
 */
const accountEventsAbi = parseAbi([
  'event TransactionEvent(uint256 indexed txId, bytes4 indexed functionHash, uint8 status, address indexed requester, address target, bytes32 operationType, bytes32 resultHash)',
  'event TxExecutionResult(uint256 indexed txId, bytes result)',
]);
/** `EngineBlox.TxStatus`, by enum position. 5 = COMPLETED, 6 = FAILED. */
const TX_STATUS = ['UNDEFINED', 'PENDING', 'EXECUTING', 'PROCESSING_PAYMENT', 'CANCELLED', 'COMPLETED', 'FAILED'] as const;
const TX_FAILED = 6;

/**
 * Did the work inside the meta-transaction actually happen?
 *
 * `receipt.status === 'success'` only says the account accepted and ran the request. When the inner call reverts,
 * `_completeTransaction` writes `TxStatus.FAILED`, emits it on `TransactionEvent`, puts the raw revert bytes on
 * `TxExecutionResult` — and the outer transaction still mines, still succeeds, still charges for every bit of gas
 * it burned. The first FX role batch cost 2,021,592 gas that way while granting nothing, and the desk called it a
 * success. So: read the events back, and turn a FAILED record into the error it actually carried.
 */
function assertInnerSuccess(logs: readonly { address: string; data: Hex; topics: readonly Hex[] }[], account: Address, what: string, hash: Hex): void {
  const mine = logs.filter((l) => l.address.toLowerCase() === account.toLowerCase());
  const results = new Map<string, Hex>();
  const terminal: Array<{ txId: bigint; status: number }> = [];
  for (const l of mine) {
    try {
      const e = decodeEventLog({ abi: accountEventsAbi, data: l.data, topics: l.topics as [Hex, ...Hex[]] });
      if (e.eventName === 'TxExecutionResult') results.set(String(e.args.txId), e.args.result as Hex);
      else if (e.eventName === 'TransactionEvent' && Number(e.args.status) >= 4) terminal.push({ txId: e.args.txId as bigint, status: Number(e.args.status) });
    } catch {
      /* some other contract's event, or a shape this ABI does not cover */
    }
  }
  const failed = terminal.find((t) => t.status === TX_FAILED);
  if (!failed) return;
  const data = results.get(String(failed.txId));
  const why = data && data.length >= 10 ? explainRevert(Object.assign(new Error(`reverted, signature "${data.slice(0, 10)}"`), { data })) : undefined;
  throw Object.assign(new Error(`${what} mined but the account recorded it ${TX_STATUS[failed.status]}: ${why?.message ?? `revert data ${data ?? '(none)'}`} (${hash})`), {
    statusCode: 502,
    code: 'FX_CONFIG_FAILED',
    ...(why?.bankLine ? { bankLine: why.bankLine } : {}),
  });
}

/** The three guarded functions, in bank order. `signature` is what `registerFunctionSchema` stores. */
export const FX_FUNCTIONS = [
  { key: 'approve', signature: 'approve(address,uint256)', operation: 'ERC20_APPROVE', gas: 80_000n },
  { key: 'permit2', signature: 'approve(address,address,uint160,uint48)', operation: 'PERMIT2_APPROVE', gas: 90_000n },
  // 500k, not the ~200k a warm v4 exactInputSingle costs: the till's first swap writes *cold* storage — a new WETH
  // balance slot, the pool's fee growth, Permit2's nonce — and inner gas is a cap the guard forwards, not a price.
  // Unused gas is refunded; an undersized inner cap is a paid-for revert. Same asymmetry `budget()` is built on.
  { key: 'execute', signature: 'execute(bytes,bytes[],uint256)', operation: 'UNISWAP_V4_SWAP', gas: 500_000n },
] as const;
export const FX_SELECTORS = Object.fromEntries(FX_FUNCTIONS.map((f) => [f.key, toFunctionSelector(`function ${f.signature}`)])) as Record<(typeof FX_FUNCTIONS)[number]['key'], Hex>;
const FX_ACTIONS = [TxAction.SIGN_META_REQUEST_AND_APPROVE, TxAction.EXECUTE_META_REQUEST_AND_APPROVE];
/**
 * The counter's Lane A shape (docs/BLOXCHAIN-INTEGRATION.md §3.3). Not an FX call and not registered here — `initialize`
 * installs the schema and Iris's provisioning whitelists the practice dollar + grants the roles. The exchange desk only
 * adds the two fiat tokens as **targets**, so fiat bought at Johnny's can be paid out over Eve's counter (Lane A only).
 */
export const FX_TRANSFER = { key: 'transfer', signature: 'transfer(address,uint256)', selector: EngineBlox.ERC20_TRANSFER_SELECTOR as Hex } as const;

/** Every target the exchange desk expects on the till, per selector. Read against the chain, never assumed. */
function fxTargets(d: FxDeployment): { approve: Address[]; permit2: Address[]; execute: Address[]; transfer: Address[] } {
  const fiat = FX_PAIRS.map((p) => d.pairs[p].token.address);
  return { approve: [d.usdc.address, ...fiat], permit2: [d.uniswap.permit2], execute: [d.uniswap.universalRouter], transfer: fiat };
}

/**
 * Outer transaction gas limits (see `enableFx`). Refunded when unused; they only have to be *enough* and to fit
 * `gas × maxFeePerGas ≤ teller balance`. Base is the meta-transaction machinery, `perAction` the batch content.
 */
const OUTER_GAS = {
  /** Guard batch: 6 actions (3 `registerFunctionSchema` + 3 whitelist) measured at 2,989,417 on Sepolia. */
  guard: (n: bigint) => 800_000n + 420_000n * n,
  /** Role batch floor: prefer state-override estimate at send — a failed first grant once priced ~2.1 M and lied. */
  role: (n: bigint) => 600_000n + 300_000n * n,
  /** One guarded call: the `requestAndApproveExecution` machinery plus the inner call's own cap. */
  call: (inner: bigint) => 700_000n + inner,
} as const;

/**
 * Fee policy for the FX teller, and why it is not viem's default.
 *
 * viem prices a transaction at `baseFee × 1.2 + eth_maxPriorityFeePerGas`, and on Sepolia the node suggests a ~1.2
 * gwei tip — 2.5 gwei all-in on a chain whose base fee is ~1.0. Nobody is competing for Sepolia blocks, so the tip
 * buys nothing and the *cap* is what a faucet-funded teller trips over: viem refuses to send when
 * `gas × maxFeePerGas` exceeds the balance, whatever the transaction would actually cost. A 0.02 gwei tip and a
 * small headroom multiplier keep both the cap and the bill honest. Raise `FEE_HEADROOM` if Sepolia ever gets busy.
 */
const FEE_TIP = parseGwei('0.02');
const FEE_HEADROOM = { num: 108n, den: 100n };

async function fees(): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
  const base = (await fxClients().publicClient.getBlock()).baseFeePerGas ?? parseGwei('1');
  return { maxFeePerGas: (base * FEE_HEADROOM.num) / FEE_HEADROOM.den + FEE_TIP, maxPriorityFeePerGas: FEE_TIP };
}

/**
 * The outer gas limit to send, or a refusal. `want` is the measured ceiling for the step.
 *
 * There is **no soft path**: when the teller cannot cover `want` we throw `FX_TELLER_DRY` and send nothing. The
 * earlier version shipped the affordable limit instead, on the theory that an out-of-gas revert names the problem
 * better than viem's "insufficient funds". It does — and it also *pays* for the privilege. That is precisely how
 * 0.0027 ETH went into the failed guard batch `0x2d3b6b27…` (2,481,776 used of a 2,520,000 limit, against a
 * measured need of 2,989,417): the SDK's pre-flight simulates with **no** gas field, so an undersized limit sails
 * through `eth_call` and only dies on chain, where the fee is not refunded. A refusal costs nothing and says
 * exactly what to do — top the teller up. Sizing comes from state-override `eth_estimateGas`, never from simulation.
 */
async function budget(want: bigint): Promise<bigint> {
  const { publicClient, broadcasterAddress } = fxClients();
  const [balance, f] = await Promise.all([publicClient.getBalance({ address: broadcasterAddress }), fees()]);
  // 98 %: viem checks `gas × maxFeePerGas ≤ balance` at send time, and the base fee may tick up between the two.
  const affordable = ((balance / f.maxFeePerGas) * 98n) / 100n;
  if (affordable >= want) return want;
  throw fxError(
    'FX_TELLER_DRY',
    `the FX teller ${broadcasterAddress} holds ${formatUnits(balance, 18)} ETH — enough for ${affordable} gas, and this step needs ${want} (~${formatUnits(want * f.maxFeePerGas, 18)} ETH at ${formatUnits(f.maxFeePerGas, 9)} gwei). Refusing rather than sending an undersized limit that would run out of gas and burn the fee. Top the teller up and re-run.`,
    503,
  );
}

// ---------------------------------------------------------------- deployment + clients (lazy, like ens.ts)

interface PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

/** The two currencies Johnny deals in, each against the practice dollar, both ways since 2026-09-10. */
export type FxPair = 'EUR' | 'ILS';
export const FX_PAIRS: readonly FxPair[] = ['EUR', 'ILS'];
/**
 * Direction of a trade, from the player's side of the counter: `buy` = pay dollars, receive the pair's fiat;
 * `sell` = pay that fiat, receive dollars. The **amount is always in the currency being sold** — buy euros with a
 * dollar size, sell euros with a euro size — because that is the number a customer has in hand at an FX desk.
 */
export type FxSide = 'buy' | 'sell';
export const FX_SIDES: readonly FxSide[] = ['buy', 'sell'];

export interface FxPairDeployment {
  pair: FxPair;
  /** The practice fiat token (open mint, 6 decimals). */
  token: { address: Address; symbol: string; name: string; decimals: number };
  pool: PoolKey & { id: Hex };
  /** Address sort: `zeroForOne` for USD → fiat is exactly this flag. */
  usdIsCurrency0: boolean;
  /** Frozen at seed; the pool prices every quote, this is the board's reference line. */
  seedRate: string;
  seedRateDate: string;
  seedTvlUsd?: number;
}

export interface FxDeployment {
  chainId: number;
  guardDefinitions: Address;
  rbacDefinitions: Address;
  uniswap: { poolManager: Address; universalRouter: Address; quoter: Address; stateView: Address; permit2: Address };
  /** The practice dollar (the U5 open-mint mock, symbol USDC on chain; "USD" at the desk). */
  usdc: { address: Address; symbol: string; decimals: number };
  pairs: Record<FxPair, FxPairDeployment>;
  /** Accounts the infra script initialised directly (the rig's till). Owner → account. */
  fixtures: Array<{ label: string; address: Address; owner: Address }>;
  /** Present once an operator has bootstrapped CopyBlox on Sepolia; until then only fixtures can open a till. */
  copyBlox?: { address: Address; deployedAtBlock: bigint; implementation: Address };
  explorer: string;
}

const fxError = (code: string, message: string, statusCode = 400) => Object.assign(new Error(message), { statusCode, code });

let deployment: FxDeployment | undefined;
let clients: { publicClient: PublicClient; chain: Chain; broadcaster: WalletClient; broadcasterAddress: Address; deployer?: WalletClient } | undefined;

function addr(v: unknown, field: string): Address {
  if (typeof v !== 'string' || !isAddress(v)) throw fxError('FX_NOT_CONFIGURED', `sepolia.json: ${field} is not an address`, 503);
  return getAddress(v);
}

export function fxDeployment(): FxDeployment {
  if (deployment) return deployment;
  const file = path.join(REPO_ROOT, 'infra', 'deployments', 'sepolia.json');
  let raw: Record<string, any>;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw fxError('FX_NOT_CONFIGURED', `sepolia.json unreadable: ${(e as Error).message}`, 503);
  }
  if (Number(raw.chainId) !== SEPOLIA_CHAIN_ID) throw fxError('FX_NOT_CONFIGURED', 'sepolia.json is not for chain 11155111', 503);
  const u = raw.uniswap;
  if (!u?.pools?.usdEur?.id || !u?.pools?.usdIls?.id || !raw.libraries?.GuardControllerDefinitions || !raw.tokens?.demoUsdc || !raw.tokens?.practiceEur || !raw.tokens?.practiceIls) {
    throw fxError('FX_NOT_CONFIGURED', 'sepolia.json has no fiat pools / practice fiat tokens / Bloxchain libraries yet — run chain:deploy --chain sepolia and npm run fx:pools-fiat', 503);
  }
  const cb = raw.applications?.CopyBlox;
  const usdcAddress = addr(raw.tokens.demoUsdc.address, 'demoUsdc');
  if (raw.tokens.circleUsdc?.address && usdcAddress.toLowerCase() === String(raw.tokens.circleUsdc.address).toLowerCase()) {
    throw fxError('FX_NOT_CONFIGURED', 'tokens.demoUsdc is Circle USDC — Circle USDC never enters a practice pool', 503);
  }
  const pairFrom = (pair: FxPair, poolKey: 'usdEur' | 'usdIls', tokenKey: 'practiceEur' | 'practiceIls'): FxPairDeployment => {
    const p = u.pools[poolKey];
    const t = raw.tokens[tokenKey];
    const token = { address: addr(t.address, tokenKey), symbol: String(t.symbol ?? pair), name: String(t.name ?? `Practice ${pair}`), decimals: Number(t.decimals ?? 6) };
    const pool = { id: p.id as Hex, currency0: addr(p.currency0, `${poolKey}.currency0`), currency1: addr(p.currency1, `${poolKey}.currency1`), fee: Number(p.fee), tickSpacing: Number(p.tickSpacing), hooks: addr(p.hooks, `${poolKey}.hooks`) };
    // Trust the addresses, not the flag: the sort is a fact about two addresses and is re-derived here.
    const usdIsCurrency0 = pool.currency0 === usdcAddress;
    const other = usdIsCurrency0 ? pool.currency1 : pool.currency0;
    if (!(usdIsCurrency0 || pool.currency1 === usdcAddress)) throw fxError('FX_NOT_CONFIGURED', `${poolKey}: neither currency is the practice dollar`, 503);
    if (other !== token.address) throw fxError('FX_NOT_CONFIGURED', `${poolKey}: the non-USD currency ${other} is not tokens.${tokenKey}`, 503);
    if (p.usdIsCurrency0 !== undefined && Boolean(p.usdIsCurrency0) !== usdIsCurrency0) throw fxError('FX_NOT_CONFIGURED', `${poolKey}: usdIsCurrency0 disagrees with the addresses`, 503);
    return { pair, token, pool, usdIsCurrency0, seedRate: String(p.seedRate ?? ''), seedRateDate: String(p.seedRateDate ?? ''), seedTvlUsd: p.seedTvlUsd ? Number(p.seedTvlUsd) : undefined };
  };
  deployment = {
    chainId: SEPOLIA_CHAIN_ID,
    guardDefinitions: addr(raw.libraries.GuardControllerDefinitions.address, 'GuardControllerDefinitions'),
    rbacDefinitions: addr(raw.libraries.RuntimeRBACDefinitions?.address, 'RuntimeRBACDefinitions'),
    uniswap: {
      poolManager: addr(u.poolManager, 'poolManager'),
      universalRouter: addr(u.universalRouter, 'universalRouter'),
      quoter: addr(u.quoter, 'quoter'),
      stateView: addr(u.stateView, 'stateView'),
      permit2: addr(u.permit2, 'permit2'),
    },
    // Bank words: the token's on-chain symbol is USDC (the U5 mock), but at an FX desk it is simply the dollar.
    usdc: { address: usdcAddress, symbol: 'USD', decimals: Number(raw.tokens.demoUsdc.decimals ?? 6) },
    pairs: { EUR: pairFrom('EUR', 'usdEur', 'practiceEur'), ILS: pairFrom('ILS', 'usdIls', 'practiceIls') },
    fixtures: ((raw.accounts ?? []) as Array<{ label: string; address: string; owner: string }>).map((a) => ({ label: a.label, address: getAddress(a.address), owner: getAddress(a.owner) })),
    copyBlox: cb?.address ? { address: addr(cb.address, 'CopyBlox'), deployedAtBlock: BigInt(cb.deployedAtBlock ?? 0), implementation: addr(cb.cloneImplementation ?? raw.accounts?.[0]?.address, 'cloneImplementation') } : undefined,
    explorer: 'https://sepolia.etherscan.io',
  };
  return deployment;
}

/** `EUR` | `ILS`, case-insensitively; anything else is `FX_PAIR` — the desk deals in two currencies and says so. */
export function pairOf(v: unknown): FxPair {
  const p = String(v ?? '').trim().toUpperCase();
  if (p === 'EUR' || p === 'ILS') return p;
  throw fxError('FX_PAIR', `the FX desk trades EUR or ILS against practice dollars; "${String(v ?? '')}" is not a pair it deals in`, 400);
}

/** `buy` | `sell` (case-insensitive; also `USD→EUR`-style words `to`/`from` are *not* accepted — keep the API to one vocabulary). Missing = `buy`, the historical one-way direction. */
export function sideOf(v: unknown): FxSide {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === '' || s === 'buy') return 'buy';
  if (s === 'sell') return 'sell';
  throw fxError('FX_SIDE', `the FX desk buys or sells — "${String(v)}" is not a direction it knows`, 400);
}

/** The two legs of a directed trade on one pool: which token leaves the till and which arrives. */
function legsOf(d: FxDeployment, p: FxPairDeployment, side: FxSide) {
  const usd = { address: d.usdc.address, symbol: d.usdc.symbol, decimals: d.usdc.decimals };
  const fiat = { address: p.token.address, symbol: p.token.symbol, decimals: p.token.decimals };
  return side === 'buy'
    ? { tokenIn: usd, tokenOut: fiat, zeroForOne: p.usdIsCurrency0 }
    : { tokenIn: fiat, tokenOut: usd, zeroForOne: !p.usdIsCurrency0 };
}

/** Mid price of a pool from `slot0`, as fiat per USD (both sides are 6 dp, so the raw ratio is the display ratio). */
function midRateOf(sqrtPriceX96: bigint, usdIsCurrency0: boolean): number {
  const sqrtP = Number(sqrtPriceX96) / 2 ** 96;
  const price1per0 = sqrtP * sqrtP;
  return usdIsCurrency0 ? price1per0 : 1 / price1per0;
}

function fxClients() {
  if (clients) return clients;
  if (!config.sepoliaRpcUrl) throw fxError('FX_NOT_CONFIGURED', 'SEPOLIA_RPC_URL is missing', 503);
  if (!config.fx.broadcasterPk) throw fxError('FX_NOT_CONFIGURED', 'SEPOLIA_BROADCASTER_PK is missing — the FX till has no teller', 503);
  // Faucet-funded throwaways pay the gas: keep the tip minimal (viem: maxFee = 1.2 × base + tip).
  const chain = defineChain({ ...sepolia, rpcUrls: { default: { http: [config.sepoliaRpcUrl] } }, fees: { defaultPriorityFee: parseGwei('0.02') } });
  const publicClient = createPublicClient({ chain, transport: http(config.sepoliaRpcUrl) }) as PublicClient;
  /**
   * Pin the fee on every write this client sends. The SDK forwards a `gas` limit but prices the transaction with
   * viem's defaults, and `TransactionOptions.gasPrice` would force a 1 gwei tip — so the cheapest place to say
   * "0.02 gwei is plenty on Sepolia" is the wallet client itself.
   */
  /**
   * And size every write from a **state-override `eth_estimateGas`**, with the caller's figure as a floor.
   *
   * This is the other half of the same problem. `OUTER_GAS` carries hand-measured ceilings, and a hand-measured
   * ceiling is only as good as the run it was measured on: the role batch's "2,143,997" was recorded against a
   * batch that reverted on its **first** grant, so it measured the revert, not the work. Sized from it, the first
   * batch that actually did the work died out of gas at 2,363,690 (`0x50ce7190…`). An estimate taken here, against
   * the real calldata, cannot make that mistake.
   *
   * The override is what makes the estimate possible at all: a public node probes with the block gas limit, so on
   * Sepolia (60 M × ~1.1 gwei ≈ 0.066 ETH) any teller poorer than that gets "insufficient funds for gas * price"
   * instead of a number. Lending the sender a balance for the duration of one `eth_call` costs nothing and changes
   * nothing about what is sent — `budget()` still decides, from the *real* balance, whether we can afford it.
   */
  const sizeGas = async (args: Record<string, unknown>, from: Address): Promise<bigint> => {
    const floor = typeof args.gas === 'bigint' ? (args.gas as bigint) : 0n;
    const to = (args.address ?? args.to) as Address | undefined;
    const encode = encodeFunctionData as (a: { abi: unknown; functionName: string; args: unknown }) => Hex;
    const data = (args.data as Hex | undefined) ?? (args.abi ? encode({ abi: args.abi, functionName: args.functionName as string, args: args.args }) : undefined);
    if (!to || !data) return floor;
    try {
      const estimate = await publicClient.estimateGas({ account: from, to, data, value: (args.value as bigint | undefined) ?? 0n, stateOverride: [{ address: from, balance: parseEther('10') }] });
      const headroom = (estimate * 115n) / 100n;
      return headroom > floor ? headroom : floor;
    } catch {
      // The call itself reverts (a refused guard, a stale quote). The SDK's own pre-flight raises that with a
      // decoded reason before we get here; keep the floor so the caller's error is the one that surfaces.
      return floor;
    }
  };
  const frugal = (w: WalletClient): WalletClient =>
    new Proxy(w, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (prop !== 'writeContract' && prop !== 'sendTransaction') return value;
        return async (args: Record<string, unknown>) => {
          const priced = args.maxFeePerGas || args.gasPrice ? args : { ...args, ...(await fees()) };
          const from = w.account!.address;
          return (value as (a: unknown) => unknown).call(target, { ...priced, gas: await budget(await sizeGas(priced, from)) });
        };
      },
    }) as WalletClient;
  const wallet = (pk: string, role: string) => {
    const account = privateKeyToAccount((pk.startsWith('0x') ? pk : `0x${pk}`) as Hex);
    if (isGanacheParityAddress(account.address)) throw fxError('FX_NOT_CONFIGURED', `refusing ${role} ${account.address}: Ganache-parity key on Sepolia`, 503);
    return createWalletClient({ account, chain, transport: http(config.sepoliaRpcUrl) });
  };
  const broadcaster = frugal(wallet(config.fx.broadcasterPk, 'FX broadcaster'));
  clients = {
    publicClient,
    chain,
    broadcaster,
    broadcasterAddress: broadcaster.account!.address,
    deployer: config.fx.deployerPk ? wallet(config.fx.deployerPk, 'FX deployer') : undefined,
  };
  return clients;
}

async function readFx<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e && typeof e === 'object' && String((e as { code?: string }).code ?? '').startsWith('FX_')) throw e;
    throw fxError('FX_RPC', `Sepolia read failed: ${(e as Error).message.split('\n')[0]}`, 503);
  }
}

/** Sepolia mines on a schedule, but the same drift guard as chain.ts costs nothing. */
async function metaTxDuration(): Promise<bigint> {
  const latest = (await fxClients().publicClient.getBlock()).timestamp;
  const now = BigInt(Math.floor(Date.now() / 1000));
  return (now > latest ? now - latest : 0n) + META_TX_TTL_SEC;
}

// ---------------------------------------------------------------- the till (the player's Sepolia AccountBlox)

/**
 * FX only works on Sepolia, and only through an account that is really *there*.
 *
 * The whole FX story is "a swap executed by a governed account", so the till has to be a live AccountBlox on
 * Sepolia whose owner is this player — not an address a stale record remembers, and above all not the player's
 * Main account from another chain. A 1337 account address will usually have **no code** on Sepolia, and if some
 * unrelated contract happens to sit there, `owner()` will not be the player. One `eth_call` settles it, and the
 * refusal is a bank line (`FX_TILL_NOT_SEPOLIA`) rather than a revert three meta-transactions later.
 */
async function assertSepoliaTill(till: Address, owner: Address): Promise<Address> {
  const { publicClient, chain } = fxClients();
  const code = await readFx(() => publicClient.getCode({ address: till }));
  if (!code || code === '0x') {
    throw fxError('FX_TILL_NOT_SEPOLIA', `${till} has no contract on ${chain.name} (${chain.id}) — the FX desk only trades through a Sepolia AccountBlox`, 400);
  }
  /**
   * `getCode` just answered, so the RPC is demonstrably reachable — which means a failing `owner()` here is a
   * fact about the *contract*, not the network, and must not be reported as `FX_RPC` ("Johnny can't reach the
   * exchange floor"). A contract with no `owner()` is simply not an AccountBlox: that is the same refusal as
   * an account owned by someone else, and the player deserves the same honest line.
   */
  let onChainOwner: string;
  try {
    onChainOwner = await new SecureOwnable(publicClient as never, undefined, till, chain).owner();
  } catch (e) {
    throw fxError('FX_TILL_NOT_SEPOLIA', `${till} on ${chain.name} does not answer owner() — it is not an AccountBlox (${(e as Error).message.split('\n')[0]})`, 400);
  }
  if (onChainOwner.toLowerCase() !== owner.toLowerCase()) {
    throw fxError('FX_TILL_NOT_SEPOLIA', `${till} on ${chain.name} is owned by ${onChainOwner}, not by ${owner}`, 400);
  }
  return getAddress(till);
}

/**
 * Which Sepolia AccountBlox is this player's. Order of trust: Live's Main account; the player record; an infra fixture whose owner is the
 * player's Privy wallet (the rig's till); a CopyBlox clone found by `BloxCloned` log; a fresh clone if CopyBlox is on
 * Sepolia and the FX deployer is funded. Otherwise the till is honestly closed (`FX_TILL_CLOSED`) — the operator's
 * continuation is in docs/UNISWAP.md §5.
 */
export async function tillFor(player: Player, open = false, jobId?: string): Promise<Address> {
  /**
   * Live: the till **is** the Main account. On the Live wing the player's AccountBlox is already a Sepolia
   * contract, so Johnny trades out of the same account the counter pays from — one balance to fund, one guard
   * list to read, and the FX door is registered on the account the player can see in their passbook
   * (docs/SEPOLIA-LIVE.md §1). Dev cannot do this: a 1337 account and a Sepolia till are different contracts
   * on different chains, so Developer Mode keeps them apart.
   */
  if (config.fxTillIsMain && player.account) {
    const main = await assertSepoliaTill(player.account, player.ownerAddress);
    if (player.fxAccount?.toLowerCase() !== main.toLowerCase()) patchPlayer(player.privyUserId, { fxAccount: main });
    return main;
  }
  if (player.fxAccount) return assertSepoliaTill(player.fxAccount, player.ownerAddress);
  const d = fxDeployment();
  const fixture = d.fixtures.find((f) => f.owner.toLowerCase() === player.ownerAddress.toLowerCase());
  if (fixture) {
    patchPlayer(player.privyUserId, { fxAccount: fixture.address });
    return fixture.address;
  }
  const { publicClient, deployer } = fxClients();
  if (d.copyBlox) {
    const logs = await readFx(() =>
      publicClient.getLogs({
        address: d.copyBlox!.address,
        event: copyBloxAbi.find((x) => x.type === 'event' && x.name === 'BloxCloned')!,
        args: { initialOwner: player.ownerAddress },
        fromBlock: d.copyBlox!.deployedAtBlock,
        toBlock: 'latest',
      }),
    );
    const last = logs[logs.length - 1];
    if (last) {
      const account = getAddress((last.args as { clone: string }).clone);
      patchPlayer(player.privyUserId, { fxAccount: account });
      return account;
    }
    if (open && deployer) {
      if (jobId) stage(player, jobId, 'provisioning', 'Opening your FX till on Sepolia…');
      const { broadcasterAddress } = fxClients();
      const hash = await deployer.writeContract({
        address: d.copyBlox.address,
        abi: copyBloxAbi,
        functionName: 'cloneBlox',
        args: [d.copyBlox.implementation, player.ownerAddress, broadcasterAddress, config.fx.recoveryAddress ?? broadcasterAddress, config.timeLockSec],
        chain: fxClients().chain,
        account: deployer.account!,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') throw fxError('FX_TX_FAILED', `cloneBlox reverted (${hash})`);
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({ abi: copyBloxAbi, data: log.data, topics: log.topics });
          if (decoded.eventName === 'BloxCloned') {
            const account = getAddress(decoded.args.clone as string);
            patchPlayer(player.privyUserId, { fxAccount: account });
            return account;
          }
        } catch {
          /* not ours */
        }
      }
      throw fxError('FX_TX_FAILED', `cloneBlox mined without BloxCloned (${hash})`);
    }
  }
  throw fxError(
    'FX_TILL_CLOSED',
    `no Sepolia AccountBlox for owner ${player.ownerAddress}: ${d.copyBlox ? 'CopyBlox is on Sepolia but SEPOLIA_DEPLOYER_PK is not set/funded' : 'CopyBlox is not on Sepolia yet (npm run chain:bootstrap -- --chain sepolia, funded SEPOLIA_DEPLOYER_PK)'}`,
    503,
  );
}

function stage(player: Player, jobId: string, s: StageEvent['stage'], bankLine: string, extra: Record<string, unknown> = {}) {
  emitStage(player.privyUserId, { type: 'stage', jobId, lane: 'FX', stage: s, bankLine, serverNow: String(Math.floor(Date.now() / 1000)), ...extra });
}

// ---------------------------------------------------------------- Lane A on Sepolia (owner signs, FX broadcaster executes)

/** The session signer's typed-data rule must also allow Sepolia (`chainId` 11155111, `verifyingContract` = the till). */
async function ensureFxPolicy(player: Player, till: Address): Promise<Player> {
  const policyId = player.policyId;
  if (!policyId) return player;
  let p = player;
  if (!p.fxPolicyRuleId) {
    const ruleId = await ensureTypedDataRule(policyId, SEPOLIA_CHAIN_ID);
    p = patchPlayer(p.privyUserId, { fxPolicyRuleId: ruleId });
  }
  if (!p.fxPolicyPinned && p.fxPolicyRuleId) {
    await pinPolicyToAccount({ policyId, ruleId: p.fxPolicyRuleId }, till, SEPOLIA_CHAIN_ID);
    p = patchPlayer(p.privyUserId, { fxPolicyPinned: true });
  }
  return p;
}

async function ownerSignedBatch(player: Player, till: Address, kind: 'guard' | 'role', executionParams: Hex, innerGas: bigint, outerGas: bigint, audit?: AuditSink): Promise<Hex> {
  const { publicClient, chain, broadcaster, broadcasterAddress } = fxClients();
  const ctl = kind === 'guard' ? new GuardController(publicClient, broadcaster, till, chain) : new RuntimeRBAC(publicClient, broadcaster, till, chain);
  const metaSelector = kind === 'guard' ? GC_SEL.GUARD_CONFIG_BATCH_META_SELECTOR : RB_SEL.ROLE_CONFIG_BATCH_META_SELECTOR;
  const execSelector = kind === 'guard' ? GC_SEL.GUARD_CONFIG_BATCH_EXECUTE_SELECTOR : RB_SEL.ROLE_CONFIG_BATCH_EXECUTE_SELECTOR;
  const operation = kind === 'guard' ? GC_OP.CONTROLLER_CONFIG_BATCH : RB_OP.ROLE_CONFIG_BATCH;
  const metaTxParams = await ctl.createMetaTxParams(till, metaSelector, TxAction.SIGN_META_REQUEST_AND_APPROVE, await metaTxDuration(), 0n, player.ownerAddress);
  const unsigned = await ctl.generateUnsignedMetaTransactionForNew(player.ownerAddress, till, 0n, innerGas, operation, execSelector, executionParams, metaTxParams);
  const signed = await signMetaTx(publicClient, chain, unsigned, { owner: player.ownerAddress, walletId: player.walletId, account: till }, audit);
  // `gas` is a floor, not the final limit: the frugal wallet client re-sizes it from a state-override estimate
  // and hard-fails through `budget()` if the teller cannot cover the result.
  const opts = { from: broadcasterAddress, gas: outerGas };
  const res = kind === 'guard' ? await (ctl as GuardController).guardConfigBatchRequestAndApprove(signed, opts) : await (ctl as RuntimeRBAC).roleConfigBatchRequestAndApprove(signed, opts);
  const receipt = await res.wait();
  if (receipt.status !== 'success') throw fxError('FX_TX_FAILED', `${kind} config batch reverted (${res.hash})`);
  assertInnerSuccess(receipt.logs, till, `${kind} config batch`, res.hash as Hex);
  return res.hash as Hex;
}

/** One guarded call from the till: owner signs `SIGN_META_REQUEST_AND_APPROVE`, the FX broadcaster submits. */
async function guardedCall(player: Player, till: Address, fn: (typeof FX_FUNCTIONS)[number], target: Address, calldata: Hex, audit?: AuditSink): Promise<Hex> {
  const { publicClient, chain, broadcaster, broadcasterAddress } = fxClients();
  const gc = new GuardController(publicClient, broadcaster, till, chain);
  const selector = calldata.slice(0, 10) as Hex;
  const params = `0x${calldata.slice(10)}` as Hex;
  const operationType = keccak256(toBytes(fn.operation));
  const metaTxParams = await gc.createMetaTxParams(till, GC_SEL.REQUEST_AND_APPROVE_EXECUTION_SELECTOR, TxAction.SIGN_META_REQUEST_AND_APPROVE, await metaTxDuration(), 0n, player.ownerAddress);
  const unsigned = await gc.generateUnsignedMetaTransactionForNew(player.ownerAddress, target, 0n, fn.gas, operationType, selector, params, metaTxParams);
  const signed = await signMetaTx(publicClient, chain, unsigned, { owner: player.ownerAddress, walletId: player.walletId, account: till }, audit);
  let res;
  try {
    res = await gc.requestAndApproveExecution(signed, { from: broadcasterAddress, gas: OUTER_GAS.call(fn.gas) });
  } catch (e) {
    const why = explainRevert(e);
    throw Object.assign(new Error(`${fn.key}: ${why.message}`), { statusCode: 400, code: why.code, bankLine: why.bankLine });
  }
  const receipt = await res.wait();
  if (receipt.status !== 'success') throw fxError('FX_TX_FAILED', `${fn.key} meta-transaction reverted (${res.hash})`);
  // A guarded call refused *inside* the account mines like any other: same reason as the config batches above.
  assertInnerSuccess(receipt.logs, till, `${fn.key} meta-transaction`, res.hash as Hex);
  return res.hash as Hex;
}

// ---------------------------------------------------------------- opening the till: guard schemas + whitelist + role grants

/** One whitelist row as the desk reports it: which function, which target, and the bank word for the target. */
export interface FxWhitelistRow {
  function: string;
  selector: Hex;
  target: Address;
  /** `USD` | `EUR` | `ILS` for a token target; `Permit2` / `UniversalRouter` otherwise. */
  symbol: string;
}

export interface FxEnableResult {
  account: Address;
  chainId: number;
  guardHash?: Hex;
  roleHash?: Hex;
  actions: string[];
  whitelist: FxWhitelistRow[];
}

function symbolOfTarget(d: FxDeployment, target: Address): string {
  const t = target.toLowerCase();
  if (t === d.usdc.address.toLowerCase()) return d.usdc.symbol;
  for (const pair of FX_PAIRS) if (t === d.pairs[pair].token.address.toLowerCase()) return d.pairs[pair].token.symbol;
  if (t === d.uniswap.permit2.toLowerCase()) return 'Permit2';
  if (t === d.uniswap.universalRouter.toLowerCase()) return 'UniversalRouter';
  return target;
}

/** The full expected whitelist, in bank order: three FX call shapes (each target), then the counter's fiat transfer targets. */
function whitelistOf(d: FxDeployment): FxWhitelistRow[] {
  const targets = fxTargets(d);
  const rows: FxWhitelistRow[] = [];
  for (const fn of FX_FUNCTIONS) for (const target of targets[fn.key]) rows.push({ function: fn.signature, selector: FX_SELECTORS[fn.key], target, symbol: symbolOfTarget(d, target) });
  for (const target of targets.transfer) rows.push({ function: FX_TRANSFER.signature, selector: FX_TRANSFER.selector, target, symbol: symbolOfTarget(d, target) });
  return rows;
}

/**
 * Register the three schemas, whitelist their targets, grant OWNER (sign) / BROADCASTER (execute) on each selector.
 * Idempotent against the chain: only what is missing is sent, and a re-visit costs nothing.
 *
 * The `innerGas` caps below are close to measured usage, not generous, and every write passes an **explicit outer
 * gas limit** (`OUTER_GAS`). Both exist for the same reason: a faucet-funded teller. `eth_estimateGas` on a public
 * node probes with the block gas limit first and answers "insufficient funds for gas * price" whenever
 * `blockGasLimit × maxFeePerGas` exceeds the sender's balance — so on Sepolia the estimate fails long before the
 * transaction would. Naming the gas skips estimation entirely; unused gas is refunded, so an honest ceiling costs
 * nothing. Figures **measured on Sepolia** with `eth_estimateGas` under a balance state-override (2026-09-08):
 * the guard batch of six actions needs 2,989,417 gas and the role batch of six grants 2,143,997 — far more than the
 * per-action arithmetic from Remote EVM suggested, because `registerFunctionSchema` stores a signature string.
 *
 * **Do not trust the SDK's pre-flight simulation to catch an undersized limit.** `BaseStateMachine.executeWriteContract`
 * simulates with `eth_call` and *no* gas field, so the node uses the block limit, the call succeeds, and the real
 * transaction then runs out of gas and burns the fee (2026-09-08: 0.0027 ETH lost that way at a 2.52 M limit).
 *
 * ### Why the role grants self-reference (and Lane A's `transfer` grant does not)
 *
 * `lanes/provision.ts` grants `transfer(address,uint256)` with `handlerForSelectors: [REQUEST_AND_APPROVE_EXECUTION]`,
 * and that is correct **there** — `transfer` is one of the built-in schemas `initialize` installs, and the built-ins
 * are registered in *flexible* mode (`enforceHandlerRelations: false`), which lets a grant name any handler.
 *
 * A schema this batch registers is a different animal. `GuardController._registerGuardedFunction` hard-codes
 * `enforceHandlerRelations: true` and `handlerForSelectors: [the selector itself]` for every dynamically registered
 * function, and the definition contract's `REGISTER_FUNCTION` format — `(string, string, TxAction[])`, confirmed by
 * `getGuardConfigActionSpecs` — gives us no field to change either. So at grant time `_validateHandlerForSelectors`
 * checks our handler against *that* list and only the self-reference is in it: naming
 * `REQUEST_AND_APPROVE_EXECUTION_SELECTOR` reverts `HandlerForSelectorMismatch(0x00000000, 0xde0df793)`.
 *
 * Self-referencing costs nothing at run time. `_validateExecutionAndHandlerPermissions` checks
 * `hasActionPermission` on the execution selector **and** on the handler selector (`0xde0df793`, whose built-in
 * OWNER/BROADCASTER grants `initialize` already installed), then applies strict mode to the **handler's** schema —
 * which is flexible — and never re-reads the permission row's `handlerForSelectors`.
 *
 * This cost a role batch to learn (`0x36126e6c…`), and it is worth knowing *how*: the outer transaction succeeded
 * and burned 2,021,592 gas while every grant in it failed. The account records an inner revert as a **FAILED**
 * status event carrying the error, not as a receipt failure — so `receipt.status === 'success'` on a config batch
 * proves only that the meta-transaction was delivered. `ownerSignedBatch` now reads the effect back instead.
 */
export async function enableFx(player: Player, jobId: string, audit?: AuditSink): Promise<FxEnableResult> {
  await maybeTopUp('pre-fx-enable');
  const d = fxDeployment();
  const { publicClient, chain, broadcaster } = fxClients();
  const till = await tillFor(player, true, jobId);
  let current = await ensureFxPolicy(player, till);

  const targets = fxTargets(d);
  const gc = new GuardController(publicClient, broadcaster, till, chain);
  const rbac = new RuntimeRBAC(publicClient, broadcaster, till, chain);
  const actions: string[] = [];

  stage(current, jobId, 'configuring', 'Setting up the exchange desk…');
  const supported = new Set((await readFx(() => gc.getSupportedFunctions())).map((s) => s.toLowerCase()));
  const guardActions: Array<{ actionType: GuardConfigActionType; data: Hex }> = [];
  const listedOn = async (selector: Hex): Promise<Address[]> => (supported.has(selector.toLowerCase()) ? readFx(() => gc.getFunctionWhitelistTargets(selector).catch(() => [] as Address[])) : []);
  for (const fn of FX_FUNCTIONS) {
    const selector = FX_SELECTORS[fn.key];
    if (!supported.has(selector.toLowerCase())) {
      guardActions.push({ actionType: GuardConfigActionType.REGISTER_FUNCTION, data: encodeRegisterFunction(publicClient, d.guardDefinitions, fn.signature, fn.operation, FX_ACTIONS) });
      actions.push(`REGISTER_FUNCTION ${fn.signature} as ${fn.operation}`);
    }
    const listed = await listedOn(selector);
    // Bidirectional (2026-09-10): `approve` carries three targets — USD, EUR, ILS — because a reverse trade has the
    // account approve the *fiat* for Permit2. A till opened one-way lists only the dollar and heals here.
    for (const target of targets[fn.key]) {
      if (listed.some((a) => a.toLowerCase() === target.toLowerCase())) continue;
      guardActions.push({ actionType: GuardConfigActionType.ADD_TARGET_TO_WHITELIST, data: encodeAddTargetToWhitelist(publicClient, d.guardDefinitions, selector, target) });
      actions.push(`ADD_TARGET_TO_WHITELIST ${fn.key} → ${symbolOfTarget(d, target)} ${target}`);
    }
  }
  /**
   * The counter's `transfer` schema is built in (`initialize`) and Iris already whitelisted the practice dollar on it;
   * the exchange desk adds Practice EUR / ILS as **targets** so fiat bought here can be paid out as account money.
   * Deliberately here and not in `provision.whitelistToken`: the door to fiat is Johnny's, and Account Opening
   * must not grow a currency the player has never asked for (HANDOFF-fx-bidirectional §B).
   */
  {
    const listed = await listedOn(FX_TRANSFER.selector);
    for (const target of targets.transfer) {
      if (listed.some((a) => a.toLowerCase() === target.toLowerCase())) continue;
      guardActions.push({ actionType: GuardConfigActionType.ADD_TARGET_TO_WHITELIST, data: encodeAddTargetToWhitelist(publicClient, d.guardDefinitions, FX_TRANSFER.selector, target) });
      actions.push(`ADD_TARGET_TO_WHITELIST transfer → ${symbolOfTarget(d, target)} ${target}`);
    }
  }
  let guardHash: Hex | undefined;
  if (guardActions.length) {
    const n = BigInt(guardActions.length);
    guardHash = await ownerSignedBatch(current, till, 'guard', guardConfigBatchExecutionParams(publicClient, d.guardDefinitions, guardActions), 240_000n * n + 200_000n, OUTER_GAS.guard(n), audit);
    stage(current, jobId, 'configuring', 'Exchange desk set up.', { hash: guardHash });
  }

  stage(current, jobId, 'configuring', 'Preparing the exchange desk…');
  const roleActions: Array<{ actionType: RoleConfigActionType; data: Hex }> = [];
  for (const [role, roleName, action, actionName] of [
    [OWNER_ROLE, 'OWNER', TxAction.SIGN_META_REQUEST_AND_APPROVE, 'SIGN_META_REQUEST_AND_APPROVE'],
    [BROADCASTER_ROLE, 'BROADCASTER', TxAction.EXECUTE_META_REQUEST_AND_APPROVE, 'EXECUTE_META_REQUEST_AND_APPROVE'],
  ] as const) {
    const existing = (await readFx(() => rbac.getActiveRolePermissions(role))) as Array<{ functionSelector: Hex; grantedActionsBitmap: number | bigint }>;
    const want = toContractValue(createBitmapFromActions([action]));
    for (const fn of FX_FUNCTIONS) {
      const selector = FX_SELECTORS[fn.key];
      const cur = existing.find((e) => e.functionSelector.toLowerCase() === selector.toLowerCase());
      if (cur && Number(cur.grantedActionsBitmap) === want) continue;
      if (cur) continue; // a different grant already exists on this selector; never REMOVE from a role here
      // `handlerForSelectors` is the **selector itself**, not `requestAndApproveExecution` — see the note below.
      roleActions.push({ actionType: RoleConfigActionType.ADD_FUNCTION_TO_ROLE, data: encodeAddFunctionToRole(publicClient, d.rbacDefinitions, role, { functionSelector: selector, grantedActionsBitmap: want, handlerForSelectors: [selector] }) });
      actions.push(`ADD ${fn.key} to ${roleName} (${actionName})`);
    }
    /**
     * Role grants are selector-scoped, so adding fiat *targets* on `transfer` needs no new grant on a Main account
     * Iris provisioned — the counter's grants already cover the selector. Only when the chain proves the grant is
     * missing (a Developer-Mode till the provisioner never touched) is it added, and then in the built-in schema's
     * own shape: flexible mode, handler = `requestAndApproveExecution`, exactly as `provision.desiredGrants` does.
     */
    const tr = existing.find((e) => e.functionSelector.toLowerCase() === FX_TRANSFER.selector.toLowerCase());
    if (!tr) {
      roleActions.push({ actionType: RoleConfigActionType.ADD_FUNCTION_TO_ROLE, data: encodeAddFunctionToRole(publicClient, d.rbacDefinitions, role, { functionSelector: FX_TRANSFER.selector, grantedActionsBitmap: want, handlerForSelectors: [GC_SEL.REQUEST_AND_APPROVE_EXECUTION_SELECTOR] }) });
      actions.push(`ADD transfer to ${roleName} (${actionName}) — the chain showed no grant on the counter's selector`);
    }
  }
  let roleHash: Hex | undefined;
  if (roleActions.length) {
    const n = BigInt(roleActions.length);
    roleHash = await ownerSignedBatch(current, till, 'role', roleConfigBatchExecutionParams(publicClient, d.rbacDefinitions, roleActions), 260_000n * n + 200_000n, OUTER_GAS.role(n), audit);
    stage(current, jobId, 'configuring', 'Exchange desk ready.', { hash: roleHash });
  }

  current = patchPlayer(current.privyUserId, { fxAccount: till, fxConfigured: true });
  stage(current, jobId, 'mined', guardHash || roleHash ? 'Your FX till is open — both ways, and your euros and shekels can go over the counter.' : 'Your FX till was already open.', { account: till, ...(roleHash ?? guardHash ? { hash: roleHash ?? guardHash } : {}) });
  return { account: till, chainId: d.chainId, guardHash, roleHash, actions, whitelist: whitelistOf(d) };
}

/**
 * Is the till open on chain? Read, not remembered — a restart or a foreign Re-check cannot lie about it.
 *
 * All three parts, because the door needs all three and a partial answer is worse than none. The first version
 * asked only for the three schemas plus the router on `execute`, and on 2026-09-08 that told the kill test the till
 * was open while every role grant was still missing: K7-b went green and K7-d then failed `NoPermission`. A probe
 * that can pass over a shut door is not a probe. `fxStatus` shows this to the player, so it costs four `eth_call`s
 * on a desk read — cheap next to being wrong.
 */
export async function fxEnabled(till: Address): Promise<boolean> {
  return (await readDoor(till)).open;
}

/** What the exchange door looks like on chain, in detail — `fxEnabled` is its one-bit summary, `/fx/status` shows the rest. */
export interface FxDoor {
  /** Every expected target is whitelisted and both roles hold their action on every selector — including the fiat transfer targets. */
  open: boolean;
  /** Whitelist rows that are **missing** on chain (empty when open). A one-way till shows the two fiat `approve` rows and the two `transfer` rows here. */
  missing: FxWhitelistRow[];
  /** Currencies Lane A may pay from this account today: the symbols whose token is a `transfer` target on chain. */
  payable: string[];
}

/**
 * Since 2026-09-10 "open" also demands the two fiat `approve` targets (reverse trades) and the two fiat `transfer`
 * targets (Lane A fiat pay). Otherwise a till opened one-way would report open, `enableFx` would send nothing on a
 * revisit, and the first sell would revert `TargetNotWhitelisted` three meta-transactions in. A probe that passes
 * over a half-open door is not a probe (see the 2026-09-08 note above).
 */
export async function readDoor(till: Address): Promise<FxDoor> {
  const d = fxDeployment();
  const { publicClient, chain, broadcaster } = fxClients();
  const gc = new GuardController(publicClient, broadcaster, till, chain);
  const rbac = new RuntimeRBAC(publicClient, broadcaster, till, chain);
  const want = whitelistOf(d);

  // 1. the three FX schemas are registered (the transfer schema is built in)
  const supported = new Set((await readFx(() => gc.getSupportedFunctions())).map((s) => s.toLowerCase()));
  const schemasOk = Object.values(FX_SELECTORS).every((s) => supported.has(s.toLowerCase()));

  // 2. each selector's whitelist carries every target we expect — a schema with no target opens nothing
  const selectors = [...new Set(want.map((w) => w.selector))];
  const listed = new Map<string, Address[]>();
  await readFx(() => Promise.all(selectors.map(async (s) => listed.set(s.toLowerCase(), supported.has(s.toLowerCase()) ? await gc.getFunctionWhitelistTargets(s).catch(() => [] as Address[]) : []))));
  const has = (row: FxWhitelistRow) => (listed.get(row.selector.toLowerCase()) ?? []).some((a) => a.toLowerCase() === row.target.toLowerCase());
  const missing = want.filter((row) => !has(row));
  const transferListed = listed.get(FX_TRANSFER.selector.toLowerCase()) ?? [];
  const payable = [d.usdc, ...FX_PAIRS.map((p) => d.pairs[p].token)].filter((t) => transferListed.some((a) => a.toLowerCase() === t.address.toLowerCase())).map((t) => t.symbol);

  // 3. and the roles can actually use them: OWNER signs, BROADCASTER executes, on all four selectors (BLOXCHAIN-INTEGRATION V4)
  let rolesOk = true;
  for (const [role, action] of [
    [OWNER_ROLE, TxAction.SIGN_META_REQUEST_AND_APPROVE],
    [BROADCASTER_ROLE, TxAction.EXECUTE_META_REQUEST_AND_APPROVE],
  ] as const) {
    const wantBits = toContractValue(createBitmapFromActions([action]));
    const perms = (await readFx(() => rbac.getActiveRolePermissions(role))) as Array<{ functionSelector: Hex; grantedActionsBitmap: number | bigint }>;
    const holds = (selector: Hex) => {
      const cur = perms.find((p) => p.functionSelector.toLowerCase() === selector.toLowerCase());
      return Boolean(cur) && (Number(cur!.grantedActionsBitmap) & wantBits) === wantBits;
    };
    if (!selectors.every(holds)) rolesOk = false;
  }
  return { open: schemasOk && missing.length === 0 && rolesOk, missing, payable };
}

// ---------------------------------------------------------------- status, quote, swap

export interface FxPairStatus {
  pair: FxPair;
  symbolOut: string;
  name: string;
  /** The till's balance of this fiat, display units. */
  balance: string;
  /** "1 USD ≈ 0.8610 EUR" from the pool's own slot0 — a reading, not a quote (no fee, no size). */
  midRate: string;
  seedRate: string;
  seedRateDate: string;
  pool: { id: Hex; fee: string; feeBps: number; tick?: number; liquidity?: string; usdIsCurrency0: boolean };
}

export interface FxStatus {
  chainId: number;
  configured: boolean;
  account: Address | null;
  enabled: boolean;
  /** The till's practice dollars (kept under the historical key the bridge and board already read). */
  usdc: string;
  eur: string;
  ils: string;
  symbolIn: string;
  /** Both directions on every pair since 2026-09-10. */
  sides: readonly FxSide[];
  pairs: FxPairStatus[];
  router: Address;
  quoter: Address;
  /** Every row the open door needs (three FX call shapes × their targets, plus EUR / ILS on the counter's `transfer`). */
  whitelist: FxWhitelistRow[];
  /** Rows the chain does **not** carry yet — a one-way till lists the fiat approve + transfer rows here until Johnny heals it. */
  missing: FxWhitelistRow[];
  /** Currencies Lane A can pay from this till today (`transfer` targets on chain). */
  payable: string[];
  explorer: { account?: string; pools: Record<FxPair, string> };
  serverNow: string;
}

async function pairStatuses(d: FxDeployment, till?: Address): Promise<FxPairStatus[]> {
  const { publicClient } = fxClients();
  return readFx(() =>
    Promise.all(
      FX_PAIRS.map(async (pair) => {
        const p = d.pairs[pair];
        const [slot0, liquidity, balance] = await Promise.all([
          publicClient.readContract({ address: d.uniswap.stateView, abi: stateViewAbi, functionName: 'getSlot0', args: [p.pool.id] }),
          publicClient.readContract({ address: d.uniswap.stateView, abi: stateViewAbi, functionName: 'getLiquidity', args: [p.pool.id] }),
          till ? publicClient.readContract({ address: p.token.address, abi: erc20, functionName: 'balanceOf', args: [till] }) : Promise.resolve(0n),
        ]);
        return {
          pair,
          symbolOut: p.token.symbol,
          name: p.token.name,
          balance: formatUnits(balance, p.token.decimals),
          midRate: `1 ${d.usdc.symbol} ≈ ${midRateOf(slot0[0], p.usdIsCurrency0).toFixed(4)} ${p.token.symbol}`,
          seedRate: p.seedRate,
          seedRateDate: p.seedRateDate,
          pool: { id: p.pool.id, fee: `${(p.pool.fee / 10_000).toFixed(2)}%`, feeBps: p.pool.fee / 100, tick: Number(slot0[1]), liquidity: liquidity.toString(), usdIsCurrency0: p.usdIsCurrency0 },
        };
      }),
    ),
  );
}

export async function fxStatus(player: Player): Promise<FxStatus> {
  const d = fxDeployment();
  const { publicClient } = fxClients();
  const serverNow = String(Math.floor(Date.now() / 1000));
  const whitelist = whitelistOf(d);
  const explorerPools = Object.fromEntries(FX_PAIRS.map((p) => [p, `${d.explorer}/address/${d.uniswap.poolManager}`])) as Record<FxPair, string>;
  let till: Address | undefined;
  try {
    till = await tillFor(player);
  } catch (e) {
    if ((e as { code?: string }).code !== 'FX_TILL_CLOSED') throw e;
  }
  const base = { chainId: d.chainId, configured: true, symbolIn: d.usdc.symbol, sides: FX_SIDES, router: d.uniswap.universalRouter, quoter: d.uniswap.quoter, whitelist, serverNow };
  if (!till) {
    const pairs = await pairStatuses(d);
    return { ...base, account: null, enabled: false, usdc: '0', eur: '0', ils: '0', pairs, missing: whitelist, payable: [], explorer: { pools: explorerPools } };
  }
  const [usdc, door, pairs] = await Promise.all([readFx(() => publicClient.readContract({ address: d.usdc.address, abi: erc20, functionName: 'balanceOf', args: [till!] })), readDoor(till), pairStatuses(d, till)]);
  const enabled = door.open;
  if (enabled !== Boolean(player.fxConfigured)) patchPlayer(player.privyUserId, { fxConfigured: enabled });
  return {
    ...base,
    account: till,
    enabled,
    missing: door.missing,
    payable: door.payable,
    usdc: formatUnits(usdc, d.usdc.decimals),
    eur: pairs.find((p) => p.pair === 'EUR')!.balance,
    ils: pairs.find((p) => p.pair === 'ILS')!.balance,
    pairs,
    explorer: { account: `${d.explorer}/address/${till}`, pools: explorerPools },
  };
}

export interface FxQuote {
  quoteId: string;
  chainId: number;
  pair: FxPair;
  /** `buy` = USD → fiat, `sell` = fiat → USD. `amountIn` is in `symbolIn`, the currency being sold. */
  side: FxSide;
  amountIn: string;
  amountOut: string;
  minOut: string;
  /** "1 USD ≈ 0.8584 EUR" (buy) or "1 EUR ≈ 1.1579 USD" (sell) — the all-in rate of this size, fee included. */
  rate: string;
  rateOut: string;
  symbolIn: string;
  symbolOut: string;
  fee: string;
  slippage: string;
  /** Unix seconds the quote (and the swap deadline) is good until; `serverNow` lets the board count against the desk clock. */
  deadline: string;
  serverNow: string;
  validSec: number;
  gasEstimate: string;
  poolId: Hex;
}

const quotes = new Map<string, { player: string; pair: FxPair; side: FxSide; amountIn: bigint; minOut: bigint; deadline: number }>();

/**
 * Johnny's board: V4Quoter.quoteExactInputSingle by `eth_call` on the pair's pool, minus 1 % slippage, good for five
 * minutes. `side` picks the direction on the same pool — `zeroForOne` is simply flipped for a sell — and the amount
 * is read in the sold currency's decimals (both are 6 dp today, but the code does not lean on that).
 */
export async function quote(player: Player | undefined, amount: string, pair: unknown = 'EUR', side: unknown = 'buy'): Promise<FxQuote> {
  const d = fxDeployment();
  const { publicClient } = fxClients();
  const p = d.pairs[pairOf(pair)];
  const s = sideOf(side);
  const { tokenIn, tokenOut, zeroForOne } = legsOf(d, p, s);
  if (!/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0) throw fxError('FX_AMOUNT', `amount must be a positive decimal string, got ${amount}`);
  const amountIn = parseUnits(amount, tokenIn.decimals);
  if (amountIn > maxUint160) throw fxError('FX_AMOUNT', 'amount too large');
  const key = { currency0: p.pool.currency0, currency1: p.pool.currency1, fee: p.pool.fee, tickSpacing: p.pool.tickSpacing, hooks: p.pool.hooks };
  let amountOut: bigint;
  let gasEstimate: bigint;
  try {
    const sim = await publicClient.simulateContract({ address: d.uniswap.quoter, abi: quoterAbi, functionName: 'quoteExactInputSingle', args: [{ poolKey: key, zeroForOne, exactAmount: amountIn, hookData: '0x' }] });
    [amountOut, gasEstimate] = sim.result;
  } catch (e) {
    const msg = (e as Error).message.split('\n')[0];
    throw fxError('FX_QUOTE_FAILED', `V4Quoter refused ${amount} ${tokenIn.symbol} → ${tokenOut.symbol}: ${msg}`, 400);
  }
  if (amountOut === 0n) throw fxError('FX_QUOTE_FAILED', 'the pool returned nothing for that amount');
  const minOut = (amountOut * (10_000n - SLIPPAGE_BPS)) / 10_000n;
  const now = Math.floor(Date.now() / 1000);
  const deadline = now + QUOTE_TTL_SEC;
  const quoteId = randomUUID().slice(0, 8);
  quotes.set(quoteId, { player: player?.privyUserId ?? 'anon', pair: p.pair, side: s, amountIn, minOut, deadline });
  for (const [id, q] of quotes) if (q.deadline + 60 < now) quotes.delete(id);
  const out = formatUnits(amountOut, tokenOut.decimals);
  const perOne = Number(out) / Number(amount);
  return {
    quoteId,
    chainId: d.chainId,
    pair: p.pair,
    side: s,
    amountIn: amount,
    amountOut: trim(out),
    minOut: trim(formatUnits(minOut, tokenOut.decimals)),
    rate: `1 ${tokenIn.symbol} ≈ ${perOne.toFixed(4)} ${tokenOut.symbol}`,
    rateOut: perOne > 0 ? `1 ${tokenOut.symbol} ≈ ${(1 / perOne).toFixed(4)} ${tokenIn.symbol}` : '—',
    symbolIn: tokenIn.symbol,
    symbolOut: tokenOut.symbol,
    fee: `${(p.pool.fee / 10_000).toFixed(2)}%`,
    slippage: `${Number(SLIPPAGE_BPS) / 100}%`,
    deadline: String(deadline),
    serverNow: String(now),
    validSec: QUOTE_TTL_SEC,
    gasEstimate: gasEstimate.toString(),
    poolId: p.pool.id,
  };
}

function trim(s: string): string {
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
}

export interface FxSwapResult {
  account: Address;
  chainId: number;
  pair: FxPair;
  side: FxSide;
  amountIn: string;
  amountOut: string;
  minOut: string;
  symbolIn: string;
  symbolOut: string;
  /** Meta-transaction hashes in order: approve (Permit2), Permit2.approve (router), execute — the first two only when needed. */
  steps: Array<{ step: 'approve' | 'permit2' | 'execute'; hash: Hex; explorer: string }>;
  hash: Hex;
  explorer: string;
  usdcAfter: string;
  /** The bought currency's balance after the fill. */
  outAfter: string;
  eurAfter: string;
  ilsAfter: string;
  poolId: Hex;
  deadline: string;
  fee?: string;
}

/**
 * The swap. Three guarded calls the first time a currency is sold, one afterwards. Refuses a stale quote
 * (`FX_QUOTE_EXPIRED`) rather than re-pricing silently; refuses without spending when the till is short of the **sold**
 * currency (`FX_TILL_SHORT`) or not open (`FX_NOT_ENABLED`). Pair and side come from the quote when there is one; a
 * bare amount needs `pair` (and `side`, default `buy`) beside it. A quote taken with the other pair or the other side
 * is refused (`FX_PAIR` / `FX_SIDE`) — the player agreed to *that* trade, not its mirror.
 */
export async function swap(player: Player, quoteId: string | undefined, amount: string | undefined, jobId: string, audit?: AuditSink, pair?: unknown, side?: unknown): Promise<FxSwapResult> {
  await maybeTopUp('pre-fx-swap');
  const d = fxDeployment();
  const { publicClient } = fxClients();
  const till = await tillFor(player);
  if (!(await fxEnabled(till))) throw fxError('FX_NOT_ENABLED', `the exchange door is not fully registered on ${till} — Johnny opens (or heals) the till first (/fx/enable)`, 409);
  let current = await ensureFxPolicy(player, till);

  const now = Math.floor(Date.now() / 1000);
  let q = quoteId ? quotes.get(quoteId) : undefined;
  if (quoteId && !q) throw fxError('FX_QUOTE_EXPIRED', `quote ${quoteId} is not on the board any more`, 409);
  if (q && q.deadline <= now) throw fxError('FX_QUOTE_EXPIRED', `quote ${quoteId} expired at ${q.deadline}`, 409);
  if (q && pair !== undefined && pair !== '' && pairOf(pair) !== q.pair) throw fxError('FX_PAIR', `quote ${quoteId} is for ${q.pair}, not ${String(pair)}`, 409);
  if (q && side !== undefined && side !== '' && sideOf(side) !== q.side) throw fxError('FX_SIDE', `quote ${quoteId} is a ${q.side}, not a ${String(side)}`, 409);
  if (!q) {
    if (!amount) throw fxError('FX_AMOUNT', 'a quoteId or an amount is required');
    const fresh = await quote(current, amount, pairOf(pair), sideOf(side));
    q = quotes.get(fresh.quoteId)!;
    quoteId = fresh.quoteId;
  }
  const p = d.pairs[q.pair];
  const { tokenIn, tokenOut, zeroForOne } = legsOf(d, p, q.side);
  const { amountIn, minOut } = q;
  const deadline = BigInt(q.deadline);
  const balance = await readFx(() => publicClient.readContract({ address: tokenIn.address, abi: erc20, functionName: 'balanceOf', args: [till] }));
  if (balance < amountIn) {
    // Deliberately not the protocol's `InsufficientBalance`: that code's bank line sends the player to Iris, and
    // Iris's faucet tops up practice *dollars* — not euros, and not a Developer-Mode till. Same refusal, honest signpost.
    throw Object.assign(new Error(`the FX till holds ${formatUnits(balance, tokenIn.decimals)} ${tokenIn.symbol}; the order needs ${formatUnits(amountIn, tokenIn.decimals)}`), { statusCode: 400, code: 'FX_TILL_SHORT' });
  }
  const outBefore = await readFx(() => publicClient.readContract({ address: tokenOut.address, abi: erc20, functionName: 'balanceOf', args: [till] }));
  const steps: FxSwapResult['steps'] = [];
  const link = (h: Hex) => `${d.explorer}/tx/${h}`;
  const inWord = tokenIn.symbol === d.usdc.symbol ? 'dollar' : tokenIn.symbol;

  // 1. sold token → Permit2 (once per currency). The `approve` whitelist carries USD, EUR and ILS, so a sell approves the fiat.
  const allowance = await readFx(() => publicClient.readContract({ address: tokenIn.address, abi: erc20, functionName: 'allowance', args: [till, d.uniswap.permit2] }));
  if (allowance < amountIn) {
    stage(current, jobId, 'signing', `Preparing the ${inWord} payment at the exchange…`);
    const h = await guardedCall(current, till, FX_FUNCTIONS[0], tokenIn.address, encodeFunctionData({ abi: erc20, functionName: 'approve', args: [d.uniswap.permit2, maxUint256] }), audit);
    steps.push({ step: 'approve', hash: h, explorer: link(h) });
    stage(current, jobId, 'broadcasting', `The exchange has the ${inWord} payment on file.`, { hash: h });
  }
  // 2. Permit2 → router (once per currency, with an expiry) — Permit2 allowances are per (owner, token, spender)
  const [p2Amount, p2Exp] = await readFx(() => publicClient.readContract({ address: d.uniswap.permit2, abi: permit2Abi, functionName: 'allowance', args: [till, tokenIn.address, d.uniswap.universalRouter] }));
  if (p2Amount < amountIn || BigInt(p2Exp) <= deadline) {
    stage(current, jobId, 'signing', "Setting the trade's spending limit…");
    const h = await guardedCall(current, till, FX_FUNCTIONS[1], d.uniswap.permit2, encodeFunctionData({ abi: permit2Abi, functionName: 'approve', args: [tokenIn.address, d.uniswap.universalRouter, maxUint160, now + PERMIT2_EXPIRY_SEC] }), audit);
    steps.push({ step: 'permit2', hash: h, explorer: link(h) });
    stage(current, jobId, 'broadcasting', 'The exchange spending limit is on file.', { hash: h });
  }
  // 3. the swap: UniversalRouter.execute(V4_SWAP: SWAP_EXACT_IN_SINGLE → SETTLE_ALL → TAKE_ALL).
  //    `zeroForOne` and the settle/take currencies follow the pool's address sort *and* the side: a buy settles USD and
  //    takes fiat; a sell settles fiat and takes USD. USD happens to be currency1 in both fiat pools — derived, not assumed.
  const key = { currency0: p.pool.currency0, currency1: p.pool.currency1, fee: p.pool.fee, tickSpacing: p.pool.tickSpacing, hooks: p.pool.hooks };
  const commands = encodePacked(['uint8'], [CMD_V4_SWAP]);
  const actions = encodePacked(['uint8', 'uint8', 'uint8'], [ACT_SWAP_EXACT_IN_SINGLE, ACT_SETTLE_ALL, ACT_TAKE_ALL]);
  const swapParams = encodeAbiParameters(parseAbiParameters(`(${POOL_KEY_TUPLE} poolKey, bool zeroForOne, uint128 amountIn, uint128 amountOutMinimum, bytes hookData)`), [
    { poolKey: key, zeroForOne, amountIn, amountOutMinimum: minOut, hookData: '0x' },
  ]);
  const settleParams = encodeAbiParameters(parseAbiParameters('address, uint256'), [tokenIn.address, amountIn]);
  const takeParams = encodeAbiParameters(parseAbiParameters('address, uint256'), [tokenOut.address, minOut]);
  const inputs = [encodeAbiParameters(parseAbiParameters('bytes, bytes[]'), [actions, [swapParams, settleParams, takeParams]])];
  const calldata = encodeFunctionData({ abi: routerAbi, functionName: 'execute', args: [commands, inputs, deadline] });
  // Pre-flight the router call *as the till* so a bad quote or thin pool is refused before a meta-transaction is spent.
  try {
    await publicClient.call({ account: till, to: d.uniswap.universalRouter, data: calldata });
  } catch (e) {
    const why = explainRevert(e);
    const text = `${(e as Error).message}`;
    const code = /V4TooLittleReceived|TooLittleReceived/.test(text) ? 'FX_SLIPPAGE' : /DeadlinePassed|TransactionDeadlinePassed/.test(text) ? 'FX_QUOTE_EXPIRED' : 'FX_ROUTER';
    throw Object.assign(new Error(`router pre-flight refused: ${why.message}`), { statusCode: 400, code });
  }
  stage(current, jobId, 'signing', `Placing the ${formatUnits(amountIn, tokenIn.decimals)} ${tokenIn.symbol} → ${tokenOut.symbol} trade through the exchange…`);
  const hash = await guardedCall(current, till, FX_FUNCTIONS[2], d.uniswap.universalRouter, calldata, audit);
  steps.push({ step: 'execute', hash, explorer: link(hash) });

  const [usdcAfter, eurAfter, ilsAfter] = await readFx(() =>
    Promise.all([
      publicClient.readContract({ address: d.usdc.address, abi: erc20, functionName: 'balanceOf', args: [till] }),
      publicClient.readContract({ address: d.pairs.EUR.token.address, abi: erc20, functionName: 'balanceOf', args: [till] }),
      publicClient.readContract({ address: d.pairs.ILS.token.address, abi: erc20, functionName: 'balanceOf', args: [till] }),
    ]),
  );
  const outAfter = tokenOut.address === d.usdc.address ? usdcAfter : p.pair === 'EUR' ? eurAfter : ilsAfter;
  const received = outAfter - outBefore;
  let fee: string | undefined;
  try {
    const r = await publicClient.getTransactionReceipt({ hash });
    fee = `${formatUnits(r.gasUsed * r.effectiveGasPrice, 18)} ETH`;
  } catch {
    /* receipt fee is decoration */
  }
  current = patchPlayer(current.privyUserId, { fxConfigured: true });
  const amountOutText = trim(formatUnits(received, tokenOut.decimals));
  stage(current, jobId, 'mined', `Swapped ${formatUnits(amountIn, tokenIn.decimals)} ${tokenIn.symbol} for ${amountOutText} ${tokenOut.symbol}.`, { hash, account: till, fee });
  if (quoteId) quotes.delete(quoteId);
  return {
    account: till,
    chainId: d.chainId,
    pair: p.pair,
    side: q.side,
    amountIn: formatUnits(amountIn, tokenIn.decimals),
    amountOut: amountOutText,
    minOut: trim(formatUnits(minOut, tokenOut.decimals)),
    symbolIn: tokenIn.symbol,
    symbolOut: tokenOut.symbol,
    steps,
    hash,
    explorer: link(hash),
    usdcAfter: formatUnits(usdcAfter, d.usdc.decimals),
    outAfter: formatUnits(outAfter, tokenOut.decimals),
    eurAfter: formatUnits(eurAfter, d.pairs.EUR.token.decimals),
    ilsAfter: formatUnits(ilsAfter, d.pairs.ILS.token.decimals),
    poolId: p.pool.id,
    deadline: String(deadline),
    fee,
  };
}

/**
 * Kill-test helper (K7 "wrong door"): ask the till to call `execute` on a contract that is **not** whitelisted. The
 * guard must refuse with `TargetNotWhitelisted` before anything moves. Exported for `scripts/kill-tests-s1.ts` only.
 */
export async function swapThroughWrongRouter(player: Player, wrongRouter: Address, audit?: AuditSink): Promise<Hex> {
  const d = fxDeployment();
  const till = await tillFor(player);
  const calldata = encodeFunctionData({ abi: routerAbi, functionName: 'execute', args: [encodePacked(['uint8'], [CMD_V4_SWAP]), [], BigInt(Math.floor(Date.now() / 1000) + 300)] });
  return guardedCall(player, till, FX_FUNCTIONS[2], wrongRouter, calldata, audit);
}

/** Kill-test rig only: the Sepolia clients this module built (chain, public client, broadcaster address). */
export { fxClients as _fxClients };
