import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Address, Hex } from 'viem';
import type { JobStage, SigningMode, StageEvent } from '@branch-zero/shared';
import { REPO_ROOT } from './config.ts';

/**
 * The player index: which Privy user owns which account, plus the Privy policy handles we need to keep
 * tightening. The chain stays the source of truth for every balance, status and release time.
 *
 * U2 persists this map to a small JSON file (`apps/teller-desk/.data/players.json`, git-ignored, no
 * secrets). U1 kept it in memory, which meant a Teller Desk restart forgot every account and the next
 * "Open my account" cloned a fresh one (16.2 M gas, and the old balance stranded). With a vault clock
 * running for minutes, losing the index mid-wire is not acceptable. ARCHITECTURE §2.3 names SQLite for
 * this; a JSON file is the same durability at hackathon scale and one less dependency.
 */
export interface Player {
  privyUserId: string;
  ownerAddress: Address;
  walletId: string;
  account?: Address;
  policyId?: string;
  /** Rule allowing `eth_signTypedData_v4` for Bloxchain meta-transactions (U1, K5). */
  policyRuleId?: string;
  /** Set once the typed-data rule names this player's account (K5 fully pinned). */
  policyPinned?: boolean;
  /**
   * Rules allowing `eth_signTransaction` for the owner's own direct calls (U2, V6): `executeWithTimeLock`,
   * `approveTimeLockExecution`, `cancelTimeLockExecution` on the player's account only.
   */
  txRuleIds?: string[];
  /** How far the `eth_signTransaction` rules could be scoped — see privy.ts `TX_POLICY_MODES`. */
  txPolicyMode?: 'calldata' | 'to-only';
  /** Set once the `eth_signTransaction` rules name this player's account. */
  txPolicyPinned?: boolean;
  signingMode: SigningMode;
  /** Set once the guard batch has whitelisted the demo token for `transfer`. */
  configured?: boolean;
  /** Version of the role-permission set applied to this account (provision.ts `ROLE_SET_VERSION`). */
  roleSet?: number;
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
  releaseTime?: string;
  updatedAt: number;
}

const DATA_DIR = path.join(REPO_ROOT, 'apps', 'teller-desk', '.data');
const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');
const RECEIPTS_FILE = path.join(DATA_DIR, 'receipts.json');

const players = new Map<string, Player>();
const receipts = new Map<string, Receipt[]>();
const listeners = new Map<string, Set<(e: StageEvent) => void>>();

function load(): void {
  try {
    const raw = JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8')) as Player[];
    for (const p of raw) players.set(p.privyUserId, p);
  } catch {
    /* first run */
  }
  try {
    const raw = JSON.parse(fs.readFileSync(RECEIPTS_FILE, 'utf8')) as Record<string, Receipt[]>;
    for (const [id, list] of Object.entries(raw)) receipts.set(id, list);
  } catch {
    /* first run */
  }
}

/**
 * Write the player index now, not later. U2 debounced this by 50 ms; `tsx watch` restarts the process the
 * instant a source file is saved, and the U4 playtest found a player whose `account` had been written but
 * whose `configured` / `roleSet` never landed — Wire then failed `NoPermission` until a Re-check. The file is
 * a few KB and changes a handful of times per session; a synchronous write is the cheaper guarantee.
 */
function flush(): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    // Merge with what is on disk: the dev server and the kill-test scripts share this file, and each
    // process only knows its own players. In-memory entries win for the ids this process has touched.
    const merged = new Map<string, Player>();
    try {
      for (const p of JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8')) as Player[]) merged.set(p.privyUserId, p);
    } catch {
      /* no file yet */
    }
    for (const [id, p] of players) merged.set(id, p);
    writeAtomic(PLAYERS_FILE, JSON.stringify([...merged.values()], null, 2));
  } catch (e) {
    console.error('player index not persisted:', (e as Error).message);
  }
}

/**
 * Receipts are the ledger board's right-hand column. U3 kept them in memory, so a Teller Desk restart
 * mid-wire blanked the board while the chain still had the record. Same file discipline as the players,
 * debounced because a job emits several stages a second.
 */
let receiptsTimer: NodeJS.Timeout | undefined;
function flushReceipts(): void {
  if (receiptsTimer) return;
  receiptsTimer = setTimeout(() => {
    receiptsTimer = undefined;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      writeAtomic(RECEIPTS_FILE, JSON.stringify(Object.fromEntries(receipts), null, 2));
    } catch (e) {
      console.error('receipts not persisted:', (e as Error).message);
    }
  }, 200);
}

/** Never leave a half-written index behind: write beside, then rename over. */
function writeAtomic(file: string, data: string): void {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}
load();

export function upsertPlayer(p: Omit<Player, 'createdAt'>): Player {
  const existing = players.get(p.privyUserId);
  const next: Player = { ...existing, ...p, createdAt: existing?.createdAt ?? Date.now() };
  players.set(p.privyUserId, next);
  flush();
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
  flush();
  return next;
}

export function newJobId(): string {
  return randomUUID().slice(0, 8);
}

/** Record a stage and fan it out to this player's SSE stream. */
export function emitStage(privyUserId: string, e: StageEvent): void {
  const list = receipts.get(privyUserId) ?? [];
  const idx = list.findIndex((r) => r.jobId === e.jobId);
  const prev = idx >= 0 ? list[idx] : { jobId: e.jobId, lane: e.lane };
  const receipt: Receipt = {
    ...prev,
    stage: e.stage,
    hash: (e.hash as Hex | undefined) ?? (prev as Receipt).hash,
    txId: e.txId ?? (prev as Receipt).txId,
    reason: e.reason,
    releaseTime: e.releaseTime ?? (prev as Receipt).releaseTime,
    updatedAt: Date.now(),
  };
  if (idx >= 0) list[idx] = receipt;
  else list.push(receipt);
  receipts.set(privyUserId, list.slice(-25));
  if (e.lane !== 'CONFIG') flushReceipts(); // the SSE "hello" is not a receipt worth a disk write
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

export function hasSubscribers(privyUserId: string): boolean {
  return (listeners.get(privyUserId)?.size ?? 0) > 0;
}

/**
 * One meta-transaction at a time per player: `createMetaTxParams` reads the current signer nonce from
 * the contract, so two concurrent signatures would share a nonce and the second would revert. The same
 * holds for the owner's direct transactions (U2): one account nonce, one in-flight tx.
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
