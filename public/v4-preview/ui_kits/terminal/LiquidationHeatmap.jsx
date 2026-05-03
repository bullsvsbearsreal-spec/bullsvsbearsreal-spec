// LiquidationHeatmap — totals + long/short split + whale-tagged tiles
function LiquidationHeatmap() {
  const events = window.IH?.useLiqEvents?.() || [];

  // Aggregate by symbol over recent events
  const byCoin = React.useMemo(() => {
    const m = new Map();
    events.forEach(e => {
      const r = m.get(e.sym) || { sym: e.sym, longUsd: 0, shortUsd: 0, total: 0, whale: false, lastT: 0 };
      if (e.side === 'LONG') r.longUsd += e.usd; else r.shortUsd += e.usd;
      r.total = r.longUsd + r.shortUsd;
      if (e.usd >= 500_000) r.whale = true;
      r.lastT = Math.max(r.lastT, e.t);
      m.set(e.sym, r);
    });
    // also seed from coins so tiles always exist
    (window.IH?.state?.coins || []).slice(0, 10).forEach(c => {
      if (!m.has(c.sym)) {
        const t = (c.px % 2_000_000) + 250_000;
        const longBias = c.chg < 0 ? 0.7 : 0.3;
        m.set(c.sym, { sym: c.sym, longUsd: t * longBias, shortUsd: t * (1-longBias), total: t, whale: t > 800_000, lastT: 0, iconBg: c.iconBg });
      }
    });
    // attach iconBg
    (window.IH?.state?.coins || []).forEach(c => {
      const r = m.get(c.sym); if (r) r.iconBg = c.iconBg;
    });
    return [...m.values()].sort((a, b) => b.total - a.total).slice(0, 8);
  }, [events]);

  const totalRekt = byCoin.reduce((s, r) => s + r.total, 0);
  const totalLong = byCoin.reduce((s, r) => s + r.longUsd, 0);
  const totalShort = byCoin.reduce((s, r) => s + r.shortUsd, 0);
  const longPct = totalRekt > 0 ? (totalLong / totalRekt) * 100 : 50;
  const shortPct = 100 - longPct;
  const lopsided = Math.abs(longPct - 50) > 25;

  const fmt = (n) => {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
    return '$' + Math.round(n);
  };

  return (
    <div style={{
      background: 'var(--hub-darker)', border: '1px solid var(--hub-border)',
      borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 14,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* subtle border-glow accent matching screenshot */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: 12, padding: 1,
        background: 'linear-gradient(135deg, rgba(248,113,113,0.25), transparent 60%)',
        WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
        WebkitMaskComposite: 'xor', maskComposite: 'exclude', pointerEvents: 'none' }}/>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--hub-accent)" stroke="none">
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
        </svg>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-default)', letterSpacing: '-0.01em' }}>Liquidation Heatmap</div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--pump-mild)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--pump-mild)', boxShadow: '0 0 6px var(--pump-mild)' }}/>
          7/7 exchanges
        </span>
        <div style={{ flex: 1 }}/>
        <div style={{ display: 'flex', gap: 4 }}>
          {['1H','4H','12H','24H','7D'].map((p,i) => (
            <span key={p} style={{
              padding: '3px 8px', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
              borderRadius: 4, cursor: 'pointer',
              background: i === 1 ? 'var(--hub-secondary-medium)' : 'transparent',
              color: i === 1 ? 'var(--fg-default)' : 'var(--fg-muted)',
              border: '1px solid', borderColor: i === 1 ? 'var(--hub-border-hover)' : 'transparent',
            }}>{p}</span>
          ))}
        </div>
      </div>

      {/* Totals row — 3 columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <div style={{ background: 'rgba(255,255,255,0.018)', border: '1px solid var(--hub-border-subtle)', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--fg-subtle)', fontWeight: 500, marginBottom: 2 }}>Total Rekt</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 19, fontWeight: 800, color: 'var(--rekt-mild)' }}>{fmt(totalRekt)}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.018)', border: '1px solid var(--hub-border-subtle)', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--fg-subtle)', fontWeight: 500, marginBottom: 2 }}>Longs</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 19, fontWeight: 800, color: 'var(--rekt-mild)' }}>{fmt(totalLong)}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.018)', border: '1px solid var(--hub-border-subtle)', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--fg-subtle)', fontWeight: 500, marginBottom: 2 }}>Shorts</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 19, fontWeight: 800, color: 'var(--pump-mild)' }}>{fmt(totalShort)}</div>
        </div>
      </div>

      {/* Long / Short split bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {lopsided && (
          <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, fontStyle: 'italic', color: 'var(--rekt-mild)', letterSpacing: '0.04em' }}>
            Absolute carnage across the board
          </div>
        )}
        <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex', position: 'relative', boxShadow: 'inset 0 0 0 1px var(--hub-border-subtle)' }}>
          <div style={{ width: longPct + '%', background: 'linear-gradient(90deg,#dc2626,#f87171)', transition: 'width 600ms' }}/>
          <div style={{ width: shortPct + '%', background: 'linear-gradient(90deg,#10b981,#22c55e)', transition: 'width 600ms' }}/>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600 }}>
          <span style={{ color: 'var(--rekt-mild)' }}>{longPct.toFixed(0)}% Long</span>
          <span style={{ color: 'var(--pump-mild)' }}>{shortPct.toFixed(0)}% Short</span>
        </div>
      </div>

      {/* Whale-tagged tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {byCoin.slice(0, 4).map(r => {
          const longHeavier = r.longUsd > r.shortUsd;
          const tint = longHeavier ? 'rgba(220,38,38,0.16)' : 'rgba(16,185,129,0.16)';
          const border = longHeavier ? 'rgba(220,38,38,0.45)' : 'rgba(16,185,129,0.45)';
          return (
            <div key={r.sym} style={{
              background: `linear-gradient(135deg, ${tint}, transparent 80%), var(--hub-darker)`,
              border: `1px solid ${border}`,
              borderRadius: 8, padding: '10px 12px',
              display: 'flex', flexDirection: 'column', gap: 4, position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontWeight: 700, color: 'var(--fg-default)', fontSize: 12 }}>{r.sym}</span>
                {r.whale && (
                  <span style={{
                    fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 3,
                    background: 'linear-gradient(135deg,#a855f7,#7c3aed)', color: '#fff',
                    letterSpacing: '0.08em',
                  }}>WHALE</span>
                )}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--fg-default)' }}>
                {fmt(r.total)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

window.LiquidationHeatmap = LiquidationHeatmap;
