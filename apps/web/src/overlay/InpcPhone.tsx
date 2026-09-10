import { useEffect, useState, type CSSProperties } from 'react';
import { requestInpcOpen } from '../bridge/branchZero';
import { focusCanvas } from '../shell/focus';
import { getTranscript, hasKey, subscribe } from '../inpc/session';
import type { ChatMessage } from '../inpc/types';

/**
 * Ambient iNPC radio. This is deliberately not an overlay: it owns no lock bit, never focuses an input, and only
 * renders while the session key says the service assistant is awake. The full Inpc panel remains the only typer.
 *
 * Talk must go through Godot (`inpc.open` → `open_inpc`) so the panel mounts with a fresh `GameState.inpc_snapshot()`
 * and `inpc_open` is set — never `openInpc` with a cached shell board.
 */
export function InpcPhone() {
  const [awake, setAwake] = useState(() => hasKey());
  const [messages, setMessages] = useState<ChatMessage[]>(() => getTranscript());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(
    () =>
      subscribe(() => {
        setAwake(hasKey());
        setMessages(getTranscript());
      }),
    [],
  );

  if (!awake) return null;

  const recent = messages.slice(-3);

  const talk = async () => {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await requestInpcOpen();
      // Panel mount hides this radio; if we are still up, Godot refused or timed out.
    } catch (e) {
      setError((e as Error).message || 'The full conversation did not open.');
      setBusy(false);
    }
  };

  const sleep = async () => {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await window.BranchZero.call('sleepInpc');
    } catch (e) {
      setError((e as Error).message || 'The assistant could not be put to sleep.');
      setBusy(false);
    } finally {
      // Sleep is a phone interaction, not a modal close, but the player should still get the canvas back after it.
      focusCanvas();
    }
  };

  return (
    <section
      style={phone}
      role="region"
      aria-label="Service assistant radio"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div style={header}>
        <span style={signal} aria-hidden="true">●</span>
        <strong style={title}>SERVICE ASSISTANT</strong>
        <span style={state}>awake · radio</span>
      </div>

      <div style={log} role="log" aria-live="polite" aria-label="Service assistant messages">
        {recent.length === 0 ? (
          <div style={empty}>The assistant is listening. Talk to ask a question.</div>
        ) : (
          recent.map((message, index) => (
            <div key={`${message.role}-${index}`} style={messageRow}>
              <span style={{ ...role, color: message.role === 'user' ? '#8ab4f8' : '#7ee787' }}>
                {message.role === 'user' ? 'you' : 'assistant'}
              </span>
              <div style={messageText}>{message.content}</div>
            </div>
          ))
        )}
      </div>

      {error && <div style={errorLine}>{error}</div>}

      <div style={actions}>
        <button style={button} disabled={busy} onClick={() => void talk()}>
          Talk
        </button>
        <button style={{ ...button, borderColor: '#e3b341' }} disabled={busy} onClick={() => void sleep()}>
          Sleep
        </button>
      </div>
    </section>
  );
}

const phone: CSSProperties = {
  position: 'fixed',
  right: 16,
  bottom: 54,
  zIndex: 10,
  width: 'min(320px, calc(100vw - 32px))',
  boxSizing: 'border-box',
  padding: 10,
  background: 'rgba(11,14,20,0.95)',
  border: '1px solid rgba(219,176,82,0.72)',
  borderLeft: '3px solid #dbb052',
  borderRadius: 12,
  boxShadow: '0 14px 34px rgba(0,0,0,0.45)',
  font: '12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  color: '#e6e6e6',
};

const header: CSSProperties = { display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 };
const signal: CSSProperties = { color: '#7ee787', fontSize: 9 };
const title: CSSProperties = { letterSpacing: 0.8, fontSize: 11 };
const state: CSSProperties = { color: '#9aa4b2', marginLeft: 'auto', fontSize: 10 };
const log: CSSProperties = { display: 'grid', gap: 7, maxHeight: 126, overflow: 'auto', padding: '7px 8px', background: '#0d1017', border: '1px solid #2a3140', borderRadius: 7 };
const messageRow: CSSProperties = { minWidth: 0 };
const role: CSSProperties = { display: 'block', fontSize: 10, marginBottom: 1 };
const messageText: CSSProperties = { maxHeight: '4.2em', overflow: 'hidden', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#e6e6e6' };
const empty: CSSProperties = { color: '#667' };
const errorLine: CSSProperties = { color: '#ff7b72', marginTop: 6, wordBreak: 'break-word' };
const actions: CSSProperties = { display: 'flex', gap: 6, marginTop: 8 };
const button: CSSProperties = { background: '#1b2130', color: '#e6e6e6', border: '1px solid #2a3140', borderRadius: 6, padding: '5px 10px', font: 'inherit', cursor: 'pointer' };
