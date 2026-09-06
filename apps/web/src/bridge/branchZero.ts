/**
 * window.BranchZero — the only door between the Godot canvas and anything on-chain.
 *
 * Contract (docs/GODOT.md §4 + packages/shared/src/bridge.ts): JSON strings in, JSON strings out; GDScript calls
 * `request(method, argsJson, id)` and receives `{type:'response', id, ok, result|error}` through the callback it
 * registered with `setGodotCallback`. Never `JavaScriptBridge.eval`. Godot never sees RPC URLs or keys.
 *
 * U0 methods: echo (K1), chainInfo, accountInfo.
 * U1 methods: login, logout, addSessionSigner, removeSessionSigner, provision, getPassbook, pay.
 *
 * Everything that needs a Privy identity is delegated to the React overlay through a small adapter it
 * registers at mount: the bridge itself holds no token and no key, and a method that needs one before the
 * overlay is ready fails with a bank line rather than a stack trace.
 */
import { createPublicClient, http, type Address } from 'viem';
import { SecureOwnable } from '@bloxchain/sdk';
import { remoteEvmWithRpc, type BranchZeroBridge, type BridgeError, type BridgeMessage, type BridgeResponse, type StageEvent } from '@branch-zero/shared';
import deployments from '../../../../infra/deployments/remote-evm.json';

export const BRIDGE_VERSION = 'u1.0';

type Handler = (args: Record<string, unknown>) => Promise<unknown>;
type Listener = (m: BridgeMessage | { type: 'request'; id: string; method: string; args: Record<string, unknown> }) => void;

/** What the React overlay lends the bridge once Privy is ready. */
export interface WalletAdapter {
  login(): Promise<void>;
  logout(): Promise<void>;
  openSession(): Promise<{ privyUserId: string; owner: string; account: string | null; signingMode: string; delegated: boolean }>;
  delegate(): Promise<void>;
  revoke(): Promise<void>;
  call<T>(path: string, body?: unknown): Promise<T>;
  isAuthenticated(): boolean;
}

let adapter: WalletAdapter | undefined;

/**
 * Registered once by the overlay. It must be a *stable* object: emitting bridge traffic re-renders the
 * overlay, so an adapter whose identity changed every render would re-register forever.
 */
export function setWalletAdapter(a: WalletAdapter | undefined): void {
  if (adapter === a) return;
  adapter = a;
}

function requireAdapter(): WalletAdapter {
  if (!adapter) throw bridgeError('AUTH', 'wallet overlay not mounted yet', 'The clerk has not opened the desk yet.');
  return adapter;
}

const listeners = new Set<Listener>();
export function onBridgeTraffic(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
function emit(m: Parameters<Listener>[0]) {
  for (const l of listeners) l(m);
}

/** Push a Teller Desk stage event into the bridge (and therefore into Godot). */
export function pushStage(e: StageEvent): void {
  emit({ type: 'event', kind: 'stage', payload: e as unknown as Record<string, unknown> });
  godotCallback?.(JSON.stringify({ type: 'event', kind: 'stage', payload: e }));
}

// Reads go through the Vite `/rpc` proxy so the browser stays same-origin and the RPC URL never reaches Godot.
const chain = remoteEvmWithRpc(`${location.origin}/rpc`);
const publicClient = createPublicClient({ chain, transport: http(`${location.origin}/rpc`) });

const handlers: Record<string, Handler> = {
  async echo(args) {
    return { echo: args.msg ?? null, receivedAt: new Date().toISOString(), bridge: BRIDGE_VERSION, userAgent: navigator.userAgent.slice(0, 60) };
  },
  async chainInfo() {
    const [chainId, block] = await Promise.all([publicClient.getChainId(), publicClient.getBlock()]);
    return { chainId, chainName: chain.name, blockNumber: block.number.toString(), timestamp: Number(block.timestamp) };
  },
  async accountInfo(args) {
    const label = typeof args.label === 'string' ? args.label : deployments.accounts[0]?.label;
    const rec = deployments.accounts.find((a) => a.label === label);
    if (!rec) throw bridgeError('BAD_ARGS', `no deployed account labelled ${label}`, 'That account is not on file at this branch.');
    const so = new SecureOwnable(publicClient as never, undefined, rec.address as Address, chain);
    const [owner, broadcasters, recovery, timeLock] = await Promise.all([so.owner(), so.getBroadcasters(), so.getRecovery(), so.getTimeLockPeriodSec()]);
    return {
      label: rec.label,
      account: rec.address,
      chainId: deployments.chainId,
      owner,
      broadcasters,
      recovery,
      timeLockPeriodSec: Number(timeLock),
      ownerMatchesRecord: owner.toLowerCase() === rec.owner.toLowerCase(),
    };
  },

  // --- U1: Account Opening ---
  async login() {
    const a = requireAdapter();
    if (!a.isAuthenticated()) await a.login();
    const session = await a.openSession();
    return { userId: session.privyUserId, owner: session.owner, account: session.account, signingMode: session.signingMode };
  },
  async logout() {
    await requireAdapter().logout();
    return { ok: true };
  },
  async addSessionSigner() {
    await requireAdapter().delegate();
    return { ok: true };
  },
  async removeSessionSigner() {
    await requireAdapter().revoke();
    return { ok: true };
  },
  async provision() {
    return requireAdapter().call('/provision', {});
  },

  // --- U1: the counter ---
  async getPassbook() {
    return requireAdapter().call('/status');
  },
  async pay(args) {
    const to = typeof args.to === 'string' ? args.to : '';
    const amount = typeof args.amount === 'string' ? args.amount : String(args.amount ?? '');
    if (!/^0x[0-9a-fA-F]{40}$/.test(to)) throw bridgeError('BAD_ARGS', `not an address: ${to}`, 'That payee is not on your approved list.');
    if (!/^\d+(\.\d+)?$/.test(amount)) throw bridgeError('BAD_ARGS', `not an amount: ${amount}`, 'That is not an amount the counter can take.');
    return requireAdapter().call('/pay', { to, amount, memo: args.memo });
  },
};

function bridgeError(code: BridgeError['code'], message: string, bankLine?: string): BridgeError {
  return { code, message, bankLine };
}

function toError(e: unknown): BridgeError {
  if (e && typeof e === 'object' && 'code' in e && 'message' in e) return e as BridgeError;
  const message = e instanceof Error ? e.message : String(e);
  const code: BridgeError['code'] = /fetch|network|HTTP|ECONN/i.test(message) ? 'RPC' : 'INTERNAL';
  return { code, message, bankLine: code === 'RPC' ? 'The branch cannot reach the ledger right now.' : 'Something went wrong behind the counter.' };
}

async function dispatch(method: string, args: Record<string, unknown>): Promise<unknown> {
  const h = handlers[method];
  if (!h) throw bridgeError('UNKNOWN_METHOD', `unknown bridge method ${method}`, 'No desk handles that request.');
  return h(args);
}

let godotCallback: ((json: string) => void) | undefined;

export function installBridge(): BranchZeroBridge {
  const bridge: BranchZeroBridge = {
    version: BRIDGE_VERSION,
    setGodotCallback(cb) {
      godotCallback = cb;
      emit({ type: 'event', kind: 'bridge.ready', payload: { version: BRIDGE_VERSION } });
      // Let the engine know the door is open (arrives as type:'event' in Chain.gd).
      queueMicrotask(() => cb(JSON.stringify({ type: 'event', kind: 'bridge.ready', payload: { version: BRIDGE_VERSION } })));
    },
    request(method, argsJson, id) {
      let args: Record<string, unknown> = {};
      try {
        args = argsJson ? (JSON.parse(argsJson) as Record<string, unknown>) : {};
      } catch (e) {
        const res: BridgeResponse = { type: 'response', id, ok: false, error: bridgeError('BAD_ARGS', `args not JSON: ${(e as Error).message}`) };
        emit(res);
        godotCallback?.(JSON.stringify(res));
        return;
      }
      emit({ type: 'request', id, method, args });
      void dispatch(method, args)
        .then((result) => ({ type: 'response', id, ok: true, result }) as BridgeResponse)
        .catch((e) => ({ type: 'response', id, ok: false, error: toError(e) }) as BridgeResponse)
        .then((res) => {
          emit(res);
          if (!godotCallback) console.warn('[BranchZero] response with no Godot callback registered', res);
          godotCallback?.(JSON.stringify(res));
        });
    },
    call<T>(method: string, args: Record<string, unknown> = {}) {
      return dispatch(method, args) as Promise<T>;
    },
  };

  window.BranchZero = bridge;
  return bridge;
}
