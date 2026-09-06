import { useEffect, useState } from 'react';
import { onBridgeTraffic } from '../bridge/branchZero';

interface Line {
  t: string;
  text: string;
  kind: 'req' | 'res' | 'err' | 'evt' | 'sys';
}

const MAX = 12;

/** Minimal U0 overlay: shows bridge traffic so K1 can be judged without opening devtools. Privy UI lands here in U1. */
export function App({ engineState }: { engineState: string }) {
  const [lines, setLines] = useState<Line[]>([]);

  useEffect(() => {
    const push = (l: Line) => setLines((prev) => [...prev.slice(-(MAX - 1)), l]);
    return onBridgeTraffic((m) => {
      const t = new Date().toLocaleTimeString();
      if (m.type === 'request') push({ t, kind: 'req', text: `→ ${m.method} ${JSON.stringify(m.args)}` });
      else if (m.type === 'response') push({ t, kind: m.ok ? 'res' : 'err', text: `← ${m.id} ${m.ok ? JSON.stringify(m.result) : `${m.error?.code}: ${m.error?.message}`}` });
      else push({ t, kind: 'evt', text: `• ${m.kind} ${JSON.stringify(m.payload)}` });
    });
  }, []);

  return (
    <div style={panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <strong>Branch Zero · U0 shell</strong>
        <span style={{ color: '#9aa4b2' }}>engine: {engineState}</span>
      </div>
      <div style={{ color: '#9aa4b2', marginBottom: 6 }}>window.BranchZero traffic (Godot ↔ JS, JSON only)</div>
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
  width: 'min(560px, calc(100vw - 24px))',
  maxHeight: '45vh',
  overflow: 'auto',
  background: 'rgba(11,14,20,0.88)',
  border: '1px solid #2a3140',
  borderRadius: 8,
  padding: '10px 12px',
  font: '12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  color: '#e6e6e6',
};
