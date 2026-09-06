import { createPublicClient, createWalletClient, http, type Address, type Chain, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { REMOTE_EVM_CHAIN_ID, isGanacheParityAddress, remoteEvmWithRpc } from '@branch-zero/shared';
import { env, redact } from './env.ts';

export function rpcUrl(): string {
  return env('REMOTE_EVM_RPC_URL', 'http://127.0.0.1:8545');
}

export function publicClientFor(chain: Chain) {
  return createPublicClient({ chain, transport: http(rpcUrl()) });
}

/** Resolve the live chain id from the RPC and build a viem Chain for it. Refuses unknown ids unless ALLOW_CHAIN_ID matches. */
export async function connect(): Promise<{ chain: Chain; publicClient: ReturnType<typeof publicClientFor>; clientVersion: string }> {
  const probe = createPublicClient({ transport: http(rpcUrl()) });
  const chainId = await probe.getChainId();
  const clientVersion = (await probe.request({ method: 'web3_clientVersion' as never, params: [] as never })) as string;
  if (chainId !== REMOTE_EVM_CHAIN_ID && process.env.ALLOW_CHAIN_ID !== String(chainId)) {
    throw new Error(
      `RPC ${rpcUrl()} reports chainId ${chainId}, expected ${REMOTE_EVM_CHAIN_ID} (Remote EVM). ` +
        `Set ALLOW_CHAIN_ID=${chainId} to override deliberately (never with Ganache-parity keys).`,
    );
  }
  const chain = remoteEvmWithRpc(rpcUrl());
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl()) });
  return { chain: chainId === REMOTE_EVM_CHAIN_ID ? chain : { ...chain, id: chainId, name: `chain-${chainId}` }, publicClient, clientVersion };
}

/** Wallet from DEPLOYER_PK. Hard-refuses a Ganache-parity key on any chain other than 1337. */
export function deployerWallet(chain: Chain) {
  const pk = env('DEPLOYER_PK') as Hex;
  const account = privateKeyToAccount(pk.startsWith('0x') ? pk : (`0x${pk}` as Hex));
  if (chain.id !== REMOTE_EVM_CHAIN_ID && isGanacheParityAddress(account.address)) {
    throw new Error(
      `Refusing: deployer ${account.address} is a Ganache-parity dev account and chainId is ${chain.id}. ` +
        `These keys never leave Remote EVM 1337 (docs/SECURITY-AND-KEYS.md).`,
    );
  }
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl()) });
  return { account, walletClient, label: `${account.address} (pk ${redact(pk)})` };
}

export function asAddress(v: string, what: string): Address {
  if (!/^0x[0-9a-fA-F]{40}$/.test(v)) throw new Error(`${what}: not an address: ${v}`);
  return v as Address;
}
