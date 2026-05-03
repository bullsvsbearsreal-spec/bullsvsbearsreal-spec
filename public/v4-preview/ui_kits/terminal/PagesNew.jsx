// ══════════════════════════════════════════════════════════════════
// New Pages: Funding Heatmap, Funding Arb, OI Heatmap, Liq Heatmap,
//            Liq Map, Liq Levels, Long/Short, ETF Tracker
// ══════════════════════════════════════════════════════════════════
const { useCoins: useC3, useEvents: useE3, useLiqEvents: useLE3, fmtUSD: fmt3, fmtPx: fmtP3 } = window.IH;
const { PageHeading, Card, FlashCell, CoinIcon, MiniSpark } = window;

// shared helpers
function intensityColor(v, kind) {
  // v ∈ [-1, 1]
  if (kind === 'pos-neg') {
    if (v > 0) return `rgba(74,222,128,${Math.min(1, Math.abs(v) * 0.85 + 0.05)})`;
    if (v < 0) return `rgba(248,113,113,${Math.min(1, Math.abs(v) * 0.85 + 0.05)})`;
    return 'rgba(255,255,255,0.025)';
  }
  if (kind === 'heat') {
    if (Math.abs(v) < 0.1) return 'rgba(255,255,255,0.025)';
    return `rgba(255,165,0,${Math.min(1, Math.abs(v) * 0.7 + 0.1)})`;
  }
  return 'rgba(255,255,255,0.025)';
}

const PERIODS = ['1H','4H','12H','24H','7D'];
function PeriodTabs({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {PERIODS.map(p => (
        <span key={p} onClick={() => onChange?.(p)} style={{
          padding: '4px 10px', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
          borderRadius: 5, cursor: 'pointer',
          background: value === p ? 'var(--hub-secondary-medium)' : 'transparent',
          color: value === p ? 'var(--fg-default)' : 'var(--fg-muted)',
          border: '1px solid', borderColor: value === p ? 'var(--hub-border-hover)' : 'transparent',
        }}>{p}</span>
      ))}
    </div>
  );
}

// ── Funding Heatmap ──────────────────────────────────────────────
function FundingHeatmapPage() {
  const coins = useC3().slice(0, 22);
  const venues = ['BINANCE','BYBIT','OKX','BITGET','HYPERLIQ','DERIBIT','GATE'];
  const [period, setPeriod] = React.useState('4H');

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, height: '100%', minHeight: 0, overflow: 'auto' }}>
      <PageHeading title="Funding Heatmap" subtitle="Funding rate across asset × venue · live"
        right={<PeriodTabs value={period} onChange={setPeriod}/>}/>

      <div style={{ background: 'var(--hub-darker)', border: '1px solid var(--hub-border)', borderRadius: 12, padding: 14 }}>
        {/* Header row */}
        <div style={{ display: 'grid', gridTemplateColumns: `90px repeat(${venues.length}, 1fr) 80px`, gap: 4, marginBottom: 6, fontSize: 9, color: 'var(--fg-subtle)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          <div></div>
          {venues.map(v => <div key={v} style={{ textAlign: 'center' }}>{v}</div>)}
          <div style={{ textAlign: 'right' }}>AVG</div>
        </div>
        {coins.map(c => {
          const cells = venues.map((v, i) => {
            const jitter = ((c.sym.charCodeAt(0) + i * 13) % 100) / 50 - 1;
            const base = c.fund + jitter * 0.04;
            return base;
          });
          const avg = cells.reduce((s, x) => s + x, 0) / cells.length;
          return (
            <div key={c.sym} style={{ display: 'grid', gridTemplateColumns: `90px repeat(${venues.length}, 1fr) 80px`, gap: 4, marginBottom: 3, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CoinIcon sym={c.sym} size={16} bg={c.iconBg}/>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-default)' }}>{c.sym}</span>
              </div>
              {cells.map((v, i) => (
                <div key={i} style={{
                  background: intensityColor(v / 0.2, 'pos-neg'),
                  borderRadius: 3, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
                  color: Math.abs(v) > 0.08 ? '#fff' : 'var(--fg-muted)',
                }}>
                  {(v * 100).toFixed(3)}%
                </div>
              ))}
              <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                color: avg >= 0 ? 'var(--pump-mild)' : 'var(--rekt-mild)' }}>
                {avg >= 0 ? '+' : ''}{(avg * 100).toFixed(3)}%
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 10, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)' }}>
        <span>Scale —</span>
        <span style={{ color: 'var(--rekt-mild)' }}>● negative funding (shorts pay)</span>
        <span style={{ color: 'var(--pump-mild)' }}>● positive funding (longs pay)</span>
      </div>
    </div>
  );
}

// ── Funding Arbitrage ─────────────────────────────────────────────
function FundingArbPage() {
  const coins = useC3();
  // pretend each coin has a spread between two venues
  const arbs = React.useMemo(() => coins.map(c => {
    const spread = c.fund + ((c.sym.charCodeAt(0) % 7 - 3) * 0.04);
    const annual = spread * 365 * 3; // 3 funding periods/day
    return {
      sym: c.sym, iconBg: c.iconBg, name: c.name,
      longVenue: 'BYBIT', shortVenue: 'BINANCE',
      longRate: c.fund - 0.02, shortRate: c.fund + spread,
      spread, annualPct: annual,
    };
  }).sort((a, b) => Math.abs(b.spread) - Math.abs(a.spread)).slice(0, 14), [coins]);

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, height: '100%', minHeight: 0, overflow: 'auto' }}>
      <PageHeading title="Funding Arbitrage" subtitle="Cross-venue spreads · annualized return on delta-neutral pairs"/>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {[
          { l: 'Best APY', v: '+' + (arbs[0]?.annualPct * 100).toFixed(1) + '%', c: 'var(--pump-mild)' },
          { l: 'Avg spread', v: (arbs.reduce((s,a) => s + Math.abs(a.spread), 0) / arbs.length * 100).toFixed(3) + '%', c: 'var(--hub-accent)' },
          { l: 'Live pairs', v: arbs.length, c: 'var(--fg-default)' },
        ].map(s => (
          <div key={s.l} style={{ background: 'var(--hub-darker)', border: '1px solid var(--hub-border)', borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 9, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700, marginBottom: 4 }}>{s.l}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--hub-darker)', border: '1px solid var(--hub-border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '110px 130px 130px 100px 110px 1fr', padding: '10px 14px', borderBottom: '1px solid var(--hub-border)', fontSize: 9, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>
          <span>Pair</span><span>Long @</span><span>Short @</span><span style={{ textAlign: 'right' }}>Spread</span><span style={{ textAlign: 'right' }}>APY</span><span style={{ textAlign: 'right' }}>Capacity</span>
        </div>
        {arbs.map((a, i) => (
          <div key={a.sym} style={{ display: 'grid', gridTemplateColumns: '110px 130px 130px 100px 110px 1fr', padding: '10px 14px', borderBottom: '1px solid var(--hub-border-subtle)', fontSize: 12, alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <CoinIcon sym={a.sym} size={18} bg={a.iconBg}/>
              <span style={{ fontWeight: 600, color: 'var(--fg-default)' }}>{a.sym}</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--pump-mild)', padding: '2px 6px', borderRadius: 3, background: 'rgba(74,222,128,0.1)', letterSpacing: '0.06em' }}>L</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-muted)' }}>{a.longVenue}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: a.longRate >= 0 ? 'var(--pump-mild)' : 'var(--rekt-mild)' }}>{(a.longRate * 100).toFixed(3)}%</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--rekt-mild)', padding: '2px 6px', borderRadius: 3, background: 'rgba(248,113,113,0.1)', letterSpacing: '0.06em' }}>S</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-muted)' }}>{a.shortVenue}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: a.shortRate >= 0 ? 'var(--pump-mild)' : 'var(--rekt-mild)' }}>{(a.shortRate * 100).toFixed(3)}%</span>
            </span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--hub-accent)' }}>{(a.spread * 100).toFixed(3)}%</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: a.annualPct >= 0 ? 'var(--pump-mild)' : 'var(--rekt-mild)' }}>{a.annualPct >= 0 ? '+' : ''}{(a.annualPct * 100).toFixed(1)}%</span>
            <span style={{ textAlign: 'right' }}>
              <CapBar pct={Math.min(100, Math.abs(a.spread) * 800)}/>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CapBar({ pct }) {
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 3, width: 120, alignItems: 'flex-end' }}>
      <div style={{ width: '100%', height: 5, borderRadius: 3, background: 'var(--hub-secondary)', overflow: 'hidden' }}>
        <div style={{ width: pct + '%', height: '100%', background: 'linear-gradient(90deg, var(--hub-accent-light), var(--hub-accent))', transition: 'width 400ms' }}/>
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-subtle)' }}>{pct.toFixed(0)}% of book</span>
    </div>
  );
}

// ── OI Heatmap ────────────────────────────────────────────────────
function OIHeatmapPage() {
  const coins = useC3().slice(0, 24).sort((a,b) => b.oi - a.oi);
  const total = coins.reduce((s, c) => s + c.oi, 0);
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, height: '100%', minHeight: 0, overflow: 'auto' }}>
      <PageHeading title="OI Heatmap" subtitle={`Open interest weighted by venue · total $${(total/1e9).toFixed(1)}B`}/>
      <div style={{ background: 'var(--hub-darker)', border: '1px solid var(--hub-border)', borderRadius: 12, padding: 8,
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridAutoRows: '1fr', gap: 4, minHeight: 480 }}>
        {coins.map((c, i) => {
          const pct = c.oi / total;
          const oi24 = c.oi24;
          const tint = oi24 >= 0 ? `rgba(74,222,128,${Math.min(0.5, Math.abs(oi24) / 25)})` : `rgba(248,113,113,${Math.min(0.5, Math.abs(oi24) / 25)})`;
          // span big tiles for top OI
          const span = i === 0 ? { gridColumn: 'span 2', gridRow: 'span 2' } :
                       i < 3   ? { gridColumn: 'span 2' } :
                       i < 5   ? { gridRow: 'span 2' } : {};
          return (
            <div key={c.sym} style={{
              ...span, position: 'relative', overflow: 'hidden',
              background: `linear-gradient(135deg, ${tint}, transparent 75%), var(--hub-black)`,
              border: '1px solid var(--hub-border-subtle)', borderRadius: 7, padding: 12,
              display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <CoinIcon sym={c.sym} size={18} bg={c.iconBg}/>
                <span style={{ fontWeight: 700, color: 'var(--fg-default)', fontSize: 12 }}>{c.sym}</span>
                <div style={{ flex: 1 }}/>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-subtle)' }}>{(pct * 100).toFixed(1)}%</span>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: i === 0 ? 22 : 14, fontWeight: 800, color: 'var(--fg-default)' }}>
                  {fmt3(c.oi, {dp: 1})}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, color: oi24 >= 0 ? 'var(--pump-mild)' : 'var(--rekt-mild)' }}>
                  {oi24 >= 0 ? '+' : ''}{oi24.toFixed(2)}% 24h
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Liquidation Heatmap (full page) ───────────────────────────────
function LiqHeatmapPage() {
  // 32 cols × 14 rows of liq tiles
  const cols = 36, rows = 14;
  const cells = [];
  let seed = 7;
  const rand = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let y = 0; y < rows; y++) {
    const yMid = 1 - Math.abs(y - rows / 2) / (rows / 2);
    for (let x = 0; x < cols; x++) {
      const wave = Math.sin((x / cols) * Math.PI * 2.5) * 0.4 + 0.6;
      const r = rand();
      const v = Math.min(1, wave * yMid + r * 0.3);
      cells.push({ x, y, v });
    }
  }
  const events = useLE3();

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, height: '100%', minHeight: 0, overflow: 'auto' }}>
      <PageHeading title="Liquidation Heatmap" subtitle="Density of forced unwinds by price level × time"
        right={<PeriodTabs value="24H" onChange={() => {}}/>}/>

      <div style={{ background: 'var(--hub-darker)', border: '1px solid var(--hub-border)', borderRadius: 12, padding: 18,
        display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-default)' }}>BTC/USDT · Aggregated</span>
          <div style={{ flex: 1 }}/>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)' }}>
            <span>Cool</span>
            <div style={{ display: 'flex', gap: 1 }}>
              {[0.1, 0.25, 0.4, 0.6, 0.8, 1].map(v => (
                <div key={v} style={{ width: 14, height: 8, background: `rgba(255,165,0,${v * 0.7 + 0.1})` }}/>
              ))}
            </div>
            <span>Hot</span>
          </div>
        </div>
        {/* y labels + grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: 8, height: 360 }}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-subtle)', textAlign: 'right', padding: '2px 0' }}>
            <span>$118,400</span><span>$115,200</span><span>$112,000</span><span>$108,800</span><span>$105,600</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gridAutoRows: '1fr', gap: 1 }}>
            {cells.map((c, i) => (
              <div key={i} style={{
                background: c.v > 0.65 ? `rgba(255,165,0,${c.v * 0.85})` : c.v > 0.3 ? `rgba(255,165,0,${c.v * 0.45})` : `rgba(255,255,255,${c.v * 0.04 + 0.005})`,
                borderRadius: 1,
              }}/>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-subtle)', paddingLeft: 68 }}>
          <span>00:00</span><span>04:00</span><span>08:00</span><span>12:00</span><span>16:00</span><span>20:00</span>
        </div>
      </div>

      <Card title="Recent Big Liquidations" pad={0}>
        {events.slice(0, 8).map((e, i) => (
          <div key={i + e.t} style={{ display: 'grid', gridTemplateColumns: '60px 80px 70px 1fr 100px', gap: 10, padding: '8px 14px', borderBottom: '1px solid var(--hub-border-subtle)', alignItems: 'center', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: 'var(--fg-subtle)' }}>{Math.floor((Date.now()-e.t)/1000)}s</span>
            <span style={{ color: 'var(--fg-default)', fontWeight: 700 }}>{e.sym}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: e.side === 'LONG' ? 'var(--rekt-mild)' : 'var(--pump-mild)', letterSpacing: '0.06em' }}>{e.side}</span>
            <span style={{ color: 'var(--fg-muted)' }}>{e.venue} · {fmtP3(e.px)}</span>
            <span style={{ textAlign: 'right', fontWeight: 700, color: 'var(--rekt-mild)' }}>{fmt3(e.usd, {dp: 0})}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ── Liquidation Map (price level density) ─────────────────────────
function LiqMapPage() {
  const c = window.IH.getCoin('BTC');
  const px = c.px;
  // levels above and below current price
  const levels = [];
  for (let i = -10; i <= 10; i++) {
    if (i === 0) continue;
    const p = px + i * 800;
    const dens = Math.exp(-Math.abs(i) / 4) * (1 + ((Math.sin(i * 1.3) + 1) / 2));
    levels.push({ price: p, dens, side: i < 0 ? 'long' : 'short', usd: dens * 80_000_000 });
  }
  const max = Math.max(...levels.map(l => l.dens));

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, height: '100%', minHeight: 0, overflow: 'auto' }}>
      <PageHeading title="Liquidation Map" subtitle={`BTC · current ${fmtP3(px)} · density of stop clusters by price`}/>

      <div style={{ background: 'var(--hub-darker)', border: '1px solid var(--hub-border)', borderRadius: 12, padding: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, fontFamily: 'var(--font-mono)', fontSize: 10 }}>
          {levels.slice().reverse().map((l, i) => {
            const w = (l.dens / max) * 100;
            const isShort = l.side === 'short';
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 100px', gap: 10, alignItems: 'center', padding: '3px 0' }}>
                <span style={{ color: isShort ? 'var(--pump-mild)' : 'var(--rekt-mild)', fontWeight: 600, textAlign: 'right' }}>{fmtP3(l.price)}</span>
                <div style={{ position: 'relative', height: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0, width: w + '%',
                    background: isShort
                      ? `linear-gradient(90deg, rgba(74,222,128,0.45), rgba(74,222,128,0.85))`
                      : `linear-gradient(90deg, rgba(248,113,113,0.45), rgba(248,113,113,0.85))`,
                    transition: 'width 400ms',
                  }}/>
                </div>
                <span style={{ textAlign: 'right', color: 'var(--fg-muted)', fontWeight: 600 }}>{fmt3(l.usd, {dp: 0})}</span>
              </div>
            );
          })}
          <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 100px', gap: 10, alignItems: 'center', padding: '6px 0', borderTop: '1px dashed var(--hub-border)', borderBottom: '1px dashed var(--hub-border)' }}>
            <span style={{ color: 'var(--hub-accent)', fontWeight: 800, textAlign: 'right' }}>{fmtP3(px)}</span>
            <span style={{ color: 'var(--hub-accent)', fontWeight: 700 }}>← MARK PRICE</span>
            <span/>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)' }}>
        <span style={{ color: 'var(--rekt-mild)' }}>● long liquidations (below)</span>
        <span style={{ color: 'var(--pump-mild)' }}>● short liquidations (above)</span>
      </div>
    </div>
  );
}

// ── Liquidation Levels (imminent zones) ───────────────────────────
function LiqLevelsPage() {
  const coins = useC3().slice(0, 14);
  const rows = coins.map(c => {
    const dist = ((c.sym.charCodeAt(0) % 7) + 1) * 0.4;
    return {
      sym: c.sym, iconBg: c.iconBg, name: c.name, px: c.px, ls: c.ls,
      nextLong: c.px * (1 - dist / 100),
      nextShort: c.px * (1 + dist / 100),
      nextLongUsd: 12_000_000 + (c.sym.charCodeAt(0) % 9) * 3_500_000,
      nextShortUsd: 8_000_000 + (c.sym.charCodeAt(0) % 5) * 4_200_000,
      distLong: dist,
      distShort: dist,
    };
  });

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, height: '100%', minHeight: 0, overflow: 'auto' }}>
      <PageHeading title="Liquidation Levels" subtitle="Imminent stop zones — closest concentration of long & short liquidations"/>

      <div style={{ background: 'var(--hub-darker)', border: '1px solid var(--hub-border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 150px 120px 150px 120px', padding: '10px 14px', borderBottom: '1px solid var(--hub-border)', fontSize: 9, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>
          <span>Pair</span>
          <span style={{ textAlign: 'right' }}>Price</span>
          <span style={{ textAlign: 'right' }}>↓ Long Liq Zone</span>
          <span style={{ textAlign: 'right' }}>Stops</span>
          <span style={{ textAlign: 'right' }}>↑ Short Liq Zone</span>
          <span style={{ textAlign: 'right' }}>Stops</span>
        </div>
        {rows.map(r => (
          <div key={r.sym} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 150px 120px 150px 120px', padding: '10px 14px', borderBottom: '1px solid var(--hub-border-subtle)', alignItems: 'center', fontSize: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CoinIcon sym={r.sym} size={20} bg={r.iconBg}/>
              <span><span style={{ fontWeight: 600, color: 'var(--fg-default)' }}>{r.sym}</span>{' '}<span style={{ fontSize: 10, color: 'var(--fg-subtle)' }}>{r.name}</span></span>
            </span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--fg-default)', fontWeight: 600 }}>{fmtP3(r.px)}</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--rekt-mild)', fontWeight: 700 }}>
              {fmtP3(r.nextLong)} <span style={{ fontSize: 9, color: 'var(--fg-subtle)', marginLeft: 4 }}>−{r.distLong.toFixed(2)}%</span>
            </span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--rekt-mild)' }}>{fmt3(r.nextLongUsd, {dp:1})}</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--pump-mild)', fontWeight: 700 }}>
              {fmtP3(r.nextShort)} <span style={{ fontSize: 9, color: 'var(--fg-subtle)', marginLeft: 4 }}>+{r.distShort.toFixed(2)}%</span>
            </span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--pump-mild)' }}>{fmt3(r.nextShortUsd, {dp:1})}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Long / Short Ratio ────────────────────────────────────────────
function LongShortPage() {
  const coins = useC3().slice(0, 16);
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, height: '100%', minHeight: 0, overflow: 'auto' }}>
      <PageHeading title="Long / Short Ratio" subtitle="Crowd positioning · top trader accounts vs all accounts"/>

      <div style={{ background: 'var(--hub-darker)', border: '1px solid var(--hub-border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr 80px 80px', padding: '10px 14px', borderBottom: '1px solid var(--hub-border)', fontSize: 9, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>
          <span>Pair</span>
          <span style={{ textAlign: 'right' }}>L/S</span>
          <span style={{ paddingLeft: 14 }}>Distribution</span>
          <span style={{ textAlign: 'right' }}>Top traders</span>
          <span style={{ textAlign: 'right' }}>Sentiment</span>
        </div>
        {coins.map(c => {
          const ratio = c.ls;
          const longPct = (ratio / (1 + ratio)) * 100;
          const shortPct = 100 - longPct;
          const top = ratio + ((c.sym.charCodeAt(0) % 5 - 2) * 0.1);
          const sentiment = ratio > 1.2 ? 'BULLISH' : ratio < 0.85 ? 'BEARISH' : 'MIXED';
          const sCol = ratio > 1.2 ? 'var(--pump-mild)' : ratio < 0.85 ? 'var(--rekt-mild)' : 'var(--fg-muted)';
          return (
            <div key={c.sym} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr 80px 80px', padding: '10px 14px', borderBottom: '1px solid var(--hub-border-subtle)', alignItems: 'center', fontSize: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CoinIcon sym={c.sym} size={20} bg={c.iconBg}/>
                <span style={{ fontWeight: 600, color: 'var(--fg-default)' }}>{c.sym}</span>
              </span>
              <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--fg-default)' }}>{ratio.toFixed(2)}</span>
              <div style={{ display: 'flex', height: 10, borderRadius: 3, overflow: 'hidden', boxShadow: 'inset 0 0 0 1px var(--hub-border-subtle)', marginLeft: 14, position: 'relative' }}>
                <div style={{ width: longPct + '%', background: 'linear-gradient(90deg,#10b981,#22c55e)', transition: 'width 400ms', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 6, fontSize: 9, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-mono)' }}>{longPct.toFixed(0)}%</div>
                <div style={{ width: shortPct + '%', background: 'linear-gradient(90deg,#dc2626,#f87171)', transition: 'width 400ms', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6, fontSize: 9, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-mono)' }}>{shortPct.toFixed(0)}%</div>
              </div>
              <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--hub-accent-light)' }}>{top.toFixed(2)}</span>
              <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 800, color: sCol, letterSpacing: '0.08em' }}>{sentiment}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ETF Tracker ────────────────────────────────────────────────────
function ETFPage() {
  const etfs = [
    { tkr: 'IBIT',  name: 'iShares Bitcoin',     issuer: 'BlackRock',  flow: 412.4, aum: 28_400, holdings: 0.451, chg: 1.42 },
    { tkr: 'FBTC',  name: 'Fidelity Wise Bitcoin', issuer: 'Fidelity',   flow: 184.2, aum: 12_100, holdings: 0.198, chg: 1.38 },
    { tkr: 'GBTC',  name: 'Grayscale BTC Trust', issuer: 'Grayscale',  flow: -42.1, aum: 18_200, holdings: 0.292, chg: 1.41 },
    { tkr: 'BITB',  name: 'Bitwise Bitcoin',     issuer: 'Bitwise',    flow:  62.4, aum:  2_850, holdings: 0.046, chg: 1.40 },
    { tkr: 'ARKB',  name: 'ARK 21Shares',        issuer: 'ARK',        flow:  41.2, aum:  2_140, holdings: 0.034, chg: 1.42 },
    { tkr: 'HODL',  name: 'VanEck Bitcoin',      issuer: 'VanEck',     flow:  18.4, aum:    948, holdings: 0.015, chg: 1.40 },
    { tkr: 'BTCO',  name: 'Invesco Galaxy',      issuer: 'Invesco',    flow:  -3.2, aum:    742, holdings: 0.012, chg: 1.41 },
    { tkr: 'EZBC',  name: 'Franklin Bitcoin',    issuer: 'Franklin',   flow:   2.1, aum:    421, holdings: 0.007, chg: 1.39 },
    { tkr: 'ETHA',  name: 'iShares Ethereum',    issuer: 'BlackRock',  flow: 124.2, aum:  4_120, holdings: 0.84,  chg: -0.42 },
    { tkr: 'FETH',  name: 'Fidelity Ethereum',   issuer: 'Fidelity',   flow:  61.8, aum:  1_840, holdings: 0.38,  chg: -0.41 },
  ];
  const totalIn = etfs.reduce((s,e) => s + e.flow, 0);
  const totalAum = etfs.reduce((s,e) => s + e.aum, 0);

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, height: '100%', minHeight: 0, overflow: 'auto' }}>
      <PageHeading title="ETF Tracker" subtitle="Daily flows & AUM across spot Bitcoin & Ethereum ETFs"/>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {[
          { l: 'Net flow today', v: '+$' + totalIn.toFixed(1) + 'M', c: totalIn >= 0 ? 'var(--pump-mild)' : 'var(--rekt-mild)' },
          { l: 'Total AUM',       v: '$' + (totalAum/1000).toFixed(1) + 'B', c: 'var(--fg-default)' },
          { l: 'Active ETFs',     v: etfs.length, c: 'var(--hub-accent)' },
          { l: 'BTC supply held', v: etfs.filter(e => e.tkr !== 'ETHA' && e.tkr !== 'FETH').reduce((s,e) => s + e.holdings, 0).toFixed(2) + '%', c: 'var(--hub-accent-light)' },
        ].map(s => (
          <div key={s.l} style={{ background: 'var(--hub-darker)', border: '1px solid var(--hub-border)', borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 9, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700, marginBottom: 4 }}>{s.l}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--hub-darker)', border: '1px solid var(--hub-border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 110px 130px 110px 130px 80px', padding: '10px 14px', borderBottom: '1px solid var(--hub-border)', fontSize: 9, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>
          <span>Ticker</span>
          <span>Issuer</span>
          <span style={{ textAlign: 'right' }}>Flow today</span>
          <span style={{ textAlign: 'right' }}>AUM</span>
          <span style={{ textAlign: 'right' }}>% supply</span>
          <span style={{ textAlign: 'right' }}>Premium</span>
          <span style={{ textAlign: 'right' }}>30D</span>
        </div>
        {etfs.map(e => (
          <div key={e.tkr} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 110px 130px 110px 130px 80px', padding: '10px 14px', borderBottom: '1px solid var(--hub-border-subtle)', alignItems: 'center', fontSize: 12 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--fg-default)' }}>{e.tkr}</span>
            <span><span style={{ color: 'var(--fg-default)' }}>{e.name}</span> <span style={{ color: 'var(--fg-subtle)', fontSize: 10 }}>· {e.issuer}</span></span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: e.flow >= 0 ? 'var(--pump-mild)' : 'var(--rekt-mild)' }}>{e.flow >= 0 ? '+' : ''}${e.flow.toFixed(1)}M</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--fg-default)', fontWeight: 600 }}>${(e.aum/1000).toFixed(2)}B</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>{e.holdings.toFixed(3)}%</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: e.chg >= 0 ? 'var(--pump-mild)' : 'var(--rekt-mild)' }}>{e.chg >= 0 ? '+' : ''}{e.chg.toFixed(2)}%</span>
            <span style={{ textAlign: 'right' }}><MiniSpark sym={e.tkr} color={e.flow >= 0 ? 'var(--pump-mild)' : 'var(--rekt-mild)'} width={60} height={20}/></span>
          </div>
        ))}
      </div>
    </div>
  );
}

window.FundingHeatmapPage = FundingHeatmapPage;
window.FundingArbPage = FundingArbPage;
window.OIHeatmapPage = OIHeatmapPage;
window.LiqHeatmapPage = LiqHeatmapPage;
window.LiqMapPage = LiqMapPage;
window.LiqLevelsPage = LiqLevelsPage;
window.LongShortPage = LongShortPage;
window.ETFPage = ETFPage;
