import { randomUUID } from 'node:crypto';
import type { Address, Hex } from 'viem';
import type { JobStage, SigningMode, StageEvent } from '@branch-zero/shared';

/**
 * U1 keeps the player index in memory. The chain is the source of truth for every balance, status and
 * release time; this map only remembers which Privy user owns which account so a reconnect does not
 * re-provision. ARCHITECTURE §2.3 puts SQLite here — that lands with the watcher in U2, when there is
 * asynchronous state worth surviving a restart.
 */
export interface Player {
  privyUserId: string;
  ownerAddress: Address;
  walletId: string;
  account?: Address;
  policyId?: string;
  policyRuleId?: string;
  /** Set once the policy rule names this player's account (K5 fully pinned). */
  policyPinned?: boolean;
  signingMode: SigningMode;
  /** Set once the guard batch has whitelisted the demo token for `transfer`. */
  configured?: boolean;
  createdAt: number;
}

export interface Receipt {
  jobId: string;
  lane: StageEvent['lane'];
  stage: JobStage;
  hash?: Hex;
  txId?: string;
  payee?: Address;
  amount?: string;
  reason?: string;
  updatedAt: number;
}

const players = new Map<string, Player>();
const receipts = new Map<string, Receipt[]>();
const listeners = new Map<string, Set<(e: StageEvent) => void>>();

export function upsertPlayer(p: Omit<Player, 'createdAt'>): Player {
  const existing = players.get(p.privyUserId);
  const next: Player = { ...existing, ...p, createdAt: existing?.createdAt ?? Date.now() };
  players.set(p.privyUserId, next);
  return next;
}

export function getPlayer(privyUserId: string): Player | undefined {
  return players.get(privyUserId);
}

export function patchPlayer(privyUserId: string, patch: Partial<Player>): Player {
  const p = players.get(privyUserId);
  if (!p) throw new Error(`unknown player ${privyUserId}`);
  const next = { ...p, ...patch };
  players.set(privyUserId, next);
  return next;
}

export function newJobId(): string {
  return randomUUID().slice(0, 8);
}

/** Record a stage and fan it out to this player's SSE stream. */
export function emitStage(privyUserId: string, e: StageEvent): void {
  const list = receipts.get(privyUserId) ?? [];
  const idx = list.findIndex((r) => r.jobId === e.jobId);
  const receipt: Receipt = {
    ...(idx >= 0 ? list[idx] : { jobId: e.jobId, lane: e.lane }),
    stage: e.stage,
    hash: e.hash as Hex | undefined,
    txId: e.txId,
    reason: e.reason,
    updatedAt: Date.now(),
  };
  if (idx >= 0) list[idx] = receipt;
  else list.push(receipt);
  receipts.set(privyUserId, list.slice(-25));
  for (const l of listeners.get(privyUserId) ?? []) l(e);
}

export function listReceipts(privyUserId: string): Receipt[] {
  return receipts.get(privyUserId) ?? [];
}

export function subscribe(privyUserId: string, cb: (e: StageEvent) => void): () => void {
  const set = listeners.get(privyUserId) ?? new Set();
  set.add(cb);
  listeners.set(privyUserId, set);
  return () => set.delete(cb);
}

/**
 * One meta-transaction at a time per player: `createMetaTxParams` reads the current signer nonce from
 * the contract, so two concurrent signatures would share a nonce and the second would revert.
 */
const queues = new Map<string, Promise<unknown>>();
export function serialize<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = queues.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  queues.set(
    key,
    next.catch(() => undefined),
  );
  return next;
}
