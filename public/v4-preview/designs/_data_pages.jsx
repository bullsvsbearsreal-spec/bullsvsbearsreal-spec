// Data-product pages — Funding, OI, Liquidations, Screener, Chart, Options, Heatmap, Alerts, Dashboard, Detail

const DATA_ROWS = [
  { sym: 'BTC',  venue: 'BINANCE',  price: 112842, fund:  0.0375, oi: '$12.47B', ls: 0.84, chg:  2.41, ic: 'linear-gradient(135deg,#f7931a,#ffb547)' },
  { sym: 'HYPE', venue: 'HYPERLIQ', price: 38.21,  fund:  0.2104, oi: '$847M',   ls: 1.42, chg: 12.84, ic: 'linear-gradient(135deg,#97fce4,#10b981)' },
  { sym: 'SOL',  venue: 'BYBIT',    price: 214.52, fund:  0.1201, oi: '$2.84B',  ls: 1.24, chg:  6.12, ic: 'linear-gradient(135deg,#9945ff,#14f195)' },
  { sym: 'ETH',  venue: 'BINANCE',  price: 4221.08,fund: -0.0170, oi: '$8.21B',  ls: 0.91, chg: -0.64, ic: 'linear-gradient(135deg,#627eea,#4a5bd0)' },
  { sym: 'DOGE', venue: 'OKX',      price: 0.4122, fund: -0.0412, oi: '$1.12B',  ls: 0.74, chg: -3.24, ic: 'linear-gradient(135deg,#c2a633,#fcc85c)' },
  { sym: 'PEPE', venue: 'BINANCE',  price: 0.0000187, fund: 0.0842, oi: '$421M', ls: 1.18, chg:  8.12, ic: 'linear-gradient(135deg,#4d9348,#6bc060)' },
  { sym: 'WIF',  venue: 'BYBIT',    price: 3.22,   fund:  0.0612, oi: '$212M',   ls: 1.08, chg:  4.82, ic: 'linear-gradient(135deg,#e4a047,#c47a1d)' },
  { sym: 'AVAX', venue: 'BINANCE',  price: 48.12,  fund: -0.0082, oi: '$712M',   ls: 0.88, chg: -1.10, ic: 'linear-gradient(135deg,#e84142,#c02728)' },
  { sym: 'ARB',  venue: 'BYBIT',    price: 1.82,   fund:  0.0412, oi: '$384M',   ls: 1.02, chg:  2.81, ic: 'linear-gradient(135deg,#28a0f0,#1478c4)' },
  { sym: 'LINK', venue: 'OKX',      price: 24.88,  fund:  0.0520, oi: '$641M',   ls: 1.14, chg:  4.02, ic: 'linear-gradient(135deg,#2a5ada,#1e4bb8)' },
];

// Animated number — tiny pulse on tick
function Animated({ value, prefix = '', suffix = '', decimals = 2, color = '#e6e6ea', size = 28, weight = 700 }) {
  const tick = useTick(2200);
  const jitter = Math.sin(tick * 0.7) * (value * 0.001);
  const v = value + jitter;
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: size, fontWeight: weight, color,
      letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1,
    }}>
      {prefix}{v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}
    </span>
  );
}

function StatCard({ label, value, delta, color = '#FF9500', spark }) {
  const up = delta >= 0;
  return (
    <div style={{
      background: '#1b1f2b', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 10, padding: '12px 14px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#777b87', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <Animated value={value} prefix="$" decimals={value > 1000 ? 0 : 2} size={22}/>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
          color: up ? '#4ade80' : '#f87171',
          background: up ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
          padding: '1px 5px', borderRadius: 3,
        }}>{up ? '+' : ''}{delta.toFixed(2)}%</span>
      </div>
      {spark && (
        <div style={{ marginTop: 10, opacity: 0.85 }}>
          <Spark data={spark} color={color} height={24}/>
        </div>
      )}
    </div>
  );
}

function FlashRow({ row, i, hot }) {
  // Briefly highlight on tick
  const fundUp = row.fund >= 0;
  const chgUp = row.chg >= 0;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '24px 1.4fr 1fr 1fr 1fr 0.8fr 0.8fr 0.8fr',
      gap: 10, padding: '8px 14px', alignItems: 'center',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      background: hot ? 'rgba(74,222,128,0.04)' : (i % 2 ? 'transparent' : 'rgba(255,255,255,0.012)'),
      fontSize: 11, fontFamily: 'var(--font-mono)',
      transition: 'background 220ms',
    }}>
      <span style={{ color: '#777b87' }}>{i+1}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 18, height: 18, borderRadius: 999, background: row.ic, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 8, color: '#0a0a0a' }}>{row.sym[0]}</span>
        <span style={{ color: '#e6e6ea', fontWeight: 600 }}>{row.sym}/USDT</span>
        <span style={{ color: '#555965', fontSize: 9 }}>{row.venue}</span>
      </span>
      <span style={{ textAlign: 'right', color: '#e6e6ea' }}>${row.price < 1 ? row.price.toFixed(7).replace(/0+$/,'') : row.price.toLocaleString(undefined,{maximumFractionDigits:2})}</span>
      <span style={{ textAlign: 'right', color: fundUp ? '#4ade80' : '#f87171', fontWeight: 700 }}>{fundUp ? '+' : ''}{row.fund.toFixed(4)}%</span>
      <span style={{ textAlign: 'right', color: '#a5a8b2' }}>{row.oi}</span>
      <span style={{ textAlign: 'right', color: row.ls >= 1 ? '#4ade80' : '#f87171' }}>{row.ls.toFixed(2)}</span>
      <span style={{ textAlign: 'right', color: chgUp ? '#4ade80' : '#f87171', fontWeight: 600 }}>{chgUp ? '+' : ''}{row.chg.toFixed(2)}%</span>
      <span style={{ textAlign: 'right' }}>
        <Spark data={genWalk(20, 50, 4)} color={chgUp ? '#4ade80' : '#f87171'} height={18} fill={false}/>
      </span>
    </div>
  );
}

function FundingTableLite({ rows = DATA_ROWS, title = 'Top Funding', period = '8h' }) {
  const tick = useTick(1800);
  const hotIdx = tick % rows.length;
  return (
    <div style={{ background: '#10131a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#e6e6ea', letterSpacing: '-0.01em' }}>{title}</span>
        <span style={{ marginLeft: 10, fontFamily: 'var(--font-mono)', fontSize: 9, color: '#777b87' }}>33 venues · {period} · streaming</span>
        <div style={{ flex: 1 }}/>
        <RadarPulse size={8}/>
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: '24px 1.4fr 1fr 1fr 1fr 0.8fr 0.8fr 0.8fr',
        gap: 10, padding: '6px 14px', background: 'rgba(0,0,0,0.25)',
        fontFamily: 'var(--font-mono)', fontSize: 8, color: '#555965',
        textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700,
      }}>
        <span>#</span><span>PAIR</span>
        <span style={{ textAlign: 'right' }}>PRICE</span>
        <span style={{ textAlign: 'right' }}>FUNDING</span>
        <span style={{ textAlign: 'right' }}>OI</span>
        <span style={{ textAlign: 'right' }}>L/S</span>
        <span style={{ textAlign: 'right' }}>24H</span>
        <span style={{ textAlign: 'right' }}>SPARK</span>
      </div>
      {rows.map((r, i) => <FlashRow key={r.sym} row={r} i={i} hot={i === hotIdx}/>)}
    </div>
  );
}

// ─── Pages ─────────────────────────────────────────────────────

function FundingPage() {
  return (
    <Chrome active="funding">
      <div style={{ flex: 1, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Funding Rates</h1>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4ade80' }}>● live · 33 exchanges</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          <StatCard label="Volume 24h" value={142.8} delta={4.21} color="#4ade80" spark={genWalk(30, 100, 3)}/>
          <StatCard label="Open Interest" value={84.2} delta={1.82} color="#FF9500" spark={genWalk(30, 100, 2)}/>
          <StatCard label="Liquidations" value={2.41} delta={18.42} color="#f87171" spark={genWalk(30, 80, 6)}/>
          <StatCard label="Fear & Greed" value={72} delta={3.10} color="#FFD700" spark={genWalk(30, 70, 1.5)}/>
        </div>
        <FundingTableLite/>
      </div>
    </Chrome>
  );
}

function OIPage() {
  return (
    <Chrome active="oi">
      <div style={{ flex: 1, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Open Interest</h1>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4ade80' }}>● $84.21B aggregate</span>
        </div>
        <div style={{ background: '#10131a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, height: 220 }}>
          <div style={{ fontSize: 11, color: '#777b87', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>BTC OI · last 7d · 14 venues</div>
          <Spark data={genWalk(120, 100, 1.5)} color="#FF9500" height={180}/>
        </div>
        <FundingTableLite title="OI Leaders" period="now"/>
      </div>
    </Chrome>
  );
}

function LiquidationsPage() {
  // grid heatmap
  let seed = 42;
  const rand = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const cols = 40, rows = 14;
  const cells = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const yS = 1 - Math.abs(y - rows/2) / (rows/2);
      const xW = Math.sin((x/cols) * Math.PI * 3.4) * 0.32 + 0.5;
      const i = rand() * 0.35 + yS * xW * 0.65;
      let c = 'rgba(255,255,255,0.02)';
      if (i > 0.78) c = `rgba(248,113,113,${Math.min(0.95, i)})`;
      else if (i > 0.55) c = `rgba(248,113,113,${i*0.6})`;
      else if (i > 0.35) c = `rgba(248,113,113,${i*0.3})`;
      else if (i < 0.13) c = `rgba(74,222,128,${0.3+i})`;
      else if (i < 0.22) c = `rgba(74,222,128,${i*0.85})`;
      cells.push(c);
    }
  }
  return (
    <Chrome active="liq">
      <div style={{ flex: 1, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Liquidations</h1>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#f87171' }}>● $2.41B rekt 24h</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <StatCard label="Longs Liquidated" value={1.84} delta={-12.41} spark={genWalk(30, 60, 8)}/>
          <StatCard label="Shorts Liquidated" value={0.57} delta={4.21} color="#4ade80" spark={genWalk(30, 30, 4)}/>
          <StatCard label="Largest" value={4.21} delta={0} color="#FF9500" spark={genWalk(30, 30, 2)}/>
        </div>
        <div style={{ background: '#10131a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, color: '#777b87', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>Liquidation heatmap · BTC · 4h window</div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 1.5, height: 160 }}>
            {cells.map((c, i) => <span key={i} style={{ background: c }}/>)}
          </div>
        </div>
        <FundingTableLite title="Recent Liquidations" period="1m"/>
      </div>
    </Chrome>
  );
}

function ScreenerPage() {
  return (
    <Chrome active="screener">
      <div style={{ flex: 1, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Market Screener</h1>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#777b87' }}>847 markets · 14 filters active</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['Vol > $100M','Funding +0.05%','OI ↑','L/S > 1.2','24h ±5%','RSI < 30','Memes','Majors'].map((f, i) => (
            <span key={f} style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, padding: '4px 9px',
              background: i < 3 ? 'rgba(255,165,0,0.15)' : 'rgba(255,255,255,0.04)',
              color: i < 3 ? '#FF9500' : '#a5a8b2',
              border: '1px solid ' + (i < 3 ? 'rgba(255,165,0,0.3)' : 'rgba(255,255,255,0.07)'),
              borderRadius: 5,
            }}>{f}</span>
          ))}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '4px 9px', color: '#FF9500', cursor: 'pointer' }}>+ add filter</span>
        </div>
        <FundingTableLite title="Filtered Results" period="847"/>
      </div>
    </Chrome>
  );
}

function ChartPage() {
  return (
    <Chrome active="chart">
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 220px', gridTemplateRows: 'auto 1fr', gap: 0 }}>
        <div style={{
          gridColumn: '1 / 3', display: 'flex', alignItems: 'center', padding: '8px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.07)', gap: 12,
        }}>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>BTC/USDT</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#777b87' }}>BINANCE PERP</span>
          <Animated value={112842} prefix="$" decimals={2} size={20}/>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#4ade80', fontWeight: 700, padding: '2px 6px', background: 'rgba(74,222,128,0.1)', borderRadius: 3 }}>+2.41%</span>
          <div style={{ flex: 1 }}/>
          <div style={{ display: 'flex', gap: 2 }}>
            {['1m','5m','15m','1h','4h','1D','1W'].map((t, i) => (
              <span key={t} style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, padding: '3px 7px',
                background: i === 4 ? '#363c51' : 'transparent', color: i === 4 ? '#fff' : '#a5a8b2',
                borderRadius: 4,
              }}>{t}</span>
            ))}
          </div>
        </div>
        <div style={{ position: 'relative', background: '#0a0c12', overflow: 'hidden' }}>
          <Spark data={genWalk(180, 110, 2.5)} color="#FF9500" height={400} fill={true}/>
          {/* Crosshair */}
          <span style={{ position: 'absolute', left: '70%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.18)', pointerEvents: 'none' }}/>
          <span style={{ position: 'absolute', left: 0, right: 0, top: '38%', height: 1, background: 'rgba(255,255,255,0.18)', pointerEvents: 'none' }}/>
          <span style={{
            position: 'absolute', left: '70%', top: '38%', transform: 'translate(8px, -28px)',
            background: '#FF9500', color: '#0a0a0a', padding: '2px 6px', borderRadius: 3,
            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
          }}>$112,842</span>
        </div>
        <div style={{ borderLeft: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 12px', fontSize: 10, fontFamily: 'var(--font-mono)', color: '#777b87', letterSpacing: '0.12em' }}>ORDER BOOK</div>
          {[...Array(8)].map((_, i) => (
            <div key={'a'+i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 12px', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
              <span style={{ color: '#f87171' }}>{(112842 + (8-i)*4).toLocaleString()}</span>
              <span style={{ color: '#a5a8b2' }}>{(0.5 + Math.random() * 4).toFixed(2)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', borderTop: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <Animated value={112842} prefix="$" decimals={2} size={14} color="#4ade80"/>
          </div>
          {[...Array(8)].map((_, i) => (
            <div key={'b'+i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 12px', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
              <span style={{ color: '#4ade80' }}>{(112842 - (i+1)*4).toLocaleString()}</span>
              <span style={{ color: '#a5a8b2' }}>{(0.5 + Math.random() * 4).toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </Chrome>
  );
}

function OptionsPage() {
  return (
    <Chrome active="options">
      <div style={{ flex: 1, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Options Flow</h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          <StatCard label="Put/Call Ratio" value={0.74} delta={-2.10} color="#4ade80" spark={genWalk(20, 70, 2)}/>
          <StatCard label="IV (BTC)" value={42.1} delta={1.82} color="#FF9500" spark={genWalk(20, 50, 3)}/>
          <StatCard label="Notional 24h" value={4.2} delta={12.4} color="#b388ff" spark={genWalk(20, 80, 4)}/>
          <StatCard label="Open Interest" value={18.4} delta={0.82} color="#FFD700" spark={genWalk(20, 80, 1.5)}/>
        </div>
        <div style={{ background: '#10131a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 13, fontWeight: 600 }}>BTC · Dec 27 expiry</div>
          {[
            { strike: 100000, type: 'P', iv: 38.2, vol: '$12.4M', delta: -0.18 },
            { strike: 110000, type: 'P', iv: 42.1, vol: '$28.7M', delta: -0.42 },
            { strike: 115000, type: 'C', iv: 41.4, vol: '$41.2M', delta:  0.52 },
            { strike: 120000, type: 'C', iv: 43.8, vol: '$22.1M', delta:  0.31 },
            { strike: 130000, type: 'C', iv: 48.1, vol: '$8.4M',  delta:  0.14 },
          ].map((r, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '1fr 60px 1fr 1fr 1fr',
              gap: 10, padding: '8px 14px', fontFamily: 'var(--font-mono)', fontSize: 11,
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}>
              <span style={{ color: '#e6e6ea', fontWeight: 600 }}>${r.strike.toLocaleString()}</span>
              <span style={{ color: r.type === 'C' ? '#4ade80' : '#f87171', fontWeight: 700 }}>{r.type === 'C' ? 'CALL' : 'PUT'}</span>
              <span style={{ textAlign: 'right', color: '#a5a8b2' }}>IV {r.iv}%</span>
              <span style={{ textAlign: 'right', color: '#FF9500' }}>{r.vol}</span>
              <span style={{ textAlign: 'right', color: r.delta >= 0 ? '#4ade80' : '#f87171' }}>Δ {r.delta.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </Chrome>
  );
}

function HeatmapPage() {
  // bubble heatmap
  const bubbles = DATA_ROWS.map((r, i) => ({
    ...r,
    size: 30 + Math.abs(r.chg) * 8,
    x: 5 + (i % 5) * 18 + Math.random() * 4,
    y: 8 + Math.floor(i / 5) * 30 + Math.random() * 6,
  }));
  return (
    <Chrome active="dashboard">
      <div style={{ flex: 1, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Market Heatmap</h1>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#777b87' }}>by 24h % · all venues</span>
        </div>
        <div style={{ position: 'relative', height: 360, background: '#10131a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
          {bubbles.map((b, i) => {
            const col = b.chg >= 0
              ? `rgba(74,222,128,${0.15 + Math.min(0.6, Math.abs(b.chg)/20)})`
              : `rgba(248,113,113,${0.15 + Math.min(0.6, Math.abs(b.chg)/20)})`;
            return (
              <span key={i} style={{
                position: 'absolute', left: `${b.x}%`, top: `${b.y}%`,
                width: b.size * 1.6, height: b.size * 1.6,
                background: col, border: '1px solid ' + (b.chg >= 0 ? 'rgba(74,222,128,0.4)' : 'rgba(248,113,113,0.4)'),
                borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)', color: '#fff',
              }}>
                <span style={{ fontSize: 11, fontWeight: 700 }}>{b.sym}</span>
                <span style={{ fontSize: 9, fontWeight: 600, color: b.chg >= 0 ? '#4ade80' : '#f87171' }}>
                  {b.chg >= 0 ? '+' : ''}{b.chg.toFixed(1)}%
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </Chrome>
  );
}

function AlertsPage() {
  const alerts = [
    { sym: 'HYPE', cond: 'Funding > 0.20%', state: 'firing', when: '2s ago', value: '+0.21%' },
    { sym: 'BTC',  cond: 'Price > $115K',   state: 'armed', when: 'in 850bps', value: '$112,842' },
    { sym: 'PEPE', cond: 'Volume spike',    state: 'firing', when: '14s ago', value: '4.2x avg' },
    { sym: 'SOL',  cond: 'Liq cluster',     state: 'armed', when: '$210', value: '$214.52' },
    { sym: 'ETH',  cond: 'L/S < 0.7',       state: 'silent', when: '—', value: '0.91' },
    { sym: 'WIF',  cond: 'OI Δ > 20%',      state: 'firing', when: '47s ago', value: '+24.1%' },
  ];
  return (
    <Chrome active="dashboard">
      <div style={{ flex: 1, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Alerts</h1>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#FF9500' }}>● 3 firing · 2 armed</span>
          <div style={{ flex: 1 }}/>
          <span style={{ background: '#FF9500', color: '#0a0a0a', fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 5 }}>+ New alert</span>
        </div>
        <div style={{ background: '#10131a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
          {alerts.map((a, i) => {
            const c = a.state === 'firing' ? '#f87171' : a.state === 'armed' ? '#FF9500' : '#777b87';
            return (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '12px 60px 1fr 1fr 100px 100px',
                gap: 12, padding: '10px 14px', alignItems: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                background: a.state === 'firing' ? 'rgba(248,113,113,0.05)' : 'transparent',
              }}>
                {a.state === 'firing'
                  ? <RadarPulse size={10} color="#f87171"/>
                  : <span style={{ width: 8, height: 8, borderRadius: 999, background: c }}/>}
                <span style={{ color: '#e6e6ea', fontWeight: 700, fontSize: 12 }}>{a.sym}</span>
                <span style={{ color: '#a5a8b2', fontSize: 12 }}>{a.cond}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#e6e6ea' }}>{a.value}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#777b87' }}>{a.when}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: c, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>{a.state}</span>
              </div>
            );
          })}
        </div>
      </div>
    </Chrome>
  );
}

function DashboardPage() {
  return (
    <Chrome active="dashboard">
      <div style={{ flex: 1, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Your Dashboard</h1>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#777b87' }}>good morning, alex</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          <StatCard label="Watchlist Δ" value={2.41} delta={2.41} color="#4ade80" spark={genWalk(20, 100, 2)}/>
          <StatCard label="Alerts Fired" value={12} delta={4} color="#FF9500" spark={genWalk(20, 50, 3)}/>
          <StatCard label="P/L 24h" value={847} delta={5.21} color="#4ade80" spark={genWalk(20, 60, 4)}/>
          <StatCard label="Active Positions" value={7} delta={0} color="#b388ff" spark={genWalk(20, 30, 1)}/>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <FundingTableLite title="Watchlist" period="custom" rows={DATA_ROWS.slice(0, 6)}/>
          <div style={{ background: '#10131a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Recent Activity</div>
            {[
              { t: 'HYPE alert fired', s: '2s ago', c: '#f87171' },
              { t: 'New funding peak BTC', s: '47s ago', c: '#FF9500' },
              { t: 'WIF added to watchlist', s: '4m ago', c: '#777b87' },
              { t: 'Position opened SOL', s: '12m ago', c: '#4ade80' },
              { t: 'Pro plan renewed', s: '1h ago', c: '#b388ff' },
            ].map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: a.c }}/>
                <span style={{ flex: 1, color: '#a5a8b2' }}>{a.t}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#555965' }}>{a.s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Chrome>
  );
}

Object.assign(window, {
  DATA_ROWS, Animated, StatCard, FlashRow, FundingTableLite,
  FundingPage, OIPage, LiquidationsPage, ScreenerPage,
  ChartPage, OptionsPage, HeatmapPage, AlertsPage, DashboardPage,
});
