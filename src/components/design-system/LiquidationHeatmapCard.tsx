'use client';

interface LiquidationHeatmapCardProps {
  totalRekt?: number;
  longTotal?: number;
  shortTotal?: number;
  exchangesActive?: number;
  exchangesTotal?: number;
  className?: string;
}

const fmt = (n: number) => {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
  return '$' + Math.round(n);
};

export default function LiquidationHeatmapCard({
  totalRekt = 0,
  longTotal = 0,
  shortTotal = 0,
  exchangesActive = 7,
  exchangesTotal = 7,
  className,
}: LiquidationHeatmapCardProps) {
  const longPct = totalRekt > 0 ? (longTotal / totalRekt) * 100 : 50;
  const shortPct = 100 - longPct;
  return (
    <div className={className} style={{ background: 'var(--hub-darker)', border: '1px solid var(--hub-border)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 14, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 12, padding: 1, background: 'linear-gradient(135deg, rgba(248,113,113,0.25), transparent 60%)', WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude', pointerEvents: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--hub-accent)" stroke="none">
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
        </svg>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-default)', letterSpacing: '-0.01em' }}>Liquidation Heatmap</div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--pump-mild)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--pump-mild)', boxShadow: '0 0 6px var(--pump-mild)' }} />
          {exchangesActive}/{exchangesTotal} exchanges
        </span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 4 }}>
          {['1H', '4H', '12H', '24H', '7D'].map((p, i) => (
            <span key={p} style={{ padding: '3px 8px', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, borderRadius: 4, cursor: 'pointer', background: i === 1 ? 'var(--hub-secondary-medium)' : 'transparent', color: i === 1 ? 'var(--fg-default)' : 'var(--fg-muted)', border: '1px solid', borderColor: i === 1 ? 'var(--hub-border-hover)' : 'transparent' }}>{p}</span>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <Stat label="Total Rekt" value={fmt(totalRekt)} color="var(--rekt-mild)" />
        <Stat label="Longs" value={fmt(longTotal)} color="var(--rekt-mild)" />
        <Stat label="Shorts" value={fmt(shortTotal)} color="var(--pump-mild)" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex', position: 'relative', boxShadow: 'inset 0 0 0 1px var(--hub-border-subtle)' }}>
          <div style={{ width: longPct + '%', background: 'linear-gradient(90deg,#dc2626,#f87171)', transition: 'width 600ms' }} />
          <div style={{ width: shortPct + '%', background: 'linear-gradient(90deg,#10b981,#22c55e)', transition: 'width 600ms' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600 }}>
          <span style={{ color: 'var(--rekt-mild)' }}>{longPct.toFixed(0)}% Long</span>
          <span style={{ color: 'var(--pump-mild)' }}>{shortPct.toFixed(0)}% Short</span>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.018)', border: '1px solid var(--hub-border-subtle)', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: 'var(--fg-subtle)', fontWeight: 500, marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 19, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}
