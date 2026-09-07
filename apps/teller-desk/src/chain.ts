import { createPublicClient, createWalletClient, http, type Address, type Chain, type PublicClient, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { ARC_TESTNET_CHAIN_ID, REMOTE_EVM_CHAIN_ID, arcTestnetWithRpc, isGanacheParityAddress, remoteEvmWithRpc } from '@branch-zero/shared';
import { config } from './config.ts';

export const chain: Chain = config.chainId === ARC_TESTNET_CHAIN_ID ? arcTestnetWithRpc(config.rpcUrl) : remoteEvmWithRpc(config.rpcUrl);

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
 * reason. On a chain that mines on a schedule this is a no-op: the staleness check simply never fires.
 */
export async function tickChain(): Promise<boolean> {
  const latest = await chainNow();
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (now <= latest + TICK_STALENESS_SEC) return false;
  const hash = await broadcaster.sendTransaction({ to: broadcasterAddress, value: 0n, chain, account: broadcaster.account! });
  await publicClient.waitForTransactionReceipt({ hash });
  return true;
}
