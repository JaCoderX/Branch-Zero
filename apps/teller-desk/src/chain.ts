import { createPublicClient, createWalletClient, defineChain, http, parseGwei, type Address, type Chain, type PublicClient, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { ARC_TESTNET_CHAIN_ID, REMOTE_EVM_CHAIN_ID, SEPOLIA_CHAIN_ID, arcTestnetWithRpc, isGanacheParityAddress, remoteEvmWithRpc, sepoliaWithRpc } from '@branch-zero/shared';
import { config } from './config.ts';

/**
 * The Live wing runs on faucet money, so it does not bid like a mainnet.
 *
 * viem's default priority fee on Sepolia is ~1.5 gwei, and this wing's largest transaction is `cloneBlox` at
 * 16.78 M gas — a tip that size costs 0.025 ETH per account opened, half a day's faucet drop, purely to
 * outbid an empty mempool. Sepolia's base fee sits near 1 gwei and blocks are not full, so 0.05 gwei is ample
 * (`lanes/fx.ts` reached the same conclusion at 0.02 for its swaps). viem still pays `1.2 × base + tip`, so
 * this lowers the bid without risking a stuck transaction.
 */
const SEPOLIA_PRIORITY_FEE = parseGwei('0.05');

export const chain: Chain =
  config.chainId === ARC_TESTNET_CHAIN_ID
    ? arcTestnetWithRpc(config.rpcUrl)
    : config.chainId === SEPOLIA_CHAIN_ID
      ? defineChain({ ...sepoliaWithRpc(config.rpcUrl), fees: { defaultPriorityFee: SEPOLIA_PRIORITY_FEE } })
      : remoteEvmWithRpc(config.rpcUrl);

/** Fail closed if an operator points the service at the wrong network. */
const chainProbe = createPublicClient({ transport: http(config.rpcUrl) });
const configuredChainId = await chainProbe.getChainId();
if (configuredChainId !== config.chainId) {
  throw new Error(`Teller Desk RPC reports chainId ${configuredChainId}; expected ${config.chainId} (${config.target})`);
}

export const publicClient = createPublicClient({ chain, transport: http(config.rpcUrl) }) as PublicClient;

function wallet(pk: `0x${string}`, role: string): WalletClient {
  const account = privateKeyToAccount(pk);
  // Ganache-parity keys are public knowledge; a config slip that pointed this service at a public
  // network would drain them instantly. Fail closed rather than sign (docs/SECURITY-AND-KEYS.md).
  if (chain.id !== REMOTE_EVM_CHAIN_ID && isGanacheParityAddress(account.address)) {
    throw new Error(`Refusing to use ${role} ${account.address}: Ganache-parity key on chain ${chain.id}`);
  }
  return createWalletClient({ account, chain, transport: http(config.rpcUrl) });
}

/** Teller — executes what an owner signed and pays the gas. Cannot forge an owner signature. */
export const broadcaster = wallet(config.broadcasterPk, 'broadcaster');
/** Bank back office — clones accounts and funds them. Holds no role on a player's account after opening. */
export const deployer = wallet(config.deployerPk, 'deployer');

/**
 * Branch Manager (T3, optional) — holds the runtime `BRANCH_MANAGER` role on each player's account, which
 * lets it approve or cancel a time-locked wire directly. It can never start one and never sign for the owner.
 */
export const manager = config.managerPk ? wallet(config.managerPk, 'manager') : undefined;

export const broadcasterAddress = broadcaster.account!.address as Address;
export const deployerAddress = deployer.account!.address as Address;
export const managerAddress = manager?.account!.address as Address | undefined;

/** Chain time — the timestamp of the latest block. See `metaTxDuration` for why this is not "now". */
export async function chainNow(): Promise<bigint> {
  return (await publicClient.getBlock()).timestamp;
}

/** Meta-transaction validity window we actually want, in seconds. */
export const META_TX_TTL_SEC = 600n;

/**
 * How long a meta-transaction should be told to live (U2 finding).
 *
 * `createMetaTxParams(..., deadline, ...)` takes a **duration** and the contract returns
 * `block.timestamp + duration` — evaluated on the *latest* block, because it is a view. Remote EVM's
 * NethDev mines only when a transaction arrives, so between transactions the latest block's timestamp is
 * frozen while wall-clock time keeps running. Sit idle for longer than the TTL and every meta-tx is born
 * already expired: `eth_call` still passes (it replays against the stale block) but the mined transaction
 * reverts, because `validateDeadline` compares against the *new* block's timestamp.
 *
 * So the duration we pass is the drift plus the window we want: stale + (now - stale) + TTL = now + TTL.
 */
export async function metaTxDuration(ttlSec: bigint = META_TX_TTL_SEC): Promise<bigint> {
  const latest = await chainNow();
  const now = BigInt(Math.floor(Date.now() / 1000));
  return (now > latest ? now - latest : 0n) + ttlSec;
}

/** A block older than this is "stale" for the purpose of time-dependent pre-flight checks. */
const TICK_STALENESS_SEC = 2n;

/**
 * Advance the chain clock before a time-dependent call (U2).
 *
 * The frozen-block problem cuts both ways. A meta-tx deadline computed from a stale block is born expired
 * (`metaTxDuration` handles that); and a wire whose `releaseTime` has genuinely passed in wall time still
 * looks "still cooling" to anything replayed against the stale block — which is exactly what the SDK's
 * pre-flight `simulateContract` and viem's `eth_estimateGas` do. The result is an approval that is refused
 * before it is ever sent, on a chain where sending it would have worked.
 *
 * So before a vault operation we mine one empty block by sending the broadcaster a 0-value self-transfer
 * (21,000 gas of dev ETH). Simulation and estimation then see the current time, and the contract remains the
 * only thing deciding whether the clock has run down — an early approval is still refused, now for the right
 * reason.
 *
 * **Lab chain only.** A public network mines on a schedule, so its head is at most a block-time behind and
 * nothing here is needed — but the staleness check would still fire (Sepolia blocks are ~12 s apart, the
 * threshold is 2 s) and we would pay real gas for an empty self-transfer before every single vault
 * operation. On Live the honest answer is to send nothing and let the next scheduled block carry the time.
 */
export async function tickChain(): Promise<boolean> {
  if (chain.id !== REMOTE_EVM_CHAIN_ID) return false;
  const latest = await chainNow();
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (now <= latest + TICK_STALENESS_SEC) return false;
  const hash = await broadcaster.sendTransaction({ to: broadcasterAddress, value: 0n, chain, account: broadcaster.account! });
  await publicClient.waitForTransactionReceipt({ hash });
  return true;
}
