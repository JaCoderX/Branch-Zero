/**
 * Browser → OpenRouter, directly. No Teller Desk proxy, no same-origin relay (docs/INPC.md lock; ENG-2026-0020
 * measured the CORS preflight: 204 with `Access-Control-Allow-Origin: *`, `Authorization` allowed).
 *
 * Two walls the lab hit that look like auth or CORS failures from a page, both surfaced here as plain text:
 *   - **403 "Key limit exceeded"** — a new OpenRouter key defaults to a $0 weekly cap; the player raises it on their
 *     keys page.
 *   - **402 "requires more credits, or fewer max_tokens"** — OpenRouter pre-authorises `max_tokens` × price against
 *     remaining credits, so an unbounded request reserves the model's whole window. `max_tokens` is always sent.
 * There is no silent retry anywhere in this file.
 */
import type { ChatMessage } from './types';

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const OPENROUTER_KEY_URL = 'https://openrouter.ai/api/v1/key';
export const OPENROUTER_KEYS_PAGE = 'https://openrouter.ai/keys';
/** The one model the product offers. `:free` is app-gated (403) and is deliberately not a choice here. */
export const INPC_MODEL = 'thinkingmachines/inkling-small';
export const INPC_MAX_TOKENS = 2048;

export class OpenRouterError extends Error {
  status: number;
  code?: string;
  /** Everyday wording for the panel; `message` keeps OpenRouter's own text. */
  bankLine: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'OpenRouterError';
    this.status = status;
    this.code = code;
    this.bankLine = bankLineFor(status);
  }
}

function bankLineFor(status: number): string {
  switch (status) {
    case 401:
      return 'OpenRouter did not accept that key (401). Check it, or paste a fresh one from your keys page.';
    case 402:
      return 'OpenRouter says the account behind this key needs credits (402). This request is capped at 2048 tokens; the balance still has to cover that.';
    case 403:
      return 'OpenRouter refused the key (403) — most often a weekly limit of $0 on a new key. Raise it on your keys page and try again.';
    case 429:
      return 'OpenRouter is rate-limiting this key (429). Wait a moment before asking again.';
    case 0:
      return 'The browser could not reach openrouter.ai — offline, blocked, or the request was cancelled.';
    default:
      return status >= 500 ? `OpenRouter had a problem on its side (${status}).` : `OpenRouter answered ${status}.`;
  }
}

export interface ChatResult {
  text: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  ms: number;
}

/**
 * One turn. `messages` is `[system, …history, user]` — the caller owns the shape; this only owns the wire format.
 * Reasoning tokens Inkling emits are billed as completion and never shown; only `message.content` comes back.
 */
export async function chat(key: string, messages: ChatMessage[], signal?: AbortSignal): Promise<ChatResult> {
  const t0 = performance.now();
  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': location.origin,
        'X-Title': 'Branch Zero',
      },
      body: JSON.stringify({ model: INPC_MODEL, messages, stream: false, max_tokens: INPC_MAX_TOKENS }),
    });
  } catch (e) {
    throw new OpenRouterError(0, (e as Error).message || 'network error');
  }
  const body = (await res.json().catch(() => ({}))) as {
    error?: { message?: string; code?: number | string };
    choices?: Array<{ message?: { content?: string | null } }>;
    usage?: ChatResult['usage'];
  };
  if (!res.ok || body.error) {
    const status = res.ok ? Number(body.error?.code) || 500 : res.status;
    throw new OpenRouterError(status, body.error?.message ?? res.statusText ?? `HTTP ${res.status}`, body.error?.code !== undefined ? String(body.error.code) : undefined);
  }
  const text = (body.choices?.[0]?.message?.content ?? '').trim();
  return { text, usage: body.usage, ms: Math.round(performance.now() - t0) };
}

export interface KeyInfo {
  limit: number | null;
  limitRemaining: number | null;
  usage: number | null;
  isFreeTier: boolean;
}

/**
 * Best effort read of the key's own limits (`GET /api/v1/key`), so a $0 weekly cap is named on Wake instead of on the
 * first question. Any failure here is swallowed by the caller — it is a courtesy, not a gate.
 */
export async function keyInfo(key: string, signal?: AbortSignal): Promise<KeyInfo> {
  const res = await fetch(OPENROUTER_KEY_URL, { headers: { Authorization: `Bearer ${key}` }, signal });
  const body = (await res.json().catch(() => ({}))) as { data?: Record<string, unknown>; error?: { message?: string } };
  if (!res.ok) throw new OpenRouterError(res.status, body.error?.message ?? res.statusText);
  const d = body.data ?? {};
  const n = (v: unknown) => (typeof v === 'number' ? v : v === null || v === undefined ? null : Number(v));
  return { limit: n(d.limit), limitRemaining: n(d.limit_remaining), usage: n(d.usage), isFreeTier: d.is_free_tier === true };
}
