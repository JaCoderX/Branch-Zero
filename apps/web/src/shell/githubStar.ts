/**
 * GitHub star from the bank front door — game window stays put.
 *
 * GitHub will not let an anonymous page stamp a star. With `VITE_GITHUB_CLIENT_ID` + desk
 * `GITHUB_OAUTH_CLIENT_SECRET`, the first press opens a small OAuth popup; after that we
 * `PUT /user/starred/{owner}/{repo}` and return. Without those envs we open the repo in a
 * **new tab** and ask the visitor to tap Star themselves (honest fallback — the bank tab stays).
 */
import { focusCanvas } from './focus';
import { liveDeskBase } from './desk';

const TOKEN_KEY = 'bz.github.token';
const STATE_KEY = 'bz.github.oauth.state';

export type StarResult = {
  starred: boolean;
  already?: boolean;
  /** `api` = we stamped the star; `tab` = opened the repo in a new tab for a manual Star. */
  via: 'api' | 'tab';
  repo: string;
};

function parseRepo(raw: string): { owner: string; repo: string; full: string } {
  const cleaned = String(raw ?? '')
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '');
  const [owner, repo] = cleaned.split('/');
  if (!owner || !repo || cleaned.split('/').length !== 2) {
    throw Object.assign(new Error(`bad repo ${raw}`), {
      code: 'BAD_ARGS',
      bankLine: 'That is not a repository the branch knows how to star.',
    });
  }
  return { owner, repo, full: `${owner}/${repo}` };
}

function clientId(): string {
  return String(import.meta.env.VITE_GITHUB_CLIENT_ID ?? '').trim();
}

/** Desk URL for the code→token exchange: the same Live desk the wallet hook uses (shell/desk.ts). */
function oauthExchangeUrl(): string {
  return `${liveDeskBase()}/github/oauth`;
}

function openCentered(url: string, name: string, w = 640, h = 740): Window | null {
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - w) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - h) / 2));
  return window.open(url, name, `popup=yes,width=${w},height=${h},left=${left},top=${top}`);
}

async function exchangeCode(code: string): Promise<string> {
  const res = await fetch(oauthExchangeUrl(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; code?: string; message?: string; bankLine?: string };
  if (!res.ok || !body.access_token) {
    throw Object.assign(new Error(body.message || `oauth exchange HTTP ${res.status}`), {
      code: body.code || 'AUTH',
      bankLine: body.bankLine || 'GitHub would not finish signing you in.',
    });
  }
  return body.access_token;
}

/** First-time GitHub consent in a popup; resolves to a user access token. */
function oauthForToken(id: string): Promise<string> {
  const redirect = `${location.origin}/github-oauth.html`;
  const state = crypto.randomUUID();
  sessionStorage.setItem(STATE_KEY, state);
  const url =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${encodeURIComponent(id)}` +
    `&redirect_uri=${encodeURIComponent(redirect)}` +
    `&scope=${encodeURIComponent('public_repo')}` +
    `&state=${encodeURIComponent(state)}`;

  const popup = openCentered(url, 'bz-github-oauth');
  if (!popup) {
    return Promise.reject(
      Object.assign(new Error('popup blocked'), {
        code: 'AUTH',
        bankLine: 'Your browser blocked the GitHub window — allow popups for this branch, then try again.',
      }),
    );
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', onMsg);
      window.clearInterval(timer);
      try {
        popup.close();
      } catch {
        /* ignore */
      }
      fn();
    };

    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin) return;
      const data = e.data as { type?: string; code?: string; state?: string; error?: string } | null;
      if (!data || data.type !== 'bz.github.oauth') return;
      if (data.error) {
        done(() =>
          reject(
            Object.assign(new Error(data.error || 'oauth denied'), {
              code: 'LOGIN_CANCELLED',
              bankLine: 'No star without a GitHub yes — come back when you are ready.',
            }),
          ),
        );
        return;
      }
      if (data.state !== state || !data.code) {
        done(() =>
          reject(
            Object.assign(new Error('oauth state mismatch'), {
              code: 'AUTH',
              bankLine: 'That GitHub sign-in looked wrong — please try the star again.',
            }),
          ),
        );
        return;
      }
      void exchangeCode(data.code)
        .then((token) => done(() => resolve(token)))
        .catch((err) => done(() => reject(err)));
    };

    window.addEventListener('message', onMsg);
    const timer = window.setInterval(() => {
      if (popup.closed && !settled) {
        done(() =>
          reject(
            Object.assign(new Error('oauth popup closed'), {
              code: 'LOGIN_CANCELLED',
              bankLine: 'The GitHub window closed before we could finish.',
            }),
          ),
        );
      }
    }, 400);
  });
}

async function ensureToken(): Promise<string> {
  const existing = sessionStorage.getItem(TOKEN_KEY);
  if (existing) return existing;
  const id = clientId();
  if (!id) {
    throw Object.assign(new Error('VITE_GITHUB_CLIENT_ID missing'), {
      code: 'NOT_CONFIGURED',
      bankLine: 'This branch has not plugged in GitHub starring yet.',
    });
  }
  const token = await oauthForToken(id);
  sessionStorage.setItem(TOKEN_KEY, token);
  return token;
}

async function apiStar(owner: string, repo: string, token: string): Promise<{ starred: boolean; already: boolean }> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const url = `https://api.github.com/user/starred/${owner}/${repo}`;
  const check = await fetch(url, { headers });
  if (check.status === 204) return { starred: true, already: true };
  if (check.status === 401 || check.status === 403) {
    sessionStorage.removeItem(TOKEN_KEY);
    throw Object.assign(new Error('github token rejected'), {
      code: 'AUTH',
      bankLine: 'GitHub asked you to sign in again — press the star once more.',
    });
  }
  const put = await fetch(url, { method: 'PUT', headers: { ...headers, 'Content-Length': '0' } });
  if (put.status === 204 || put.status === 201) return { starred: true, already: false };
  if (put.status === 401 || put.status === 403) {
    sessionStorage.removeItem(TOKEN_KEY);
    throw Object.assign(new Error('github star forbidden'), {
      code: 'AUTH',
      bankLine: 'GitHub would not take the star — sign in again and retry.',
    });
  }
  throw Object.assign(new Error(`github star HTTP ${put.status}`), {
    code: 'RPC',
    bankLine: 'GitHub did not accept the star just now.',
  });
}

/**
 * Star `owner/repo`. Keeps the Godot canvas mounted.
 * With OAuth: small auth popup then API star. Without: repo opens in a **new tab** for a manual Star.
 */
export async function starGithubRepo(raw: string): Promise<StarResult> {
  const { owner, repo, full } = parseRepo(raw);
  try {
    if (clientId()) {
      const token = await ensureToken();
      const r = await apiStar(owner, repo, token);
      return { starred: true, already: r.already, via: 'api', repo: full };
    }
    // No OAuth app: open the repo in a normal tab (not a chrome-less popup) so the visitor can tap Star.
    // Do not pass `noopener` in features — that makes `window.open` return null, so we cannot detect a blocker.
    const tab = window.open(`https://github.com/${full}`, '_blank');
    if (!tab) {
      throw Object.assign(new Error('tab blocked'), {
        code: 'AUTH',
        bankLine: 'Your browser blocked the new tab — allow popups for this branch, then try again.',
      });
    }
    try {
      tab.opener = null;
    } catch {
      /* ignore */
    }
    return { starred: false, via: 'tab', repo: full };
  } finally {
    focusCanvas();
  }
}
