/**
 * The Account Opening desk, in one hook.
 *
 * The whole "no pop-ups" claim rests on a single consent: `addSessionSigners` grants our key quorum the
 * right to sign, scoped by the policy the Teller Desk minted for this player. Privy will not let the
 * server attach either of those itself — a user-controlled embedded wallet is owned by the *user's* key
 * quorum, and a server-side wallet update is rejected with 401 — so this consent is a real control, not
 * a courtesy dialog. After it, every Bloxchain slip is signed server-side and the player sees no modal.
 */
import { useCallback, useMemo, useState } from 'react';
import { useCreateWallet, useLogin, useLogout, usePrivy, useSessionSigners, useWallets } from '@privy-io/react-auth';
import type { SigningMode } from '@branch-zero/shared';

export interface Session {
  privyUserId: string;
  owner: string;
  account: string | null;
  signingMode: SigningMode;
  delegated: boolean;
  signerId: string;
  policyId?: string;
  policyPinnedToAccount: boolean;
  chainId: number;
  token: { address: string; symbol: string; decimals: number };
}

const TELLER = import.meta.env.VITE_TELLER_DESK_URL || '/api';

export function useBranchZeroWallet() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const { login } = useLogin();
  const { logout } = useLogout();
  const { wallets } = useWallets();
  const { createWallet } = useCreateWallet();
  const { addSessionSigners, removeSessionSigners } = useSessionSigners();

  const [session, setSession] = useState<Session | undefined>();
  const [busy, setBusy] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  const embedded = useMemo(() => wallets.find((w) => w.walletClientType === 'privy'), [wallets]);

  /** Authenticated call to the Teller Desk. The owner address rides along so the server can prove it is ours. */
  const call = useCallback(
    async <T>(path: string, body?: unknown, owner?: string): Promise<T> => {
      const token = await getAccessToken();
      const res = await fetch(`${TELLER}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
          'x-bz-owner': owner ?? embedded?.address ?? '',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `${path} failed (${res.status})`);
      return json as T;
    },
    [getAccessToken, embedded?.address],
  );

  /** The app creates embedded wallets on demand rather than on login, so make sure one exists. */
  const ensureWallet = useCallback(async (): Promise<string> => {
    if (embedded?.address) return embedded.address;
    const created = await createWallet();
    return created.address;
  }, [embedded?.address, createWallet]);

  /** Sign in, make sure there is a wallet, and open a Teller Desk session (which mints the policy). */
  const openSession = useCallback(async (): Promise<Session> => {
    setBusy('Signing you in…');
    try {
      const owner = await ensureWallet();
      const s = await call<Session>('/session', {}, owner);
      setSession(s);
      return s;
    } finally {
      setBusy(undefined);
    }
  }, [ensureWallet, call]);

  /** The one consent. Grants the Teller Desk's key quorum the right to sign, bounded by this policy. */
  const delegate = useCallback(async () => {
    setError(undefined);
    setBusy('Waiting for your consent…');
    try {
      const s = session ?? (await openSession());
      if (!s.policyId) throw new Error('Teller Desk did not issue a policy for this player');
      await addSessionSigners({ address: s.owner, signers: [{ signerId: s.signerId, policyIds: [s.policyId] }] });
      setSession(await call<Session>('/session', {}, s.owner));
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(undefined);
    }
  }, [session, openSession, addSessionSigners, call]);

  /** Always available at the desk, per docs/PRIVY.md §7. Revoking drops us back to client signing. */
  const revoke = useCallback(async () => {
    setBusy('Revoking…');
    try {
      const owner = session?.owner ?? embedded?.address;
      if (!owner) return;
      await removeSessionSigners({ address: owner });
      setSession(await call<Session>('/session', {}, owner));
    } finally {
      setBusy(undefined);
    }
  }, [session?.owner, embedded?.address, removeSessionSigners, call]);

  return {
    ready,
    authenticated,
    embedded,
    session,
    busy,
    error,
    setError,
    login,
    logout,
    openSession,
    delegate,
    revoke,
    call,
    getAccessToken,
  };
}
