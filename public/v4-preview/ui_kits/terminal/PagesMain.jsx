// ══════════════════════════════════════════════════════════════════
// Pages — OI / Liq / Screener / Chart
// All subscribe to window.IH for live data.
// ══════════════════════════════════════════════════════════════════

const { useCoins, useCoin, useEvents, useLiqEvents, useStreamMeta, fmtUSD, fmtPx, toggleWatch, isWatched } = window.IH;

// ── Shared atoms ────────────────────────────────────────────────────
function PageHeading({ title, subtitle, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 4 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--fg-default)' }}>{title}</h1>
      {subtitle && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)' }}>{subtitle}</span>}
      <div style={{ flex: 1 }}/>
      {right}
    </div>
  );
}

function Card({ title, right, children, pad = 14, height }) {
  return (
    <div style={{
      background: 'var(--hub-darker)', border: '1px solid var(--hub-border)',
      borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column',
      height,
    }}>
      {title && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
          borderBottom: '1px solid var(--hub-border-subtle)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-default)', letterSpacing: '-0.01em' }}>{title}</div>
          <div style={{ flex: 1 }}/>
          {right}
        </div>
      )}
      <div style={{ padding: pad, flex: 1, minHeight: 0, overflow: 'auto' }}>{children}</div>
    </div>
  );
}

function FlashCell({ value, dir, format = (v) => v, color = 'var(--fg-default)' }) {
  // dir: 1 up, -1 down, 0 flat
  const ref = React.useRef(null);
  const last = React.useRef(value);
  React.useEffect(() => {
    if (!ref.current) return;
    if (value !== last.current && dir !== 0) {
      const bg = dir > 0 ? 'rgba(74,222,128,0.22)' : 'rgba(248,113,113,0.22)';
      ref.current.style.background = bg;
      const t = setTimeout(() => {
        if (ref.current) ref.current.style.background = 'transparent';
      }, 600);
      last.current = value;
      return () => clearTimeout(t);
    }
  }, [value, dir]);
  return (
    <span ref={ref} style={{
      display: 'inline-block', padding: '1px 5px', margin: '-1px -5px',
      borderRadius: 3, transition: 'background 600ms', color,
      fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontWeight: 600,
    }}>{format(value)}</span>
  );
}

function CoinIcon({ sym, size = 22, bg }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 999, flexShrink: 0,
      background: bg || 'linear-gradient(135deg,#444,#222)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: size * 0.45, fontWeight: 800, fontFamily: 'var(--font-sans)',
    }}>{sym[0]}</div>
  );
}

function MiniSpark({ sym, color = 'var(--hub-accent)', height = 24, width = 70 }) {
  // deterministic walk based on sym hash
  const data = React.useMemo(() => {
    let h = 0; for (let i = 0; i < sym.length; i++) h = ((h << 5) - h + sym.charCodeAt(i)) | 0;
    let s = Math.abs(h); const seed = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    const out = [50];
    for (let i = 1; i < 30; i++) out.push(out[i-1] + (seed() - 0.48) * 4);
    return out;
  }, [sym]);
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.2"/>
    </svg>
  );
}

// ══════════════════════════════════════════════════════════════════
// Open Interest
// ══════════════════════════════════════════════════════════════════
function OIPage() {
  const coins = useCoins().slice().sort((a, b) => b.oi - a.oi).slice(0, 16);
  const total = coins.reduce((s, c) => s + c.oi, 0);
  const max = coins[0].oi;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
      <PageHeading title="Open Interest" subtitle="Aggregate OI across 33 venues · streaming"
        right={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)' }}>Σ {fmtUSD(total)}</span>}/>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <StatCard label="Total OI"   value={fmtUSD(total).replace('$','')}        unit="$" delta={2.41} spark={[60,62,64,66,65,68,70,69,72,74,73,76]} color="var(--hub-accent)"/>
        <StatCard label="OI 24h Δ"   value="3.84B" unit="$" delta={4.62} spark={[2,3,4,3,5,6,7,6,8,9,8,10]} color="var(--pump-mild)"/>
        <StatCard label="L/S Ratio"  value="1.18"          delta={2.81} spark={[100,102,104,103,105,107,108,110,112,111,114,116]} color="var(--pump-mild)"/>
        <StatCard label="Long Liq"   value="248M" unit="$" delta={-12.4} spark={[8,7,6,7,5,6,4,5,3,4,3,2]} color="var(--rekt-mild)"/>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 12 }}>
        <Card title="OI by Asset" right={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)' }}>Top 16 · sorted by OI</span>} pad={0}>
          <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {coins.map((c, i) => (
              <div key={c.sym} style={{ display: 'grid', gridTemplateColumns: '24px 100px 1fr 90px 80px', alignItems: 'center', gap: 10, fontSize: 12 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)' }}>{i + 1}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <CoinIcon sym={c.sym} size={18} bg={c.iconBg}/>
                  <span style={{ fontWeight: 600, color: 'var(--fg-default)' }}>{c.sym}</span>
                </span>
                <div style={{ position: 'relative', height: 18, background: 'rgba(255,255,255,0.025)', borderRadius: 4 }}>
                  <div style={{ position: 'absolute', inset: 0, width: `${(c.oi / max) * 100}%`,
                    background: c.oi24 >= 0 ? 'linear-gradient(90deg, rgba(74,222,128,0.18), rgba(74,222,128,0.4))' : 'linear-gradient(90deg, rgba(248,113,113,0.18), rgba(248,113,113,0.4))',
                    borderRadius: 4 }}/>
                  <span style={{ position: 'absolute', left: 8, top: 0, height: 18, lineHeight: '18px',
                    fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-default)' }}>{fmtUSD(c.oi)}</span>
                </div>
                <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
                  color: c.oi24 >= 0 ? 'var(--pump-mild)' : 'var(--rekt-mild)' }}>{c.oi24 >= 0 ? '+' : ''}{c.oi24.toFixed(2)}%</span>
                <FlashCell value={c.px} dir={c.flashDir} format={fmtPx}/>
              </div>
            ))}
          </div>
        </Card>

        <Card title="OI by Exchange" pad={14}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { v: 'Binance',     pct: 32, oi: 26.8 },
              { v: 'Bybit',       pct: 18, oi: 15.2 },
              { v: 'OKX',         pct: 12, oi: 10.1 },
              { v: 'Hyperliquid', pct: 9,  oi: 7.6  },
              { v: 'Bitget',      pct: 8,  oi: 6.7  },
              { v: 'BitMEX',      pct: 5,  oi: 4.2  },
              { v: 'Deribit',     pct: 4,  oi: 3.4  },
              { v: 'Other',       pct: 12, oi: 10.2 },
            ].map(x => (
              <div key={x.v} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 60px', alignItems: 'center', gap: 8, fontSize: 11 }}>
                <span style={{ color: 'var(--fg-default)', fontWeight: 500 }}>{x.v}</span>
                <div style={{ height: 14, background: 'rgba(255,255,255,0.025)', borderRadius: 3, position: 'relative' }}>
                  <div style={{ position: 'absolute', inset: 0, width: `${x.pct}%`, background: 'linear-gradient(90deg,#FF8C00,#FFB800)', borderRadius: 3 }}/>
                </div>
                <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>${x.oi}B</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--hub-border-subtle)' }}>
            <div style={{ fontSize: 9, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, marginBottom: 8 }}>OI Δ — last hour</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24,1fr)', gap: 1, height: 36 }}>
              {Array.from({length: 24}, (_, i) => {
                const v = Math.sin(i * 0.5) * 0.7 + Math.random() * 0.3;
                const up = v > 0;
                return <div key={i} style={{ background: up ? `rgba(74,222,128,${Math.abs(v)})` : `rgba(248,113,113,${Math.abs(v)})`, borderRadius: 1 }}/>;
              })}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Liquidations
// ══════════════════════════════════════════════════════════════════
function LiquidationsPage() {
  const events = useLiqEvents();
  const recent = events.slice(0, 22);
  const totals = events.reduce((acc, e) => {
    acc.total += e.usd;
    if (e.side === 'LONG') acc.long += e.usd; else acc.short += e.usd;
    return acc;
  }, { total: 0, long: 0, short: 0 });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
      <PageHeading title="Liquidations" subtitle="Live forced exits across venues"
        right={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--rekt-mild)', fontWeight: 700 }}>● {events.length} in last min</span>}/>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <StatCard label="Total 24h"  value="2.41B" unit="$" delta={18.42} spark={[2,3,4,3,5,6,4,7,8,12,16,18]} color="var(--rekt-mild)"/>
        <StatCard label="Long Liq"   value="1.42B" unit="$" delta={24.12} spark={[1,2,3,2,4,5,3,6,7,9,11,13]} color="var(--rekt-mild)"/>
        <StatCard label="Short Liq"  value="998M"  unit="$" delta={11.21} spark={[2,2,3,4,3,5,4,6,5,7,8,9]}   color="var(--pump-mild)"/>
        <StatCard label="Whales (1m+)" value="38"          delta={42.10} spark={[3,4,5,4,6,5,7,8,7,9,10,12]}  color="var(--hub-accent)"/>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Card title="Live Feed" right={<RadarPulse size={9} color="var(--rekt-mild)"/>} pad={0} height={420}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {recent.map((e, i) => {
              const big = e.usd > 100_000;
              const huge = e.usd > 500_000;
              return (
                <div key={i + '-' + e.t} style={{
                  display: 'grid', gridTemplateColumns: '50px 1fr 80px 90px 90px',
                  alignItems: 'center', gap: 10, padding: '8px 14px',
                  borderBottom: '1px solid var(--hub-border-subtle)',
                  fontSize: 11, fontFamily: 'var(--font-mono)',
                  background: huge ? 'rgba(248,113,113,0.06)' : 'transparent',
                  animation: i === 0 ? 'liq-flash 800ms ease-out' : undefined,
                }}>
                  <span style={{ color: 'var(--fg-subtle)' }}>{Math.floor((Date.now() - e.t)/1000)}s</span>
                  <span style={{ color: 'var(--fg-default)', fontWeight: 600 }}>{e.sym}</span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                    color: e.side === 'LONG' ? 'var(--rekt-mild)' : 'var(--pump-mild)',
                  }}>{e.side} REKT</span>
                  <span style={{ color: 'var(--fg-muted)', textAlign: 'right' }}>{e.venue}</span>
                  <span style={{ textAlign: 'right', fontWeight: 700,
                    color: huge ? 'var(--rekt-nuclear)' : (big ? 'var(--rekt-hot)' : 'var(--rekt-mild)') }}>
                    {fmtUSD(e.usd, { dp: 0 })}
                  </span>
                </div>
              );
            })}
            {recent.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-subtle)', fontSize: 11 }}>Waiting for events…</div>
            )}
          </div>
          <style>{`
            @keyframes liq-flash {
              0% { background: rgba(248,113,113,0.35); }
              100% { background: transparent; }
            }
          `}</style>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card title="Heatmap · BTC · 4h">
            <LiquidationHeatmap/>
          </Card>
          <Card title="Long vs Short">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--rekt-mild)' }}>$1.42B</span>
                <span style={{ fontSize: 10, color: 'var(--fg-subtle)' }}>longs</span>
                <div style={{ flex: 1 }}/>
                <span style={{ fontSize: 10, color: 'var(--fg-subtle)' }}>shorts</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--pump-mild)' }}>$998M</span>
              </div>
              <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: '58%', background: 'linear-gradient(90deg,#e63946,#f87171)' }}/>
                <div style={{ width: '42%', background: 'linear-gradient(90deg,#22d38a,#4ade80)' }}/>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-subtle)' }}>
                <span>58% long</span><span>42% short</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Screener
// ══════════════════════════════════════════════════════════════════
function ScreenerPage({ openDetail }) {
  const all = useCoins();
  const [sortBy, setSortBy] = React.useState('mcap');
  const [dir, setDir] = React.useState('desc');
  const [filter, setFilter] = React.useState('all');
  const [q, setQ] = React.useState('');

  const rows = React.useMemo(() => {
    let r = all.slice();
    if (filter !== 'all') r = r.filter(c => filter === 'watchlist' ? isWatched(c.sym) : c.cat === filter);
    if (q) r = r.filter(c => c.sym.toLowerCase().includes(q.toLowerCase()) || c.name.toLowerCase().includes(q.toLowerCase()));
    r.sort((a, b) => {
      const av = a[sortBy], bv = b[sortBy];
      return dir === 'desc' ? bv - av : av - bv;
    });
    return r;
  }, [all, sortBy, dir, filter, q]);

  function setSort(col) {
    if (sortBy === col) setDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(col); setDir('desc'); }
  }

  const cols = [
    { k: 'sym',   l: '#',          w: 30 },
    { k: 'name',  l: 'Coin',       w: 180 },
    { k: 'px',    l: 'Price',      w: 110, num: true },
    { k: 'chg',   l: '24h %',      w: 80,  num: true },
    { k: 'fund',  l: 'Funding',    w: 90,  num: true },
    { k: 'oi',    l: 'OI',         w: 100, num: true },
    { k: 'oi24',  l: 'OI Δ',       w: 80,  num: true },
    { k: 'vol24', l: 'Vol 24h',    w: 100, num: true },
    { k: 'ls',    l: 'L/S',        w: 60,  num: true },
    { k: 'mcap',  l: 'M.Cap',      w: 100, num: true },
    { k: 'spark', l: '7d',         w: 80 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, height: '100%', minHeight: 0 }}>
      <PageHeading title="Screener" subtitle={`${rows.length} matching · live across 33 venues`}/>

      {/* Filter chrome */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <input placeholder="Filter by symbol or name…" value={q} onChange={e => setQ(e.target.value)}
          style={{
            background: 'var(--hub-darker)', border: '1px solid var(--hub-border)',
            borderRadius: 7, padding: '7px 12px', color: 'var(--fg-default)',
            fontFamily: 'var(--font-sans)', fontSize: 12, width: 240, outline: 'none',
          }}/>
        <div style={{ display: 'flex', gap: 4, padding: 3, background: 'var(--hub-black)', border: '1px solid var(--hub-border)', borderRadius: 7 }}>
          {[
            { k: 'all', l: 'All' },
            { k: 'watchlist', l: 'Watchlist' },
            { k: 'majors', l: 'Majors' },
            { k: 'memes', l: 'Memes' },
            { k: 'ai', l: 'AI' },
            { k: 'defi', l: 'DeFi' },
            { k: 'layer1', l: 'Layer 1' },
          ].map(f => (
            <button key={f.k} onClick={() => setFilter(f.k)} style={{
              padding: '4px 10px', fontSize: 11, fontWeight: filter === f.k ? 600 : 500,
              border: 'none', borderRadius: 4, cursor: 'pointer',
              background: filter === f.k ? 'var(--hub-secondary-medium)' : 'transparent',
              color: filter === f.k ? 'var(--fg-default)' : 'var(--fg-muted)',
            }}>{f.l}</button>
          ))}
        </div>
        <div style={{ flex: 1 }}/>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)' }}>
          Click headers to sort
        </span>
      </div>

      {/* Table */}
      <div style={{ flex: 1, minHeight: 0, background: 'var(--hub-darker)', border: '1px solid var(--hub-border)', borderRadius: 12, overflow: 'auto' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 1, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)',
          borderBottom: '1px solid var(--hub-border)', display: 'grid',
          gridTemplateColumns: cols.map(c => c.w + 'px').join(' '), gap: 10, padding: '10px 14px',
          fontSize: 9, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700,
        }}>
          {cols.map(c => (
            <div key={c.k} onClick={() => setSort(c.k)} style={{
              cursor: 'pointer', textAlign: c.num ? 'right' : 'left',
              color: sortBy === c.k ? 'var(--hub-accent)' : 'var(--fg-subtle)',
            }}>{c.l}{sortBy === c.k && (dir === 'desc' ? ' ↓' : ' ↑')}</div>
          ))}
        </div>
        {rows.map((r, i) => (
          <div key={r.sym} onClick={() => openDetail && openDetail(r)} style={{
            display: 'grid', gridTemplateColumns: cols.map(c => c.w + 'px').join(' '), gap: 10,
            padding: '8px 14px', alignItems: 'center', cursor: 'pointer',
            borderBottom: '1px solid var(--hub-border-subtle)',
            background: i % 2 ? 'transparent' : 'rgba(255,255,255,0.012)',
            fontSize: 12,
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,165,0,0.05)'}
          onMouseLeave={e => e.currentTarget.style.background = i % 2 ? 'transparent' : 'rgba(255,255,255,0.012)'}>
            <span style={{ color: 'var(--fg-subtle)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{i + 1}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <CoinIcon sym={r.sym} size={18} bg={r.iconBg}/>
              <span><span style={{ fontWeight: 600, color: 'var(--fg-default)' }}>{r.sym}</span> <span style={{ color: 'var(--fg-subtle)', fontSize: 10 }}>{r.name}</span></span>
            </span>
            <span style={{ textAlign: 'right' }}><FlashCell value={r.px} dir={r.flashDir} format={fmtPx}/></span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: r.chg >= 0 ? 'var(--pump-mild)' : 'var(--rekt-mild)' }}>{r.chg >= 0 ? '+' : ''}{r.chg.toFixed(2)}%</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: r.fund > 0.15 ? 'var(--hub-accent-light)' : (r.fund > 0 ? 'var(--pump-mild)' : 'var(--rekt-mild)') }}>{r.fund >= 0 ? '+' : ''}{r.fund.toFixed(4)}%</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>{fmtUSD(r.oi)}</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: r.oi24 >= 0 ? 'var(--pump-mild)' : 'var(--rekt-mild)' }}>{r.oi24 >= 0 ? '+' : ''}{r.oi24.toFixed(1)}%</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>{fmtUSD(r.vol24)}</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: r.ls >= 1 ? 'var(--pump-mild)' : 'var(--rekt-mild)' }}>{r.ls.toFixed(2)}</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>{fmtUSD(r.mcap)}</span>
            <span><MiniSpark sym={r.sym} color={r.chg >= 0 ? 'var(--pump-mild)' : 'var(--rekt-mild)'}/></span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Chart page (full-bleed candle area + book + trades)
// ══════════════════════════════════════════════════════════════════
function ChartPage({ symbol = 'BTC' }) {
  const c = useCoin(symbol);
  if (!c) return null;

  // Generate candles deterministically based on tick + symbol
  const candles = React.useMemo(() => {
    let h = 0; for (let i = 0; i < symbol.length; i++) h = ((h << 5) - h + symbol.charCodeAt(i)) | 0;
    let s = Math.abs(h);
    const seed = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    const out = [];
    let p = c.px * 0.94;
    for (let i = 0; i < 80; i++) {
      const o = p;
      const change = (seed() - 0.48) * c.px * 0.01;
      p = Math.max(p + change, c.px * 0.5);
      const cl = p;
      const hi = Math.max(o, cl) + seed() * c.px * 0.005;
      const lo = Math.min(o, cl) - seed() * c.px * 0.005;
      out.push({ o, c: cl, hi, lo });
    }
    return out;
  }, [symbol, c.px]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', height: '100%', minHeight: 0, gap: 0 }}>
      {/* Main chart pane */}
      <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--hub-border-subtle)', minHeight: 0 }}>
        {/* Symbol bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px',
          borderBottom: '1px solid var(--hub-border-subtle)', background: 'rgba(0,0,0,0.2)',
        }}>
          <CoinIcon sym={c.sym} size={26} bg={c.iconBg}/>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-default)' }}>{c.sym}/USDT <span style={{ fontSize: 10, color: 'var(--fg-subtle)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>PERP</span></div>
            <div style={{ fontSize: 10, color: 'var(--fg-subtle)', fontFamily: 'var(--font-mono)' }}>{c.name} · {c.venue}</div>
          </div>
          <div style={{
            padding: '8px 14px', borderRadius: 8, background: 'var(--hub-black)', border: '1px solid var(--hub-border)',
            display: 'flex', flexDirection: 'column', minWidth: 130,
          }}>
            <FlashCell value={c.px} dir={c.flashDir} format={v => fmtPx(v)} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: c.chg >= 0 ? 'var(--pump-mild)' : 'var(--rekt-mild)', fontWeight: 600 }}>
              {c.chg >= 0 ? '+' : ''}{c.chg.toFixed(2)}% 24h
            </span>
          </div>
          {[
            { l: 'OI', v: fmtUSD(c.oi) },
            { l: 'Funding', v: (c.fund >= 0 ? '+' : '') + c.fund.toFixed(4) + '%', col: c.fund > 0.15 ? 'var(--hub-accent-light)' : (c.fund > 0 ? 'var(--pump-mild)' : 'var(--rekt-mild)') },
            { l: 'Vol 24h', v: fmtUSD(c.vol24) },
            { l: 'L/S', v: c.ls.toFixed(2), col: c.ls >= 1 ? 'var(--pump-mild)' : 'var(--rekt-mild)' },
          ].map(s => (
            <div key={s.l} style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 9, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>{s.l}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: s.col || 'var(--fg-default)' }}>{s.v}</span>
            </div>
          ))}
          <div style={{ flex: 1 }}/>
          {/* Timeframes */}
          <div style={{ display: 'flex', gap: 2, padding: 2, background: 'var(--hub-black)', border: '1px solid var(--hub-border)', borderRadius: 6 }}>
            {['1m','5m','15m','1h','4h','1d','1w'].map((t, i) => (
              <button key={t} style={{
                padding: '4px 8px', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
                border: 'none', borderRadius: 3, cursor: 'pointer',
                background: i === 4 ? 'var(--hub-secondary-medium)' : 'transparent',
                color: i === 4 ? 'var(--fg-default)' : 'var(--fg-muted)',
              }}>{t}</button>
            ))}
          </div>
        </div>

        {/* Candle area */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'linear-gradient(180deg,#0a0c12,#07090d)' }}>
          <svg width="100%" height="100%" style={{ display: 'block', position: 'absolute', inset: 0 }} preserveAspectRatio="none" viewBox="0 0 800 380">
            {/* Grid */}
            {[1,2,3,4,5,6,7].map(y => (
              <line key={y} x1="0" y1={y * 47} x2="800" y2={y * 47} stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
            ))}
            {[1,2,3,4,5,6,7,8,9].map(x => (
              <line key={x} x1={x * 80} y1="0" x2={x * 80} y2="380" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
            ))}
            {/* Candles */}
            {candles.map((k, i) => {
              const min = Math.min(...candles.map(x => x.lo));
              const max = Math.max(...candles.map(x => x.hi));
              const range = max - min;
              const y = (v) => 360 - ((v - min) / range) * 340 + 10;
              const x = i * (760 / candles.length) + 20;
              const w = (760 / candles.length) * 0.7;
              const up = k.c >= k.o;
              const col = up ? '#4ade80' : '#f87171';
              return (
                <g key={i}>
                  <line x1={x + w/2} y1={y(k.hi)} x2={x + w/2} y2={y(k.lo)} stroke={col} strokeWidth="1"/>
                  <rect x={x} y={y(Math.max(k.o, k.c))} width={w} height={Math.max(1, Math.abs(y(k.o) - y(k.c)))} fill={col} opacity={up ? 1 : 0.85}/>
                </g>
              );
            })}
            {/* Current price line */}
            {(() => {
              const min = Math.min(...candles.map(x => x.lo));
              const max = Math.max(...candles.map(x => x.hi));
              const y = 360 - ((c.px - min) / (max - min)) * 340 + 10;
              return <>
                <line x1="0" y1={y} x2="800" y2={y} stroke="#FF9500" strokeWidth="1" strokeDasharray="4 3"/>
                <rect x="740" y={y - 9} width="58" height="18" fill="#FF9500"/>
                <text x="769" y={y + 4} fontSize="11" fill="#0a0a0a" fontWeight="700" fontFamily="JetBrains Mono" textAnchor="middle">{c.px.toFixed(c.px < 1 ? 4 : 0)}</text>
              </>;
            })()}
          </svg>
          {/* Volume bars at bottom */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, display: 'flex', alignItems: 'flex-end', gap: 1, padding: '0 20px' }}>
            {candles.map((k, i) => {
              const up = k.c >= k.o;
              const h = (Math.abs(k.c - k.o) / c.px) * 12000 + 4;
              return <div key={i} style={{ flex: 1, height: Math.min(h, 50), background: up ? 'rgba(74,222,128,0.4)' : 'rgba(248,113,113,0.4)', borderRadius: 1 }}/>;
            })}
          </div>
        </div>
      </div>

      {/* Right rail: order book + recent trades */}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <OrderBook px={c.px} sym={c.sym}/>
        <RecentTrades sym={c.sym}/>
      </div>
    </div>
  );
}

// Order book
function OrderBook({ px, sym }) {
  const [, force] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => force(t => t + 1), 1100);
    return () => clearInterval(id);
  }, []);
  // generate bids/asks deterministically per tick
  const ladder = (side) => {
    const out = [];
    let cum = 0;
    for (let i = 0; i < 14; i++) {
      const offset = (i + 1) * (px * 0.0006);
      const p = side === 'bid' ? px - offset : px + offset;
      const sz = (Math.random() * 4 + 0.05).toFixed(3);
      cum += parseFloat(sz);
      out.push({ p, sz: parseFloat(sz), cum });
    }
    return out;
  };
  const bids = ladder('bid');
  const asks = ladder('ask').reverse();
  const maxCum = Math.max(...bids.map(b => b.cum), ...asks.map(a => a.cum));

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--hub-border-subtle)' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--hub-border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-default)' }}>Order Book</div>
        <span style={{ flex: 1 }}/>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-subtle)' }}>0.1</span>
      </div>
      <div style={{ padding: '4px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', fontSize: 9, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, borderBottom: '1px solid var(--hub-border-subtle)' }}>
        <span>Price</span><span style={{ textAlign: 'right' }}>Size</span><span style={{ textAlign: 'right' }}>Cum</span>
      </div>
      {/* asks */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {asks.map((a, i) => (
          <div key={i} style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '2px 12px', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${(a.cum / maxCum) * 100}%`, background: 'rgba(248,113,113,0.08)' }}/>
            <span style={{ color: 'var(--rekt-mild)', position: 'relative' }}>{a.p.toFixed(a.p < 1 ? 4 : 2)}</span>
            <span style={{ color: 'var(--fg-muted)', textAlign: 'right', position: 'relative' }}>{a.sz.toFixed(3)}</span>
            <span style={{ color: 'var(--fg-subtle)', textAlign: 'right', position: 'relative' }}>{a.cum.toFixed(2)}</span>
          </div>
        ))}
        {/* spread */}
        <div style={{ padding: '6px 12px', background: 'rgba(255,165,0,0.06)', borderTop: '1px solid var(--hub-border-subtle)', borderBottom: '1px solid var(--hub-border-subtle)', display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--hub-accent)' }}>{px.toFixed(px < 1 ? 4 : 2)}</span>
          <span style={{ fontSize: 9, color: 'var(--fg-subtle)', fontFamily: 'var(--font-mono)' }}>spread {(px * 0.0006).toFixed(2)}</span>
        </div>
        {bids.map((b, i) => (
          <div key={i} style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '2px 12px', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${(b.cum / maxCum) * 100}%`, background: 'rgba(74,222,128,0.08)' }}/>
            <span style={{ color: 'var(--pump-mild)', position: 'relative' }}>{b.p.toFixed(b.p < 1 ? 4 : 2)}</span>
            <span style={{ color: 'var(--fg-muted)', textAlign: 'right', position: 'relative' }}>{b.sz.toFixed(3)}</span>
            <span style={{ color: 'var(--fg-subtle)', textAlign: 'right', position: 'relative' }}>{b.cum.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Recent trades
function RecentTrades({ sym }) {
  const events = useEvents();
  const trades = events.filter(e => e.kind === 'trade' && e.sym === sym).slice(0, 18);
  return (
    <div style={{ flexBasis: 220, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--hub-border-subtle)', fontSize: 11, fontWeight: 600, color: 'var(--fg-default)' }}>Recent Trades</div>
      <div style={{ padding: '4px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', fontSize: 9, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, borderBottom: '1px solid var(--hub-border-subtle)' }}>
        <span>Time</span><span style={{ textAlign: 'right' }}>Price</span><span style={{ textAlign: 'right' }}>Size</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {trades.length === 0 && <div style={{ padding: 14, color: 'var(--fg-subtle)', fontSize: 10, textAlign: 'center' }}>Waiting for trades…</div>}
        {trades.map((t, i) => (
          <div key={i + '-' + t.t} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '2px 12px', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
            <span style={{ color: 'var(--fg-subtle)' }}>{new Date(t.t).toLocaleTimeString().slice(3, 8)}</span>
            <span style={{ textAlign: 'right', color: t.side === 'BUY' ? 'var(--pump-mild)' : 'var(--rekt-mild)' }}>{t.px.toFixed(t.px < 1 ? 4 : 2)}</span>
            <span style={{ textAlign: 'right', color: 'var(--fg-muted)' }}>{t.size.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

window.OIPage = OIPage;
window.LiquidationsPage = LiquidationsPage;
window.ScreenerPage = ScreenerPage;
window.ChartPage = ChartPage;
window.PageHeading = PageHeading;
window.Card = Card;
window.FlashCell = FlashCell;
window.CoinIcon = CoinIcon;
window.MiniSpark = MiniSpark;
