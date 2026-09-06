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
 * Methods available in U0 + U1. Later units extend this union (see docs/GODOT.md §4).
 * U1 adds the Account Opening desk (`login` … `provision`) and the Lane A counter (`pay`).
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
  | 'pay';

/** How the owner's signature is obtained for meta-transactions. */
export type SigningMode = 'session' | 'client';

/** Stage names pushed while a job runs; the Teller Desk emits them over SSE. */
export type JobStage = 'queued' | 'provisioning' | 'configuring' | 'funding' | 'signing' | 'broadcasting' | 'mined' | 'failed';

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
