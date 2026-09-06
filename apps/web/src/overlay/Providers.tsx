import { PrivyProvider } from '@privy-io/react-auth';
import { remoteEvm } from '@branch-zero/shared';
import { App } from './App';

/**
 * Privy wraps the whole overlay. Two deliberate choices:
 *
 * - `createOnLogin: 'off'` matches the dashboard and we call `createWallet()` ourselves after login, so
 *   the wallet appears at the Account Opening desk rather than invisibly during sign-in.
 * - Remote EVM (1337) is declared as a supported chain. Privy signs typed data for whatever `chainId`
 *   the domain carries regardless, but declaring it keeps the client-side fallback honest about which
 *   chain the player is on.
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
        supportedChains: [remoteEvm],
      }}
    >
      <App engineState={engineState} />
    </PrivyProvider>
  );
}
