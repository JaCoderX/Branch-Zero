import { useEffect, useRef, useState } from 'react';
import { focusCanvas } from '../shell/focus';

/**
 * The bank's back-office terminal (docs/TERMINAL-CONSOLE.md).
 *
 * Two halves, both honest:
 *
 *   1. **Viewing wallets.** The player types a `0x` address or a Name Desk name; the bridge resolves it and the
 *      Teller Desk adds it to the runtime `OBSERVER` role — membership only, no function permissions. That is
 *      what makes the hosted Console's permissioned registry views answer for a wallet the player already holds
 *      (V10: those views run `_validateAnyRole()` on the `eth_call` sender). The panel prints the role's
 *      permission list back from the chain, so "it can only read" is visible, not just promised.
 *
 *   2. **The Console itself**, in an iframe of bloxchain.app. Framing was verified on 2026-09-08 (no
 *      `X-Frame-Options`, no `frame-ancestors`), but a SaaS can harden headers any day, so a blocked frame is a
 *      first-class state.
 *
 * **A refused frame cannot be detected from here, and pretending otherwise would be the bug.** Measured against a
 * host that sends `X-Frame-Options: deny` (2026-09-08): Chrome loads its own error document into the frame and
 * fires `load` normally, so the timeout below never fires; `contentWindow` is an opaque origin, so `location`,
 * `document` and `origin` all throw exactly as they do for a page that loaded perfectly; and the browser's
 * "Refused to display…" message goes to the console, not to script. `contentWindow.length` is 0 for a blocked
 * frame and also 0 for any page without sub-frames. There is no signal. So the panel does not guess:
 *
 *   - the top-level-tab link is **permanent**, in the title bar and again under the frame, phrased for the player
 *     who is looking at a blank rectangle and needs a way out of it;
 *   - `FRAME_TIMEOUT_MS` still catches the case that *is* observable — a frame that never loads at all (DNS,
 *     offline, a host that hangs) — and switches to the fallback view with a reason;
 *   - the player can switch to the fallback view themselves at any time.
 *
 * Focus contract (GODOT.md §5b): while this is open the player is typing, so the canvas must *not* have focus;
 * the moment it closes, `focusCanvas()` runs and the component unmounts completely — nothing is left behind as
 * a hit target over `#canvas`, which is the U4 playtest bug this bank already paid for once.
 */

/** Only catches a frame that never loads at all; a *refused* frame fires `load` like any other (see above). */
const FRAME_TIMEOUT_MS = 8000;

export interface ObserverView {
  exists: boolean;
  wallets: string[];
  maxWallets: number;
  roleName: string;
  permissions?: Array<{ functionSelector: string; grantedActionsBitmap: string }>;
}

export interface TerminalProps {
  url: string;
  account?: string | null;
  /** `tab` once the frame never loaded, or once the player says the screen is blank; the panel then leads with the link. */
  mode: 'iframe' | 'tab';
  onMode(mode: 'iframe' | 'tab'): void;
  onClose(reason: string): void;
  /** `window.BranchZero.call` — the same door Godot uses, so both surfaces run one code path. */
  call<T>(method: string, args?: Record<string, unknown>): Promise<T>;
  loggedIn: boolean;
}

export function Terminal({ url, account, mode, onMode, onClose, call, loggedIn }: TerminalProps) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [note, setNote] = useState<string | undefined>();
  const [view, setView] = useState<ObserverView | undefined>();
  const framed = useRef(false);
  const field = useRef<HTMLInputElement>(null);

  const close = (reason: string) => {
    onClose(reason);
    focusCanvas();
  };

  // Esc closes, like every other panel in the bank. Capture phase: the iframe never sees it either way, but a
  // key that reached this document is the player's, not the Console's.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close('escape');
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, []);

  useEffect(() => {
    field.current?.focus();
    if (loggedIn) void refresh();
  }, [loggedIn]);

  // Only "never loaded at all" is observable from here — a refused frame fires `load` like any other, so this
  // timer is a backstop, not the blocked-frame detector. See the note at the top of the file.
  useEffect(() => {
    if (mode !== 'iframe') return;
    const t = setTimeout(() => {
      if (framed.current) return;
      onMode('tab');
      setNote('The Console never loaded in the frame. Use the link above; the viewing wallet works either way.');
    }, FRAME_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [mode]);

  async function refresh(): Promise<void> {
    try {
      setView(await call<ObserverView>('observerList'));
    } catch (e) {
      setError(msg(e));
    }
  }

  async function run(label: string, fn: () => Promise<unknown>): Promise<void> {
    setBusy(label);
    setError(undefined);
    setNote(undefined);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(msg(e));
      await refresh().catch(() => undefined);
    } finally {
      setBusy(undefined);
    }
  }

  const grant = () =>
    run('Adding a viewing wallet…', async () => {
      const target = input.trim();
      const r = await call<{ changed: boolean; address: string }>('observerGrant', { address: target });
      setNote(r.changed ? `${r.address} can now read this account — and nothing else.` : `${r.address} was already a viewing wallet.`);
      setInput('');
    });

  const revoke = (address: string) =>
    run('Removing a viewing wallet…', async () => {
      await call('observerRevoke', { address });
      setNote(`${address} can no longer read this account.`);
    });

  const permissions = view?.permissions ?? [];

  return (
    <div style={backdrop} onPointerDown={(e) => e.target === e.currentTarget && close('backdrop')}>
      <div style={panel} onPointerDown={(e) => e.stopPropagation()}>
        <div style={bar}>
          <strong style={{ letterSpacing: 1 }}>BRANCH ZERO · BACK-OFFICE TERMINAL</strong>
          <span style={{ color: '#667', flex: 1 }}> — viewing access &amp; the public Console</span>
          <a style={link} href={url} target="_blank" rel="noreferrer noopener">
            Open in a new tab ↗
          </a>
          <button style={btn} onClick={() => close('button')} title="Esc — back to the bank">
            Close [Esc]
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, minHeight: 0, flex: 1 }}>
          <div style={side}>
            <div style={{ color: '#9aa4b2' }}>Viewing wallets</div>
            <p style={hint}>
              A viewing wallet joins the <code>{view?.roleName ?? 'OBSERVER'}</code> role on your account with <strong>no</strong> permissions. It unlocks the Console's account screens for a wallet you
              already hold; it cannot pay, wire, release, recall, or change your file.
            </p>

            {account ? (
              <div style={row}>
                <span style={label}>account</span>
                <code style={{ color: '#7ee787', wordBreak: 'break-all' }}>{account}</code>
              </div>
            ) : (
              <div style={{ color: '#e3b341' }}>Open an account with Ines first — there is nothing to grant viewing on yet.</div>
            )}

            <div style={{ display: 'flex', gap: 6, margin: '8px 0', flexWrap: 'wrap' }}>
              <input
                ref={field}
                style={input_}
                value={input}
                placeholder="0x… or alice.branchzero.eth"
                spellCheck={false}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && input.trim() && !busy) void grant();
                }}
              />
              <button style={{ ...btn, borderColor: '#7ee787' }} disabled={!input.trim() || Boolean(busy) || !account} onClick={() => void grant()}>
                Add viewing wallet
              </button>
            </div>

            <div style={{ color: '#9aa4b2', marginTop: 4 }}>
              on file{view ? ` (${view.wallets.length}/${view.maxWallets})` : ''}
            </div>
            {view && view.wallets.length === 0 && <div style={{ color: '#667' }}>nobody — this account is private</div>}
            {view?.wallets.map((w) => (
              <div key={w} style={{ ...row, alignItems: 'center' }}>
                <code style={{ color: '#8ab4f8', wordBreak: 'break-all', flex: 1 }}>{w}</code>
                <button style={btn} disabled={Boolean(busy)} onClick={() => void revoke(w)}>
                  Remove
                </button>
              </div>
            ))}

            {view?.exists && (
              <div style={{ marginTop: 8, color: permissions.length ? '#ff7b72' : '#7ee787' }}>
                {permissions.length === 0
                  ? `${view.roleName} holds 0 function permissions — read-only by construction.`
                  : `${view.roleName} holds ${permissions.length} function permission(s): ${permissions.map((p) => `${p.functionSelector}=${p.grantedActionsBitmap}`).join(', ')} — that is a bug, tell the branch.`}
              </div>
            )}

            {busy && <div style={{ color: '#d2a8ff', marginTop: 8 }}>{busy}</div>}
            {note && <div style={{ color: '#7ee787', marginTop: 8, wordBreak: 'break-word' }}>{note}</div>}
            {error && <div style={{ color: '#ff7b72', marginTop: 8, wordBreak: 'break-word' }}>{error}</div>}

            <p style={{ ...hint, marginTop: 'auto' }}>
              In the Console: <em>Import</em> the account address above, then connect the viewing wallet (WalletConnect / MetaMask). An injected wallet inside a cross-origin frame is unreliable — expect
              to use WalletConnect here, or the new tab.
            </p>
          </div>

          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {mode === 'iframe' ? (
              <>
                <iframe
                  title="Bloxchain Console"
                  src={url}
                  onLoad={() => {
                    framed.current = true;
                  }}
                  style={frame}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                  referrerPolicy="no-referrer"
                />
                {/* The only reliable blocked-frame detector is the player's own eyes — see the note at the top. */}
                <div style={{ color: '#667', paddingTop: 6 }}>
                  Screen blank? The Console may refuse to be embedded here.{' '}
                  <button style={{ ...btn, padding: '2px 8px' }} onClick={() => onMode('tab')}>
                    Open it in a new tab instead
                  </button>
                </div>
              </>
            ) : (
              <div style={{ ...frame, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 20 }}>
                <div>
                  <div style={{ color: '#e3b341', marginBottom: 8 }}>The Console is not showing on this screen.</div>
                  <a style={{ ...link, fontSize: 14 }} href={url} target="_blank" rel="noreferrer noopener">
                    Open {url} in a new tab ↗
                  </a>
                  <div style={{ color: '#667', marginTop: 8 }}>Your viewing wallet is already on the account — it works there just the same.</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function msg(e: unknown): string {
  const err = e as { bankLine?: string; message?: string; code?: string };
  return err?.bankLine ?? err?.message ?? String(e);
}

const backdrop: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(4,6,10,0.82)',
  display: 'grid',
  placeItems: 'center',
  padding: 16,
  font: '12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  color: '#e6e6e6',
};

const panel: React.CSSProperties = {
  // Wider than the original 1180 so the bloxchain.app iframe has a real working strip beside the grant column.
  width: 'min(1480px, 100%)',
  height: 'min(860px, 100%)',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  background: '#0b0e14',
  border: '1px solid #2a3140',
  borderRadius: 10,
  padding: 12,
  boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
};

const bar: React.CSSProperties = { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' };
const side: React.CSSProperties = { width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'auto', paddingRight: 4 };
const frame: React.CSSProperties = { flex: 1, width: '100%', border: '1px solid #2a3140', borderRadius: 6, background: '#fff' };
const hint: React.CSSProperties = { color: '#667', margin: '6px 0' };
const row: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 4 };
const label: React.CSSProperties = { color: '#667', width: 56, flexShrink: 0 };
const link: React.CSSProperties = { color: '#8ab4f8', textDecoration: 'none', border: '1px solid #2a3140', borderRadius: 6, padding: '4px 8px' };
const btn: React.CSSProperties = { background: '#1b2130', color: '#e6e6e6', border: '1px solid #2a3140', borderRadius: 6, padding: '5px 10px', font: 'inherit', cursor: 'pointer' };
const input_: React.CSSProperties = { background: '#0d1017', color: '#e6e6e6', border: '1px solid #2a3140', borderRadius: 6, padding: '5px 8px', font: 'inherit', flex: 1, minWidth: 180 };
