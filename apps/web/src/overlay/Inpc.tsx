import { useEffect, useRef, useState } from 'react';
import { focusCanvas } from '../shell/focus';
import { INPC_MAX_TOKENS, INPC_MODEL, OPENROUTER_KEYS_PAGE, OpenRouterError, chat, keyInfo } from '../inpc/openrouter';
import { buildMessages } from '../inpc/prompt';
import { appendTranscript, envLeaks, getTranscript, hasKey, readKey, subscribe, wipe, writeKey } from '../inpc/session';
import { freshenSnapshot, sanitizeSnapshot, summarize } from '../inpc/snapshot';
import type { ChatMessage } from '../inpc/types';

/**
 * The iNPC's panel — Wake / Chat / Sleep (docs/INPC.md, docs/missions/HANDOFF-inpc-openrouter.md §2).
 *
 * Three honest halves:
 *
 *   1. **Wake.** The player pastes their own OpenRouter key. It goes to `sessionStorage` and nowhere else — not to the
 *      bank, not to a `.env`, not to `localStorage`. A best-effort read of the key's own limits names a $0 weekly cap
 *      up front instead of on the first question.
 *   2. **Chat.** Browser → `openrouter.ai` directly, model Inkling Small, `max_tokens` always bounded. The system
 *      prompt is rules + teaching pack + the player-safe snapshot Godot handed over, re-timed at send so READY is
 *      decided from the chain's `releaseTime` at that moment (`freshenSnapshot`). 401 / 402 / 403 are shown as
 *      OpenRouter wrote them, with the bank's plain reading beside them. No retry.
 *   3. **Sleep.** Wipes the key and the conversation, closes the panel, tells Godot the eye went dark.
 *
 * Focus contract (GODOT.md §5b) is the Terminal's: while this is open the player is typing, so the canvas must not
 * have focus; every exit runs `focusCanvas()` and the component unmounts completely — nothing stays over `#canvas`.
 * Esc closes this panel only; Godot's own Esc order (dialogue → slips → Console → visitor's card) is untouched because
 * Godot hears no keys while a DOM field has focus, and `GameState.ui_locked` holds until `inpc.closed` arrives.
 */
export interface InpcProps {
  /** Raw snapshot from the bridge (whitelisted again here) and the local time it arrived, for the vault clock. */
  snapshot: unknown;
  receivedAt: number;
  /** `awake` rides along so Godot's eye follows Sleep on the same event that unlocks the floor. */
  onClose(reason: string, awake: boolean): void;
}

export function Inpc({ snapshot, receivedAt, onClose }: InpcProps) {
  const [key, setKey] = useState<string>(() => readKey());
  const [keyInput, setKeyInput] = useState('');
  const [keyNote, setKeyNote] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>(() => getTranscript());
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ line: string; detail: string; status?: number } | undefined>();
  const [meta, setMeta] = useState<string | undefined>();
  const field = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const inflight = useRef<AbortController | undefined>(undefined);

  const snap = sanitizeSnapshot(snapshot);
  const leaks = envLeaks();

  const close = (reason: string) => {
    inflight.current?.abort();
    onClose(reason, hasKey());
    focusCanvas();
  };

  const sleep = () => {
    inflight.current?.abort();
    wipe();
    setKey('');
    setMessages([]);
    onClose('sleep', false);
    focusCanvas();
  };

  // Esc closes, like every other panel in the bank. Capture phase so a focused input does not swallow it.
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

  useEffect(() => subscribe(() => setMessages(getTranscript())), []);

  useEffect(() => {
    field.current?.focus();
  }, [key]);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [messages.length, busy]);

  const wake = async () => {
    const k = keyInput.trim();
    if (!k) return;
    writeKey(k);
    setKeyInput('');
    setKey(k);
    setError(undefined);
    setKeyNote(k.startsWith('sk-or-') ? undefined : 'That does not look like an OpenRouter key (they start with sk-or-). Kept anyway — OpenRouter will say if it is wrong.');
    // Courtesy read, never a gate: a fresh key often carries a $0 weekly cap, and 403 on the first question is a worse
    // place to learn it than here.
    try {
      const info = await keyInfo(k);
      if (info.limit === 0) setKeyNote(`This key's weekly limit is $0 on OpenRouter — raise it on ${OPENROUTER_KEYS_PAGE} before asking anything.`);
      else if (info.limitRemaining !== null && info.limitRemaining <= 0) setKeyNote(`This key has used its OpenRouter limit for the period (remaining ${info.limitRemaining}). Raise or wait — ${OPENROUTER_KEYS_PAGE}.`);
      else if (info.limit !== null) setKeyNote(`Awake. Key limit ${money(info.limit)}${info.limitRemaining !== null ? ` · remaining ${money(info.limitRemaining)}` : ''}.`);
    } catch {
      /* the limits read is optional; the first question will tell the truth anyway */
    }
  };

  const send = async () => {
    const q = input.trim();
    if (!q || busy || !key) return;
    setInput('');
    setError(undefined);
    setBusy(true);
    const history = getTranscript();
    appendTranscript({ role: 'user', content: q });
    const fresh = freshenSnapshot(snap, receivedAt);
    const ac = new AbortController();
    inflight.current = ac;
    try {
      const r = await chat(key, buildMessages(fresh, history, q), ac.signal);
      appendTranscript({ role: 'assistant', content: r.text || '(the assistant said nothing)' });
      setMeta(`${r.ms} ms${r.usage ? ` · ${r.usage.prompt_tokens ?? '?'} in / ${r.usage.completion_tokens ?? '?'} out` : ''} · ${INPC_MODEL} · max_tokens ${INPC_MAX_TOKENS}`);
    } catch (e) {
      if (ac.signal.aborted) return;
      if (e instanceof OpenRouterError) setError({ line: e.bankLine, detail: `${e.status}${e.code ? ` ${e.code}` : ''}: ${e.message}`, status: e.status });
      else setError({ line: 'Something went wrong on the way to OpenRouter.', detail: (e as Error).message });
    } finally {
      if (inflight.current === ac) inflight.current = undefined;
      setBusy(false);
    }
  };

  const awake = key.length > 0;

  return (
    <div style={backdrop} onPointerDown={(e) => e.target === e.currentTarget && close('backdrop')}>
      <div style={panel} onPointerDown={(e) => e.stopPropagation()}>
        <div style={bar}>
          <strong style={{ letterSpacing: 1 }}>BRANCH ZERO · SERVICE ASSISTANT</strong>
          <span style={{ color: '#667', flex: 1 }}> — {awake ? 'awake · reads your board, moves nothing' : 'asleep · needs your OpenRouter key'}</span>
          {awake && (
            <button style={{ ...btn, borderColor: '#e3b341' }} onClick={sleep} title="Forget the key and this conversation">
              Sleep (forget key)
            </button>
          )}
          <button style={btn} onClick={() => close('button')} title="Esc — back to the bank">
            Close [Esc]
          </button>
        </div>

        {leaks.length > 0 && (
          <div style={{ color: '#ff7b72' }}>
            Build carries {leaks.join(', ')} — an OpenRouter key must never ship in the bundle (docs/INPC.md). Tell the branch.
          </div>
        )}

        {!awake ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0 }}>
            <p style={hint}>
              The assistant thinks with a link of your own. Paste an <strong>OpenRouter</strong> API key to wake it. The key is kept in this tab's session only — never sent to the bank, never saved to disk — and
              Sleep (or closing the tab) forgets it. It reads your passbook and the vault board; it cannot pay, wire, release, recall or open anything.
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <input
                ref={field}
                style={{ ...input_, minWidth: 320 }}
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="sk-or-…"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && keyInput.trim()) void wake();
                }}
              />
              <button style={{ ...btn, borderColor: '#7ee787' }} disabled={!keyInput.trim()} onClick={() => void wake()}>
                Wake
              </button>
              <a style={link} href={OPENROUTER_KEYS_PAGE} target="_blank" rel="noreferrer noopener">
                Get or manage a key ↗
              </a>
            </div>
            <p style={hint}>
              Model: <code>{INPC_MODEL}</code> via <code>openrouter.ai</code>, called from this browser directly — no relay. New keys default to a $0 weekly limit on OpenRouter; raise it there if the assistant answers 403.
              Each question costs OpenRouter credit (fractions of a cent).
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0 }}>
            <div style={{ color: '#9aa4b2' }}>
              reading your board: <span style={{ color: '#e6e6e6' }}>{summarize(snap)}</span>
              {snap.network ? <span style={{ color: '#556' }}> · {snap.network}</span> : null}
            </div>
            {keyNote && <div style={{ color: keyNote.startsWith('Awake') ? '#7ee787' : '#e3b341' }}>{keyNote}</div>}

            <div ref={log} style={transcript}>
              {messages.length === 0 && (
                <div style={{ color: '#667' }}>
                  Ask about the bank, your passbook or a wire in the vault — “Is my wire ready?”, “What is a broadcaster?”, “Who can release it?”. It explains; it never acts.
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <span style={{ color: m.role === 'user' ? '#8ab4f8' : '#7ee787' }}>{m.role === 'user' ? 'you' : 'assistant'}</span>
                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.content}</div>
                </div>
              ))}
              {busy && <div style={{ color: '#d2a8ff' }}>thinking…</div>}
              {error && (
                <div style={{ color: '#ff7b72', marginTop: 6, wordBreak: 'break-word' }}>
                  <div>{error.line}</div>
                  <div style={{ color: '#a35', fontSize: 11 }}>OpenRouter said: {error.detail}</div>
                  {(error.status === 402 || error.status === 403 || error.status === 401) && (
                    <a style={{ ...link, display: 'inline-block', marginTop: 4 }} href={OPENROUTER_KEYS_PAGE} target="_blank" rel="noreferrer noopener">
                      Open your OpenRouter keys page ↗
                    </a>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <input
                ref={field}
                style={input_}
                value={input}
                placeholder="Ask the assistant…"
                spellCheck={false}
                disabled={busy}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && input.trim() && !busy) void send();
                }}
              />
              <button style={{ ...btn, borderColor: '#7ee787' }} disabled={!input.trim() || busy} onClick={() => void send()}>
                Ask
              </button>
            </div>
            <div style={{ color: '#556', fontSize: 11 }}>
              {meta ?? `${INPC_MODEL} · max_tokens ${INPC_MAX_TOKENS} · direct to openrouter.ai`} · key in sessionStorage only · Sleep forgets it
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

const backdrop: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(4,6,10,0.78)',
  display: 'grid',
  placeItems: 'center',
  padding: 16,
  font: '12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  color: '#e6e6e6',
};

const panel: React.CSSProperties = {
  width: 'min(760px, 100%)',
  height: 'min(620px, 100%)',
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
const transcript: React.CSSProperties = { flex: 1, minHeight: 0, overflow: 'auto', border: '1px solid #2a3140', borderRadius: 6, padding: '8px 10px', background: '#0d1017' };
const hint: React.CSSProperties = { color: '#9aa4b2', margin: '4px 0' };
const link: React.CSSProperties = { color: '#8ab4f8', textDecoration: 'none', border: '1px solid #2a3140', borderRadius: 6, padding: '4px 8px' };
const btn: React.CSSProperties = { background: '#1b2130', color: '#e6e6e6', border: '1px solid #2a3140', borderRadius: 6, padding: '5px 10px', font: 'inherit', cursor: 'pointer' };
const input_: React.CSSProperties = { background: '#0d1017', color: '#e6e6e6', border: '1px solid #2a3140', borderRadius: 6, padding: '5px 8px', font: 'inherit', flex: 1, minWidth: 180 };
