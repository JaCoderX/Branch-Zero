/**
 * window.BranchZero — the only door between the Godot canvas and anything on-chain.
 *
 * Contract (docs/GODOT.md §4 + packages/shared/src/bridge.ts): JSON strings in, JSON strings out; GDScript calls
 * `request(method, argsJson, id)` and receives `{type:'response', id, ok, result|error}` through the callback it
 * registered with `setGodotCallback`. Never `JavaScriptBridge.eval`. Godot never sees RPC URLs or keys.
 *
 * U0 methods: echo (K1), chainInfo, accountInfo.
 * U1 methods: login, logout, addSessionSigner, removeSessionSigner, provision, faucet, getPassbook, pay.
 * U2 methods: wire, approve, cancel, listPending (the vault — Lane B).
 * U3 methods: getSession (who is at the desk, never opens a modal), getHistory (ledger receipts). Both call
 *             routes that already exist (`/session`, `/status`); U3 added no chain semantics.
 * U4+ method: priority (Okafor's desk) — the one call allowed to open a second Privy surface: the player's own
 *             signer signs the meta-approve bypass behind a Passkey, the Branch Manager submits it before the clock.
 * U5 methods: ensAvailable / ensMint / ensSetText / resolveName — ENSv2 identity on Sepolia, on either wing.
 * S2 method:  setMode ('live' | 'dev') — which Teller Desk, and so which payment chain, the bank runs against.
 *             `approve` is owner-only from here (Bob's wait path); `as: 'manager'` is refused by the desk.
 * S2.1 method: loadAccount — Ines adopts an AccountBlox the player already owns on the current wing (an older
 *             CopyBlox clone, or a second account). The desk checks `owner()` on the chain before it switches
 *             anything; docs/LOAD-ACCOUNT.md.
 * Terminal Console (stretch): openConsole (asks the shell for the terminal overlay — an iframe of bloxchain.app, or
 *             a top-level tab if the Console ever refuses framing) and observerGrant / observerRevoke / observerList
 *             (the OBSERVER viewing role: membership only, no function permissions — docs/TERMINAL-CONSOLE.md).
 * iNPC (s2.3): openInpc / inpcSnapshot / inpcStatus / sleepInpc — the optional service assistant's Wake / chat / Sleep
 *             panel (docs/INPC.md). Shell surfaces only: they read no chain, sign nothing and hold no bank secret. The
 *             player's OpenRouter key lives in `sessionStorage` for the session and is never seen by Godot or the desk.
 * Player ops float (s2.4): treasuryStatus / openBranchFloat — the whitelisted `/healthz` treasury slice and its
 *             read-only Copy + faucet panel. The panel never calls a top-up route.
 *
 * Everything that needs a Privy identity is delegated to the React overlay through a small adapter it
 * registers at mount: the bridge itself holds no token and no key, and a method that needs one before the
 * overlay is ready fails with a bank line rather than a stack trace.
 */
import { createPublicClient, http, type Address } from 'viem';
import { SecureOwnable } from '@bloxchain/sdk';
import { ARC_TESTNET_CHAIN_ID, REMOTE_EVM_CHAIN_ID, SEPOLIA_CHAIN_ID, remoteEvmWithRpc, type BranchZeroBridge, type BridgeError, type BridgeMessage, type BridgeResponse, type DeskSession, type StageEvent } from '@branch-zero/shared';
import deployments from '../../../../infra/deployments/remote-evm.json';
import type { DeskLink } from '../shell/deskEvents';
import { focusCanvas } from '../shell/focus';
import { starGithubRepo } from '../shell/githubStar';
import { hasKey as hasInpcKey, wipe as wipeInpcSession } from '../inpc/session';

/**
 * `s2.4`: the player ops float — `treasuryStatus` / `openBranchFloat` (docs/missions/HANDOFF-help-keep-branch-open.md).
 * `s2.3` before it: the optional iNPC — `openInpc` / `inpcSnapshot` / `inpcStatus` / `sleepInpc` (docs/INPC.md). Panel and key
 * are the shell's; Godot hands over a player-safe snapshot and mirrors one bit (awake) back. `s2.2` before it:
 * front-door GitHub stars — `starGithub` opens a small OAuth popup (or a repo popup when the OAuth app is not
 * configured), stamps `PUT /user/starred/{owner}/{repo}`, and returns without navigating the Godot shell away.
 */
export const BRIDGE_VERSION = 's2.4';

/**
 * Where the bank computer points. `/accounts` is the Console screen that matters: it is where the player imports
 * their AccountBlox by address and connects the wallet the terminal has just made a viewing clerk.
 * Framing was verified from this origin on 2026-09-08 (no `X-Frame-Options`, no `frame-ancestors`); the overlay
 * still falls back to a top-level tab if the frame never loads, because a SaaS may harden its headers any day.
 */
export const CONSOLE_URL: string = import.meta.env.VITE_CONSOLE_URL || 'https://bloxchain.app/accounts';

/**
 * `?mock=1` on the shell URL tells Godot to answer every desk call from its own MockChain (canned data,
 * fake latency, no Privy, no chain). It is for walking the greybox without an inbox; it is announced in
 * `bridge.ready` and nowhere else, and the real bridge methods stay installed regardless.
 */
export const MOCK_MODE: false | string = (() => {
  const v = new URLSearchParams(location.search).get('mock');
  return v === null ? false : v || 'fresh'; // `?mock=account` starts the mock with an open, funded account
})();

/** `?demo=walk` — Godot reading window.BranchZero.demoWalk starts the walking autopilot (MockChain reel). */
export const DEMO_WALK: boolean = new URLSearchParams(location.search).get('demo') === 'walk';

type Handler = (args: Record<string, unknown>) => Promise<unknown>;
type Listener = (m: BridgeMessage | { type: 'request'; id: string; method: string; args: Record<string, unknown> }) => void;

/** What the React overlay lends the bridge once Privy is ready. */
export interface WalletAdapter {
  /** Opens the Privy modal and resolves once the player is signed in (`true`) or dismissed it (`false`). */
  login(): Promise<boolean>;
  logout(): Promise<void>;
  openSession(): Promise<DeskSessionSource>;
  delegate(): Promise<void>;
  revoke(): Promise<void>;
  /** U6: change only the active payment wing; the existing Privy consent is reused. */
  switchWing(chainId: number): Promise<DeskSessionSource>;
  /**
   * Sepolia Live: re-point the shell at the Live or Dev Teller Desk. Not a wing switch, not MockChain.
   * Resolves to `undefined` when nobody is signed in — the wing is still chosen, there is just no session
   * to rebind yet, which is the normal state for an operator picking a desk before Account Opening.
   */
  switchMode(mode: 'live' | 'dev'): Promise<DeskSessionSource | undefined>;
  /** U4+: prepare → Passkey + user-signer typed data (UI shown) → submit. The only second Privy surface. */
  priority(txId: string): Promise<unknown>;
  call<T>(path: string, body?: unknown): Promise<T>;
  isAuthenticated(): boolean;
  /** Privy provider initialised (auth state is known). */
  isReady(): boolean;
}

/** The `/session` view the overlay hook already holds; the bridge trims it to `DeskSession` for Godot. */
export interface DeskSessionSource {
  privyUserId: string;
  owner: string;
  account: string | null;
  signingMode: string;
  delegated: boolean;
  chainId?: number;
  mode?: 'live' | 'dev' | 'arc';
  chainName?: string;
  fxTillIsMain?: boolean;
  timeLockSec?: number;
  instantLimit?: string;
  manager?: string | null;
  priority?: boolean;
  ensName?: string | null;
  /** Passbook tier (Silver | Gold) the desk mirrors from the name's `bz.tier` record. */
  ensTier?: string | null;
  token?: { address: string; symbol: string; decimals: number };
}

/**
 * The terminal overlay, lent to the bridge by React the same way the wallet is. It is a *shell* surface, not a
 * chain one: opening it signs nothing and reads nothing. `open` resolves once the panel is mounted and says
 * which way it went — `iframe` when bloxchain.app frames, `tab` when the overlay had to hand the player a
 * top-level link instead.
 */
export interface TerminalHost {
  open(opts: { url: string; account?: string | null }): Promise<{ mode: 'iframe' | 'tab'; url: string }>;
  close(reason?: string): void;
  isOpen(): boolean;
}

/**
 * The iNPC panel, lent by React the same way. `open` resolves once the panel is mounted; `awake` says whether a key is
 * already in this tab's session (a reload keeps it) so Godot can light the eye without asking twice.
 */
export interface InpcHost {
  open(snapshot: unknown): Promise<{ awake: boolean }>;
  /** A fresher snapshot while the panel is up (Godot pushes one on every change of its mirror). */
  update(snapshot: unknown): void;
  close(reason?: string): void;
  isOpen(): boolean;
}

/** The only treasury fields that may cross into the player shell. All values come from `/healthz`. */
export interface PlayerTreasury {
  configured: boolean;
  address: string | null;
  eth: string | null;
  treasuryShort: boolean;
  requiredEth: string | null;
}

/** The read-only player ops float panel, lent by React to the bridge. */
export interface BranchFloatHost {
  open(opts: { reason?: string }): Promise<{ status: PlayerTreasury }>;
  close(reason?: string): void;
  isOpen(): boolean;
  status(): PlayerTreasury | null;
}

let adapter: WalletAdapter | undefined;
let terminal: TerminalHost | undefined;
let inpc: InpcHost | undefined;
let branchFloat: BranchFloatHost | undefined;

export function setInpcHost(h: InpcHost | undefined): void {
  if (inpc === h) return;
  inpc = h;
}

export function setBranchFloatHost(h: BranchFloatHost | undefined): void {
  if (branchFloat === h) return;
  branchFloat = h;
}

/** The player shut the read-only ops float panel. Godot clears its temporary overlay ownership on this event. */
export function pushBranchFloatClosed(reason: string = 'closed'): void {
  const payload = { reason };
  emit({ type: 'event', kind: 'branch-float.closed', payload });
  godotCallback?.(JSON.stringify({ type: 'event', kind: 'branch-float.closed', payload }));
}

/**
 * The player shut the assistant's panel (Esc, Close, backdrop, Sleep). Same contract as `terminal.closed`: Godot
 * unlocks movement on this event, not on the `openInpc` promise. `awake` rides along so the eye follows Sleep.
 */
export function pushInpcClosed(reason: string = 'closed', awake: boolean = hasInpcKey()): void {
  const payload = { reason, awake };
  emit({ type: 'event', kind: 'inpc.closed', payload });
  godotCallback?.(JSON.stringify({ type: 'event', kind: 'inpc.closed', payload }));
}

type InpcOpenWaiter = {
  resolve: (v: { awake: boolean }) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};
type InpcFreshenWaiter = {
  resolve: (snapshot: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
};

let pendingInpcOpen: InpcOpenWaiter | undefined;
let pendingInpcFreshen: InpcFreshenWaiter | undefined;

const INPC_OPEN_TIMEOUT_MS = 8_000;

function clearPendingInpcOpen(err?: Error): void {
  if (!pendingInpcOpen) return;
  clearTimeout(pendingInpcOpen.timer);
  const w = pendingInpcOpen;
  pendingInpcOpen = undefined;
  if (err) w.reject(err);
}

/**
 * Phone Talk → Godot `inpc.open` → `GameState.run_action("open_inpc")`. Resolves when Godot calls `openInpc` with a
 * freshly built snapshot (and sets `inpc_open`). Never opens from a cached shell board.
 */
export function requestInpcOpen(): Promise<{ awake: boolean }> {
  return new Promise((resolve, reject) => {
    clearPendingInpcOpen(new Error('Another Talk request replaced this one.'));
    const callback = godotCallback;
    if (!callback) {
      reject(bridgeError('INPC_UNAVAILABLE', 'no Godot callback is registered', 'The assistant stays asleep here — it only wakes in the full bank window.'));
      return;
    }
    const timer = setTimeout(() => {
      clearPendingInpcOpen(new Error('The full conversation did not open after a few seconds.'));
    }, INPC_OPEN_TIMEOUT_MS);
    pendingInpcOpen = {
      resolve: (v) => {
        clearTimeout(timer);
        pendingInpcOpen = undefined;
        resolve(v);
      },
      reject,
      timer,
    };
    const msg = { type: 'event' as const, kind: 'inpc.open', payload: {} };
    emit(msg as BridgeMessage);
    try {
      callback(JSON.stringify(msg));
    } catch (e) {
      clearPendingInpcOpen(e instanceof Error ? e : new Error(String(e)));
    }
  });
}

/**
 * Ask → Godot `inpc.freshen` → refresh session/passbook → `inpcSnapshot` push. Returns the fresh board, or `null` if
 * Godot did not answer in time (caller falls back to local clock freshen on the last board).
 */
export function requestInpcBoardFreshen(): Promise<unknown | null> {
  return new Promise((resolve) => {
    if (pendingInpcFreshen) {
      clearTimeout(pendingInpcFreshen.timer);
      pendingInpcFreshen.resolve(null);
      pendingInpcFreshen = undefined;
    }
    if (!godotCallback) {
      resolve(null);
      return;
    }
    const timer = setTimeout(() => {
      if (pendingInpcFreshen) {
        pendingInpcFreshen = undefined;
        resolve(null);
      }
    }, 8_000);
    pendingInpcFreshen = {
      resolve: (snapshot) => {
        clearTimeout(timer);
        pendingInpcFreshen = undefined;
        resolve(snapshot);
      },
      timer,
    };
    const msg = { type: 'event' as const, kind: 'inpc.freshen', payload: {} };
    emit(msg as BridgeMessage);
    godotCallback(JSON.stringify(msg));
  });
}

/** Registered once by the overlay, like `setWalletAdapter`: it must be a stable object across renders. */
export function setTerminalHost(t: TerminalHost | undefined): void {
  if (terminal === t) return;
  terminal = t;
}

/**
 * The player closed the Console. Godot unlocks movement on this event rather than on the `openConsole` promise,
 * so nothing in the bridge has to stay pending while somebody reads a ledger (docs/GODOT.md §4).
 */
export function pushTerminalClosed(reason: string = 'closed'): void {
  const payload = { reason };
  emit({ type: 'event', kind: 'terminal.closed', payload });
  godotCallback?.(JSON.stringify({ type: 'event', kind: 'terminal.closed', payload }));
}

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

/**
 * U4: the SSE link's state (`shell/deskEvents.ts`). `connected:false` means the stage feed is down and the
 * overlay is reconnecting; `connected:true` after an outage means the server has just re-read the vault and
 * re-armed its watchers, so Godot reconciles the board once (`GameState`).
 */
export function pushLink(l: DeskLink): void {
  const payload = l as unknown as Record<string, unknown>;
  emit({ type: 'event', kind: 'desk.link', payload });
  godotCallback?.(JSON.stringify({ type: 'event', kind: 'desk.link', payload }));
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
    if (!a.isAuthenticated()) {
      // The one wallet modal. Whatever happens in it, the keyboard goes back to the bank afterwards.
      let ok = false;
      try {
        ok = await a.login();
      } finally {
        focusCanvas();
      }
      if (!ok) throw bridgeError('LOGIN_CANCELLED', 'the sign-in was dismissed', 'No rush — come back when you are ready to sign in.');
    }
    const session = await a.openSession();
    return { userId: session.privyUserId, owner: session.owner, account: session.account, signingMode: session.signingMode, delegated: session.delegated };
  },
  async logout() {
    await requireAdapter().logout();
    return { ok: true };
  },
  async addSessionSigner() {
    // The consent is part of the same Privy flow (docs/GODOT.md §4); it also leaves DOM focus behind.
    try {
      await requireAdapter().delegate();
    } finally {
      focusCanvas();
    }
    return { ok: true };
  },
  async removeSessionSigner() {
    await requireAdapter().revoke();
    return { ok: true };
  },
  async provision() {
    return requireAdapter().call('/provision', {});
  },
  /** U7: server-side Main-wing practice credit; no wallet or Passkey surface. */
  async faucet() {
    return requireAdapter().call('/faucet', {});
  },
  /**
   * Load Account: adopt an AccountBlox the player already owns on the current wing (docs/LOAD-ACCOUNT.md).
   *
   * Address only, on purpose. Unlike `observerGrant`, an ENS name is not resolved here: a customer name points
   * at whichever account the Name Desk recorded, which is precisely the account the player may be trying to
   * move *away* from — so accepting one would quietly load the wrong vault. The desk terminal (and a passbook)
   * is where a player gets the address; the desk then re-checks ownership on the chain before adopting it.
   */
  async loadAccount(args) {
    const raw = String(args.account ?? args.address ?? '').trim();
    if (!raw) throw bridgeError('BAD_ARGS', 'an account address is required', 'Write the account number you want me to load.');
    if (!/^0x[0-9a-fA-F]{40}$/.test(raw)) {
      throw bridgeError('BAD_ARGS', `not an address: ${raw.slice(0, 64)}`, 'That is not an account number — it should start 0x and be 40 characters after that. The desk terminal can find it for you.');
    }
    return requireAdapter().call('/account/load', { account: raw });
  },

  // --- U6: elevator ---
  async switchWing(args) {
    const chainId = Number(args.chainId);
    if (chainId !== REMOTE_EVM_CHAIN_ID && chainId !== ARC_TESTNET_CHAIN_ID) {
      throw bridgeError('BAD_ARGS', `unsupported wing chain ${args.chainId}`, 'That elevator only serves Main and Arc.');
    }
    const s = await requireAdapter().switchWing(chainId);
    return { wing: chainId === ARC_TESTNET_CHAIN_ID ? 'arc' : 'main', chainId, account: s.account, owner: s.owner };
  },

  // --- Sepolia Live: the payment wing's mode. Operator surface (desk debug / `?mode=dev`), not a lobby door. ---
  /**
   * Live | Dev. Live is Sepolia and the default for every normal player; Dev is the private Remote EVM lab and
   * exists so an operator can iterate quickly. Switching re-points the shell at the other Teller Desk and
   * re-reads `/session` from it, because the player's Main account differs per chain.
   */
  async setMode(args) {
    const mode = String(args.mode ?? '').toLowerCase();
    if (mode !== 'live' && mode !== 'dev') {
      throw bridgeError('BAD_ARGS', `unsupported mode ${args.mode}`, 'The branch runs in Live or Developer Mode.');
    }
    const s = await requireAdapter().switchMode(mode);
    // No session yet is a real answer, not a failure: say which wing is now selected and leave the account
    // fields null rather than inventing them. Godot's board reads `chainId` either way.
    return {
      mode: s?.mode ?? mode,
      chainId: s?.chainId ?? (mode === 'dev' ? REMOTE_EVM_CHAIN_ID : SEPOLIA_CHAIN_ID),
      chainName: s?.chainName ?? null,
      account: s?.account ?? null,
      owner: s?.owner ?? null,
      fxTillIsMain: s?.fxTillIsMain ?? null,
      loggedIn: Boolean(s),
    };
  },

  // --- U5: Petra's ENSv2 Name Desk (Sepolia only) ---
  async ensAvailable(args) {
    const label = typeof args.label === 'string' ? args.label.trim() : '';
    const query = label ? `?label=${encodeURIComponent(label)}` : '';
    return requireAdapter().call(`/ens/available${query}`);
  },
  async ensMint(args) {
    const label = typeof args.label === 'string' ? args.label.trim() : '';
    if (!label) throw bridgeError('BAD_ARGS', 'name label is required', 'Petra needs a name to put on the slip.');
    try {
      return await requireAdapter().call('/ens/claim', { label });
    } finally {
      // The Name Desk is a Godot form today, but keep every async desk mutation's focus contract explicit.
      focusCanvas();
    }
  },
  async ensSetText(args) {
    const name = typeof args.name === 'string' ? args.name.trim() : '';
    const key = typeof args.key === 'string' ? args.key : 'bz.tier';
    const value = typeof args.value === 'string' ? args.value : '';
    if (!name || !value) throw bridgeError('BAD_ARGS', 'name record needs name and value', 'Petra needs a name record to edit.');
    try {
      return await requireAdapter().call('/ens/record', { name, key, value });
    } finally {
      focusCanvas();
    }
  },
  async resolveName(args) {
    const name = typeof args.name === 'string' ? args.name.trim() : '';
    if (!name) throw bridgeError('BAD_ARGS', 'ENS name is required', 'Write a customer name, like florist.branchzero.eth.');
    return requireAdapter().call(`/ens/resolve?name=${encodeURIComponent(name)}`);
  },

  // --- Terminal Console (stretch): the bank computer and the OBSERVER viewing role ---

  /**
   * Open the terminal overlay. The panel is the shell's, not the game's: Godot only asks for it and then waits
   * for `terminal.closed`. Every exit path from the overlay calls `focusCanvas()` itself, and the overlay
   * renders nothing at all while closed, so no hit target is ever left sitting over `#canvas` (GODOT.md §5b).
   */
  async openConsole() {
    const host = terminal;
    if (!host) throw bridgeError('CONSOLE_UNAVAILABLE', 'no terminal overlay is mounted', 'The screen is dark — the Console only runs in the full bank window.');
    const account = adapter?.isAuthenticated() ? ((await adapter.openSession().catch(() => undefined))?.account ?? null) : null;
    const opened = await host.open({ url: CONSOLE_URL, account });
    return { opened: true, ...opened, account };
  },

  /**
   * Add a viewing wallet. Accepts a `0x` address or an ENS name, which is resolved through the Name Desk's
   * existing `/ens/resolve` (Sepolia) before the address is handed to the role batch on 1337 — the same
   * two-step Lane A already uses for pay-by-name; no second resolver was invented for the terminal.
   */
  async observerGrant(args) {
    const raw = String(args.address ?? args.name ?? args.wallet ?? '').trim();
    if (!raw) throw bridgeError('BAD_ARGS', 'a viewing wallet is required', 'Write an address or a customer name to add.');
    let address = raw;
    if (!/^0x[0-9a-fA-F]{40}$/.test(raw)) {
      if (!raw.includes('.')) throw bridgeError('BAD_ARGS', `not an address or a name: ${raw.slice(0, 64)}`, 'That is not an address or a customer name.');
      const resolved = await requireAdapter().call<{ address?: string }>(`/ens/resolve?name=${encodeURIComponent(raw)}`);
      if (!resolved.address) throw bridgeError('NAME_NOT_FOUND', `${raw} has no address record`, 'That name has no address on file at the Name Desk.');
      address = resolved.address;
    }
    return requireAdapter().call('/observer/grant', { address });
  },
  async observerRevoke(args) {
    const address = String(args.address ?? args.wallet ?? '').trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw bridgeError('BAD_ARGS', `not an address: ${address.slice(0, 64)}`, 'That is not one of the viewing wallets on your file.');
    return requireAdapter().call('/observer/revoke', { address });
  },
  async observerList() {
    return requireAdapter().call('/observer/list');
  },

  // --- iNPC (docs/INPC.md): the optional service assistant. Shell surfaces; no chain, no desk, no bank secret. ---

  /**
   * Open the Wake / chat panel with the snapshot Godot built (`GameState.inpc_snapshot()`, player-safe by
   * construction and whitelisted again in the panel). Resolves when the panel is mounted; the bank stays locked until
   * the panel pushes `inpc.closed`. Nothing here, or behind the panel, can reach pay / wire / approve / cancel /
   * priority / provision — the panel has no bridge verbs at all, only OpenRouter.
   */
  async openInpc(args) {
    const host = inpc;
    if (!host) {
      clearPendingInpcOpen(new Error('The full conversation is not available in this bank window.'));
      throw bridgeError('INPC_UNAVAILABLE', 'no iNPC overlay is mounted', 'The assistant stays asleep here — it only wakes in the full bank window.');
    }
    try {
      const opened = await host.open(args.snapshot ?? {});
      if (pendingInpcOpen) {
        pendingInpcOpen.resolve(opened);
      }
      return { opened: true, awake: opened.awake };
    } catch (e) {
      clearPendingInpcOpen(e instanceof Error ? e : new Error(String(e)));
      throw e;
    }
  },
  /** Godot's mirror changed while the panel is up: hand the panel the fresher board. Harmless when it is closed. */
  async inpcSnapshot(args) {
    const snapshot = args.snapshot ?? {};
    inpc?.update(snapshot);
    if (pendingInpcFreshen) {
      pendingInpcFreshen.resolve(snapshot);
    }
    return { delivered: Boolean(inpc?.isOpen()) };
  },
  /** Is a key in this tab's session? Yes/no only — the key itself never crosses the bridge. */
  async inpcStatus() {
    return { awake: hasInpcKey() };
  },
  /** Sleep from the prop's dialogue: wipe key + transcript; close the panel if it happens to be up. */
  async sleepInpc() {
    wipeInpcSession();
    if (inpc?.isOpen()) inpc.close('sleep');
    else pushInpcClosed('sleep', false);
    return { awake: false };
  },

  // --- Player ops float (docs/missions/HANDOFF-help-keep-branch-open.md): health slice + read-only panel. ---

  /** Return only the configured/address/balance/shortfall fields the player can act on. */
  async treasuryStatus() {
    return branchFloat?.status() ?? null;
  },
  /** Mount the panel; the panel itself only copies the published address or opens the human faucet. */
  async openBranchFloat(args) {
    const host = branchFloat;
    if (!host) throw bridgeError('FLOAT_UNAVAILABLE', 'no branch float panel is mounted', 'The branch float panel is not available in this bank window.');
    const status = host.status();
    if (!status?.configured || !status.address) throw bridgeError('FLOAT_UNAVAILABLE', 'the Live treasury is not configured', 'The branch float is not configured on this wing.');
    const opened = await host.open({ reason: typeof args.reason === 'string' ? args.reason : undefined });
    return { opened: true, status: opened.status };
  },

  // --- S1: Kenji's FX desk (Uniswap v4 on Sepolia; the Main wing's lanes are untouched) ---

  /** The till: balances, whether the exchange door is registered, the pool, and the three whitelisted calls. */
  async fxStatus() {
    return requireAdapter().call('/fx/status');
  },
  /**
   * The quote board. A read — no signature, no modal — so the board can price a swap for a player who has not
   * signed in yet, exactly like Petra's availability check.
   */
  async fxQuote(args) {
    const amount = typeof args.amount === 'string' ? args.amount.trim() : String(args.amount ?? '');
    if (!/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0) throw bridgeError('FX_AMOUNT', `not an amount: ${amount}`, 'That is not an amount the dealer can price.');
    // Fiat pairs (2026-09-09): `pair` is EUR | ILS. The desk validates it (`FX_PAIR`); the bridge only carries it.
    const pair = String(args.pair ?? 'EUR').trim().toUpperCase();
    return requireAdapter().call(`/fx/quote?amount=${encodeURIComponent(amount)}&pair=${encodeURIComponent(pair)}`);
  },
  /** Open the till: register the three schemas, whitelist their targets, grant the two roles. Silent (Lane A shape). */
  async fxEnable() {
    return requireAdapter().call('/fx/enable', {});
  },
  /**
   * The swap. Up to three guarded meta-transactions on Sepolia, all signed by the session signer — so unlike
   * `priority` this opens no Privy surface and needs no `focusCanvas()` dance.
   */
  async fxSwap(args) {
    const body: Record<string, unknown> = {};
    if (typeof args.quoteId === 'string' && args.quoteId) body.quoteId = args.quoteId;
    if (args.amount !== undefined && String(args.amount) !== '') body.amount = String(args.amount);
    if (args.pair !== undefined && String(args.pair) !== '') body.pair = String(args.pair).trim().toUpperCase();
    if (!body.quoteId && !body.amount) throw bridgeError('FX_AMOUNT', 'a quote or an amount is required', 'Ask the dealer for a quote first.');
    return requireAdapter().call('/fx/swap', body);
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

  // --- U2: the vault (Lane B) ---
  async wire(args) {
    const to = typeof args.to === 'string' ? args.to : '';
    const amount = typeof args.amount === 'string' ? args.amount : String(args.amount ?? '');
    if (!/^0x[0-9a-fA-F]{40}$/.test(to)) throw bridgeError('BAD_ARGS', `not an address: ${to}`, 'That payee is not on your approved list.');
    if (!/^\d+(\.\d+)?$/.test(amount)) throw bridgeError('BAD_ARGS', `not an amount: ${amount}`, 'That is not an amount the vault can take.');
    // Returns { txId, releaseTime, chainNow, serverNow, hash } — releaseTime is read from the chain record.
    return requireAdapter().call('/wire', { to, amount, memo: args.memo });
  },
  /** Bob's wait path: the owner's timed release after the clock, silent. U4+: never the manager. */
  async approve(args) {
    return requireAdapter().call('/approve', { txId: String(args.txId ?? ''), as: 'owner' });
  },
  /**
   * U4+ — Okafor's Priority release. The hand scan is a Privy MFA sheet plus a visible sign sheet, so like `login`
   * it leaves DOM focus behind: the canvas gets it back whatever the outcome (docs/GODOT.md §5b).
   */
  async priority(args) {
    const txId = String(args.txId ?? '');
    if (!/^\d+$/.test(txId)) throw bridgeError('BAD_ARGS', `not a record id: ${txId}`, 'We have no wire by that number.');
    try {
      return await requireAdapter().priority(txId);
    } finally {
      focusCanvas();
    }
  },
  async cancel(args) {
    return requireAdapter().call('/cancel', { txId: String(args.txId ?? ''), as: args.as === 'manager' ? 'manager' : 'owner' });
  },
  async listPending() {
    const status = await requireAdapter().call<{ wires?: unknown[]; serverNow?: string }>('/status');
    return { items: status.wires ?? [], serverNow: status.serverNow };
  },

  // --- U3: the bank shell ---
  /**
   * Who is standing at the desk. Never opens a modal: an anonymous visitor gets `loggedIn:false` and the
   * clerk offers "Sign in". Waits briefly for Privy to initialise so a fresh page load is not misread as
   * "signed out".
   */
  async getSession(): Promise<DeskSession> {
    const a = adapter;
    if (!a) return { loggedIn: false, ready: false };
    for (let i = 0; i < 40 && !a.isReady(); i++) await new Promise((r) => setTimeout(r, 250));
    if (!a.isReady()) return { loggedIn: false, ready: false };
    if (!a.isAuthenticated()) return { loggedIn: false, ready: true };
    const s = await a.openSession();
    return {
      loggedIn: true,
      ready: true,
      userId: s.privyUserId,
      owner: s.owner,
      account: s.account,
      delegated: s.delegated,
      signingMode: s.signingMode as DeskSession['signingMode'],
      chainId: s.chainId,
      mode: s.mode,
      chainName: s.chainName,
      fxTillIsMain: s.fxTillIsMain,
      timeLockSec: s.timeLockSec,
      instantLimit: s.instantLimit,
      manager: s.manager ?? null,
      priority: Boolean(s.priority),
      ensName: s.ensName ?? null,
      ensTier: s.ensTier ?? null,
      token: s.token,
    };
  },
  /** The ledger board's right-hand column: the Teller Desk's last receipts for this player (`/status.receipts`). */
  async getHistory(args) {
    const limit = Math.max(1, Math.min(25, Number(args.limit ?? 8) || 8));
    const status = await requireAdapter().call<{ receipts?: unknown[]; serverNow?: string }>('/status');
    const all = status.receipts ?? [];
    return { items: all.slice(-limit), serverNow: status.serverNow };
  },

  /**
   * Front-door CTA: star a public GitHub repo without navigating the bank away.
   * Needs `VITE_GITHUB_CLIENT_ID` + desk `GITHUB_OAUTH_CLIENT_SECRET` for one-click API stars;
   * otherwise opens the repo in a new tab for a manual Star.
   */
  async starGithub(args) {
    const repo = String(args.repo ?? args.full ?? '').trim();
    if (!repo) throw bridgeError('BAD_ARGS', 'repo required', 'Which repository should we star?');
    try {
      return await starGithubRepo(repo);
    } finally {
      focusCanvas();
    }
  },
};

function bridgeError(code: BridgeError['code'], message: string, bankLine?: string): BridgeError {
  return { code, message, bankLine };
}

function toError(e: unknown): BridgeError {
  if (e && typeof e === 'object' && 'code' in e && 'message' in e) {
    const err = e as { code: string; message: string; bankLine?: string; status?: number };
    return { code: err.code, message: err.message, ...(err.bankLine ? { bankLine: err.bankLine } : {}), ...(err.status ? { status: err.status } : {}) };
  }
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
      const payload = { version: BRIDGE_VERSION, mock: MOCK_MODE };
      emit({ type: 'event', kind: 'bridge.ready', payload });
      // Let the engine know the door is open (arrives as type:'event' in Chain.gd).
      queueMicrotask(() => cb(JSON.stringify({ type: 'event', kind: 'bridge.ready', payload })));
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

  // Background tabs throttle Godot's frame loop (docs/GODOT.md §5). When the tab comes back, tell the game
  // so it reconciles the ledger board with `listPending` once — SSE kept running here in the meantime.
  document.addEventListener('visibilitychange', () => {
    const msg = { type: 'event', kind: 'tab.visible', payload: { visible: document.visibilityState === 'visible' } };
    emit(msg as BridgeMessage);
    godotCallback?.(JSON.stringify(msg));
  });

  window.BranchZero = bridge;
  // Extra flag for Godot DemoWalk.wanted() — not part of the JSON bridge contract.
  (window.BranchZero as BranchZeroBridge & { demoWalk?: boolean }).demoWalk = DEMO_WALK;
  return bridge;
}
