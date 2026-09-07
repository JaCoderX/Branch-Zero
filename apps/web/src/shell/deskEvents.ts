/**
 * The Teller Desk's SSE stream, with reconnection.
 *
 * A bare `EventSource` retries on its own, but not with a fresh access token, and not after the server
 * answered 401 or the dev proxy answered 500 — and U3 closed it on the first error, so a Teller Desk restart
 * or a dropped connection silently ended the stage feed until the page was reloaded. This keeps one stream
 * alive: on any error it closes, waits (2 s doubling to 30 s), asks for a fresh URL (fresh token) and reopens.
 * `onLink` reports every transition so the bridge can tell Godot (`desk.link`) and the game can reconcile the
 * board — the server re-reads the vault and re-arms its watchers on every connect (`/events`).
 */
import type { StageEvent } from '@branch-zero/shared';

export interface DeskLink {
  connected: boolean;
  /** Reconnect attempts since the last successful open (0 on the first connection of a session). */
  attempt: number;
  reason?: string;
}

export interface DeskEventsOptions {
  /** Builds the stream URL for the next connection — called every time, so the token can be renewed. */
  url: () => Promise<string>;
  onEvent: (e: StageEvent) => void;
  onLink: (l: DeskLink) => void;
  minDelayMs?: number;
  maxDelayMs?: number;
}

/** Start the stream. Returns a stop function; after it, nothing is reopened. */
export function connectDeskEvents(opts: DeskEventsOptions): () => void {
  const minDelay = opts.minDelayMs ?? 2_000;
  const maxDelay = opts.maxDelayMs ?? 30_000;
  let closed = false;
  let attempt = 0;
  let es: EventSource | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const open = async () => {
    if (closed) return;
    let url: string;
    try {
      url = await opts.url();
    } catch (e) {
      return fail(`no url: ${(e as Error).message}`);
    }
    if (closed) return;
    const s = new EventSource(url);
    es = s;
    s.onopen = () => {
      opts.onLink({ connected: true, attempt });
      attempt = 0;
    };
    s.onmessage = (ev) => {
      try {
        opts.onEvent(JSON.parse(ev.data) as StageEvent);
      } catch {
        /* not one of ours */
      }
    };
    s.onerror = () => {
      // readyState CLOSED = the server refused (401, proxy 500); CONNECTING = the connection dropped.
      fail(s.readyState === EventSource.CLOSED ? 'refused' : 'dropped');
    };
  };

  const fail = (reason: string) => {
    if (closed) return;
    es?.close();
    es = undefined;
    opts.onLink({ connected: false, attempt, reason });
    const delay = Math.min(maxDelay, minDelay * 2 ** Math.min(attempt, 6));
    attempt += 1;
    timer = setTimeout(() => void open(), delay);
  };

  void open();
  return () => {
    closed = true;
    if (timer) clearTimeout(timer);
    es?.close();
    es = undefined;
  };
}
