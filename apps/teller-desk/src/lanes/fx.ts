/**
 * S1 — the FX desk: a Uniswap v4 swap executed **by the player's AccountBlox** on Sepolia, through GuardController.
 *
 * What makes this a bank operation rather than a swap UI (docs/UNISWAP.md §3): the account, not the player's wallet,
 * is `msg.sender` to Permit2 and to the Universal Router, and it may only call the three functions the FX guard batch
 * registered and whitelisted —
 *
 *     demoUSDC.approve(address,uint256)                    → Permit2 may pull the account's practice dollars
 *     Permit2.approve(address,address,uint160,uint48)      → the Universal Router may spend them, once, with an expiry
 *     UniversalRouter.execute(bytes,bytes[],uint256)       → the V4_SWAP itself
 *
 * — each as a Lane A meta-transaction: the owner's session signer signs (silently, the same `SIGN_META_REQUEST_AND_APPROVE`
 * action the counter uses), the Sepolia broadcaster submits `requestAndApproveExecution`. Nothing Kenji says can make
 * the account talk to any other contract or function: a wrong router is `TargetNotWhitelisted`, a wrong selector has
 * no schema. The first swap is three meta-transactions; later ones are one, because the two approvals are read back
 * from the chain and skipped while they still cover the amount.
 *
 * Like `ens.ts`, this is a lazy Sepolia module inside the Main-wing Teller Desk: payments and the vault stay on Remote
 * EVM 1337; only the FX till lives on Sepolia. Everything Uniswap is hand-encoded with viem from the published
 * v4-periphery / universal-router encodings — no Uniswap npm package (REFLECTION §8). Pool + addresses come from
 * infra/deployments/sepolia.json (`infra/scripts/uniswap-pool.ts`).
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
  GuardController,
  GuardConfigActionType,
  GUARD_CONTROLLER_FUNCTION_SELECTORS as GC_SEL,
  GUARD_CONTROLLER_OPERATION_TYPES as GC_OP,
  RoleConfigActionType,
  RuntimeRBAC,
  RUNTIME_RBAC_FUNCTION_SELECTORS as RB_SEL,
  RUNTIME_RBAC_OPERATION_TYPES as RB_OP,
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
import { explainRevert } from './laneB.ts';
import { BROADCASTER_ROLE, OWNER_ROLE } from './provision.ts';

// ---------------------------------------------------------------- constants (read from the published sources 2026-09-08)

/** universal-router `Commands.V4_SWAP`. */
const CMD_V4_SWAP = 0x10;
/** v4-periphery `Actions`. */
const ACT_SWAP_EXACT_IN_SINGLE = 0x06;
const ACT_SETTLE_ALL = 0x0c;
const ACT_TAKE_ALL = 0x0f;

/** Slippage Kenji quotes with (docs/UNISWAP.md §3.3) and how long a quote stays on the board. */
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

/** The three guarded functions, in bank order. `signature` is what `registerFunctionSchema` stores. */
export const FX_FUNCTIONS = [
  { key: 'approve', signature: 'approve(address,uint256)', operation: 'ERC20_APPROVE', gas: 80_000n },
  { key: 'permit2', signature: 'approve(address,address,uint160,uint48)', operation: 'PERMIT2_APPROVE', gas: 90_000n },
  { key: 'execute', signature: 'execute(bytes,bytes[],uint256)', operation: 'UNISWAP_V4_SWAP', gas: 350_000n },
] as const;
export const FX_SELECTORS = Object.fromEntries(FX_FUNCTIONS.map((f) => [f.key, toFunctionSelector(`function ${f.signature}`)])) as Record<(typeof FX_FUNCTIONS)[number]['key'], Hex>;
const FX_ACTIONS = [TxAction.SIGN_META_REQUEST_AND_APPROVE, TxAction.EXECUTE_META_REQUEST_AND_APPROVE];

/**
 * Outer transaction gas limits (see `enableFx`). Refunded when unused; they only have to be *enough* and to fit
 * `gas × maxFeePerGas ≤ teller balance`. Base is the meta-transaction machinery, `perAction` the batch content.
 */
const OUTER_GAS = {
  /** Guard batch: 6 actions (3 `registerFunctionSchema` + 3 whitelist) measured at 2,989,417 on Sepolia. */
  guard: (n: bigint) => 800_000n + 420_000n * n,
  /** Role batch: 6 `addFunctionToRole` grants measured at 2,143,997. */
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
 * What the teller can actually pay for, in gas. `want` is the honest ceiling for the call; when the balance cannot
 * cover it we send what it can (98 %, leaving room for the fee to tick up) rather than refusing — an out-of-gas
 * revert names the real problem, where viem's balance error only says "insufficient funds".
 */
async function budget(want: bigint): Promise<bigint> {
  const { publicClient, broadcasterAddress } = fxClients();
  const [balance, f] = await Promise.all([publicClient.getBalance({ address: broadcasterAddress }), fees()]);
  const affordable = ((balance / f.maxFeePerGas) * 98n) / 100n;
  if (affordable >= want) return want;
  if (affordable < 200_000n) {
    throw fxError('FX_TELLER_DRY', `the FX teller ${broadcasterAddress} holds ${formatUnits(balance, 18)} ETH — not enough Sepolia gas for one guarded call (needs ~${formatUnits(want * f.maxFeePerGas, 18)} ETH)`, 503);
  }
  console.warn(`[fx] teller can only fund ${affordable} of ${want} gas — sending the smaller limit`);
  return affordable;
}

// ---------------------------------------------------------------- deployment + clients (lazy, like ens.ts)

interface PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

export interface FxDeployment {
  chainId: number;
  guardDefinitions: Address;
  rbacDefinitions: Address;
  uniswap: { poolManager: Address; universalRouter: Address; quoter: Address; stateView: Address; permit2: Address };
  pool: PoolKey & { id: Hex };
  usdc: { address: Address; symbol: string; decimals: number };
  weth: { address: Address; symbol: string; decimals: number };
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
  if (!u?.pool?.id || !raw.libraries?.GuardControllerDefinitions || !raw.tokens?.demoUsdc) {
    throw fxError('FX_NOT_CONFIGURED', 'sepolia.json has no uniswap pool / Bloxchain libraries yet — run chain:deploy --chain sepolia and infra fx:pool', 503);
  }
  const cb = raw.applications?.CopyBlox;
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
    pool: { id: u.pool.id as Hex, currency0: addr(u.pool.currency0, 'currency0'), currency1: addr(u.pool.currency1, 'currency1'), fee: Number(u.pool.fee), tickSpacing: Number(u.pool.tickSpacing), hooks: addr(u.pool.hooks, 'hooks') },
    usdc: { address: addr(raw.tokens.demoUsdc.address, 'demoUsdc'), symbol: String(raw.tokens.demoUsdc.symbol ?? 'USDC'), decimals: Number(raw.tokens.demoUsdc.decimals ?? 6) },
    weth: { address: addr(raw.tokens.weth?.address, 'weth'), symbol: String(raw.tokens.weth?.symbol ?? 'WETH'), decimals: Number(raw.tokens.weth?.decimals ?? 18) },
    fixtures: ((raw.accounts ?? []) as Array<{ label: string; address: string; owner: string }>).map((a) => ({ label: a.label, address: getAddress(a.address), owner: getAddress(a.owner) })),
    copyBlox: cb?.address ? { address: addr(cb.address, 'CopyBlox'), deployedAtBlock: BigInt(cb.deployedAtBlock ?? 0), implementation: addr(cb.cloneImplementation ?? raw.accounts?.[0]?.address, 'cloneImplementation') } : undefined,
    explorer: 'https://sepolia.etherscan.io',
  };
  if (deployment.pool.currency0 !== deployment.usdc.address) throw fxError('FX_NOT_CONFIGURED', 'pool currency0 is not the demo USDC — the desk swaps zeroForOne', 503);
  return deployment;
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
  const frugal = (w: WalletClient): WalletClient =>
    new Proxy(w, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (prop !== 'writeContract' && prop !== 'sendTransaction') return value;
        return async (args: Record<string, unknown>) => {
          const priced = args.maxFeePerGas || args.gasPrice ? args : { ...args, ...(await fees()) };
          return (value as (a: unknown) => unknown).call(target, priced);
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
 * Which Sepolia AccountBlox is this player's. Order of trust: the player record; an infra fixture whose owner is the
 * player's Privy wallet (the rig's till); a CopyBlox clone found by `BloxCloned` log; a fresh clone if CopyBlox is on
 * Sepolia and the FX deployer is funded. Otherwise the till is honestly closed (`FX_TILL_CLOSED`) — the operator's
 * continuation is in docs/UNISWAP.md §5.
 */
export async function tillFor(player: Player, open = false, jobId?: string): Promise<Address> {
  if (player.fxAccount) return player.fxAccount;
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
  const opts = { from: broadcasterAddress, gas: await budget(outerGas) };
  const res = kind === 'guard' ? await (ctl as GuardController).guardConfigBatchRequestAndApprove(signed, opts) : await (ctl as RuntimeRBAC).roleConfigBatchRequestAndApprove(signed, opts);
  const receipt = await res.wait();
  if (receipt.status !== 'success') throw fxError('FX_TX_FAILED', `${kind} config batch reverted (${res.hash})`);
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
    res = await gc.requestAndApproveExecution(signed, { from: broadcasterAddress, gas: await budget(OUTER_GAS.call(fn.gas)) });
  } catch (e) {
    const why = explainRevert(e);
    throw Object.assign(new Error(`${fn.key}: ${why.message}`), { statusCode: 400, code: why.code, bankLine: why.bankLine });
  }
  const receipt = await res.wait();
  if (receipt.status !== 'success') throw fxError('FX_TX_FAILED', `${fn.key} meta-transaction reverted (${res.hash})`);
  return res.hash as Hex;
}

// ---------------------------------------------------------------- opening the till: guard schemas + whitelist + role grants

export interface FxEnableResult {
  account: Address;
  chainId: number;
  guardHash?: Hex;
  roleHash?: Hex;
  actions: string[];
  whitelist: Array<{ function: string; selector: Hex; target: Address }>;
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
 */
export async function enableFx(player: Player, jobId: string, audit?: AuditSink): Promise<FxEnableResult> {
  const d = fxDeployment();
  const { publicClient, chain, broadcaster } = fxClients();
  const till = await tillFor(player, true, jobId);
  let current = await ensureFxPolicy(player, till);

  const targets: Record<(typeof FX_FUNCTIONS)[number]['key'], Address> = { approve: d.usdc.address, permit2: d.uniswap.permit2, execute: d.uniswap.universalRouter };
  const gc = new GuardController(publicClient, broadcaster, till, chain);
  const rbac = new RuntimeRBAC(publicClient, broadcaster, till, chain);
  const actions: string[] = [];

  stage(current, jobId, 'configuring', 'Registering the exchange door on your account…');
  const supported = new Set((await readFx(() => gc.getSupportedFunctions())).map((s) => s.toLowerCase()));
  const guardActions: Array<{ actionType: GuardConfigActionType; data: Hex }> = [];
  for (const fn of FX_FUNCTIONS) {
    const selector = FX_SELECTORS[fn.key];
    if (!supported.has(selector.toLowerCase())) {
      guardActions.push({ actionType: GuardConfigActionType.REGISTER_FUNCTION, data: encodeRegisterFunction(publicClient, d.guardDefinitions, fn.signature, fn.operation, FX_ACTIONS) });
      actions.push(`REGISTER_FUNCTION ${fn.signature} as ${fn.operation}`);
    }
    const listed = supported.has(selector.toLowerCase()) ? await readFx(() => gc.getFunctionWhitelistTargets(selector).catch(() => [] as Address[])) : [];
    if (!listed.some((a) => a.toLowerCase() === targets[fn.key].toLowerCase())) {
      guardActions.push({ actionType: GuardConfigActionType.ADD_TARGET_TO_WHITELIST, data: encodeAddTargetToWhitelist(publicClient, d.guardDefinitions, selector, targets[fn.key]) });
      actions.push(`ADD_TARGET_TO_WHITELIST ${fn.key} → ${targets[fn.key]}`);
    }
  }
  let guardHash: Hex | undefined;
  if (guardActions.length) {
    const n = BigInt(guardActions.length);
    guardHash = await ownerSignedBatch(current, till, 'guard', guardConfigBatchExecutionParams(publicClient, d.guardDefinitions, guardActions), 240_000n * n + 200_000n, OUTER_GAS.guard(n), audit);
    stage(current, jobId, 'configuring', 'Exchange door registered: three functions, three addresses.', { hash: guardHash });
  }

  stage(current, jobId, 'configuring', 'Authorising you to sign and the FX teller to submit…');
  const roleActions: Array<{ actionType: RoleConfigActionType; data: Hex }> = [];
  for (const [role, roleName, action, actionName, handler] of [
    [OWNER_ROLE, 'OWNER', TxAction.SIGN_META_REQUEST_AND_APPROVE, 'SIGN_META_REQUEST_AND_APPROVE', GC_SEL.REQUEST_AND_APPROVE_EXECUTION_SELECTOR],
    [BROADCASTER_ROLE, 'BROADCASTER', TxAction.EXECUTE_META_REQUEST_AND_APPROVE, 'EXECUTE_META_REQUEST_AND_APPROVE', GC_SEL.REQUEST_AND_APPROVE_EXECUTION_SELECTOR],
  ] as const) {
    const existing = (await readFx(() => rbac.getActiveRolePermissions(role))) as Array<{ functionSelector: Hex; grantedActionsBitmap: number | bigint }>;
    for (const fn of FX_FUNCTIONS) {
      const selector = FX_SELECTORS[fn.key];
      const want = toContractValue(createBitmapFromActions([action]));
      const cur = existing.find((e) => e.functionSelector.toLowerCase() === selector.toLowerCase());
      if (cur && Number(cur.grantedActionsBitmap) === want) continue;
      if (cur) continue; // a different grant already exists on this selector; never REMOVE from a role here
      roleActions.push({ actionType: RoleConfigActionType.ADD_FUNCTION_TO_ROLE, data: encodeAddFunctionToRole(publicClient, d.rbacDefinitions, role, { functionSelector: selector, grantedActionsBitmap: want, handlerForSelectors: [handler] }) });
      actions.push(`ADD ${fn.key} to ${roleName} (${actionName})`);
    }
  }
  let roleHash: Hex | undefined;
  if (roleActions.length) {
    const n = BigInt(roleActions.length);
    roleHash = await ownerSignedBatch(current, till, 'role', roleConfigBatchExecutionParams(publicClient, d.rbacDefinitions, roleActions), 260_000n * n + 200_000n, OUTER_GAS.role(n), audit);
    stage(current, jobId, 'configuring', 'FX desk authorised.', { hash: roleHash });
  }

  current = patchPlayer(current.privyUserId, { fxAccount: till, fxConfigured: true });
  stage(current, jobId, 'mined', guardHash || roleHash ? 'Your FX till is open.' : 'Your FX till was already open.', { account: till, ...(roleHash ?? guardHash ? { hash: roleHash ?? guardHash } : {}) });
  return { account: till, chainId: d.chainId, guardHash, roleHash, actions, whitelist: FX_FUNCTIONS.map((fn) => ({ function: fn.signature, selector: FX_SELECTORS[fn.key], target: targets[fn.key] })) };
}

/** Is the till open on chain? Read, not remembered — a restart or a foreign Re-check cannot lie about it. */
export async function fxEnabled(till: Address): Promise<boolean> {
  const d = fxDeployment();
  const { publicClient, chain, broadcaster } = fxClients();
  const gc = new GuardController(publicClient, broadcaster, till, chain);
  const supported = new Set((await readFx(() => gc.getSupportedFunctions())).map((s) => s.toLowerCase()));
  if (!Object.values(FX_SELECTORS).every((s) => supported.has(s.toLowerCase()))) return false;
  const listed = await readFx(() => gc.getFunctionWhitelistTargets(FX_SELECTORS.execute).catch(() => [] as Address[]));
  return listed.some((a) => a.toLowerCase() === d.uniswap.universalRouter.toLowerCase());
}

// ---------------------------------------------------------------- status, quote, swap

export interface FxStatus {
  chainId: number;
  configured: boolean;
  account: Address | null;
  enabled: boolean;
  usdc: string;
  weth: string;
  symbolIn: string;
  symbolOut: string;
  pool: { id: Hex; fee: string; feeBps: number; tick?: number; liquidity?: string; router: Address; quoter: Address };
  whitelist: Array<{ function: string; selector: Hex; target: Address }>;
  explorer: { account?: string; pool: string };
  serverNow: string;
}

export async function fxStatus(player: Player): Promise<FxStatus> {
  const d = fxDeployment();
  const { publicClient } = fxClients();
  const serverNow = String(Math.floor(Date.now() / 1000));
  const whitelist = FX_FUNCTIONS.map((fn) => ({ function: fn.signature, selector: FX_SELECTORS[fn.key], target: { approve: d.usdc.address, permit2: d.uniswap.permit2, execute: d.uniswap.universalRouter }[fn.key] }));
  const [slot0, liquidity] = await readFx(() =>
    Promise.all([
      publicClient.readContract({ address: d.uniswap.stateView, abi: stateViewAbi, functionName: 'getSlot0', args: [d.pool.id] }),
      publicClient.readContract({ address: d.uniswap.stateView, abi: stateViewAbi, functionName: 'getLiquidity', args: [d.pool.id] }),
    ]),
  );
  const pool = { id: d.pool.id, fee: `${(d.pool.fee / 10_000).toFixed(2)}%`, feeBps: d.pool.fee / 100, tick: Number(slot0[1]), liquidity: liquidity.toString(), router: d.uniswap.universalRouter, quoter: d.uniswap.quoter };
  let till: Address | undefined;
  try {
    till = await tillFor(player);
  } catch (e) {
    if ((e as { code?: string }).code !== 'FX_TILL_CLOSED') throw e;
  }
  if (!till) {
    return { chainId: d.chainId, configured: true, account: null, enabled: false, usdc: '0', weth: '0', symbolIn: d.usdc.symbol, symbolOut: d.weth.symbol, pool, whitelist, explorer: { pool: `${d.explorer}/address/${d.uniswap.poolManager}` }, serverNow };
  }
  const [usdc, weth, enabled] = await readFx(() =>
    Promise.all([
      publicClient.readContract({ address: d.usdc.address, abi: erc20, functionName: 'balanceOf', args: [till!] }),
      publicClient.readContract({ address: d.weth.address, abi: erc20, functionName: 'balanceOf', args: [till!] }),
      fxEnabled(till!),
    ]),
  );
  if (enabled !== Boolean(player.fxConfigured)) patchPlayer(player.privyUserId, { fxConfigured: enabled });
  return {
    chainId: d.chainId,
    configured: true,
    account: till,
    enabled,
    usdc: formatUnits(usdc, d.usdc.decimals),
    weth: formatUnits(weth, d.weth.decimals),
    symbolIn: d.usdc.symbol,
    symbolOut: d.weth.symbol,
    pool,
    whitelist,
    explorer: { account: `${d.explorer}/address/${till}`, pool: `${d.explorer}/address/${d.uniswap.poolManager}` },
    serverNow,
  };
}

export interface FxQuote {
  quoteId: string;
  chainId: number;
  amountIn: string;
  amountOut: string;
  minOut: string;
  /** "1 USDC ≈ 0.000487 WETH" */
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

const quotes = new Map<string, { player: string; amountIn: bigint; minOut: bigint; deadline: number }>();

/** Kenji's board: V4Quoter.quoteExactInputSingle by `eth_call`, minus 1 % slippage, good for five minutes. */
export async function quote(player: Player | undefined, amount: string): Promise<FxQuote> {
  const d = fxDeployment();
  const { publicClient } = fxClients();
  if (!/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0) throw fxError('FX_AMOUNT', `amount must be a positive decimal string, got ${amount}`);
  const amountIn = parseUnits(amount, d.usdc.decimals);
  if (amountIn > maxUint160) throw fxError('FX_AMOUNT', 'amount too large');
  const key = { currency0: d.pool.currency0, currency1: d.pool.currency1, fee: d.pool.fee, tickSpacing: d.pool.tickSpacing, hooks: d.pool.hooks };
  let amountOut: bigint;
  let gasEstimate: bigint;
  try {
    const sim = await publicClient.simulateContract({ address: d.uniswap.quoter, abi: quoterAbi, functionName: 'quoteExactInputSingle', args: [{ poolKey: key, zeroForOne: true, exactAmount: amountIn, hookData: '0x' }] });
    [amountOut, gasEstimate] = sim.result;
  } catch (e) {
    const msg = (e as Error).message.split('\n')[0];
    throw fxError('FX_QUOTE_FAILED', `V4Quoter refused ${amount} ${d.usdc.symbol}: ${msg}`, 400);
  }
  if (amountOut === 0n) throw fxError('FX_QUOTE_FAILED', 'the pool returned nothing for that amount');
  const minOut = (amountOut * (10_000n - SLIPPAGE_BPS)) / 10_000n;
  const now = Math.floor(Date.now() / 1000);
  const deadline = now + QUOTE_TTL_SEC;
  const quoteId = randomUUID().slice(0, 8);
  quotes.set(quoteId, { player: player?.privyUserId ?? 'anon', amountIn, minOut, deadline });
  for (const [id, q] of quotes) if (q.deadline + 60 < now) quotes.delete(id);
  const out = formatUnits(amountOut, d.weth.decimals);
  const perOne = Number(out) / Number(amount);
  return {
    quoteId,
    chainId: d.chainId,
    amountIn: amount,
    amountOut: trim(out),
    minOut: trim(formatUnits(minOut, d.weth.decimals)),
    rate: `1 ${d.usdc.symbol} ≈ ${perOne.toPrecision(4)} ${d.weth.symbol}`,
    rateOut: perOne > 0 ? `1 ${d.weth.symbol} ≈ ${(1 / perOne).toFixed(2)} ${d.usdc.symbol}` : '—',
    symbolIn: d.usdc.symbol,
    symbolOut: d.weth.symbol,
    fee: `${(d.pool.fee / 10_000).toFixed(2)}%`,
    slippage: `${Number(SLIPPAGE_BPS) / 100}%`,
    deadline: String(deadline),
    serverNow: String(now),
    validSec: QUOTE_TTL_SEC,
    gasEstimate: gasEstimate.toString(),
    poolId: d.pool.id,
  };
}

function trim(s: string): string {
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
}

export interface FxSwapResult {
  account: Address;
  chainId: number;
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
  wethAfter: string;
  poolId: Hex;
  deadline: string;
  fee?: string;
}

/**
 * The swap. Three guarded calls the first time, one afterwards. Refuses a stale quote (`FX_QUOTE_EXPIRED`) rather than
 * re-pricing silently; refuses without spending when the till is short (`InsufficientBalance`) or not open (`FX_NOT_ENABLED`).
 */
export async function swap(player: Player, quoteId: string | undefined, amount: string | undefined, jobId: string, audit?: AuditSink): Promise<FxSwapResult> {
  const d = fxDeployment();
  const { publicClient } = fxClients();
  const till = await tillFor(player);
  if (!(await fxEnabled(till))) throw fxError('FX_NOT_ENABLED', `the exchange door is not registered on ${till} — Kenji opens the till first (/fx/enable)`, 409);
  let current = await ensureFxPolicy(player, till);

  const now = Math.floor(Date.now() / 1000);
  let q = quoteId ? quotes.get(quoteId) : undefined;
  if (quoteId && !q) throw fxError('FX_QUOTE_EXPIRED', `quote ${quoteId} is not on the board any more`, 409);
  if (q && q.deadline <= now) throw fxError('FX_QUOTE_EXPIRED', `quote ${quoteId} expired at ${q.deadline}`, 409);
  if (!q) {
    if (!amount) throw fxError('FX_AMOUNT', 'a quoteId or an amount is required');
    const fresh = await quote(current, amount);
    q = quotes.get(fresh.quoteId)!;
    quoteId = fresh.quoteId;
  }
  const { amountIn, minOut } = q;
  const deadline = BigInt(q.deadline);

  const balance = await readFx(() => publicClient.readContract({ address: d.usdc.address, abi: erc20, functionName: 'balanceOf', args: [till] }));
  if (balance < amountIn) {
    // Deliberately not the protocol's `InsufficientBalance`: that code's bank line sends the player to Ines, and
    // Ines's faucet tops up the Main-wing account on 1337, not this till on Sepolia. Same refusal, honest signpost.
    throw Object.assign(new Error(`the FX till holds ${formatUnits(balance, d.usdc.decimals)} ${d.usdc.symbol}; the order needs ${formatUnits(amountIn, d.usdc.decimals)}`), { statusCode: 400, code: 'FX_TILL_SHORT' });
  }
  const wethBefore = await readFx(() => publicClient.readContract({ address: d.weth.address, abi: erc20, functionName: 'balanceOf', args: [till] }));
  const steps: FxSwapResult['steps'] = [];
  const link = (h: Hex) => `${d.explorer}/tx/${h}`;

  // 1. token → Permit2 (once)
  const allowance = await readFx(() => publicClient.readContract({ address: d.usdc.address, abi: erc20, functionName: 'allowance', args: [till, d.uniswap.permit2] }));
  if (allowance < amountIn) {
    stage(current, jobId, 'signing', 'Letting the exchange counter draw practice dollars from your till (approve → Permit2)…');
    const h = await guardedCall(current, till, FX_FUNCTIONS[0], d.usdc.address, encodeFunctionData({ abi: erc20, functionName: 'approve', args: [d.uniswap.permit2, maxUint256] }), audit);
    steps.push({ step: 'approve', hash: h, explorer: link(h) });
    stage(current, jobId, 'broadcasting', 'Permit2 may now draw from the till.', { hash: h });
  }
  // 2. Permit2 → router (once, with an expiry)
  const [p2Amount, p2Exp] = await readFx(() => publicClient.readContract({ address: d.uniswap.permit2, abi: permit2Abi, functionName: 'allowance', args: [till, d.usdc.address, d.uniswap.universalRouter] }));
  if (p2Amount < amountIn || BigInt(p2Exp) <= deadline) {
    stage(current, jobId, 'signing', 'Allowing the Universal Router to spend them, with an expiry (Permit2.approve)…');
    const h = await guardedCall(current, till, FX_FUNCTIONS[1], d.uniswap.permit2, encodeFunctionData({ abi: permit2Abi, functionName: 'approve', args: [d.usdc.address, d.uniswap.universalRouter, maxUint160, now + PERMIT2_EXPIRY_SEC] }), audit);
    steps.push({ step: 'permit2', hash: h, explorer: link(h) });
    stage(current, jobId, 'broadcasting', 'Router allowance on file.', { hash: h });
  }
  // 3. the swap: UniversalRouter.execute(V4_SWAP: SWAP_EXACT_IN_SINGLE → SETTLE_ALL → TAKE_ALL)
  const key = { currency0: d.pool.currency0, currency1: d.pool.currency1, fee: d.pool.fee, tickSpacing: d.pool.tickSpacing, hooks: d.pool.hooks };
  const commands = encodePacked(['uint8'], [CMD_V4_SWAP]);
  const actions = encodePacked(['uint8', 'uint8', 'uint8'], [ACT_SWAP_EXACT_IN_SINGLE, ACT_SETTLE_ALL, ACT_TAKE_ALL]);
  const swapParams = encodeAbiParameters(parseAbiParameters(`(${POOL_KEY_TUPLE} poolKey, bool zeroForOne, uint128 amountIn, uint128 amountOutMinimum, bytes hookData)`), [
    { poolKey: key, zeroForOne: true, amountIn, amountOutMinimum: minOut, hookData: '0x' },
  ]);
  const settleParams = encodeAbiParameters(parseAbiParameters('address, uint256'), [d.pool.currency0, amountIn]);
  const takeParams = encodeAbiParameters(parseAbiParameters('address, uint256'), [d.pool.currency1, minOut]);
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
  stage(current, jobId, 'signing', `Swapping ${formatUnits(amountIn, d.usdc.decimals)} ${d.usdc.symbol} through the Universal Router…`);
  const hash = await guardedCall(current, till, FX_FUNCTIONS[2], d.uniswap.universalRouter, calldata, audit);
  steps.push({ step: 'execute', hash, explorer: link(hash) });

  const [usdcAfter, wethAfter] = await readFx(() =>
    Promise.all([
      publicClient.readContract({ address: d.usdc.address, abi: erc20, functionName: 'balanceOf', args: [till] }),
      publicClient.readContract({ address: d.weth.address, abi: erc20, functionName: 'balanceOf', args: [till] }),
    ]),
  );
  const received = wethAfter - wethBefore;
  let fee: string | undefined;
  try {
    const r = await publicClient.getTransactionReceipt({ hash });
    fee = `${formatUnits(r.gasUsed * r.effectiveGasPrice, 18)} ETH`;
  } catch {
    /* receipt fee is decoration */
  }
  current = patchPlayer(current.privyUserId, { fxConfigured: true });
  const amountOutText = trim(formatUnits(received, d.weth.decimals));
  stage(current, jobId, 'mined', `Swapped ${formatUnits(amountIn, d.usdc.decimals)} ${d.usdc.symbol} for ${amountOutText} ${d.weth.symbol}.`, { hash, account: till, fee });
  if (quoteId) quotes.delete(quoteId);
  return {
    account: till,
    chainId: d.chainId,
    amountIn: formatUnits(amountIn, d.usdc.decimals),
    amountOut: amountOutText,
    minOut: trim(formatUnits(minOut, d.weth.decimals)),
    symbolIn: d.usdc.symbol,
    symbolOut: d.weth.symbol,
    steps,
    hash,
    explorer: link(hash),
    usdcAfter: formatUnits(usdcAfter, d.usdc.decimals),
    wethAfter: formatUnits(wethAfter, d.weth.decimals),
    poolId: d.pool.id,
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
