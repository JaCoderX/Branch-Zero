import { useEffect, useRef, useState } from 'react';
import type { PlayerTreasury } from '../bridge/branchZero';
import { focusCanvas } from '../shell/focus';

export const SEPOLIA_FAUCET_URL = 'https://cloud.google.com/application/web3/faucet/ethereum/sepolia';

export interface BranchFloatProps {
  treasury: PlayerTreasury;
  onClose(reason: string): void;
}

/** The player-safe ops float panel. It only copies the published address or opens the human faucet. */
export function BranchFloat({ treasury, onClose }: BranchFloatProps) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);

  const close = (reason: string) => {
    onClose(reason);
    focusCanvas();
  };

  useEffect(() => {
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      close('escape');
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, []);

  async function copyAddress(): Promise<void> {
    const address = treasury.address;
    if (!address) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(address);
      } else {
        const area = document.createElement('textarea');
        area.value = address;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        if (!document.execCommand('copy')) throw new Error('copy refused');
        area.remove();
      }
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const required = treasury.requiredEth || '—';
  const short = treasury.treasuryShort ? 'yes' : 'no';

  return (
    <div style={backdrop} role="presentation" onPointerDown={(event) => event.target === event.currentTarget && close('backdrop')}>
      <section style={panel} role="dialog" aria-modal="true" aria-labelledby="branch-float-title">
        <div style={bar}>
          <h2 id="branch-float-title" style={title}>Help keep the branch open</h2>
          <button ref={closeButton} style={button} onClick={() => close('button')} title="Esc — back to the bank">
            Close [Esc]
          </button>
        </div>

        <p style={why}>Sepolia ETH for bank ops gas — not your passbook and not practice dollars.</p>

        <div style={addressRow}>
          <code style={address}>{treasury.address ?? 'address unavailable'}</code>
          <button style={button} disabled={!treasury.address} onClick={() => void copyAddress()}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <a style={faucet} href={SEPOLIA_FAUCET_URL} target="_blank" rel="noreferrer noopener">
          Open the Google Cloud Sepolia ETH faucet ↗
        </a>

        <div style={{ ...status, borderColor: treasury.treasuryShort ? '#e3b341' : '#2a3140' }}>
          <div>status · eth {treasury.eth || '—'} · short {short} · requiredEth {required}</div>
          <div style={{ color: treasury.treasuryShort ? '#e3b341' : '#7ee787', marginTop: 4 }}>
            {treasury.treasuryShort ? 'Staff gas is low; the branch may not stamp slips right now.' : 'Staff gas is in the till; the branch can stamp slips.'}
          </div>
        </div>

        <p style={note}>After a faucet drop, the branch tops staff in the background — retry in a minute.</p>
      </section>
    </div>
  );
}

const backdrop: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 20,
  background: 'rgba(4,6,10,0.78)',
  display: 'grid',
  placeItems: 'center',
  padding: 16,
  font: '14px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  color: '#e6e6e6',
};

const panel: React.CSSProperties = {
  width: 'min(640px, 100%)',
  background: '#0b0e14',
  border: '1px solid #8ab4f8',
  borderRadius: 10,
  padding: 20,
  boxShadow: '0 24px 80px rgba(0,0,0,0.65)',
};

const bar: React.CSSProperties = { display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' };
const title: React.CSSProperties = { margin: 0, color: '#e3b341', fontSize: 22, letterSpacing: 0.4 };
const why: React.CSSProperties = { color: '#e6e6e6', margin: '18px 0 14px' };
const addressRow: React.CSSProperties = { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 };
const address: React.CSSProperties = { color: '#8ab4f8', wordBreak: 'break-all', flex: 1 };
const status: React.CSSProperties = { border: '1px solid #2a3140', borderRadius: 6, padding: '10px 12px', marginTop: 16 };
const note: React.CSSProperties = { color: '#9aa4b2', margin: '16px 0 0' };
const faucet: React.CSSProperties = { color: '#8ab4f8', display: 'inline-block', textDecoration: 'none', borderBottom: '1px solid #8ab4f8', paddingBottom: 2 };
const button: React.CSSProperties = {
  background: '#1b2130',
  color: '#e6e6e6',
  border: '1px solid #2a3140',
  borderRadius: 6,
  padding: '6px 10px',
  font: 'inherit',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};
