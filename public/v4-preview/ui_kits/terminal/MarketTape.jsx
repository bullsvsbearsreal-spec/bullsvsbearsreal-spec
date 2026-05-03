// MarketTape — 28px horizontally scrolling ticker
function MarketTape({ items }) {
  return (
    <div style={{
      position: 'sticky', top: 48, zIndex: 39, height: 28,
      background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(10px)',
      borderBottom: '1px solid var(--hub-border-subtle)',
      display: 'flex', alignItems: 'center', overflow: 'hidden',
    }}>
      <div style={{
        flexShrink: 0, padding: '0 14px', fontFamily: 'var(--font-sans)',
        fontSize: 10, fontWeight: 700, color: 'var(--hub-accent)',
        textTransform: 'uppercase', letterSpacing: '0.12em',
        borderRight: '1px solid var(--hub-border-subtle)', height: '100%',
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'linear-gradient(90deg, rgba(255,165,0,0.08), transparent)',
      }}>
        <RadarPulse size={12} color="var(--pump-mild)"/>
        <span>LIVE</span>
        <span style={{ color: 'var(--fg-subtle)', fontWeight: 500, letterSpacing: '0.06em' }}>
          <ThroughputCounter baseline={1247}/>
          <span style={{ marginLeft: 3, color: 'var(--fg-muted)', fontSize: 9 }}>msg/s</span>
        </span>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', height: '100%' }}>
        <div style={{
          display: 'flex', gap: 26, height: '100%', alignItems: 'center',
          paddingLeft: 14, whiteSpace: 'nowrap',
          animation: 'tape-scroll 60s linear infinite',
        }}>
          {[...items, ...items].map((m, i) => (
            <span key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
              <span style={{ color: 'var(--fg-muted)', fontWeight: 600 }}>{m.sym}</span>{' '}
              <span style={{ color: 'var(--fg-default)' }}>${m.price.toLocaleString()}</span>{' '}
              <span style={{ color: m.chg >= 0 ? 'var(--pump-mild)' : 'var(--rekt-mild)', fontWeight: 600 }}>
                {m.chg >= 0 ? '+' : ''}{m.chg.toFixed(2)}%
              </span>
            </span>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes tape-scroll { from { transform: translateX(0);} to { transform: translateX(-50%);} }
        @keyframes tape-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
      `}</style>
    </div>
  );
}

window.MarketTape = MarketTape;
