import type { InpcSnapshot, InpcWire } from './types';

/** Anything that looks like a 32-byte hash or a raw key has no business in a teaching snapshot, whoever built it. */
const HASHLIKE = /0x[0-9a-fA-F]{40,}|sk-or-[A-Za-z0-9-]+/g;

function str(v: unknown, max = 160): string {
  if (v === null || v === undefined) return '';
  return String(v).replace(HASHLIKE, '[redacted]').slice(0, max);
}
function bool(v: unknown): boolean {
  return v === true;
}
function num(v: unknown): number {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : 0;
  return Number.isFinite(n) ? n : 0;
}

/**
 * Whitelist copy of whatever arrived over the bridge. Unknown keys are dropped, every value is coerced to the type the
 * prompt expects, and hash-shaped strings are redacted. The result is what the model sees — nothing else.
 */
export function sanitizeSnapshot(raw: unknown): InpcSnapshot {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const wiresIn = Array.isArray(r.pending_wires) ? (r.pending_wires as unknown[]) : [];
  const pending_wires: InpcWire[] = wiresIn.slice(0, 12).map((w) => {
    const x = (w && typeof w === 'object' ? w : {}) as Record<string, unknown>;
    return {
      slip: str(x.slip, 24),
      amount_display: str(x.amount_display, 48),
      payee_short: str(x.payee_short, 24),
      status: str(x.status, 16),
      board_word: x.board_word === 'READY' ? 'READY' : 'PENDING',
      release_ready: bool(x.release_ready),
      cooling_left_display: str(x.cooling_left_display, 12),
      release_at_unix: num(x.release_at_unix),
      release_at_display: str(x.release_at_display, 8),
    };
  });
  const help = Array.isArray(r.who_can_help) ? (r.who_can_help as unknown[]).slice(0, 8).map((h) => str(h, 200)) : [];
  return {
    schema: str(r.schema, 48),
    desk_now_unix: num(r.desk_now_unix),
    logged_in: bool(r.logged_in),
    has_account: bool(r.has_account),
    wing: str(r.wing, 16),
    network: str(r.network, 64),
    bank_name: str(r.bank_name, 80),
    tier: str(r.tier, 16),
    balance_display: str(r.balance_display, 48),
    currency_note: str(r.currency_note, 160),
    counter_limit_display: str(r.counter_limit_display, 80),
    cooling_period_display: str(r.cooling_period_display, 12),
    pending_count: pending_wires.length,
    pending_wires,
    viewing_wallets_count: num(r.viewing_wallets_count),
    player_zone: str(r.player_zone, 40),
    who_can_help: help,
  };
}

function fmt(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Bring the vault clock up to the moment of asking. Godot stamped `desk_now_unix` when it built the snapshot; the
 * time since then has passed on this machine's clock, so desk-now = stamped + elapsed (the desk offset is already
 * inside the stamp — docs/GODOT.md §5). READY flips here, at send time, and only from `release_at_unix`.
 */
export function freshenSnapshot(snap: InpcSnapshot, receivedAtMs: number, nowMs = Date.now()): InpcSnapshot {
  if (!snap.desk_now_unix) return snap;
  const deskNow = snap.desk_now_unix + Math.max(0, (nowMs - receivedAtMs) / 1000);
  return {
    ...snap,
    desk_now_unix: Math.floor(deskNow),
    pending_wires: snap.pending_wires.map((w) => {
      if (!w.release_at_unix) return w;
      const left = w.release_at_unix - deskNow;
      const ready = left <= 0;
      return { ...w, release_ready: ready, board_word: ready ? 'READY' : 'PENDING', cooling_left_display: ready ? '0:00' : fmt(left) };
    }),
  };
}

/** One line for the panel's header — what the assistant is currently reading. */
export function summarize(snap: InpcSnapshot): string {
  if (!snap.has_account) return snap.logged_in ? 'signed in · no account yet' : 'no account on file';
  const ready = snap.pending_wires.filter((w) => w.release_ready).length;
  const wires = snap.pending_count === 0 ? 'no wires in the vault' : `${snap.pending_count} in the vault${ready ? ` · ${ready} READY` : ''}`;
  return `${snap.balance_display} · ${wires}${snap.bank_name ? ` · ${snap.bank_name}` : ''}`;
}
