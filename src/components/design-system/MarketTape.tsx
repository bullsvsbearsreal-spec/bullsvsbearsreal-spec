'use client';
import RadarPulse from './RadarPulse';
import ThroughputCounter from './ThroughputCounter';

interface TapeItem { sym: string; price: number; chg: number; }
interface MarketTapeProps { items: TapeItem[]; baseline?: number; stickyTop?: number; className?: string; }

export default function MarketTape({ items, baseline = 1247, stickyTop = 0, className }: MarketTapeProps) {
  if (!items?.length) return null;
  return (
    <div className={className} style={{ position: 'sticky', top: stickyTop, zIndex: 39, height: 28, background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--hub-border-subtle)', display: 'flex', alignItems: 'center', overflow: 'hidden', flexShrink: 0 }} aria-label="Live market tape">
      <div style={{ flexShrink: 0, padding: '0 14px', fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 700, color: 'var(--hub-accent)', textTransform: 'uppercase', letterSpacing: '0.12em', borderRight: '1px solid var(--hub-border-subtle)', height: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(90deg, rgba(255,165,0,0.08), transparent)' }}>
        <RadarPulse size={12} color="var(--pump-mild)" />
        <span>LIVE</span>
        <ThroughputCounter baseline={baseline} suffix="msg/s" />
      </div>
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', height: '100%' }}>
        <div style={{ display: 'flex', gap: 26, height: '100%', alignItems: 'center', paddingLeft: 14, whiteSpace: 'nowrap', animation: 'tape-scroll 60s linear infinite' }}>
          {[...items, ...items].map((m, i) => (
            <span key={`${m.sym}-${i}`} style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
              <span style={{ color: 'var(--fg-muted)', fontWeight: 600 }}>{m.sym}</span>{' '}
              <span style={{ color: 'var(--fg-default)' }}>${m.price.toLocaleString(undefined, { maximumFractionDigits: m.price < 1 ? 4 : 2 })}</span>{' '}
              <span style={{ color: m.chg >= 0 ? 'var(--pump-mild)' : 'var(--rekt-mild)', fontWeight: 600 }}>{m.chg >= 0 ? '+' : ''}{m.chg.toFixed(2)}%</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
