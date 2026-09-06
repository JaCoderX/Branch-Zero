import { useEffect, useRef, useState } from 'react';
import { onBridgeTraffic, pushStage, setWalletAdapter } from '../bridge/branchZero';
import { useBranchZeroWallet } from './useBranchZeroWallet';
import type { StageEvent } from '@branch-zero/shared';

interface Line {
  t: string;
  text: string;
  kind: 'req' | 'res' | 'err' | 'evt' | 'sys';
}

const MAX = 10;
const TELLER = import.meta.env.VITE_TELLER_DESK_URL || '/api';

/**
 * U1 overlay: the Account Opening desk plus the bridge log from U0.
 *
 * This panel is deliberately plain — the greybox bank that replaces it is U3. What matters here is that
 * the delegation consent happens exactly once and is visibly revocable, and that everything after it
 * runs with no wallet modal at all.
 */
export function App({ engineState }: { engineState: string }) {
  const w = useBranchZeroWallet();
  const [lines, setLines] = useState<Line[]>([]);
  const [stage, setStage] = useState<string>('');
  const [passbook, setPassbook] = useState<{ balance: string; symbol: string; pending: number } | undefined>();
  const [payee, setPayee] = useState('0x95cED938F7991cd0dFcb48F0a06a40FA1aF46EBC');
  const [amount, setAmount] = useState('12.5');
  const esRef = useRef<EventSource | undefined>(undefined);

  useEffect(() => {
    const push = (l: Line) => setLines((prev) => [...prev.slice(-(MAX - 1)), l]);
    return onBridgeTraffic((m) => {
      const t = new Date().toLocaleTimeString();
      if (m.type === 'request') push({ t, kind: 'req', text: `→ ${m.method} ${JSON.stringify(m.args)}` });
      else if (m.type === 'response') push({ t, kind: m.ok ? 'res' : 'err', text: `← ${m.id} ${m.ok ? JSON.stringify(m.result) : `${m.error?.code}: ${m.error?.message}`}` });
      else push({ t, kind: 'evt', text: `• ${m.kind} ${JSON.stringify(m.payload)}` });
    });
  }, []);

  // Lend the bridge a way to reach Privy. Godot's `login()` / `pay()` land here.
  //
  // The adapter object is created once and reads the current hook values through a ref. Registering a
  // fresh object each render would loop: bridge traffic re-renders this panel, which would re-register.
  const latest = useRef(w);
  latest.current = w;
  useEffect(() => {
    setWalletAdapter({
      login: async () => {
        latest.current.login();
      },
      logout: () => latest.current.logout(),
      openSession: () => latest.current.openSession(),
      delegate: () => latest.current.delegate(),
      revoke: () => latest.current.revoke(),
      call: (path, body) => latest.current.call(path, body),
      isAuthenticated: () => latest.current.authenticated,
    });
    return () => setWalletAdapter(undefined);
  }, []);

  // Teller Desk stages arrive over SSE and are forwarded straight into the bridge, so the NPC lines the
  // game shows and the lines this panel shows are the same events.
  useEffect(() => {
    if (!w.session) return;
    let closed = false;
    void (async () => {
      const token = await w.getAccessToken();
      if (closed) return;
      const es = new EventSource(`${TELLER}/events?token=${encodeURIComponent(token ?? '')}&owner=${w.session!.owner}`);
      es.onmessage = (ev) => {
        const e = JSON.parse(ev.data) as StageEvent;
        setStage(e.bankLine);
        pushStage(e);
      };
      es.onerror = () => es.close();
      esRef.current = es;
    })();
    return () => {
      closed = true;
      esRef.current?.close();
      esRef.current = undefined;
    };
  }, [w.session?.owner]);

  // Drop stale passbook when Privy auth ends (Sign out used to leave 500 dUSDC on screen).
  useEffect(() => {
    if (!w.authenticated) {
      setPassbook(undefined);
      setStage('');
    }
  }, [w.authenticated]);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    w.setError(undefined);
    setStage(label);
    try {
      await fn();
      // Provision / pay mutate desk state; /session is the source of account + policyPinned for the UI.
      await w.refreshSession();
      const status = await w.call<{ balance?: string; symbol?: string; pending?: number; account?: string | null }>('/status');
      if (status.account) {
        setPassbook({ balance: status.balance ?? '0', symbol: status.symbol ?? 'dUSDC', pending: status.pending ?? 0 });
      } else {
        setPassbook(undefined);
      }
    } catch (e) {
      w.setError((e as Error).message);
    } finally {
      setStage('');
    }
  };

  const s = w.session;
  const delegated = Boolean(s?.delegated);

  return (
    <div style={panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <strong>Branch Zero · Account Opening</strong>
        <span style={{ color: '#9aa4b2' }}>engine: {engineState}</span>
      </div>

      {!w.ready && <div style={{ color: '#9aa4b2' }}>loading Privy…</div>}

      {w.ready && !w.authenticated && (
        <>
          <div style={{ color: '#9aa4b2', marginBottom: 8 }}>One sign-in, one consent. After that the counter stamps your slips for you.</div>
          <button style={btn} onClick={() => w.login()}>
            Sign in
          </button>
        </>
      )}

      {w.ready && w.authenticated && (
        <>
          <div style={row}>
            <span style={label}>owner</span>
            <code style={{ color: '#8ab4f8' }}>{s?.owner ?? w.embedded?.address ?? '—'}</code>
          </div>
          <div style={row}>
            <span style={label}>account</span>
            <code style={{ color: s?.account ? '#7ee787' : '#667' }}>{s?.account ?? 'not opened'}</code>
          </div>
          <div style={row}>
            <span style={label}>signing</span>
            <span style={{ color: delegated ? '#7ee787' : '#e3b341' }}>
              {delegated ? 'session signer — no modal per action' : 'client — you sign each slip'}
              {s?.policyId ? ` · policy ${s.policyId.slice(0, 8)}…${s.policyPinnedToAccount ? ' (pinned to your account)' : ' (chain-scoped)'}` : ''}
            </span>
          </div>
          {passbook && (
            <div style={row}>
              <span style={label}>passbook</span>
              <span>
                {passbook.balance} {passbook.symbol}
                {passbook.pending ? ` · ${passbook.pending} pending` : ''}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
            {!s && (
              <button style={btn} onClick={() => run('Opening a session…', w.openSession)}>
                Start
              </button>
            )}
            {s && !delegated && (
              <button style={{ ...btn, borderColor: '#e3b341' }} onClick={() => run('Waiting for your consent…', w.delegate)}>
                Allow the teller to stamp my slips
              </button>
            )}
            {s && delegated && (
              <button style={btn} onClick={() => run('Revoking…', w.revoke)}>
                Revoke
              </button>
            )}
            {s && (
              <button style={btn} onClick={() => run('Opening your account…', () => w.call('/provision', {}))}>
                {s.account ? 'Re-check account' : 'Open my account'}
              </button>
            )}
            <button style={btn} onClick={() => w.logout()}>
              Sign out
            </button>
          </div>

          {s?.account && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
              <input style={input} value={payee} onChange={(e) => setPayee(e.target.value)} spellCheck={false} />
              <input style={{ ...input, width: 80 }} value={amount} onChange={(e) => setAmount(e.target.value)} />
              <button style={btn} onClick={() => run('Stamping your slip…', () => w.call('/pay', { to: payee, amount }))}>
                Pay
              </button>
            </div>
          )}
        </>
      )}

      {(stage || w.busy) && <div style={{ color: '#d2a8ff', marginBottom: 6 }}>{w.busy ?? stage}</div>}
      {w.error && <div style={{ color: '#ff7b72', marginBottom: 6, wordBreak: 'break-word' }}>{w.error}</div>}

      <div style={{ color: '#9aa4b2', margin: '6px 0 4px' }}>window.BranchZero traffic (Godot ↔ JS, JSON only)</div>
      {lines.length === 0 && <div style={{ color: '#667' }}>waiting for the engine…</div>}
      {lines.map((l, i) => (
        <div key={i} style={{ color: color[l.kind], whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          <span style={{ color: '#556' }}>{l.t} </span>
          {l.text}
        </div>
      ))}
    </div>
  );
}

const color: Record<Line['kind'], string> = { req: '#8ab4f8', res: '#7ee787', err: '#ff7b72', evt: '#d2a8ff', sys: '#9aa4b2' };

const panel: React.CSSProperties = {
  position: 'fixed',
  right: 12,
  bottom: 12,
  width: 'min(620px, calc(100vw - 24px))',
  maxHeight: '80vh',
  overflow: 'auto',
  background: 'rgba(11,14,20,0.92)',
  border: '1px solid #2a3140',
  borderRadius: 8,
  padding: '10px 12px',
  font: '12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  color: '#e6e6e6',
};

const row: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 2 };
const label: React.CSSProperties = { color: '#667', width: 64, flexShrink: 0 };
const btn: React.CSSProperties = {
  background: '#1b2130',
  color: '#e6e6e6',
  border: '1px solid #2a3140',
  borderRadius: 6,
  padding: '5px 10px',
  font: 'inherit',
  cursor: 'pointer',
};
const input: React.CSSProperties = {
  background: '#0d1017',
  color: '#e6e6e6',
  border: '1px solid #2a3140',
  borderRadius: 6,
  padding: '5px 8px',
  font: 'inherit',
  width: 340,
};
