import { PrivyProvider } from '@privy-io/react-auth';
import { arcTestnet, remoteEvm } from '@branch-zero/shared';
import { App } from './App';

/**
 * Privy wraps the whole overlay. Two deliberate choices:
 *
 * - `createOnLogin: 'off'` matches the dashboard and we call `createWallet()` ourselves after login, so
 *   the wallet appears at the Account Opening desk rather than invisibly during sign-in.
 * - Both payment wings are declared. Privy signs typed data for either exact chain id, while the
 *   Teller Desk policy and the server-side chain guard remain the actual boundary.
 */
export function Providers({ engineState }: { engineState: string }) {
  return (
    <PrivyProvider
      appId={import.meta.env.VITE_PRIVY_APP_ID}
      config={{
        appearance: { theme: 'dark', walletChainType: 'ethereum-only' },
        loginMethods: ['email'],
        embeddedWallets: { ethereum: { createOnLogin: 'off' } },
        defaultChain: remoteEvm,
        supportedChains: [remoteEvm, arcTestnet],
      }}
    >
      <App engineState={engineState} />
    </PrivyProvider>
  );
}
