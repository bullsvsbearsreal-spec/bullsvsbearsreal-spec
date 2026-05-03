// FundingTable — dense data table, primary data surface
const EXCHANGES = ['binance','bybit','okx','bitget','deribit'];

function FundingTable({ rows, onRowClick, selectedSymbol }) {
  return (
    <div style={{
      background: 'var(--hub-darker)', border: '1px solid var(--hub-border)',
      borderRadius: 12, overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', padding: '12px 16px',
        borderBottom: '1px solid var(--hub-border-subtle)',
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-default)', letterSpacing: '-0.01em' }}>Top Funding</div>
        <span style={{ marginLeft: 10, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)' }}>
          33 exchanges · 8h period · updated 8s ago
        </span>
        <div style={{ flex: 1 }}/>
        <div style={{ display: 'flex', background: 'var(--hub-black)', border: '1px solid var(--hub-border)', borderRadius: 7, padding: 2 }}>
          {['8h', '1d', '1w'].map((t, i) => (
            <button key={t} style={{
              padding: '4px 10px', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
              border: 'none', borderRadius: 5, cursor: 'pointer',
              background: i === 0 ? 'var(--hub-secondary-medium)' : 'transparent',
              color: i === 0 ? 'var(--fg-default)' : 'var(--fg-muted)',
            }}>{t}</button>
          ))}
        </div>
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: '32px 1.2fr 1fr 1fr 1fr 0.8fr 1fr',
        gap: 10, padding: '8px 16px', background: 'rgba(0,0,0,0.25)',
        borderBottom: '1px solid var(--hub-border)',
        fontSize: 9, color: 'var(--fg-subtle)', textTransform: 'uppercase',
        letterSpacing: '0.12em', fontWeight: 700,
      }}>
        <div>#</div><div>Pair</div>
        <div style={{ textAlign: 'right' }}>Price</div>
        <div style={{ textAlign: 'right' }}>Funding</div>
        <div style={{ textAlign: 'right' }}>OI</div>
        <div style={{ textAlign: 'right' }}>L/S</div>
        <div style={{ textAlign: 'right' }}>24h</div>
      </div>
      {rows.map((r, i) => {
        const on = r.symbol === selectedSymbol;
        return (
          <div key={r.symbol} onClick={() => onRowClick(r)}
            style={{
              display: 'grid', gridTemplateColumns: '32px 1.2fr 1fr 1fr 1fr 0.8fr 1fr',
              gap: 10, padding: '10px 16px', alignItems: 'center',
              borderBottom: '1px solid var(--hub-border-subtle)',
              background: on ? 'rgba(255,165,0,0.06)' : (i % 2 ? 'transparent' : 'rgba(255,255,255,0.015)'),
              cursor: 'pointer', fontSize: 12,
              borderLeft: on ? '2px solid var(--hub-accent)' : '2px solid transparent',
              paddingLeft: on ? 14 : 16, transition: 'background 120ms',
            }}
            onMouseEnter={e => { if (!on) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
            onMouseLeave={e => { if (!on) e.currentTarget.style.background = i % 2 ? 'transparent' : 'rgba(255,255,255,0.015)'; }}>
            <div style={{ color: 'var(--fg-subtle)', fontFamily: 'var(--font-mono)' }}>{i + 1}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 22, height: 22, borderRadius: 999,
                background: r.iconBg || 'linear-gradient(135deg,#f7931a,#ffb547)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 10, fontWeight: 800, fontFamily: 'var(--font-sans)',
              }}>{r.symbol[0]}</div>
              <div>
                <span style={{ color: 'var(--fg-default)', fontWeight: 600 }}>{r.symbol}</span>
                <span style={{ color: 'var(--fg-subtle)', fontSize: 9, marginLeft: 6, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{r.venue}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--fg-default)', fontVariantNumeric: 'tabular-nums' }}>${r.price.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
            <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
              fontWeight: 700,
              color: r.funding > 0.15 ? 'var(--hub-accent-light)' : (r.funding > 0 ? 'var(--pump-mild)' : 'var(--rekt-mild)'),
            }}>{r.funding >= 0 ? '+' : ''}{r.funding.toFixed(4)}%</div>
            <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', fontVariantNumeric: 'tabular-nums' }}>{r.oi}</div>
            <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: r.ls >= 1 ? 'var(--pump-mild)' : 'var(--rekt-mild)', fontVariantNumeric: 'tabular-nums' }}>{r.ls.toFixed(2)}</div>
            <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
              color: r.chg >= 0 ? 'var(--pump-mild)' : 'var(--rekt-mild)', fontWeight: 600,
            }}>{r.chg >= 0 ? '+' : ''}{r.chg.toFixed(2)}%</div>
          </div>
        );
      })}
    </div>
  );
}

window.FundingTable = FundingTable;
