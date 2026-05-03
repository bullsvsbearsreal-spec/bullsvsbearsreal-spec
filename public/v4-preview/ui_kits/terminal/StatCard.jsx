// StatCard — hero metric card with sparkline
function Sparkline({ data, color }) {
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${100 - ((v - min) / range) * 100}`).join(' ');
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: 36, opacity: 0.7 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke"/>
    </svg>
  );
}

function StatCard({ label, value, delta, unit, spark, color = 'var(--pump-mild)' }) {
  return (
    <div style={{
      background: 'var(--hub-darker)', border: '1px solid var(--hub-border)',
      borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8,
      transition: 'border-color 150ms',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--hub-border-hover)'}
    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--hub-border)'}>
      <div style={{
        fontSize: 10, color: 'var(--fg-subtle)', textTransform: 'uppercase',
        letterSpacing: '0.12em', fontWeight: 700,
      }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700,
          color: 'var(--fg-default)', letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {unit}{value}
        </div>
        {delta != null && (
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
            color: delta >= 0 ? 'var(--pump-mild)' : 'var(--rekt-mild)',
          }}>
            {delta >= 0 ? '+' : ''}{delta.toFixed(2)}%
          </div>
        )}
      </div>
      {spark && <Sparkline data={spark} color={color}/>}
    </div>
  );
}

window.StatCard = StatCard;
