// MarketDetail — right-side drawer shown when a row is clicked
function MarketDetail({ row, onClose }) {
  if (!row) return null;
  const venues = [
    { name: 'Binance', img: '../../assets/exchanges/binance.png', fund: row.funding, oi: '4.2B' },
    { name: 'Bybit',   img: '../../assets/exchanges/bybit.png',   fund: row.funding * 0.92, oi: '2.8B' },
    { name: 'OKX',     img: '../../assets/exchanges/okx.png',     fund: row.funding * 1.08, oi: '1.9B' },
    { name: 'Bitget',  img: '../../assets/exchanges/bitget.png',  fund: row.funding * 0.75, oi: '1.2B' },
    { name: 'Hyperliq',img: '../../assets/exchanges/hyperliquid.png',fund: row.funding * 1.31, oi: '0.8B' },
    { name: 'dYdX',    img: '../../assets/exchanges/dydx.png',    fund: row.funding * 0.61, oi: '0.4B' },
  ];
  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50,
        animation: 'fade-in 160ms ease-out',
      }}/>
      <aside style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 480, zIndex: 51,
        background: 'var(--hub-black)', borderLeft: '1px solid var(--hub-border-hover)',
        boxShadow: '-20px 0 50px rgba(0,0,0,0.5)', overflowY: 'auto',
        animation: 'slide-in 200ms cubic-bezier(0.2,0.8,0.25,1)',
      }}>
        <div style={{
          position: 'sticky', top: 0, background: 'var(--hub-black)',
          borderBottom: '1px solid var(--hub-border)', padding: '14px 18px',
          display: 'flex', alignItems: 'center', gap: 10, zIndex: 1,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 999,
            background: 'linear-gradient(135deg,#f7931a,#ffb547)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontFamily: 'var(--font-sans)',
          }}>{row.symbol[0]}</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-default)', letterSpacing: '-0.01em' }}>{row.symbol} <span style={{ fontSize: 11, color: 'var(--fg-subtle)', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>PERP</span></div>
            <div style={{ fontSize: 11, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>${row.price.toLocaleString(undefined,{maximumFractionDigits:2})} · <span style={{ color: row.chg >= 0 ? 'var(--pump-mild)' : 'var(--rekt-mild)' }}>{row.chg >= 0 ? '+' : ''}{row.chg.toFixed(2)}%</span></div>
          </div>
          <div style={{ flex: 1 }}/>
          <button onClick={onClose} style={{
            width: 28, height: 28, border: '1px solid var(--hub-border)', borderRadius: 7,
            background: 'var(--hub-darker)', color: 'var(--fg-muted)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        {/* Chart placeholder */}
        <div style={{ padding: 16 }}>
          <div style={{
            height: 180, background: 'var(--hub-darker)', border: '1px solid var(--hub-border)',
            borderRadius: 10, position: 'relative', overflow: 'hidden',
          }}>
            <svg viewBox="0 0 480 180" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(255,165,0)" stopOpacity="0.3"/>
                  <stop offset="100%" stopColor="rgb(255,165,0)" stopOpacity="0"/>
                </linearGradient>
              </defs>
              <path d="M0,130 C40,100 80,120 120,90 C160,60 200,80 240,50 C280,40 320,70 360,55 C400,40 440,60 480,35 L480,180 L0,180 Z" fill="url(#chartGrad)"/>
              <path d="M0,130 C40,100 80,120 120,90 C160,60 200,80 240,50 C280,40 320,70 360,55 C400,40 440,60 480,35" fill="none" stroke="var(--hub-accent)" strokeWidth="1.5"/>
            </svg>
            <div style={{ position: 'absolute', top: 10, left: 12, display: 'flex', gap: 6 }}>
              {['1h','4h','1d','1w','1m'].map((t, i) => (
                <button key={t} style={{
                  padding: '3px 8px', fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
                  border: '1px solid var(--hub-border)', borderRadius: 4, cursor: 'pointer',
                  background: i === 1 ? 'var(--hub-secondary-medium)' : 'var(--hub-black)',
                  color: i === 1 ? 'var(--fg-default)' : 'var(--fg-muted)',
                }}>{t}</button>
              ))}
            </div>
          </div>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 12 }}>
            {[
              { l: 'Mark', v: '$' + row.price.toLocaleString(undefined,{maximumFractionDigits:0}) },
              { l: 'Index', v: '$' + (row.price * 0.9998).toLocaleString(undefined,{maximumFractionDigits:0}) },
              { l: 'OI', v: row.oi, c: 'var(--fg-default)' },
              { l: 'L/S', v: row.ls.toFixed(2), c: row.ls >= 1 ? 'var(--pump-mild)' : 'var(--rekt-mild)' },
            ].map(s => (
              <div key={s.l} style={{ padding: 10, background: 'var(--hub-darker)', border: '1px solid var(--hub-border)', borderRadius: 8 }}>
                <div style={{ fontSize: 9, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>{s.l}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: s.c || 'var(--fg-default)', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* Per-exchange breakdown */}
          <div style={{ marginTop: 16, marginBottom: 8, fontSize: 10, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>Funding by exchange</div>
          <div style={{ background: 'var(--hub-darker)', border: '1px solid var(--hub-border)', borderRadius: 10, overflow: 'hidden' }}>
            {venues.map((v, i) => (
              <div key={v.name} style={{
                display: 'grid', gridTemplateColumns: '26px 1fr 1fr 1fr', gap: 10, alignItems: 'center',
                padding: '9px 12px',
                borderBottom: i < venues.length - 1 ? '1px solid var(--hub-border-subtle)' : 'none',
                fontSize: 12,
              }}>
                <img src={v.img} style={{ width: 18, height: 18, borderRadius: 4 }} onError={e => e.target.style.visibility = 'hidden'}/>
                <div style={{ color: 'var(--fg-default)', fontWeight: 500 }}>{v.name}</div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                  color: v.fund > 0.15 ? 'var(--hub-accent-light)' : (v.fund > 0 ? 'var(--pump-mild)' : 'var(--rekt-mild)') }}>
                  {v.fund >= 0 ? '+' : ''}{v.fund.toFixed(4)}%
                </div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', fontVariantNumeric: 'tabular-nums' }}>${v.oi}</div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button style={{
              flex: 1, background: 'linear-gradient(135deg,#FFB800,#FF8C00)', color: '#07090d',
              fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 12,
              border: 'none', padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
              boxShadow: '0 0 14px rgb(255 165 0 / 0.2)',
            }}>Open in Chart</button>
            <button style={{
              background: 'var(--hub-darker)', border: '1px solid var(--hub-border)',
              color: 'var(--fg-default)', fontFamily: 'var(--font-sans)', fontWeight: 600,
              fontSize: 12, padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
            }}>+ Watchlist</button>
            <button style={{
              background: 'var(--hub-darker)', border: '1px solid var(--hub-border)',
              color: 'var(--fg-default)', fontFamily: 'var(--font-sans)', fontWeight: 600,
              fontSize: 12, padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
            }}>Alert</button>
          </div>
        </div>

        <style>{`
          @keyframes slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
          @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        `}</style>
      </aside>
    </>
  );
}

window.MarketDetail = MarketDetail;
