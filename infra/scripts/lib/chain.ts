import { createPublicClient, createWalletClient, http, type Address, type Chain, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { ARC_TESTNET_CHAIN_ID, DEFAULT_ARC_RPC_URL, DEFAULT_REMOTE_EVM_RPC_URL, REMOTE_EVM_CHAIN_ID, arcTestnetWithRpc, isGanacheParityAddress, remoteEvmWithRpc, type ChainTarget } from '@branch-zero/shared';
import { env, redact } from './env.ts';

export type InfraChainTarget = ChainTarget;

export function targetFromArg(argv = process.argv.slice(2)): InfraChainTarget {
  const idx = argv.indexOf('--chain');
  const value = idx >= 0 ? argv[idx + 1] : undefined;
  if (!value || value === 'remote' || value === 'remote-evm' || value === '1337') return 'remote';
  if (value === 'arc' || value === 'arc-testnet' || value === String(ARC_TESTNET_CHAIN_ID)) return 'arc';
  throw new Error(`unknown --chain ${value}; use --chain remote or --chain arc`);
}

export function rpcUrl(target: InfraChainTarget = 'remote'): string {
  return target === 'arc' ? env('ARC_RPC_URL', DEFAULT_ARC_RPC_URL) : env('REMOTE_EVM_RPC_URL', DEFAULT_REMOTE_EVM_RPC_URL);
}

export function publicClientFor(chain: Chain, target: InfraChainTarget = 'remote') {
  return createPublicClient({ chain, transport: http(rpcUrl(target)) });
}

/** Resolve and hard-check the live chain. Arc never accepts an ALLOW_CHAIN_ID override. */
export async function connect(target: InfraChainTarget = 'remote'): Promise<{ chain: Chain; publicClient: ReturnType<typeof publicClientFor>; clientVersion: string }> {
  const expected = target === 'arc' ? ARC_TESTNET_CHAIN_ID : REMOTE_EVM_CHAIN_ID;
  const rpc = rpcUrl(target);
  const probe = createPublicClient({ transport: http(rpc) });
  const chainId = await probe.getChainId();
  const clientVersion = (await probe.request({ method: 'web3_clientVersion' as never, params: [] as never })) as string;
  if (chainId !== expected) {
    throw new Error(
      `RPC ${rpc} reports chainId ${chainId}, expected ${expected} (${target === 'arc' ? 'Arc Testnet' : 'Remote EVM'}). ` +
        (target === 'arc' ? 'Arc refuses chain overrides.' : 'Use the Remote EVM RPC or fix its chain id.'),
    );
  }
  const chain = target === 'arc' ? arcTestnetWithRpc(rpc) : remoteEvmWithRpc(rpc);
  const publicClient = createPublicClient({ chain, transport: http(rpc) });
  return { chain, publicClient, clientVersion };
}

/** Wallet from the target-specific deployer key. Hard-refuses Ganache-parity keys off 1337. */
export function deployerWallet(chain: Chain, target: InfraChainTarget = 'remote') {
  const pk = env(target === 'arc' ? 'ARC_DEPLOYER_PK' : 'DEPLOYER_PK') as Hex;
  const account = privateKeyToAccount(pk.startsWith('0x') ? pk : (`0x${pk}` as Hex));
  if (chain.id !== REMOTE_EVM_CHAIN_ID && isGanacheParityAddress(account.address)) {
    throw new Error(
      `Refusing: deployer ${account.address} is a Ganache-parity dev account and chainId is ${chain.id}. ` +
        `These keys never leave Remote EVM 1337 (docs/SECURITY-AND-KEYS.md).`,
    );
  }
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl(target)) });
  return { account, walletClient, label: `${account.address} (pk ${redact(pk)})` };
}

export function asAddress(v: string, what: string): Address {
  if (!/^0x[0-9a-fA-F]{40}$/.test(v)) throw new Error(`${what}: not an address: ${v}`);
  return v as Address;
}
