/**
 * JSON-only protocol between GDScript (`autoload/chain.gd`) and `window.BranchZero` (apps/web/src/bridge).
 * Godot never sees keys, hex ABI, or RPC URLs — only display-ready JSON.
 */
export type BridgeErrorCode = 'TIMEOUT' | 'UNKNOWN_METHOD' | 'BAD_ARGS' | 'RPC' | 'NOT_IMPLEMENTED' | 'INTERNAL' | 'AUTH' | 'POLICY' | 'CHAIN';

export interface BridgeError {
  code: BridgeErrorCode;
  message: string;
  /** Everyday-bank wording for NPC lines; technical detail stays in `message`. */
  bankLine?: string;
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
 * Methods available in U0–U2. Later units extend this union (see docs/GODOT.md §4).
 * U1 adds the Account Opening desk (`login` … `provision`) and the Lane A counter (`pay`).
 * U2 adds the vault: `wire` (Lane B request), `approve` / `cancel`, `listPending`.
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
  | 'listPending';

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
  lane: 'A' | 'B' | 'CONFIG' | 'PROVISION';
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

export interface BranchZeroBridge {
  /** Godot registers its `JavaScriptBridge.create_callback` here; JS calls it with one JSON string. */
  setGodotCallback(cb: (json: string) => void): void;
  /** Fire-and-forget from GDScript; reply arrives through the callback as a `BridgeResponse` with the same id. */
  request(method: string, argsJson: string, id: string): void;
  /** Promise form for the React overlay / tests. */
  call<T = unknown>(method: string, args?: Record<string, unknown>): Promise<T>;
  readonly version: string;
}
