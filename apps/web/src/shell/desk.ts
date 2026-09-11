/**
 * Which Teller Desk the shell talks to for the Live wing - resolved at RUNTIME, not only at build.
 *
 * The public front (`https://branchzero.app`) holds no keys and is common; the desk holds the hot keys and the
 * player index and is the operator's to run. When the principal takes the hosted desk down, an operator runs the
 * same Docker image locally and points this shell at it (docs/HOSTING.md). Precedence, highest first:
 *
 *   1. `?desk=https://...`            -> persisted to localStorage['bz.desk'] so the choice survives a reload
 *   2. localStorage['bz.desk']
 *   3. import.meta.env.VITE_TELLER_DESK_URL   (the build's default hosted desk)
 *   4. '/api'                          (the Vite dev proxy)
 *
 * Only `https://` origins, or `http://` on localhost / 127.0.0.1 / [::1], are accepted; anything else is ignored
 * with a console warning and never stored. A chosen desk that does not answer is NAMED by the desk-debug panel -
 * the shell never silently falls back to the hosted desk, because that would hand the player's session to a desk
 * they chose not to use. `?desk=` (empty), `?desk=default` or `?desk=reset` clears the saved choice.
 *
 * Only the Live slot is overridable. The Dev (`/dev-api`, Remote EVM 1337) and Arc proxies are laptop-only
 * conveniences and stay as they are.
 */

export const DESK_STORAGE_KEY = 'bz.desk';
export const DESK_QUERY_PARAM = 'desk';

export type DeskSource = 'query' | 'saved' | 'env' | 'default';

export interface DeskChoice {
  /** Base URL, no trailing slash: `https://desk.example.org`, `http://localhost:8787`, `/api`. */
  url: string;
  source: DeskSource;
  /** True when the operator chose this desk (query or saved) rather than the build's default. */
  override: boolean;
  /** The last rejected input, if any, so the panel can say why nothing changed. */
  rejected?: string;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Normalise an operator-supplied desk URL, or return `undefined` when it must not be used.
 * Accepts `https://host[:port][/path]` from anywhere and `http://` only for loopback hosts (which browsers treat
 * as potentially trustworthy, so an https shell may call them). Credentials, query strings and fragments are
 * refused rather than stripped: a desk URL is an origin plus an optional path prefix, nothing more.
 */
export function acceptDeskUrl(raw: string): string | undefined {
  const text = raw.trim();
  if (!text) return undefined;
  let u: URL;
  try {
    u = new URL(text);
  } catch {
    return undefined;
  }
  if (u.username || u.password || u.search || u.hash) return undefined;
  const local = LOCAL_HOSTS.has(u.hostname) || u.hostname.endsWith('.localhost');
  if (u.protocol === 'https:') {
    /* any host */
  } else if (u.protocol === 'http:' && local) {
    /* loopback only */
  } else {
    return undefined;
  }
  const path = u.pathname.replace(/\/+$/, '');
  return `${u.origin}${path}`;
}

function warn(msg: string): void {
  // eslint-disable-next-line no-console
  console.warn(`[branch-zero] desk override ignored: ${msg}`);
}

function readSaved(): string | undefined {
  try {
    const v = localStorage.getItem(DESK_STORAGE_KEY);
    return v ?? undefined;
  } catch {
    return undefined;
  }
}

function writeSaved(url: string | undefined): void {
  try {
    if (url) localStorage.setItem(DESK_STORAGE_KEY, url);
    else localStorage.removeItem(DESK_STORAGE_KEY);
  } catch {
    /* storage unavailable: the choice lives for this page only */
  }
}

function buildDefault(): Pick<DeskChoice, 'url' | 'source'> {
  const env = String(import.meta.env.VITE_TELLER_DESK_URL ?? '').trim().replace(/\/+$/, '');
  return env ? { url: env, source: 'env' } : { url: '/api', source: 'default' };
}

let resolved: DeskChoice | undefined;

/** Resolve once per page load. Module-level so every reader (wallet hook, SSE URL, GitHub star) agrees. */
export function resolveLiveDesk(): DeskChoice {
  if (resolved) return resolved;
  let rejected: string | undefined;

  // 1. query param
  let fromQuery: string | undefined;
  let clearRequested = false;
  try {
    const params = new URLSearchParams(location.search);
    if (params.has(DESK_QUERY_PARAM)) {
      const raw = params.get(DESK_QUERY_PARAM) ?? '';
      const lowered = raw.trim().toLowerCase();
      if (lowered === '' || lowered === 'default' || lowered === 'reset') {
        clearRequested = true;
      } else {
        fromQuery = acceptDeskUrl(raw);
        if (!fromQuery) {
          rejected = raw;
          warn(`"${raw}" is not an https:// URL or an http://localhost URL`);
        }
      }
    }
  } catch {
    /* no location (tests) */
  }

  if (clearRequested) writeSaved(undefined);
  if (fromQuery) {
    writeSaved(fromQuery);
    resolved = { url: fromQuery, source: 'query', override: true, rejected };
    return resolved;
  }

  // 2. saved
  const savedRaw = readSaved();
  if (savedRaw !== undefined) {
    const saved = acceptDeskUrl(savedRaw);
    if (saved) {
      resolved = { url: saved, source: 'saved', override: true, rejected };
      return resolved;
    }
    warn(`saved value "${savedRaw}" is not acceptable any more; cleared`);
    writeSaved(undefined);
  }

  // 3./4. build default
  resolved = { ...buildDefault(), override: false, rejected };
  return resolved;
}

/** The Live desk base URL every caller must use. */
export function liveDeskBase(): string {
  return resolveLiveDesk().url;
}

/**
 * Back to the build's default desk: forget the saved choice, drop `?desk=` from the address bar and reload.
 * A reload is deliberate - the Privy session, the SSE stream and the passbook are all bound to one desk, and
 * the page is the unit that owns them.
 */
export function resetDesk(): void {
  writeSaved(undefined);
  try {
    const u = new URL(location.href);
    u.searchParams.delete(DESK_QUERY_PARAM);
    history.replaceState(history.state, '', u.toString());
  } catch {
    /* ignore */
  }
  location.reload();
}

/** Human label for the panel. */
export function describeDeskSource(source: DeskSource): string {
  switch (source) {
    case 'query':
      return 'chosen with ?desk= (saved for this browser)';
    case 'saved':
      return 'saved choice from an earlier ?desk=';
    case 'env':
      return "this build's default desk";
    default:
      return 'same-origin /api proxy';
  }
}
