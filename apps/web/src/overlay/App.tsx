import { useEffect, useRef, useState } from 'react';
import { onBridgeTraffic, pushLink, pushStage, pushTerminalClosed, setTerminalHost, setWalletAdapter } from '../bridge/branchZero';
import { connectDeskEvents, type DeskLink } from '../shell/deskEvents';
import { focusCanvas } from '../shell/focus';
import { Terminal } from './Terminal';
import { useBranchZeroWallet } from './useBranchZeroWallet';
import { ARC_TESTNET_CHAIN_ID, type PendingWire } from '@branch-zero/shared';

interface Line {
  t: string;
  text: string;
  kind: 'req' | 'res' | 'err' | 'evt' | 'sys';
}

const MAX = 10;
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
  /**
   * The bank computer's overlay (docs/TERMINAL-CONSOLE.md). `undefined` means *not rendered at all* — the panel
   * must never linger as an invisible full-viewport hit target over the canvas (GODOT.md §5b).
   */
  const [console_, setConsole] = useState<{ url: string; account?: string | null; mode: 'iframe' | 'tab' } | undefined>();

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
      switchWing: (chainId) => latest.current.switchWing(chainId),
      switchMode: (mode) => latest.current.switchMode(mode),
      priority: (txId) => latest.current.priority(txId),
      call: (path, body) => latest.current.call(path, body),
      isAuthenticated: () => latest.current.authenticated,
      isReady: () => latest.current.ready,
    });
    return () => setWalletAdapter(undefined);
  }, []);

  // The same lending pattern for the terminal overlay: the bridge asks, React renders. Stable object, one
  // registration — bridge traffic re-renders this panel, so a fresh host each render would re-register forever.
  const consoleOpen = useRef(false);
  consoleOpen.current = Boolean(console_);
  useEffect(() => {
    setTerminalHost({
      open: async ({ url, account }) => {
        setConsole({ url, account, mode: 'iframe' });
        return { mode: 'iframe', url };
      },
      close: (reason) => {
        setConsole(undefined);
        pushTerminalClosed(reason ?? 'closed');
      },
      isOpen: () => consoleOpen.current,
    });
    return () => setTerminalHost(undefined);
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
      url: async () => `${latest.current.tellerBase}/events?token=${encodeURIComponent((await latest.current.getAccessToken()) ?? '')}&owner=${owner}`,
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
  }, [w.session?.owner, w.activeChainId, w.tellerBase]);

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
  const live = w.mode === 'live';
  /** S3 — operator till health from the selected desk's `/healthz`. `null`/absent off the Live wing. */
  const treasury = w.desk?.treasury ?? undefined;
  const now = Math.floor(Date.now() / 1000) + clockOffset;

  const terminal = console_ ? (
    <Terminal
      url={console_.url}
      account={console_.account}
      mode={console_.mode}
      loggedIn={Boolean(s)}
      onMode={(mode) => setConsole((c) => (c ? { ...c, mode } : c))}
      onClose={(reason) => {
        setConsole(undefined);
        pushTerminalClosed(reason);
      }}
      call={(method, args) => window.BranchZero.call(method, args)}
    />
  ) : null;

  if (!debugOpen) {
    return (
      <>
        {terminal}
        <button style={pill} onClick={() => setDebugOpen(true)} title="Show the desk debug panel (bridge traffic, session, vault board)">
          desk debug · {engineState.startsWith('running') ? 'engine running' : engineState}
          {lines.length ? ` · ${lines.length} msgs` : ''}
        </button>
      </>
    );
  }

  return (
    <>
      {terminal}
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

          {/*
        The primary control of this panel: which payment wing the whole bank runs against.
        Live (Sepolia) is what every normal player and every judge gets. Dev (Remote EVM 1337) is the
        operator's lab and is only reachable from here or with `?mode=dev`. This is NOT the Arc elevator
        (still deferred, below) and NOT MockChain — see docs/SEPOLIA-LIVE.md §1.
      */}
      <div style={row}>
        <span style={label}>mode</span>
        <span style={{ color: live ? '#7ee787' : '#e3b341' }}>
          {live ? 'LIVE · public testnet' : 'DEVELOPER MODE · private lab'}
          {' · '}
          {s?.chainName ?? w.desk?.chainName ?? (live ? 'Sepolia' : 'Remote EVM')} · {s?.chainId ?? w.desk?.chainId ?? w.activeChainId}
          {!live && ' · operator only, never shared'}
        </span>
      </div>
      {w.desk && !w.desk.reachable && (
        <div style={{ color: '#ff7b72', marginBottom: 4 }}>
          {live
            ? 'the Live desk is not answering — start it with `npm run dev:teller`'
            : 'the Dev desk is not answering — Developer Mode needs Remote EVM up and `npm run dev:teller:dev`; Live is unaffected'}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '6px 0', alignItems: 'center' }}>
        <button
          style={{ ...btn, borderColor: live ? '#7ee787' : '#2a3140', fontWeight: live ? 700 : 400 }}
          title="Sepolia 11155111 — the product default. Provision, pay, wire, Priority, faucet and OBSERVER all on the public testnet."
          onClick={() => run('Switching to the live branch…', () => w.switchMode('live'))}
        >
          Live (Sepolia)
        </button>
        <button
          style={{ ...btn, borderColor: !live ? '#e3b341' : '#2a3140', fontWeight: !live ? 700 : 400 }}
          title="Remote EVM 1337 — Developer Mode. Private lab chain, fast iteration, never exposed as public infra."
          onClick={() => run('Switching to Developer Mode…', () => w.switchMode('dev'))}
        >
          Dev (1337)
        </button>
        <span style={{ color: '#556' }}>desk {w.tellerBase}</span>
      </div>

      {/*
        S3 — the ops treasury, operator information only (docs/SEPOLIA-TREASURY.md §5).

        This is the whole "desk debug shows till health" surface: no lobby NPC, no quest, no button that
        moves money. Rebalancing happens in the background or from `npm run treasury:topup`; the panel just
        says whether the bank can pay its own gas bill, and names the address a human should faucet when it
        cannot. Absent on the Dev wing, where lab ETH is free.
      */}
      {treasury && (
        <div style={{ margin: '6px 0', padding: '6px 8px', border: '1px solid #2a3140', borderRadius: 6 }}>
          <div style={row}>
            <span style={label}>treasury</span>
            <span style={{ color: treasury.problem ? '#ff7b72' : treasury.treasuryShort ? '#e3b341' : treasury.shortfalls ? '#e3b341' : '#7ee787' }}>
              {!treasury.configured
                ? 'not configured — faucet drops go to each staff wallet one at a time'
                : treasury.error
                  ? `unreadable: ${treasury.error}`
                  : `${treasury.eth} ETH · ${treasury.circleUsdc?.amount ?? '0'} Circle USDC · ${treasury.practiceUsdc?.amount ?? '0'} practice ${treasury.practiceUsdc?.symbol ?? 'USDC'}`}
            </span>
          </div>
          {treasury.configured && !treasury.error && (
            <>
              <div style={row}>
                <span style={label} />
                <code style={{ color: '#8ab4f8' }}>{treasury.address}</code>
                <span style={{ color: '#556' }}>
                  {treasury.canExecute ? (treasury.auto ? 'auto top-up on' : 'CLI only') : 'read-only'} · caps {treasury.caps?.perTxEth}/tx · {treasury.caps?.perHourEth}/h
                </span>
              </div>
              {treasury.problem && (
                <div style={{ color: '#ff7b72', marginBottom: 2 }}>
                  {treasury.problem.code}: {treasury.problem.message}
                </div>
              )}
              {!treasury.problem && treasury.collapsedRoles && treasury.collapsedRoles.length > 0 && (
                <div style={{ color: '#e3b341', marginBottom: 2 }}>
                  demo concession: this key is also the {treasury.collapsedRoles.join(' + ')} key — identity and float are one wallet; that role is skipped and its target reserved
                </div>
              )}
              {(treasury.staff ?? []).map((st) => (
                <div key={st.role} style={row}>
                  <span style={label} />
                  <span style={{ color: st.short ? '#e3b341' : '#9aa4b2', width: 220, flexShrink: 0 }}>{st.label}</span>
                  <span style={{ color: st.short ? '#e3b341' : '#9aa4b2' }}>
                    {st.eth} / need {st.needEth} → {st.targetEth}
                    {st.wouldSendEth ? ` · top-up ${st.wouldSendEth}` : st.skip === 'treasury-short' ? ` · SHORT by ${st.deficitEth ?? '?'}` : st.skip === 'is-treasury' ? ' · is the treasury' : ' · ok'}
                  </span>
                </div>
              ))}
              {treasury.treasuryShort && (
                <div style={{ color: '#e3b341', marginTop: 2 }}>
                  faucet {treasury.requiredEth} ETH to the address above (a human claims it), then `npm run treasury:topup -- --execute`
                </div>
              )}
              {(treasury.recent ?? []).length > 0 && (
                <div style={{ color: '#556', marginTop: 2 }}>last: {treasury.recent!.map((r) => `${r.eth} → ${r.role} (${r.reason})`).join(' · ')}</div>
              )}
            </>
          )}
        </div>
      )}

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
          {/* U6 Arc stays DEFERRED: the control is visible so the shape is honest, and refuses like the elevator. */}
          <div style={row}>
            <span style={label}>wing</span>
            <span style={{ color: w.activeWing === 'arc' ? '#7ee787' : '#8ab4f8' }}>
              {w.activeWing === 'arc' ? 'Arc Testnet · 5042002 · native USDC gas' : 'Main wing'}
              <button
                style={{ ...btn, padding: '1px 8px', marginLeft: 8, opacity: 0.5, cursor: 'not-allowed' }}
                disabled
                title="ARC floor — coming soon. U6 is deferred (docs/ARC.md §5b); Dev/Live is not the Arc elevator."
                onClick={() => run('Taking the elevator to Arc…', () => w.switchWing(ARC_TESTNET_CHAIN_ID))}
              >
                Arc wing — coming soon
              </button>
            </span>
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
          {s?.account && (
            <div style={row}>
              <span style={label}>vault</span>
              <span style={{ color: s.priority ? '#e3b341' : '#9aa4b2' }}>
                {s.priority ? 'priority desk open — Okafor bypasses the clock with your Passkey' : 'vault-only — the clock is the only way out'}
                {` · roleSet ${s.roleSet ?? '?'}/${s.roleSetWanted ?? '?'}`}
                {w.mfaEnrolled ? ' · MFA enrolled' : ' · no MFA enrolled (sign sheet only)'}
              </span>
            </div>
          )}
          {s?.account && (
            <div style={row}>
              <span style={label}>FX till</span>
              <span style={{ color: '#9aa4b2' }}>
                {/* FX writes are Sepolia in both modes; Live's till is the Main account itself. */}
                {s.fxTillIsMain ? 'the Main account above — one balance, one guard list' : 'a separate Sepolia account (Developer Mode: Main is on the lab chain)'}
                {' · Sepolia only'}
              </span>
            </div>
          )}
          {s?.account && (
            <div style={row}>
              <span style={label}>ENS</span>
              <span style={{ color: s.ensName ? '#7ee787' : '#667' }}>{s.ensName ? `${s.ensName} · Sepolia` : 'no name claimed · Petra mints on Sepolia'}</span>
            </div>
          )}
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
            {s?.account && (
              <button style={{ ...btn, borderColor: '#8ab4f8' }} title="The bank computer: viewing wallets (OBSERVER) + the hosted Console" onClick={() => void window.BranchZero.call('openConsole')}>
                Terminal
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
                    <button style={{ ...btn, opacity: released ? 1 : 0.6 }} title="Bob — owner timed release after the clock, silent" onClick={() => run('Opening the vault…', () => w.call('/approve', { txId: x.txId }))}>
                      Release
                    </button>
                    <button style={btn} onClick={() => run('Recalling the wire…', () => w.call('/cancel', { txId: x.txId }))}>
                      Recall
                    </button>
                    {s?.priority && !released && (
                      <button
                        style={{ ...btn, borderColor: '#e3b341' }}
                        title="Okafor — skip the cooling period, hand scan required (Passkey + your own signature; the manager submits)"
                        onClick={() => run('Priority release — hand scan…', () => w.priority(x.txId))}
                      >
                        Priority (hand scan)
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
    </>
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
