/**
 * The Account Opening desk, in one hook.
 *
 * The whole "no pop-ups" claim rests on a single consent: `addSessionSigners` grants our key quorum the
 * right to sign, scoped by the policy the Teller Desk minted for this player. Privy will not let the
 * server attach either of those itself — a user-controlled embedded wallet is owned by the *user's* key
 * quorum, and a server-side wallet update is rejected with 401 — so this consent is a real control, not
 * a courtesy dialog. After it, every Bloxchain slip is signed server-side and the player sees no modal.
 *
 * U4+ — one deliberate exception: a **Priority release** at the manager's desk. The bypass payload
 * (`SIGN_META_APPROVE`) is outside the session signer's policy on purpose, so it is signed here by the player's *own*
 * signer with the Privy UI shown and — when the player has MFA enrolled — a fresh Passkey first (`clear()` +
 * `promptMfa()`; ENG-2026-0013: this re-challenges every time, there is no cache to lean on). That is the "hand scan".
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  errorIndicatesMaxMfaRetries,
  errorIndicatesMfaTimeout,
  errorIndicatesMfaVerificationFailed,
  useCreateWallet,
  useLogin,
  useLogout,
  useMfa,
  usePrivy,
  useSessionSigners,
  useSignTypedData,
  useWallets,
} from '@privy-io/react-auth';
import { ARC_TESTNET_CHAIN_ID, REMOTE_EVM_CHAIN_ID, type PriorityTypedData, type SigningMode } from '@branch-zero/shared';

export interface Session {
  privyUserId: string;
  owner: string;
  account: string | null;
  signingMode: SigningMode;
  delegated: boolean;
  signerId: string;
  policyId?: string;
  policyPinnedToAccount: boolean;
  /** U2 (V6): how the owner's `eth_signTransaction` rules are scoped, and whether they name the account yet. */
  txPolicy?: { mode: 'calldata' | 'to-only'; pinnedToAccount: boolean; rules: number } | null;
  chainId: number;
  token: { address: string; symbol: string; decimals: number };
  timeLockSec?: number;
  instantLimit?: string;
  /** Branch Manager address when the Teller Desk has a manager key; enables recall and (U4+) the Priority desk. */
  manager?: string | null;
  /** U4+: this branch runs Priority releases and this account carries the META_APPROVE split. */
  priority?: boolean;
  /** U5: the latest customer subname claimed under branchzero.eth. */
  ensName?: string | null;
  roleSet?: number;
  roleSetWanted?: number;
}

/** What `/priority/prepare` hands back: the unsigned bypass payload as EIP-712 typed data plus its handle. */
interface PriorityPrepared {
  priorityId: string;
  txId: string;
  releaseTime: string;
  deadline: string;
  signer: string;
  submitter: string;
  typedData: PriorityTypedData;
}

export interface PriorityResult {
  hash: string;
  txId: string;
  status: string;
  actor: 'priority';
  releaseTime: string;
  chainNow: string;
  balanceAfter: string;
  /** Whether Privy asked for a second factor before the signature (false when the player has none enrolled). */
  mfaPrompted: boolean;
}

const MAIN_TELLER = import.meta.env.VITE_TELLER_DESK_URL || '/api';
const ARC_TELLER = import.meta.env.VITE_ARC_TELLER_DESK_URL || '/arc-api';
const tellerFor = (chainId: number) => (chainId === ARC_TESTNET_CHAIN_ID ? ARC_TELLER : MAIN_TELLER);

export function useBranchZeroWallet() {
  const { ready, authenticated, getAccessToken, user } = usePrivy();
  const { signTypedData } = useSignTypedData();
  const { promptMfa, clear: clearMfa } = useMfa();

  // U3: Godot's clerk needs to *await* the sign-in, not just open it. Privy's `login()` returns as soon as
  // the modal is up, so completion / dismissal are caught here and handed to whoever is waiting.
  const loginWaiters = useRef<Array<(ok: boolean) => void>>([]);
  const settleLogin = (ok: boolean) => {
    const w = loginWaiters.current;
    loginWaiters.current = [];
    for (const r of w) r(ok);
  };
  const { login } = useLogin({ onComplete: () => settleLogin(true), onError: () => settleLogin(false) });
  const { logout } = useLogout();
  const { wallets } = useWallets();
  const { createWallet } = useCreateWallet();
  const { addSessionSigners, removeSessionSigners } = useSessionSigners();

  const [session, setSession] = useState<Session | undefined>();
  const [activeChainId, setActiveChainId] = useState(REMOTE_EVM_CHAIN_ID);
  const [busy, setBusy] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  const embedded = useMemo(() => wallets.find((w) => w.walletClientType === 'privy'), [wallets]);

  /** Authenticated call to the Teller Desk. The owner address rides along so the server can prove it is ours. */
  const callOnChain = useCallback(
    async <T>(chainId: number, path: string, body?: unknown, owner?: string): Promise<T> => {
      const token = await getAccessToken();
      const res = await fetch(`${tellerFor(chainId)}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
          'x-bz-owner': owner ?? embedded?.address ?? session?.owner ?? '',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      // A dead Teller Desk does not answer JSON: the Vite proxy (or a host's gateway) answers 5xx with an
      // empty or HTML body. That is the branch failing to reach the ledger — `RPC`, not `INTERNAL` (U4).
      const text = await res.text();
      let json: { error?: string; code?: string } | undefined;
      try {
        json = text ? (JSON.parse(text) as { error?: string; code?: string }) : undefined;
      } catch {
        json = undefined;
      }
      if (!res.ok) {
        if (!json) throw Object.assign(new Error(`Teller Desk unreachable (${res.status} from ${path})`), { code: 'RPC', status: res.status });
        // Keep the Teller Desk's `code` (NO_ACCOUNT, NOT_PENDING, BeforeReleaseTime, policy_violation, ...):
        // the bridge forwards it unchanged and the NPC picks its line by that code (NPCS.md §5).
        throw Object.assign(new Error(json.error ?? `${path} failed (${res.status})`), { code: json.code ?? (res.status === 401 || res.status === 403 ? 'AUTH' : 'INTERNAL'), status: res.status });
      }
      return json as T;
    },
    [getAccessToken, embedded?.address, session?.owner],
  );

  const call = useCallback(<T>(path: string, body?: unknown, owner?: string) => callOnChain<T>(activeChainId, path, body, owner), [activeChainId, callOnChain]);

  /** The app creates embedded wallets on demand rather than on login, so make sure one exists. */
  const ensureWallet = useCallback(async (): Promise<string> => {
    if (embedded?.address) return embedded.address;
    const created = await createWallet();
    return created.address;
  }, [embedded?.address, createWallet]);

  /** Re-read /session so account / policyPinned / delegated stay in sync after provision and consent. */
  const refreshSession = useCallback(async (): Promise<Session> => {
    const owner = session?.owner ?? embedded?.address ?? (await ensureWallet());
    const s = await call<Session>('/session', {}, owner);
    setSession(s);
    return s;
  }, [session?.owner, embedded?.address, ensureWallet, call]);

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

  /** Switch only the payment wing. ENS stays on Sepolia and the user's single Privy consent is reused. */
  const switchWing = useCallback(
    async (chainId: number): Promise<Session> => {
      if (chainId !== REMOTE_EVM_CHAIN_ID && chainId !== ARC_TESTNET_CHAIN_ID) throw new Error(`unsupported wing chain ${chainId}`);
      const owner = session?.owner ?? embedded?.address ?? (await ensureWallet());
      setBusy(chainId === ARC_TESTNET_CHAIN_ID ? 'Taking the elevator to Arc…' : 'Taking the elevator to Main…');
      try {
        const s = await callOnChain<Session>(chainId, '/session', {}, owner);
        setActiveChainId(chainId);
        setSession(s);
        return s;
      } finally {
        setBusy(undefined);
      }
    },
    [session?.owner, embedded?.address, ensureWallet, callOnChain],
  );

  /** The one consent. Grants the Teller Desk's key quorum the right to sign, bounded by this policy.
   * Idempotent: if Privy already has our signer (reload / second "Let tellers act for me"), treat that as
   * success — Privy answers `invalid_data: Duplicate signer(s)…` and the wallet is already delegated. */
  const delegate = useCallback(async () => {
    setError(undefined);
    setBusy('Waiting for your consent…');
    try {
      const s = session ?? (await openSession());
      if (!s.policyId) throw new Error('Teller Desk did not issue a policy for this player');
      if (!s.delegated) {
        try {
          await addSessionSigners({ address: s.owner, signers: [{ signerId: s.signerId, policyIds: [s.policyId] }] });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (!/duplicate signer/i.test(msg)) throw e;
        }
      }
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

  /**
   * U4+ Priority release — the hand scan. Three steps, all owned by the overlay:
   *   1. `/priority/prepare` → the contract-built unsigned meta-approve as typed data (Teller Desk).
   *   2. Fresh MFA if the player has any enrolled (`clear()` drops Privy's cache, `promptMfa()` asks now — Passkey),
   *      then `signTypedData` with the wallet UI **shown**: the player sees what they authorise.
   *   3. `/priority/submit` → recover == owner is checked by the SDK, the Branch Manager submits, COMPLETED.
   * Errors keep their Teller Desk code (`NOT_COOLING`, `PRIORITY_OFF`, `NOT_PENDING`, …); a dismissed sheet or a
   * failed second factor becomes `PRIORITY_CANCELLED` / `MFA_FAILED` so Okafor has a line for each.
   */
  const priority = useCallback(
    async (txId: string): Promise<PriorityResult> => {
      const owner = session?.owner ?? embedded?.address;
      if (!owner) throw Object.assign(new Error('no embedded wallet to sign with'), { code: 'NO_WALLET' });
      setError(undefined);
      setBusy('Preparing the priority release…');
      try {
        const prep = await call<PriorityPrepared>('/priority/prepare', { txId }, owner);
        const enrolled = (user?.mfaMethods?.length ?? 0) > 0;
        let signature: string;
        try {
          if (enrolled) {
            setBusy('Hand scan — confirm with your Passkey…');
            await clearMfa();
            await promptMfa();
          }
          setBusy('Confirm the priority release in your wallet…');
          const res = await signTypedData(prep.typedData as never, {
            address: owner,
            uiOptions: {
              showWalletUIs: true,
              title: 'Priority release — hand scan',
              description: `Skip the cooling period — hand scan required. Wire #${prep.txId} will be released before its clock by the Branch Manager under this signature.`,
              buttonText: 'Confirm priority release',
            },
          });
          signature = res.signature;
        } catch (e) {
          const err = e as Error;
          if (errorIndicatesMfaVerificationFailed(err) || errorIndicatesMfaTimeout(err) || errorIndicatesMaxMfaRetries(err)) {
            throw Object.assign(new Error(`hand scan failed: ${err.message}`), { code: 'MFA_FAILED' });
          }
          throw Object.assign(new Error(`priority release not signed: ${err.message}`), { code: 'PRIORITY_CANCELLED' });
        }
        setBusy('The manager is stamping a priority release…');
        const result = await call<Omit<PriorityResult, 'mfaPrompted'>>('/priority/submit', { priorityId: prep.priorityId, signature }, owner);
        return { ...result, mfaPrompted: enrolled };
      } catch (e) {
        setError((e as Error).message);
        throw e;
      } finally {
        setBusy(undefined);
      }
    },
    [session?.owner, embedded?.address, call, user?.mfaMethods, clearMfa, promptMfa, signTypedData],
  );

  /** Open the Privy modal (the one wallet modal of the game) and resolve when the player is signed in or gave up. */
  const loginAndWait = useCallback((): Promise<boolean> => {
    if (authenticated) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      loginWaiters.current.push(resolve);
      try {
        login();
      } catch (e) {
        settleLogin(false);
        throw e;
      }
    });
  }, [authenticated, login]);

  /** Clear local desk state; Privy's logout alone leaves a stale session and hides Start / Pay. */
  const signOut = useCallback(async () => {
    setSession(undefined);
    setError(undefined);
    setBusy(undefined);
    await logout();
  }, [logout]);

  useEffect(() => {
    if (!authenticated) {
      setSession(undefined);
      setError(undefined);
      setBusy(undefined);
    }
  }, [authenticated]);

  return {
    ready,
    authenticated,
    embedded,
    session,
    busy,
    error,
    setError,
    login,
    loginAndWait,
    logout: signOut,
    openSession,
    refreshSession,
    delegate,
    revoke,
    priority,
    mfaEnrolled: (user?.mfaMethods?.length ?? 0) > 0,
    call,
    callOnChain,
    activeChainId,
    activeWing: activeChainId === ARC_TESTNET_CHAIN_ID ? 'arc' : 'main',
    tellerBase: tellerFor(activeChainId),
    switchWing,
    getAccessToken,
  };
}
