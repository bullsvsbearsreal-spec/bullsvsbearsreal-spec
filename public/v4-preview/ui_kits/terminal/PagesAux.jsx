// ══════════════════════════════════════════════════════════════════
// Pages — Options / Dashboard / Alerts
// ══════════════════════════════════════════════════════════════════

const { useCoins: useC2, useCoin: useCoin2, useEvents: useE2, useAlerts, useWatchlist, fmtUSD: fmt2, fmtPx: fmtP2, addAlert, rmAlert, state: IHstate } = window.IH;
const { PageHeading, Card, FlashCell, CoinIcon, MiniSpark } = window;

// Inline area-spark for the dashboard hero
function Spark({ data, color = 'var(--hub-accent)', height = 50 }) {
  const w = 600, h = height;
  if (!data || !data.length) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const rng = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / rng) * (h - 4) - 2).toFixed(1)}`);
  const path = 'M' + pts.join(' L');
  const fill = path + ` L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
      <path d={fill} fill={color} opacity={0.12}/>
      <path d={path} fill="none" stroke={color} strokeWidth={1.5}/>
    </svg>
  );
}

// ══════════════════════════════════════════════════════════════════
// Options
// ══════════════════════════════════════════════════════════════════
function OptionsPage() {
  const c = useCoin2('BTC');
  const px = c.px;
  // Build chain ±15 strikes
  const strikes = [];
  const step = px > 1000 ? 5000 : 100;
  const center = Math.round(px / step) * step;
  for (let i = -7; i <= 7; i++) {
    const k = center + i * step;
    const m = i === 0 ? 0 : i / 7;
    strikes.push({
      k,
      callBid: Math.max(0, px - k + 250 - Math.abs(i) * 30 + Math.random() * 20).toFixed(0),
      callAsk: Math.max(0, px - k + 280 - Math.abs(i) * 30 + Math.random() * 20).toFixed(0),
      callIV: (45 + Math.abs(m) * 30 + Math.random() * 5).toFixed(1),
      callOI: Math.floor(2000 - Math.abs(i) * 180 + Math.random() * 200),
      callDelta: Math.max(0, Math.min(1, 0.5 - m * 0.5)).toFixed(2),
      putBid: Math.max(0, k - px + 250 - Math.abs(i) * 30 + Math.random() * 20).toFixed(0),
      putAsk: Math.max(0, k - px + 280 - Math.abs(i) * 30 + Math.random() * 20).toFixed(0),
      putIV:  (44 + Math.abs(m) * 32 + Math.random() * 5).toFixed(1),
      putOI: Math.floor(1900 - Math.abs(i) * 170 + Math.random() * 200),
      putDelta: Math.max(-1, Math.min(0, -0.5 - m * 0.5)).toFixed(2),
      atm: i === 0,
    });
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, height: '100%', minHeight: 0 }}>
      <PageHeading title="Options Chain" subtitle="BTC · Deribit · 25 OCT expiry"
        right={<div style={{ display: 'flex', gap: 6 }}>
          {['25 OCT','29 NOV','27 DEC','31 JAN','28 MAR'].map((d,i) => (
            <span key={d} style={{
              padding: '4px 9px', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
              border: '1px solid var(--hub-border)', borderRadius: 5,
              background: i === 0 ? 'var(--hub-secondary-medium)' : 'var(--hub-darker)',
              color: i === 0 ? 'var(--fg-default)' : 'var(--fg-muted)', cursor: 'pointer',
            }}>{d}</span>
          ))}
        </div>}/>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
        {[
          { l: 'BTC Spot', v: fmtP2(c.px), col: 'var(--fg-default)' },
          { l: 'IV (ATM)', v: '52.4%', col: 'var(--hub-accent)' },
          { l: 'Put/Call', v: '0.84', col: 'var(--pump-mild)' },
          { l: 'Vol 24h',  v: '$1.84B', col: 'var(--fg-default)' },
          { l: 'Open Int', v: '$24.8B', col: 'var(--fg-default)' },
        ].map(s => (
          <div key={s.l} style={{ background: 'var(--hub-darker)', border: '1px solid var(--hub-border)', borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 9, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, marginBottom: 4 }}>{s.l}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 17, fontWeight: 700, color: s.col }}>{s.v}</div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 0, background: 'var(--hub-darker)', border: '1px solid var(--hub-border)', borderRadius: 12, overflow: 'auto' }}>
        <div style={{ position: 'sticky', top: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', borderBottom: '1px solid var(--hub-border)', display: 'grid',
          gridTemplateColumns: '70px 70px 70px 70px 70px 90px 70px 70px 70px 70px 70px',
          gap: 0, padding: '8px 14px', fontSize: 9, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700,
        }}>
          <div style={{ textAlign: 'center', gridColumn: '1 / 6', color: 'var(--pump-mild)' }}>──── CALLS ────</div>
          <div style={{ textAlign: 'center', color: 'var(--hub-accent)' }}>STRIKE</div>
          <div style={{ textAlign: 'center', gridColumn: '7 / 12', color: 'var(--rekt-mild)' }}>──── PUTS ────</div>
          <div style={{ textAlign: 'right' }}>OI</div>
          <div style={{ textAlign: 'right' }}>IV</div>
          <div style={{ textAlign: 'right' }}>Δ</div>
          <div style={{ textAlign: 'right' }}>Bid</div>
          <div style={{ textAlign: 'right' }}>Ask</div>
          <div></div>
          <div style={{ textAlign: 'right' }}>Bid</div>
          <div style={{ textAlign: 'right' }}>Ask</div>
          <div style={{ textAlign: 'right' }}>Δ</div>
          <div style={{ textAlign: 'right' }}>IV</div>
          <div style={{ textAlign: 'right' }}>OI</div>
        </div>
        {strikes.map((s, i) => {
          const itm = (k, t) => t === 'call' ? k < px : k > px;
          return (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '70px 70px 70px 70px 70px 90px 70px 70px 70px 70px 70px',
              padding: '5px 14px', fontFamily: 'var(--font-mono)', fontSize: 11,
              borderBottom: '1px solid var(--hub-border-subtle)',
              background: s.atm ? 'rgba(255,165,0,0.08)' : (i % 2 ? 'transparent' : 'rgba(255,255,255,0.012)'),
            }}>
              <span style={{ textAlign: 'right', color: itm(s.k, 'call') ? 'var(--pump-mild)' : 'var(--fg-subtle)' }}>{s.callOI}</span>
              <span style={{ textAlign: 'right', color: 'var(--hub-accent-light)' }}>{s.callIV}</span>
              <span style={{ textAlign: 'right', color: 'var(--fg-muted)' }}>{s.callDelta}</span>
              <span style={{ textAlign: 'right', color: 'var(--pump-mild)' }}>{s.callBid}</span>
              <span style={{ textAlign: 'right', color: 'var(--rekt-mild)' }}>{s.callAsk}</span>
              <span style={{ textAlign: 'center', color: s.atm ? 'var(--hub-accent)' : 'var(--fg-default)', fontWeight: s.atm ? 700 : 600 }}>{s.k.toLocaleString()}</span>
              <span style={{ textAlign: 'right', color: 'var(--pump-mild)' }}>{s.putBid}</span>
              <span style={{ textAlign: 'right', color: 'var(--rekt-mild)' }}>{s.putAsk}</span>
              <span style={{ textAlign: 'right', color: 'var(--fg-muted)' }}>{s.putDelta}</span>
              <span style={{ textAlign: 'right', color: 'var(--hub-accent-light)' }}>{s.putIV}</span>
              <span style={{ textAlign: 'right', color: itm(s.k, 'put') ? 'var(--rekt-mild)' : 'var(--fg-subtle)' }}>{s.putOI}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Dashboard
// ══════════════════════════════════════════════════════════════════
function DashboardPage({ openDetail }) {
  const coins = useC2();
  const watch = useWatchlist();
  const watchCoins = coins.filter(c => watch.has(c.sym));
  const events = useE2();
  const liqs = events.filter(e => e.kind === 'liq').slice(0, 6);
  const port = IHstate.portfolio;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12, padding: 16, height: '100%', minHeight: 0, overflow: 'auto' }}>
      {/* LEFT */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
        {/* Portfolio hero */}
        <div style={{ background: 'linear-gradient(135deg, rgba(255,165,0,0.08), rgba(255,165,0,0.02) 60%), var(--hub-darker)',
          border: '1px solid var(--hub-border)', borderRadius: 12, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <div>
              <div style={{ fontSize: 9, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>Equity</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 32, fontWeight: 800, color: 'var(--fg-default)', letterSpacing: '-0.03em' }}>${port.equity.toLocaleString(undefined,{minimumFractionDigits:2})}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--pump-mild)' }}>+${port.pnl24.toFixed(2)}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--pump-mild)' }}>+{port.pnl24Pct.toFixed(2)}% 24h</div>
            </div>
            <div style={{ flex: 1 }}/>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <span style={{ fontSize: 9, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>Free margin</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--fg-default)' }}>${port.free.toLocaleString(undefined,{minimumFractionDigits:2})}</span>
            </div>
          </div>
          {/* equity sparkline */}
          <div style={{ marginTop: 10 }}>
            <Spark data={Array.from({length:60}, (_,i) => 28000 + Math.sin(i*0.3)*200 + i*8)} color="#FF9500" height={50}/>
          </div>
        </div>

        {/* Positions */}
        <Card title="Open Positions" right={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)' }}>{port.positions.length} open</span>} pad={0}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 90px 90px 80px 100px', gap: 10, padding: '8px 14px', borderBottom: '1px solid var(--hub-border)', fontSize: 9, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
            <span>Pair</span><span>Side</span><span style={{ textAlign: 'right' }}>Size</span><span style={{ textAlign: 'right' }}>Mark</span><span style={{ textAlign: 'right' }}>Lev</span><span style={{ textAlign: 'right' }}>uPnL</span>
          </div>
          {port.positions.map(p => {
            const live = coins.find(c => c.sym === p.sym) || { px: p.mark };
            const upnl = (live.px - p.entry) * p.size * (p.side === 'long' ? 1 : -1);
            return (
              <div key={p.sym} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 90px 90px 80px 100px', gap: 10, padding: '10px 14px', alignItems: 'center', borderBottom: '1px solid var(--hub-border-subtle)', fontSize: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <CoinIcon sym={p.sym} size={18} bg={live.iconBg}/>
                  <span style={{ fontWeight: 600, color: 'var(--fg-default)' }}>{p.sym}/USDT</span>
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: p.side === 'long' ? 'var(--pump-mild)' : 'var(--rekt-mild)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{p.side}</span>
                <span style={{ fontFamily: 'var(--font-mono)', textAlign: 'right', color: 'var(--fg-muted)' }}>{p.size}</span>
                <span style={{ textAlign: 'right' }}><FlashCell value={live.px} dir={live.flashDir} format={fmtP2}/></span>
                <span style={{ fontFamily: 'var(--font-mono)', textAlign: 'right', color: 'var(--fg-muted)' }}>{p.lev}</span>
                <span style={{ fontFamily: 'var(--font-mono)', textAlign: 'right', fontWeight: 700, color: upnl >= 0 ? 'var(--pump-mild)' : 'var(--rekt-mild)' }}>{upnl >= 0 ? '+' : ''}${upnl.toFixed(2)}</span>
              </div>
            );
          })}
        </Card>

        {/* Watchlist */}
        <Card title="Watchlist" right={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)' }}>{watchCoins.length} pinned</span>} pad={0}>
          {watchCoins.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--fg-subtle)', fontSize: 11 }}>Star a coin to pin it here</div>}
          {watchCoins.map(c => (
            <div key={c.sym} onClick={() => openDetail && openDetail(c)} style={{
              display: 'grid', gridTemplateColumns: '1fr 90px 80px 80px 70px', gap: 10, padding: '10px 14px',
              alignItems: 'center', borderBottom: '1px solid var(--hub-border-subtle)', fontSize: 12, cursor: 'pointer',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <CoinIcon sym={c.sym} size={20} bg={c.iconBg}/>
                <span><span style={{ fontWeight: 600, color: 'var(--fg-default)' }}>{c.sym}</span> <span style={{ color: 'var(--fg-subtle)', fontSize: 10 }}>{c.name}</span></span>
              </span>
              <span style={{ textAlign: 'right' }}><FlashCell value={c.px} dir={c.flashDir} format={fmtP2}/></span>
              <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: c.chg >= 0 ? 'var(--pump-mild)' : 'var(--rekt-mild)' }}>{c.chg >= 0 ? '+' : ''}{c.chg.toFixed(2)}%</span>
              <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: c.fund > 0 ? 'var(--pump-mild)' : 'var(--rekt-mild)' }}>{c.fund >= 0 ? '+' : ''}{c.fund.toFixed(3)}%</span>
              <span><MiniSpark sym={c.sym} color={c.chg >= 0 ? 'var(--pump-mild)' : 'var(--rekt-mild)'} width={60} height={20}/></span>
            </div>
          ))}
        </Card>
      </div>

      {/* RIGHT */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
        <Card title="Live Activity" right={<RadarPulse size={9} color="var(--pump-mild)"/>} pad={0} height={280}>
          {events.slice(0, 14).map((e, i) => {
            const colorMap = { trade: 'var(--fg-muted)', liq: 'var(--rekt-mild)', funding: 'var(--hub-accent)', alert: 'var(--hub-ai)' };
            const labelMap = { trade: 'TRADE', liq: 'REKT', funding: 'FUND', alert: 'ALERT' };
            return (
              <div key={i + '-' + e.t} style={{
                display: 'grid', gridTemplateColumns: '40px 60px 1fr', gap: 8, padding: '6px 14px', alignItems: 'center',
                borderBottom: '1px solid var(--hub-border-subtle)', fontFamily: 'var(--font-mono)', fontSize: 10,
              }}>
                <span style={{ color: 'var(--fg-subtle)' }}>{Math.floor((Date.now() - e.t)/1000)}s</span>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: colorMap[e.kind] }}>{labelMap[e.kind]}</span>
                <span style={{ color: 'var(--fg-default)' }}>
                  <b>{e.sym}</b>{' '}
                  {e.kind === 'liq' && <span style={{ color: e.side === 'LONG' ? 'var(--rekt-mild)' : 'var(--pump-mild)' }}>{e.side} {fmt2(e.usd, {dp:0})}</span>}
                  {e.kind === 'trade' && <span style={{ color: e.side === 'BUY' ? 'var(--pump-mild)' : 'var(--rekt-mild)' }}>{e.side} {e.size.toFixed(2)} @ {fmtP2(e.px)}</span>}
                  {e.kind === 'funding' && <span>funding {e.fund >= 0 ? '+' : ''}{e.fund.toFixed(4)}%</span>}
                  {e.kind === 'alert' && <span>{e.msg}</span>}
                </span>
              </div>
            );
          })}
        </Card>

        <Card title="Top Movers 24h" pad={12}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {coins.slice().sort((a,b) => b.chg - a.chg).slice(0,3).map(c => (
              <div key={c.sym} style={{ padding: 8, background: 'rgba(74,222,128,0.04)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 7, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 10, color: 'var(--fg-muted)', fontWeight: 600 }}>{c.sym}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--pump-mild)' }}>+{c.chg.toFixed(2)}%</span>
              </div>
            ))}
            {coins.slice().sort((a,b) => a.chg - b.chg).slice(0,3).map(c => (
              <div key={c.sym} style={{ padding: 8, background: 'rgba(248,113,113,0.04)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 7, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 10, color: 'var(--fg-muted)', fontWeight: 600 }}>{c.sym}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--rekt-mild)' }}>{c.chg.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Recent Liquidations" pad={0} height={200}>
          {liqs.map((e, i) => (
            <div key={i + '-' + e.t} style={{ display: 'grid', gridTemplateColumns: '50px 1fr 80px 90px', gap: 8, padding: '6px 14px', alignItems: 'center', borderBottom: '1px solid var(--hub-border-subtle)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: 'var(--fg-subtle)' }}>{Math.floor((Date.now() - e.t)/1000)}s</span>
              <span style={{ color: 'var(--fg-default)', fontWeight: 600 }}>{e.sym}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: e.side === 'LONG' ? 'var(--rekt-mild)' : 'var(--pump-mild)' }}>{e.side}</span>
              <span style={{ textAlign: 'right', fontWeight: 700, color: 'var(--rekt-mild)' }}>{fmt2(e.usd,{dp:0})}</span>
            </div>
          ))}
          {liqs.length === 0 && <div style={{ padding: 14, color: 'var(--fg-subtle)', fontSize: 10, textAlign: 'center' }}>Quiet…</div>}
        </Card>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Alerts
// ══════════════════════════════════════════════════════════════════
function AlertsPage() {
  const alerts = useAlerts();
  const events = useE2();
  const fired = events.filter(e => e.kind === 'alert' || e.kind === 'liq').slice(0, 14);
  const [draft, setDraft] = React.useState({ sym: 'BTC', cond: 'price > 115000' });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 16, height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
        <PageHeading title="Alerts" subtitle={`${alerts.length} configured · ${alerts.filter(a => a.fired).length} firing`}/>

        {/* Create */}
        <div style={{ background: 'var(--hub-darker)', border: '1px solid var(--hub-border)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-default)' }}>New alert</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={draft.sym} onChange={e => setDraft({...draft, sym: e.target.value.toUpperCase()})}
              placeholder="Symbol" style={{ width: 80, background: 'var(--hub-black)', border: '1px solid var(--hub-border)', borderRadius: 6, padding: '6px 10px', color: 'var(--fg-default)', fontFamily: 'var(--font-mono)', fontSize: 11, outline: 'none' }}/>
            <input value={draft.cond} onChange={e => setDraft({...draft, cond: e.target.value})}
              placeholder="condition (e.g. price > 115000)"
              style={{ flex: 1, background: 'var(--hub-black)', border: '1px solid var(--hub-border)', borderRadius: 6, padding: '6px 10px', color: 'var(--fg-default)', fontFamily: 'var(--font-mono)', fontSize: 11, outline: 'none' }}/>
            <button onClick={() => { addAlert({ sym: draft.sym, cond: draft.cond }); setDraft({ sym: 'BTC', cond: 'price > 115000' }); }}
              style={{ background: 'linear-gradient(135deg,#FFB800,#FF8C00)', color: '#0a0a0a', border: 'none', borderRadius: 6, padding: '0 14px', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>Add</button>
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {['price > X','price < X','funding > 0.20%','oi24 > 10%','liquidations > 5M','24h chg > 10%'].map(t => (
              <span key={t} onClick={() => setDraft({...draft, cond: t})} style={{ padding: '3px 8px', fontSize: 10, fontFamily: 'var(--font-mono)', background: 'var(--hub-black)', border: '1px solid var(--hub-border)', borderRadius: 5, color: 'var(--fg-muted)', cursor: 'pointer' }}>{t}</span>
            ))}
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, minHeight: 0, background: 'var(--hub-darker)', border: '1px solid var(--hub-border)', borderRadius: 12, overflow: 'auto' }}>
          {alerts.map(a => (
            <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '70px 70px 1fr 80px 30px', gap: 10, padding: '11px 14px', alignItems: 'center', borderBottom: '1px solid var(--hub-border-subtle)', fontSize: 12 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: a.fired ? 'var(--rekt-mild)' : 'var(--pump-mild)', boxShadow: a.fired ? '0 0 8px var(--rekt-mild)' : 'none', animation: a.fired ? 'flash-cell 1.2s ease-in-out infinite' : undefined }}/>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: a.fired ? 'var(--rekt-mild)' : 'var(--pump-mild)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{a.state}</span>
              </span>
              <span style={{ fontWeight: 700, color: 'var(--fg-default)' }}>{a.sym}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)' }}>{a.cond}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: a.value ? 'var(--rekt-mild)' : 'var(--fg-subtle)', textAlign: 'right' }}>{a.value || a.when + ' ago'}</span>
              <button onClick={() => rmAlert(a.id)} style={{ background: 'transparent', border: 'none', color: 'var(--fg-subtle)', cursor: 'pointer', fontSize: 14 }}>×</button>
            </div>
          ))}
        </div>
      </div>

      {/* Right: history feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
        <PageHeading title="History" subtitle="Last 24h fired"/>
        <div style={{ flex: 1, minHeight: 0, background: 'var(--hub-darker)', border: '1px solid var(--hub-border)', borderRadius: 12, overflow: 'auto' }}>
          {fired.map((e, i) => (
            <div key={i + '-' + e.t} style={{ display: 'grid', gridTemplateColumns: '60px 60px 1fr', gap: 10, padding: '10px 14px', alignItems: 'center', borderBottom: '1px solid var(--hub-border-subtle)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
              <span style={{ color: 'var(--fg-subtle)' }}>{Math.floor((Date.now()-e.t)/1000)}s ago</span>
              <span style={{ color: 'var(--fg-default)', fontWeight: 700 }}>{e.sym}</span>
              <span style={{ color: 'var(--fg-muted)' }}>
                {e.kind === 'alert' && <span style={{ color: 'var(--hub-ai)' }}>{e.msg}</span>}
                {e.kind === 'liq' && <span><span style={{ color: e.side === 'LONG' ? 'var(--rekt-mild)' : 'var(--pump-mild)' }}>{e.side}</span> liq · {fmt2(e.usd,{dp:0})}</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

window.OptionsPage = OptionsPage;
window.DashboardPage = DashboardPage;
window.AlertsPage = AlertsPage;
