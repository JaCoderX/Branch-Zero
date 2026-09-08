import { PrivyProvider } from '@privy-io/react-auth';
import { arcTestnet, remoteEvm, sepolia } from '@branch-zero/shared';
import { App } from './App';

/**
 * Privy wraps the whole overlay. Two deliberate choices:
 *
 * - `createOnLogin: 'off'` matches the dashboard and we call `createWallet()` ourselves after login, so
 *   the wallet appears at the Account Opening desk rather than invisibly during sign-in.
 * - Every chain the bank signs on is declared, and **Sepolia is the default** because Live is the product
 *   default (docs/SEPOLIA-LIVE.md §1): Sepolia `11155111` for the Live payment wing, ENS and FX; Remote EVM
 *   `1337` for Developer Mode; Arc `5042002` for the deferred wing. Privy signs typed data for an exact chain
 *   id, so a missing entry is a signing failure on that wing — while the per-player policy (which pins
 *   `chainId` *and* `verifyingContract`) and the desk's own chain guard remain the actual boundary.
 */
export function Providers({ engineState }: { engineState: string }) {
  return (
    <PrivyProvider
      appId={import.meta.env.VITE_PRIVY_APP_ID}
      config={{
        appearance: { theme: 'dark', walletChainType: 'ethereum-only' },
        loginMethods: ['email'],
        embeddedWallets: { ethereum: { createOnLogin: 'off' } },
        defaultChain: sepolia,
        supportedChains: [sepolia, remoteEvm, arcTestnet],
      }}
    >
      <App engineState={engineState} />
    </PrivyProvider>
  );
}
