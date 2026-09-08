import { defineChain, type Chain } from 'viem';
import { sepolia } from 'viem/chains';

/** Default dev chain — particle-tool-box `Docker Apps/Remote EVM` (Nethermind, NethDev instant mining). */
export const REMOTE_EVM_CHAIN_ID = 1337;
export const DEFAULT_REMOTE_EVM_RPC_URL = 'http://127.0.0.1:8545';
export const ARC_TESTNET_CHAIN_ID = 5042002;
export const DEFAULT_ARC_RPC_URL = 'https://rpc.testnet.arc.io';
/** Arc's native USDC ERC-20-compatible interface. Its token units are 6 decimals; native gas is 18. */
export const ARC_USDC_ADDRESS = '0x3600000000000000000000000000000000000000' as const;
/** S1: the FX desk writes on Sepolia (Uniswap v4); it is a target for infra scripts and the Teller Desk's lazy FX module. */
export const SEPOLIA_CHAIN_ID = 11155111;
export type ChainTarget = 'remote' | 'arc' | 'sepolia';

export const remoteEvm = defineChain({
  id: REMOTE_EVM_CHAIN_ID,
  name: 'Remote EVM',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [DEFAULT_REMOTE_EVM_RPC_URL] } },
  testnet: true,
});

/** Same chain, different transport URL (Tailscale Serve, Vite `/rpc` proxy, …). */
export function remoteEvmWithRpc(rpcUrl: string): Chain {
  return defineChain({ ...remoteEvm, rpcUrls: { default: { http: [rpcUrl] } } });
}

export { sepolia };

export function sepoliaWithRpc(rpcUrl: string): Chain {
  return defineChain({ ...sepolia, rpcUrls: { default: { http: [rpcUrl] } } });
}

/** Arc Testnet: native balance and gas are USDC in 18-decimal EVM units. */
export const arcTestnet = defineChain({
  id: ARC_TESTNET_CHAIN_ID,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [DEFAULT_ARC_RPC_URL] } },
  blockExplorers: { default: { name: 'Arcscan', url: 'https://testnet.arcscan.app' } },
  contracts: { multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11' } },
  testnet: true,
});

export function arcTestnetWithRpc(rpcUrl: string): Chain {
  return defineChain({ ...arcTestnet, rpcUrls: { default: { http: [rpcUrl] } } });
}

export const SUPPORTED_CHAINS: Record<number, Chain> = {
  [remoteEvm.id]: remoteEvm,
  [sepolia.id]: sepolia,
  [arcTestnet.id]: arcTestnet,
};

export function chainById(chainId: number, rpcUrl?: string): Chain {
  const base = SUPPORTED_CHAINS[chainId];
  if (!base) throw new Error(`Unsupported chainId ${chainId}`);
  return rpcUrl ? defineChain({ ...base, rpcUrls: { default: { http: [rpcUrl] } } }) : base;
}
