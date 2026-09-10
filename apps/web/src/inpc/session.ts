/**
 * Where the iNPC's key and conversation live: this tab, this session, nowhere else.
 *
 * Principal lock (docs/INPC.md): the product never stores an OpenRouter key in `.env`, `VITE_*` or the build. The
 * player pastes it on Wake, it sits in `sessionStorage` (survives a reload of *this* tab, dies with it), and Sleep
 * wipes it together with the transcript. `localStorage` is never touched. The transcript is memory only.
 */
import type { ChatMessage } from './types';

export const INPC_KEY_SLOT = 'inpc.openrouter.key';

/** Bank-facing history cap: enough to carry a conversation, small enough that the snapshot stays the loudest thing. */
export const HISTORY_MAX = 12;

let transcript: ChatMessage[] = [];
const listeners = new Set<() => void>();

function store(): Storage | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

export function readKey(): string {
  try {
    return store()?.getItem(INPC_KEY_SLOT) ?? '';
  } catch {
    return '';
  }
}

export function hasKey(): boolean {
  return readKey().length > 0;
}

export function writeKey(key: string): void {
  const k = key.trim();
  if (!k) return;
  store()?.setItem(INPC_KEY_SLOT, k);
  notify();
}

/** Sleep: forget the key and everything that was said with it. */
export function wipe(): void {
  try {
    store()?.removeItem(INPC_KEY_SLOT);
  } catch {
    /* nothing to wipe */
  }
  transcript = [];
  notify();
}

export function getTranscript(): ChatMessage[] {
  return transcript;
}

export function appendTranscript(m: ChatMessage): void {
  transcript = [...transcript, m].slice(-(HISTORY_MAX * 2));
  notify();
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(): void {
  for (const l of listeners) l();
}

/**
 * Build-time guard the panel shows in red if it ever trips: no `VITE_*OPENROUTER*` may exist in the bundle. Vite
 * inlines `import.meta.env` as an object literal, so this is a real check of what shipped, not a promise.
 */
export function envLeaks(): string[] {
  try {
    return Object.keys(import.meta.env).filter((k) => /OPENROUTER|INPC/i.test(k));
  } catch {
    return [];
  }
}
