/**
 * JSON-only protocol between GDScript (`autoload/chain.gd`) and `window.BranchZero` (apps/web/src/bridge).
 * Godot never sees keys, hex ABI, or RPC URLs — only display-ready JSON.
 */
export type BridgeErrorCode = 'TIMEOUT' | 'UNKNOWN_METHOD' | 'BAD_ARGS' | 'RPC' | 'NOT_IMPLEMENTED' | 'INTERNAL';

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

/** Methods available in U0. Later units extend this union (see docs/GODOT.md §4). */
export type BridgeMethod = 'echo' | 'chainInfo' | 'accountInfo';

export interface BranchZeroBridge {
  /** Godot registers its `JavaScriptBridge.create_callback` here; JS calls it with one JSON string. */
  setGodotCallback(cb: (json: string) => void): void;
  /** Fire-and-forget from GDScript; reply arrives through the callback as a `BridgeResponse` with the same id. */
  request(method: string, argsJson: string, id: string): void;
  /** Promise form for the React overlay / tests. */
  call<T = unknown>(method: string, args?: Record<string, unknown>): Promise<T>;
  readonly version: string;
}
