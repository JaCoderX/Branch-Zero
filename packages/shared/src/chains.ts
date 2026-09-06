import { defineChain, type Chain } from 'viem';
import { sepolia } from 'viem/chains';

/** Default dev chain — particle-tool-box `Docker Apps/Remote EVM` (Nethermind, NethDev instant mining). */
export const REMOTE_EVM_CHAIN_ID = 1337;
export const DEFAULT_REMOTE_EVM_RPC_URL = 'http://127.0.0.1:8545';

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

// Arc Testnet (5042002) is added in U6 (ENG-2026-0006 / K3). Native-USDC decimals are VERIFY — not defined here on purpose.

export const SUPPORTED_CHAINS: Record<number, Chain> = {
  [remoteEvm.id]: remoteEvm,
  [sepolia.id]: sepolia,
};

export function chainById(chainId: number, rpcUrl?: string): Chain {
  const base = SUPPORTED_CHAINS[chainId];
  if (!base) throw new Error(`Unsupported chainId ${chainId}`);
  return rpcUrl ? defineChain({ ...base, rpcUrls: { default: { http: [rpcUrl] } } }) : base;
}
