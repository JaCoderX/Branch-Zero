/**
 * The iNPC's view of the player — the *only* player-specific truth it is ever given (docs/INPC.md,
 * docs/missions/HANDOFF-inpc-openrouter.md §4). Godot builds it in `GameState.inpc_snapshot()` from the same mirror
 * the passbook and the vault board render; the shell whitelists it again here (`sanitizeSnapshot`) so a field that
 * is not on this list never reaches the model, whatever the sender.
 *
 * Deliberately absent: account / owner addresses, tx hashes, calldata, receipts, keys of any kind, Live/Dev and
 * desk-link flags, till health. `payee_short` is the board's own shortened form of a payee the player typed.
 */
export interface InpcWire {
  /** The board's slip number, `#14`. */
  slip: string;
  amount_display: string;
  payee_short: string;
  /** Chain record status word (`PENDING` until a release or recall mines). */
  status: string;
  /** What the vault clock says: `READY` once `release_ready`, else `PENDING`. */
  board_word: 'READY' | 'PENDING';
  /** The vault clock has run down (`releaseTime <= desk now`). The only thing that may ever be called READY. */
  release_ready: boolean;
  /** `m:ss` still to cool; `0:00` once ready. */
  cooling_left_display: string;
  /** Chain `releaseTime`, unix seconds — the shell re-derives the three fields above from this at send time. */
  release_at_unix: number;
  /** `HH:MM` on the player's clock. */
  release_at_display: string;
}

export interface InpcSnapshot {
  schema: string;
  /** Teller Desk wall clock at build time (unix seconds) — the vault clock counts against this, never the chain. */
  desk_now_unix: number;
  logged_in: boolean;
  has_account: boolean;
  wing: string;
  network: string;
  bank_name: string;
  tier: string;
  balance_display: string;
  currency_note: string;
  counter_limit_display: string;
  cooling_period_display: string;
  pending_count: number;
  pending_wires: InpcWire[];
  viewing_wallets_count: number;
  player_zone: string;
  who_can_help: string[];
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
