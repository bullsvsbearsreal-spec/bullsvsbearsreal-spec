// Shared building blocks for all InfoHub page mocks
// Tiny, fast, dense — optimized for canvas review

const TAPE = [
  { sym: 'BTC',  price: 112842, chg:  2.41 },
  { sym: 'ETH',  price: 4221,   chg: -0.64 },
  { sym: 'SOL',  price: 214.52, chg:  6.12 },
  { sym: 'HYPE', price: 38.21,  chg: 12.84 },
  { sym: 'BNB',  price: 712.44, chg:  1.12 },
  { sym: 'DOGE', price: 0.412,  chg: -3.24 },
  { sym: 'XRP',  price: 2.84,   chg:  0.82 },
  { sym: 'AVAX', price: 48.12,  chg: -1.10 },
  { sym: 'LINK', price: 24.88,  chg:  4.02 },
  { sym: 'TON',  price: 6.71,   chg: -0.24 },
];

const NAV = [
  { key: 'funding', label: 'Funding' },
  { key: 'oi', label: 'Open Interest' },
  { key: 'liq', label: 'Liquidations' },
  { key: 'screener', label: 'Screener' },
  { key: 'chart', label: 'Chart' },
  { key: 'options', label: 'Options' },
  { key: 'dashboard', label: 'Dashboard' },
];

const EXCH = [
  'binance', 'bybit', 'okx', 'bitget', 'coinbase', 'kraken', 'mexc',
  'htx', 'kucoin', 'bitmex', 'deribit', 'hyperliquid', 'dydx',
  'gmx', 'drift', 'aevo', 'lighter',
];

// ── live primitives ────────────────────────────────────────────
function useTick(ms = 1000) {
  const [t, setT] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setT(x => x + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return t;
}

function RadarPulse({ size = 10, color = '#4ade80' }) {
  const core = size * 0.4;
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: size, height: size, flexShrink: 0 }}>
      {[0,1].map(i => (
        <span key={i} style={{
          position: 'absolute', inset: 0, borderRadius: 999, border: `1px solid ${color}`,
          animation: `radar-ring 2.2s cubic-bezier(0,0,0.2,1) ${i*1.1}s infinite`, opacity: 0,
        }}/>
      ))}
      <span style={{
        position: 'absolute', top: '50%', left: '50%', width: core, height: core,
        marginLeft: -core/2, marginTop: -core/2, background: color, borderRadius: 999,
        boxShadow: `0 0 ${size*0.6}px ${color}`,
        animation: 'radar-core 1.8s ease-in-out infinite',
      }}/>
    </span>
  );
}

function Tape({ items = TAPE }) {
  return (
    <div style={{
      height: 26, background: 'rgba(10,10,10,0.92)',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      display: 'flex', alignItems: 'center', overflow: 'hidden',
    }}>
      <div style={{
        flexShrink: 0, padding: '0 12px', height: '100%',
        borderRight: '1px solid rgba(255,255,255,0.04)',
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'linear-gradient(90deg, rgba(255,165,0,0.08), transparent)',
        fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
        color: '#FF9500', letterSpacing: '0.12em',
      }}>
        <RadarPulse size={9}/>LIVE
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{
          display: 'flex', gap: 22, height: 26, alignItems: 'center',
          paddingLeft: 12, whiteSpace: 'nowrap',
          animation: 'tape-scroll 60s linear infinite',
        }}>
          {[...items, ...items].map((m, i) => (
            <span key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
              <span style={{ color: '#a5a8b2', fontWeight: 600 }}>{m.sym}</span>{' '}
              <span style={{ color: '#e6e6ea' }}>${m.price < 1 ? m.price.toFixed(4) : m.price.toLocaleString()}</span>{' '}
              <span style={{ color: m.chg >= 0 ? '#4ade80' : '#f87171', fontWeight: 600 }}>
                {m.chg >= 0 ? '+' : ''}{m.chg.toFixed(2)}%
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Header({ active = 'funding' }) {
  return (
    <header style={{
      height: 44, background: 'rgba(7,9,13,0.92)',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      display: 'flex', alignItems: 'center', padding: '0 16px', gap: 18,
    }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 0 }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 14, color: '#e6e6ea', letterSpacing: '-0.035em' }}>Info</span>
        <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 14, color: '#0a0a0a', background: '#FF9500', padding: '2px 4px', borderRadius: 4, letterSpacing: '-0.035em', marginLeft: 1 }}>Hub</span>
      </div>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, paddingLeft: 10, borderLeft: '1px solid rgba(255,255,255,0.07)' }}>
        <RadarPulse size={9}/>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#4ade80', fontWeight: 600, letterSpacing: '0.08em' }}>LIVE</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#777b87' }}>
          <span style={{ color: '#e6e6ea', fontWeight: 600 }}>33</span> venues
        </span>
      </span>
      <nav style={{ display: 'flex', alignItems: 'center', gap: 0, height: '100%' }}>
        {NAV.map(it => {
          const on = active === it.key;
          return (
            <span key={it.key} style={{
              padding: '0 10px', height: '100%', display: 'flex', alignItems: 'center',
              fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: on ? 600 : 500,
              color: on ? '#FF9500' : '#a5a8b2', position: 'relative',
            }}>
              {it.label}
              {on && <span style={{ position: 'absolute', left: 8, right: 8, bottom: 0, height: 2, background: '#FF9500' }}/>}
            </span>
          );
        })}
      </nav>
      <div style={{ flex: 1 }}/>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, color: '#777b87',
        padding: '4px 8px', background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)', borderRadius: 5,
      }}>Search ⌘K</span>
      <span style={{
        background: '#FF9500', color: '#0a0a0a',
        fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 700,
        padding: '5px 12px', borderRadius: 5,
      }}>Sign in</span>
    </header>
  );
}

function Footer() {
  return (
    <footer style={{
      height: 28, background: '#10131a',
      borderTop: '1px solid rgba(255,255,255,0.04)',
      display: 'flex', alignItems: 'center', padding: '0 14px', gap: 12,
      fontFamily: 'var(--font-mono)', fontSize: 9, color: '#777b87',
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#4ade80', fontWeight: 600 }}>
        <RadarPulse size={8}/>Streaming
      </span>
      <span>33/33 venues</span>
      <div style={{ display: 'inline-flex', gap: 3 }}>
        {EXCH.slice(0, 14).map((e, i) => (
          <span key={e} style={{
            width: 12, height: 12, borderRadius: 999, background: '#fff', overflow: 'hidden',
            boxShadow: i === 5 ? '0 0 4px rgba(74,222,128,0.7)' : '0 0 0 1px rgba(255,255,255,0.05)',
          }}>
            <img src={`../assets/exchanges/${e}.png`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
          </span>
        ))}
      </div>
      <span>api 142ms</span>
      <span>ws 38ms</span>
      <div style={{ flex: 1 }}/>
      <span style={{ opacity: 0.55 }}>Not financial advice · DYOR</span>
    </footer>
  );
}

// ── chart primitives ──────────────────────────────────────────
function Spark({ data, color = '#FF9500', height = 28, fill = true }) {
  const w = 100, h = height;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i/(data.length-1))*w},${h - ((v-min)/range)*h*0.85 - 2}`).join(' ');
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      {fill && (
        <polygon points={`0,${h} ${pts} ${w},${h}`} fill={color} opacity="0.15"/>
      )}
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>
    </svg>
  );
}

function genWalk(n = 60, start = 100, vol = 1) {
  const out = [start];
  for (let i = 1; i < n; i++) out.push(out[i-1] + (Math.random() - 0.48) * vol);
  return out;
}

// ── Chrome wrapper ─────────────────────────────────────────────
function Chrome({ active, tape = true, children }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0,
      background: '#07090d', color: '#e6e6ea', fontFamily: 'var(--font-sans)', overflow: 'hidden',
    }}>
      <Header active={active}/>
      {tape && <Tape/>}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
      <Footer/>
    </div>
  );
}

// expose
Object.assign(window, {
  TAPE, NAV, EXCH, useTick, RadarPulse, Tape, Header, Footer, Spark, genWalk, Chrome,
});
