import { createPublicClient, createWalletClient, http, type Address, type Chain, type PublicClient, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { REMOTE_EVM_CHAIN_ID, isGanacheParityAddress, remoteEvmWithRpc } from '@branch-zero/shared';
import { config } from './config.ts';

export const chain: Chain = remoteEvmWithRpc(config.rpcUrl);

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

export const broadcasterAddress = broadcaster.account!.address as Address;
export const deployerAddress = deployer.account!.address as Address;

/** Chain time, not `Date.now()` — the vault clock and meta-tx deadlines must agree with the chain. */
export async function chainNow(): Promise<bigint> {
  return (await publicClient.getBlock()).timestamp;
}
