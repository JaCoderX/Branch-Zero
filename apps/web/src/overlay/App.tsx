import { useEffect, useRef, useState } from 'react';
import { onBridgeTraffic, pushLink, pushStage, setWalletAdapter } from '../bridge/branchZero';
import { connectDeskEvents, type DeskLink } from '../shell/deskEvents';
import { focusCanvas } from '../shell/focus';
import { useBranchZeroWallet } from './useBranchZeroWallet';
import type { PendingWire } from '@branch-zero/shared';

interface Line {
  t: string;
  text: string;
  kind: 'req' | 'res' | 'err' | 'evt' | 'sys';
}

const MAX = 10;
const TELLER = import.meta.env.VITE_TELLER_DESK_URL || '/api';

interface Passbook {
  balance: string;
  symbol: string;
  pending: number;
  wires: PendingWire[];
  /** Teller Desk wall clock at fetch time, unix seconds. The vault clock counts against this, corrected locally. */
  serverNow: number;
}

/**
 * U1/U2 overlay: the Account Opening desk, the counter, the vault — plus the bridge log from U0.
 *
 * This panel is deliberately plain — the greybox bank that replaces it is U3. What matters here is that
 * the delegation consent happens exactly once and is visibly revocable, that everything after it runs
 * with no wallet modal at all (Pay, Wire, Release, Recall included), and that the vault clock is the
 * chain's `releaseTime`, never a timer this panel invented.
 */
export function App({ engineState }: { engineState: string }) {
  const w = useBranchZeroWallet();
  const [lines, setLines] = useState<Line[]>([]);
  const [stage, setStage] = useState<string>('');
  const [passbook, setPassbook] = useState<Passbook | undefined>();
  const [payee, setPayee] = useState('0x95cED938F7991cd0dFcb48F0a06a40FA1aF46EBC');
  const [amount, setAmount] = useState('12.5');
  const [wireAmount, setWireAmount] = useState('250');
  const [clockOffset, setClockOffset] = useState(0); // serverNow - localNow, seconds
  const [, setTick] = useState(0);
  const [link, setLink] = useState<DeskLink | undefined>();

  useEffect(() => {
    const push = (l: Line) => setLines((prev) => [...prev.slice(-(MAX - 1)), l]);
    return onBridgeTraffic((m) => {
      const t = new Date().toLocaleTimeString();
      if (m.type === 'request') push({ t, kind: 'req', text: `→ ${m.method} ${JSON.stringify(m.args)}` });
      else if (m.type === 'response') push({ t, kind: m.ok ? 'res' : 'err', text: `← ${m.id} ${m.ok ? JSON.stringify(m.result) : `${m.error?.code}: ${m.error?.message}`}` });
      else push({ t, kind: 'evt', text: `• ${m.kind} ${JSON.stringify(m.payload)}` });
    });
  }, []);

  // Re-render once a second while a wire is pending so the countdown moves. The clock itself is
  // `releaseTime` from the chain; only the "now" side is local (server-corrected).
  useEffect(() => {
    if (!passbook?.wires.some((x) => x.status === 'PENDING')) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [passbook?.wires]);

  // Lend the bridge a way to reach Privy. Godot's `login()` / `pay()` / `wire()` land here.
  //
  // The adapter object is created once and reads the current hook values through a ref. Registering a
  // fresh object each render would loop: bridge traffic re-renders this panel, which would re-register.
  const latest = useRef(w);
  latest.current = w;
  useEffect(() => {
    setWalletAdapter({
      login: () => latest.current.loginAndWait(),
      logout: () => latest.current.logout(),
      openSession: () => latest.current.openSession(),
      delegate: () => latest.current.delegate(),
      revoke: () => latest.current.revoke(),
      call: (path, body) => latest.current.call(path, body),
      isAuthenticated: () => latest.current.authenticated,
      isReady: () => latest.current.ready,
    });
    return () => setWalletAdapter(undefined);
  }, []);

  // U3: the greybox is the product surface now; this panel is the debug view of the same bridge traffic.
  // Collapsed by default once the engine runs (`?debug` keeps it open); the pill re-opens it.
  const [debugOpen, setDebugOpen] = useState(true);
  useEffect(() => {
    if (engineState.startsWith('running') && !/[?&](debug|mock)(=|&|$)/.test(location.search)) setDebugOpen(false);
  }, [engineState.startsWith('running')]);

  const refreshPassbook = async () => {
    const status = await w.call<{ balance?: string; symbol?: string; pending?: number; account?: string | null; wires?: PendingWire[]; serverNow?: string }>('/status');
    if (status.account) {
      const serverNow = Number(status.serverNow ?? Math.floor(Date.now() / 1000));
      setClockOffset(serverNow - Math.floor(Date.now() / 1000));
      setPassbook({ balance: status.balance ?? '0', symbol: status.symbol ?? 'dUSDC', pending: status.pending ?? 0, wires: status.wires ?? [], serverNow });
    } else {
      setPassbook(undefined);
    }
  };
  const refreshRef = useRef(refreshPassbook);
  refreshRef.current = refreshPassbook;

  // Teller Desk stages arrive over SSE and are forwarded straight into the bridge, so the NPC lines the
  // game shows and the lines this panel shows are the same events. Vault transitions refresh the passbook.
  //
  // U4: the stream reconnects on its own (fresh token each time — `shell/deskEvents.ts`). U3 closed it on the
  // first error, so a Teller Desk restart ended the stage feed until reload. Every transition is pushed to
  // Godot as `desk.link`; after an outage the passbook is re-read here and the game reconciles its board.
  useEffect(() => {
    if (!w.session) return;
    const owner = w.session.owner;
    return connectDeskEvents({
      url: async () => `${TELLER}/events?token=${encodeURIComponent((await latest.current.getAccessToken()) ?? '')}&owner=${owner}`,
      onEvent: (e) => {
        setStage(e.bankLine);
        pushStage(e);
        if (e.serverNow) setClockOffset(Number(e.serverNow) - Math.floor(Date.now() / 1000));
        if (e.lane === 'B' && (e.stage === 'released' || e.stage === 'mined' || e.stage === 'cancelled' || (e.stage === 'pending' && e.hash))) void refreshRef.current();
      },
      onLink: (l) => {
        setLink(l);
        pushLink(l);
        if (l.connected && l.attempt > 0) void refreshRef.current();
      },
    });
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
    } catch (e) {
      w.setError((e as Error).message);
    } finally {
      // Provision / pay / wire / approve / cancel mutate desk state; /session is the source of account +
      // policy pins for the UI (U1 lesson), /status of balance + vault board. Refresh even after a failure —
      // a refused approve still moved the clock.
      try {
        await w.refreshSession();
        await refreshPassbook();
      } catch {
        /* keep the primary error */
      }
      setStage('');
    }
  };

  const s = w.session;
  const delegated = Boolean(s?.delegated);
  const now = Math.floor(Date.now() / 1000) + clockOffset;

  if (!debugOpen) {
    return (
      <button style={pill} onClick={() => setDebugOpen(true)} title="Show the desk debug panel (bridge traffic, session, vault board)">
        desk debug · {engineState.startsWith('running') ? 'engine running' : engineState}
        {lines.length ? ` · ${lines.length} msgs` : ''}
      </button>
    );
  }

  return (
    <div style={panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
        <strong>Branch Zero · desk debug</strong>
        <span style={{ color: '#9aa4b2' }}>
          engine: {engineState}{' '}
          <button
            style={{ ...btn, padding: '1px 8px', marginLeft: 6 }}
            onClick={() => {
              setDebugOpen(false);
              focusCanvas(); // the player is going back to the bank
            }}
          >
            hide
          </button>
        </span>
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
              {s?.txPolicy ? ` · owner tx rules: ${s.txPolicy.mode}${s.txPolicy.pinnedToAccount ? ', pinned' : ''}` : ''}
            </span>
          </div>
          {passbook && (
            <div style={row}>
              <span style={label}>passbook</span>
              <span>
                {passbook.balance} {passbook.symbol}
                {passbook.pending ? ` · ${passbook.pending} in the vault` : ''}
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
            <>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                <input style={input} value={payee} onChange={(e) => setPayee(e.target.value)} spellCheck={false} />
                <input style={{ ...input, width: 80 }} value={amount} onChange={(e) => setAmount(e.target.value)} />
                <button style={btn} onClick={() => run('Stamping your slip…', () => w.call('/pay', { to: payee, amount }))}>
                  Pay
                </button>
                <span style={{ color: '#667' }}>≤ {s.instantLimit ?? '100'} at the counter</span>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ ...label, width: 'auto' }}>vault</span>
                <input style={{ ...input, width: 80 }} value={wireAmount} onChange={(e) => setWireAmount(e.target.value)} />
                <button style={{ ...btn, borderColor: '#d2a8ff' }} onClick={() => run('Filing your wire…', () => w.call('/wire', { to: payee, amount: wireAmount }))}>
                  Wire (time-locked {s.timeLockSec ?? 120}s)
                </button>
                <span style={{ color: '#667' }}>same payee · owner signs via session signer, no modal</span>
              </div>
            </>
          )}

          {passbook && passbook.wires.length > 0 && (
            <div style={{ border: '1px solid #2a3140', borderRadius: 6, padding: '6px 8px', marginBottom: 8 }}>
              <div style={{ color: '#9aa4b2', marginBottom: 4 }}>vault board — releaseTime from chain (getTransaction), clock vs Teller Desk time</div>
              {passbook.wires.map((x) => {
                const left = Number(x.releaseTime) - now;
                const released = left <= 0;
                return (
                  <div key={x.txId} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                    <code style={{ color: '#8ab4f8' }}>#{x.txId}</code>
                    <span>
                      {x.amount ?? '?'} {passbook.symbol} → {x.to ? `${x.to.slice(0, 8)}…` : '?'}
                    </span>
                    <span style={{ color: released ? '#7ee787' : '#e3b341', minWidth: 120 }}>
                      {released ? '● released' : `○ ${fmt(left)} to release`}
                    </span>
                    <span style={{ color: '#556' }}>t={x.releaseTime}</span>
                    <button style={{ ...btn, opacity: released ? 1 : 0.6 }} onClick={() => run('Opening the vault…', () => w.call('/approve', { txId: x.txId }))}>
                      Release
                    </button>
                    <button style={btn} onClick={() => run('Recalling the wire…', () => w.call('/cancel', { txId: x.txId }))}>
                      Recall
                    </button>
                    {s?.manager && (
                      <button style={{ ...btn, borderColor: '#e3b341' }} onClick={() => run('Asking the manager…', () => w.call('/approve', { txId: x.txId, as: 'manager' }))}>
                        Manager stamp
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {link && !link.connected && (
        <div style={{ color: '#e3b341', marginBottom: 6 }}>
          desk link down ({link.reason ?? '…'}) — reconnecting, attempt {link.attempt + 1}
        </div>
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

function fmt(sec: number): string {
  const s = Math.max(0, sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const color: Record<Line['kind'], string> = { req: '#8ab4f8', res: '#7ee787', err: '#ff7b72', evt: '#d2a8ff', sys: '#9aa4b2' };

const pill: React.CSSProperties = {
  position: 'fixed',
  right: 12,
  bottom: 12,
  background: 'rgba(11,14,20,0.85)',
  color: '#9aa4b2',
  border: '1px solid #2a3140',
  borderRadius: 999,
  padding: '4px 10px',
  font: '11px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  cursor: 'pointer',
};

const panel: React.CSSProperties = {
  position: 'fixed',
  right: 12,
  bottom: 12,
  width: 'min(680px, calc(100vw - 24px))',
  maxHeight: '85vh',
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
