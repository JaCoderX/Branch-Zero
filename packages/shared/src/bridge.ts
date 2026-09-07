/**
 * JSON-only protocol between GDScript (`autoload/chain.gd`) and `window.BranchZero` (apps/web/src/bridge).
 * Godot never sees keys, hex ABI, or RPC URLs — only display-ready JSON.
 */
/**
 * Bridge-level codes. Teller Desk codes (`NO_ACCOUNT`, `NOT_PENDING`, `NO_MANAGER`, `policy_violation`, …) and
 * decoded protocol error names (`BeforeReleaseTime`, `NoPermission`, `TargetNotWhitelisted`, …) travel in the
 * same field, so the game maps *one* string to an NPC line (apps/game/dialogue/errors.json, NPCS.md §5).
 */
export type BridgeErrorCode = 'TIMEOUT' | 'UNKNOWN_METHOD' | 'BAD_ARGS' | 'RPC' | 'NOT_IMPLEMENTED' | 'INTERNAL' | 'AUTH' | 'POLICY' | 'CHAIN' | 'LOGIN_CANCELLED';

export interface BridgeError {
  code: BridgeErrorCode | (string & {});
  message: string;
  /** Everyday-bank wording for NPC lines; technical detail stays in `message`. */
  bankLine?: string;
  /** HTTP status when the error came back from the Teller Desk. */
  status?: number;
}

export interface BridgeResponse {
  type: 'response';
  id: string;
  ok: boolean;
  result?: unknown;
  error?: BridgeError;
}

export interface BridgeEvent {
  type: 'event';
  kind: string;
  payload: Record<string, unknown>;
}

export type BridgeMessage = BridgeResponse | BridgeEvent;

/**
 * Methods available in U0–U3. Later units extend this union (see docs/GODOT.md §4).
 * U1 adds the Account Opening desk (`login` … `provision`) and the Lane A counter (`pay`).
 * U2 adds the vault: `wire` (Lane B request), `approve` / `cancel`, `listPending`.
 * U3 adds the reads the greybox needs without opening a modal: `getSession` (who is at the desk, no
 * login prompt) and `getHistory` (the ledger board's receipts). Both are backed by existing routes.
 * U4+ adds `priority` — the one bridge method that is allowed to open a second Privy surface (the Passkey / hand
 * scan), over `/priority/prepare` + `/priority/submit`. `approve` is owner-only from here on.
 * U5 adds the ENS Name Desk reads/writes; they never change the Remote EVM payment lanes.
 */
export type BridgeMethod =
  | 'echo'
  | 'chainInfo'
  | 'accountInfo'
  // U1 — Account Opening
  | 'login'
  | 'logout'
  | 'addSessionSigner'
  | 'removeSessionSigner'
  | 'provision'
  // U1 — counter
  | 'getPassbook'
  | 'pay'
  // U2 — vault
  | 'wire'
  | 'approve'
  | 'cancel'
  | 'listPending'
  // U3 — bank shell reads
  | 'getSession'
  | 'getHistory'
  // U4+ — Priority release (Okafor): owner Passkey signature in the browser, manager submits before the clock
  | 'priority'
  // U5 — ENS Name Desk (Sepolia identity; payments still use 1337)
  | 'ensAvailable'
  | 'ensMint'
  | 'ensSetText'
  | 'resolveName';

/** How the owner's signature is obtained for meta-transactions. */
export type SigningMode = 'session' | 'client';

/**
 * Stage names pushed while a job runs; the Teller Desk emits them over SSE.
 * U2 adds the vault states: `pending` (time-locked record exists, clock running), `released`
 * (chain time has passed `releaseTime`), `cancelled`.
 */
export type JobStage =
  | 'queued'
  | 'provisioning'
  | 'configuring'
  | 'funding'
  | 'signing'
  | 'broadcasting'
  | 'pending'
  | 'released'
  | 'mined'
  | 'cancelled'
  | 'failed';

/** On-chain record status as the SDK's `TxStatus` names it. */
export type RecordStatus = 'UNDEFINED' | 'PENDING' | 'EXECUTING' | 'PROCESSING_PAYMENT' | 'CANCELLED' | 'COMPLETED' | 'FAILED';

export interface StageEvent {
  type: 'stage';
  jobId: string;
  lane: 'A' | 'B' | 'CONFIG' | 'PROVISION' | 'ENS';
  stage: JobStage;
  /** Bank-counter wording for the NPC; always safe to show. */
  bankLine: string;
  hash?: string;
  txId?: string;
  account?: string;
  reason?: string;
  /**
   * Vault clock (U2). `releaseTime` is the record's `releaseTime` read from the chain (unix seconds,
   * decimal string) — never a local timer. `chainNow` is the latest block timestamp, which on an
   * on-demand-mining dev chain lags between transactions; `serverNow` is the Teller Desk's wall clock so
   * the overlay can correct its own. The clock is green when `releaseTime <= now`.
   */
  releaseTime?: string;
  chainNow?: string;
  serverNow?: string;
  status?: RecordStatus;
  /** U4+: which way the wire left the vault. `priority` = owner Passkey + manager meta-approve before the clock. */
  via?: 'priority';
}

/** One time-locked record as the vault board shows it. Strings only (bigint → decimal). */
export interface PendingWire {
  txId: string;
  status: RecordStatus;
  releaseTime: string;
  /** `releaseTime <= serverNow` — the door may be opened. */
  released: boolean;
  to?: string;
  amount?: string;
  requester: string;
}

/**
 * `getSession` result — what the Account Opening desk knows without prompting anyone. `loggedIn:false`
 * is a normal answer, not an error; the clerk offers "Sign in" (the one wallet modal) in that case.
 */
export interface DeskSession {
  loggedIn: boolean;
  /** Privy provider finished initialising (a `false` here means "ask again in a moment"). */
  ready: boolean;
  userId?: string;
  owner?: string;
  account?: string | null;
  delegated?: boolean;
  signingMode?: SigningMode;
  chainId?: number;
  timeLockSec?: number;
  instantLimit?: string;
  /** Branch Manager address when the Teller Desk has one; enables the shredder and (U4+) the Priority desk. */
  manager?: string | null;
  /** U5: the latest customer subname this player claimed under branchzero.eth. */
  ensName?: string | null;
  /** U4+: the branch runs Priority releases and this account carries the META_APPROVE split (ROLE_SET 3). */
  priority?: boolean;
  token?: { address: string; symbol: string; decimals: number };
}

/**
 * Events the bridge pushes to Godot besides `stage`: `bridge.ready` {version, mock}, `tab.visible` {visible} and
 * (U4) `desk.link` {connected, attempt, reason?} — the state of the Teller Desk SSE stream, so the game can say
 * "reconnecting…" from real link state and reconcile the board when the link comes back.
 */
export type BridgeEventKind = 'bridge.ready' | 'stage' | 'tab.visible' | 'desk.link';

export interface BranchZeroBridge {
  /** Godot registers its `JavaScriptBridge.create_callback` here; JS calls it with one JSON string. */
  setGodotCallback(cb: (json: string) => void): void;
  /** Fire-and-forget from GDScript; reply arrives through the callback as a `BridgeResponse` with the same id. */
  request(method: string, argsJson: string, id: string): void;
  /** Promise form for the React overlay / tests. */
  call<T = unknown>(method: string, args?: Record<string, unknown>): Promise<T>;
  readonly version: string;
}
