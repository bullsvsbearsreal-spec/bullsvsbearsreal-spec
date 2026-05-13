import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { ALL_EXCHANGES } from '@/lib/constants';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';

type Variant =
  | 'default'
  | 'tape'
  | 'funding'
  | 'liquidations'
  | 'oi'
  | 'screener'
  | 'news'
  | 'heatmap'
  | 'chart'
  | 'donate'
  | 'ratios'
  | 'etf'
  | 'options'
  | 'changelog';

const ACCENT = '#FF9500';
const ACCENT_DARK = '#E06600';
const PUMP = '#22c55e';
const REKT = '#ef4444';

// ────────────────────────────────────────────────────────────────────
// Variant-specific right-column previews
// ────────────────────────────────────────────────────────────────────

function FundingPreview() {
  const rows = [
    { sym: 'BTC',  vals: [ 0.0043, -0.0045,  0.0079,  0.0012, -0.0031,  0.0058] },
    { sym: 'ETH',  vals: [ 0.0053,  0.0032,  0.0014, -0.0067,  0.0041, -0.0019] },
    { sym: 'SOL',  vals: [-0.0089, -0.0038, -0.0085,  0.0023, -0.0056,  0.0011] },
    { sym: 'XRP',  vals: [ 0.0074,  0.0034, -0.0040,  0.0015,  0.0062, -0.0028] },
    { sym: 'DOGE', vals: [ 0.0100,  0.0064,  0.0000, -0.0051,  0.0033,  0.0072] },
    { sym: 'BNB',  vals: [-0.0016,  0.0048,  0.0091, -0.0035,  0.0027,  0.0063] },
  ];
  const cellColor = (r: number) => {
    const t = Math.min(Math.abs(r), 0.01) / 0.01;
    if (r > 0) return `rgba(34, 197, 94, ${(0.2 + t * 0.6).toFixed(2)})`;
    if (r < 0) return `rgba(239, 68, 68, ${(0.2 + t * 0.6).toFixed(2)})`;
    return 'rgba(255,255,255,0.06)';
  };
  const textColor = (r: number) => r > 0 ? '#86efac' : r < 0 ? '#fca5a5' : '#a3a3a3';
  const fmt = (r: number) => `${r >= 0 ? '+' : ''}${(r * 100).toFixed(3)}%`;
  const ex = ['BINANCE', 'BYBIT', 'OKX', 'BITGET', 'MEXC', 'BINGX'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.025)' }}>
        <div style={{ width: 78, padding: '12px 14px', fontSize: 10, fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: 1.2, display: 'flex' }}>SYM</div>
        {ex.map((n) => (
          <div key={n} style={{ flex: 1, padding: '12px 2px', fontSize: 9, fontWeight: 700, color: '#525252', display: 'flex', justifyContent: 'center', letterSpacing: 0.6 }}>{n}</div>
        ))}
      </div>
      {rows.map((row) => (
        <div key={row.sym} style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
          <div style={{ width: 78, padding: '0 14px', display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#fafafa' }}>{row.sym}</span>
          </div>
          {row.vals.map((v, i) => (
            <div key={i} style={{ flex: 1, padding: '5px 3px', display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: '100%', padding: '10px 2px', borderRadius: 6, background: cellColor(v), display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: textColor(v), fontFamily: 'monospace' }}>{fmt(v)}</span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function LiquidationsPreview() {
  const liqs = [
    { sym: 'BTC', side: 'LONG',  amount: '$2.84M', exch: 'Binance', flash: true },
    { sym: 'ETH', side: 'LONG',  amount: '$1.62M', exch: 'Bybit' },
    { sym: 'SOL', side: 'SHORT', amount: '$842K',  exch: 'OKX' },
    { sym: 'BTC', side: 'LONG',  amount: '$680K',  exch: 'Bitget' },
    { sym: 'AVAX', side: 'LONG', amount: '$432K',  exch: 'Hyperliquid' },
    { sym: 'XRP', side: 'SHORT', amount: '$310K',  exch: 'MEXC' },
    { sym: 'TON', side: 'LONG',  amount: '$285K',  exch: 'Binance' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
      {/* Header strip */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(239,68,68,0.06)' }}>
        <div style={{ width: 8, height: 8, borderRadius: 999, background: REKT, marginRight: 8, display: 'flex' }} />
        {/* OG image is pre-rendered with example data — don't claim LIVE.
            Was "LIVE · TOTAL REKT 24H" with hardcoded $437.16M next to it,
            shipped to every Twitter/Discord share. Re-labeled as PREVIEW. */}
        <span style={{ fontSize: 11, fontWeight: 800, color: '#fca5a5', textTransform: 'uppercase', letterSpacing: 1 }}>PREVIEW · LIQUIDATIONS</span>
        <div style={{ flex: 1, display: 'flex' }} />
        {/* Dropped the hardcoded "$437.16M" total — real number on the
            page is updated every minute, baking it into the OG would make
            us look wrong within minutes of any share. */}
      </div>
      {liqs.map((l, i) => {
        const isLong = l.side === 'LONG';
        const bg = isLong ? 'rgba(239,68,68,0.06)' : 'rgba(34,197,94,0.06)';
        const sideColor = isLong ? '#fca5a5' : '#86efac';
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '11px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)', background: l.flash ? bg : 'transparent' }}>
            <span style={{ width: 56, fontSize: 14, fontWeight: 800, color: '#fafafa' }}>{l.sym}</span>
            <span style={{ width: 70, fontSize: 10, fontWeight: 700, color: sideColor, fontFamily: 'monospace', letterSpacing: 0.6 }}>{l.side}</span>
            <span style={{ flex: 1, display: 'flex' }} />
            <span style={{ fontSize: 11, color: '#737373', marginRight: 12 }}>{l.exch}</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: isLong ? REKT : PUMP, fontFamily: 'monospace' }}>{l.amount}</span>
          </div>
        );
      })}
    </div>
  );
}

function OIPreview() {
  const rows = [
    { sym: 'BTC',  oi: '$87.3B', pct: 4.2, color: PUMP },
    { sym: 'ETH',  oi: '$32.1B', pct: 2.8, color: PUMP },
    { sym: 'SOL',  oi: '$8.4B',  pct: -1.2, color: REKT },
    { sym: 'XRP',  oi: '$4.9B',  pct: 8.1, color: PUMP },
    { sym: 'DOGE', oi: '$2.1B',  pct: -3.4, color: REKT },
    { sym: 'BNB',  oi: '$1.6B',  pct: 1.5, color: PUMP },
  ];
  const max = 87.3;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', padding: 16, borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ width: 4, height: 14, background: '#a78bfa', borderRadius: 2, marginRight: 8, display: 'flex' }} />
        <span style={{ fontSize: 11, fontWeight: 800, color: '#fafafa', textTransform: 'uppercase', letterSpacing: 1.4 }}>OPEN INTEREST · 24H</span>
      </div>
      {rows.map(r => {
        const numeric = parseFloat(r.oi.replace('$', '').replace('B', ''));
        const w = Math.max(20, (numeric / max) * 100);
        return (
          <div key={r.sym} style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ width: 56, fontSize: 14, fontWeight: 800, color: '#fafafa' }}>{r.sym}</span>
            <div style={{ flex: 1, height: 28, position: 'relative', display: 'flex', alignItems: 'center' }}>
              <div style={{ width: `${w}%`, height: '100%', borderRadius: 6, background: 'linear-gradient(90deg, rgba(167,139,250,0.5), rgba(167,139,250,0.2))', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fafafa', fontFamily: 'monospace' }}>{r.oi}</span>
              </div>
            </div>
            <span style={{ width: 70, marginLeft: 10, fontSize: 12, fontWeight: 700, color: r.color, fontFamily: 'monospace', textAlign: 'right' as const, display: 'flex', justifyContent: 'flex-end' }}>
              {r.pct >= 0 ? '+' : ''}{r.pct.toFixed(1)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

function NewsPreview() {
  const articles = [
    { src: 'CoinDesk',     time: '2m',  title: 'Bitcoin breaks to new ATH amid record ETF inflows' },
    { src: 'The Block',    time: '12m', title: 'Ethereum L2s see surge in TVL as fees drop sharply' },
    { src: 'Decrypt',      time: '34m', title: 'Hyperliquid hits $1B daily perp volume milestone' },
    { src: 'CryptoSlate',  time: '1h',  title: 'BlackRock files for spot Solana ETF; analysts bullish' },
    { src: 'Cointelegraph', time: '2h', title: 'On-chain data: whales accumulate during pullback' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(245,158,11,0.05)' }}>
        <span style={{ width: 4, height: 14, background: '#f59e0b', borderRadius: 2, marginRight: 8, display: 'flex' }} />
        <span style={{ fontSize: 11, fontWeight: 800, color: '#fafafa', textTransform: 'uppercase', letterSpacing: 1.4 }}>LATEST NEWS · 21+ SOURCES</span>
      </div>
      {articles.map((a, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', padding: '11px 16px', borderBottom: i < articles.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#fafafa', lineHeight: 1.35 }}>{a.title}</span>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b' }}>{a.src}</span>
            <span style={{ fontSize: 10, color: '#404040', margin: '0 6px' }}>·</span>
            <span style={{ fontSize: 10, color: '#737373' }}>{a.time} ago</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function HeatmapPreview() {
  // Treemap-style colored tiles
  const tiles = [
    { sym: 'BTC',  pct: 2.4,  size: 'big', col: 0, row: 0, w: 3, h: 2 },
    { sym: 'ETH',  pct: 3.1,  size: 'big', col: 3, row: 0, w: 2, h: 2 },
    { sym: 'SOL',  pct: -1.2, col: 5, row: 0, w: 1, h: 1 },
    { sym: 'XRP',  pct: 0.8,  col: 5, row: 1, w: 1, h: 1 },
    { sym: 'BNB',  pct: 1.5,  col: 0, row: 2, w: 2, h: 1 },
    { sym: 'DOGE', pct: 5.2,  col: 2, row: 2, w: 1, h: 1 },
    { sym: 'ADA',  pct: -3.1, col: 3, row: 2, w: 1, h: 1 },
    { sym: 'AVAX', pct: 4.7,  col: 4, row: 2, w: 1, h: 1 },
    { sym: 'PEPE', pct: 8.4,  col: 5, row: 2, w: 1, h: 1 },
  ];
  const colorFor = (pct: number) => {
    const a = Math.min(Math.abs(pct), 8) / 8;
    return pct >= 0
      ? `rgba(34,197,94,${(0.25 + a * 0.65).toFixed(2)})`
      : `rgba(239,68,68,${(0.25 + a * 0.65).toFixed(2)})`;
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: 360, borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', position: 'relative', background: '#0a0a0a' }}>
      {/* CSS grid is limited in @vercel/og — use absolute positioning */}
      {tiles.map(t => (
        <div key={t.sym} style={{
          position: 'absolute',
          left:   `${(t.col / 6) * 100}%`,
          top:    `${(t.row / 3) * 100}%`,
          width:  `${(t.w / 6) * 100}%`,
          height: `${(t.h / 3) * 100}%`,
          background: colorFor(t.pct),
          border: '2px solid #050505',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: t.size === 'big' ? 36 : 18, fontWeight: 900, color: '#fff', letterSpacing: -0.5, textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>{t.sym}</span>
          <span style={{ fontSize: t.size === 'big' ? 18 : 12, fontWeight: 700, color: 'rgba(255,255,255,0.92)', fontFamily: 'monospace' }}>
            {t.pct >= 0 ? '+' : ''}{t.pct.toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
}

function ChartPreview() {
  // Hand-drawn candle stack
  const candles = [
    { open: 60, close: 80, high: 85, low: 55, up: true },
    { open: 80, close: 75, high: 82, low: 72, up: false },
    { open: 75, close: 90, high: 95, low: 73, up: true },
    { open: 90, close: 100, high: 105, low: 88, up: true },
    { open: 100, close: 95, high: 102, low: 90, up: false },
    { open: 95, close: 110, high: 115, low: 93, up: true },
    { open: 110, close: 115, high: 120, low: 108, up: true },
    { open: 115, close: 105, high: 118, low: 100, up: false },
    { open: 105, close: 125, high: 130, low: 102, up: true },
    { open: 125, close: 135, high: 140, low: 122, up: true },
    { open: 135, close: 130, high: 138, low: 128, up: false },
    { open: 130, close: 150, high: 155, low: 127, up: true },
  ];
  const maxH = 160;
  const scale = (v: number) => maxH - v;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: 280, borderRadius: 14, padding: 18, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>BTC/USD</span>
        <span style={{ fontSize: 12, color: '#737373', marginLeft: 8 }}>· 1H</span>
        <div style={{ flex: 1, display: 'flex' }} />
        <span style={{ fontSize: 18, fontWeight: 900, color: PUMP, fontFamily: 'monospace' }}>$74,820</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: PUMP, marginLeft: 8, fontFamily: 'monospace' }}>+3.42%</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', height: maxH, gap: 4, position: 'relative' }}>
        {candles.map((c, i) => {
          const bodyTop = scale(Math.max(c.open, c.close));
          const bodyH = Math.abs(c.close - c.open);
          const wickTop = scale(c.high);
          const wickH = c.high - c.low;
          const color = c.up ? PUMP : REKT;
          return (
            <div key={i} style={{ flex: 1, position: 'relative', height: maxH, display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'absolute', left: '50%', top: wickTop, width: 1.5, height: wickH, background: color, transform: 'translateX(-50%)', display: 'flex' }} />
              <div style={{ position: 'absolute', top: bodyTop, left: 0, right: 0, height: Math.max(2, bodyH), background: color, borderRadius: 1, display: 'flex' }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DonatePreview() {
  const chains = [
    { sym: 'BTC',  color: '#f7931a', name: 'Bitcoin' },
    { sym: 'ETH',  color: '#627eea', name: 'Ethereum + L2s' },
    { sym: 'SOL',  color: '#9945ff', name: 'Solana' },
    { sym: 'HYPE', color: '#50d2c1', name: 'Hyperliquid' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', padding: 18, borderRadius: 14, border: '1px solid rgba(244,63,94,0.18)', background: 'linear-gradient(135deg, rgba(244,63,94,0.06) 0%, rgba(251,146,60,0.04) 100%)' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
          <span style={{ fontSize: 22, color: '#f43f5e' }}>♥</span>
        </div>
        <span style={{ fontSize: 16, fontWeight: 800, color: '#fafafa' }}>Tip in crypto</span>
        <div style={{ flex: 1, display: 'flex' }} />
        <span style={{ fontSize: 9, fontWeight: 700, color: '#f43f5e', textTransform: 'uppercase', letterSpacing: 1, padding: '4px 10px', borderRadius: 999, background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)' }}>Day-One Perk</span>
      </div>
      {chains.map(c => (
        <div key={c.sym} style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', marginBottom: 6, borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: `${c.color}1f`, border: `1px solid ${c.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: c.color }}>{c.sym}</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fafafa' }}>{c.name}</span>
          <div style={{ flex: 1, display: 'flex' }} />
          <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#737373' }}>QR + address</span>
        </div>
      ))}
    </div>
  );
}

function RatiosPreview() {
  const rows = [
    { sym: 'BTC',  long: 62, short: 38 },
    { sym: 'ETH',  long: 58, short: 42 },
    { sym: 'SOL',  long: 71, short: 29 },
    { sym: 'XRP',  long: 44, short: 56 },
    { sym: 'BNB',  long: 53, short: 47 },
    { sym: 'DOGE', long: 67, short: 33 },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', padding: 18, borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ width: 4, height: 14, background: '#60a5fa', borderRadius: 2, marginRight: 8, display: 'flex' }} />
        <span style={{ fontSize: 11, fontWeight: 800, color: '#fafafa', textTransform: 'uppercase', letterSpacing: 1.4 }}>LONG / SHORT RATIOS</span>
      </div>
      {rows.map(r => (
        <div key={r.sym} style={{ display: 'flex', flexDirection: 'column', marginBottom: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ width: 50, fontSize: 13, fontWeight: 800, color: '#fafafa' }}>{r.sym}</span>
            <div style={{ flex: 1, display: 'flex' }} />
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: PUMP, fontWeight: 700 }}>{r.long}%</span>
            <span style={{ fontSize: 11, color: '#525252', margin: '0 5px' }}>·</span>
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: REKT, fontWeight: 700 }}>{r.short}%</span>
          </div>
          <div style={{ width: '100%', height: 6, borderRadius: 3, overflow: 'hidden', background: 'rgba(239,68,68,0.25)', display: 'flex' }}>
            <div style={{ width: `${r.long}%`, height: '100%', background: PUMP, display: 'flex' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ScreenerPreview() {
  const rows = [
    { sym: 'BTC',  price: '74,820',  ch: '+3.42%',  vol: '$28.1B', up: true  },
    { sym: 'ETH',  price: '3,420',   ch: '+2.18%',  vol: '$14.7B', up: true  },
    { sym: 'SOL',  price: '184.50',  ch: '-1.22%',  vol: '$5.2B',  up: false },
    { sym: 'BNB',  price: '602.30',  ch: '+0.84%',  vol: '$1.8B',  up: true  },
    { sym: 'XRP',  price: '0.5840',  ch: '+5.61%',  vol: '$2.1B',  up: true  },
    { sym: 'DOGE', price: '0.1820',  ch: '-2.41%',  vol: '$1.4B',  up: false },
    { sym: 'TON',  price: '5.840',   ch: '+1.07%',  vol: '$420M',  up: true  },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
      <div style={{ display: 'flex', padding: '11px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.025)' }}>
        <span style={{ width: 60, fontSize: 9, fontWeight: 800, color: '#525252', textTransform: 'uppercase', letterSpacing: 1 }}>SYM</span>
        <span style={{ flex: 1, fontSize: 9, fontWeight: 800, color: '#525252', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'right' }}>PRICE</span>
        <span style={{ width: 90, fontSize: 9, fontWeight: 800, color: '#525252', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'right' }}>24H</span>
        <span style={{ width: 90, fontSize: 9, fontWeight: 800, color: '#525252', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'right' }}>VOL</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '11px 14px', borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
          <span style={{ width: 60, fontSize: 13, fontWeight: 800, color: '#fafafa' }}>{r.sym}</span>
          <span style={{ flex: 1, fontSize: 12, fontFamily: 'monospace', color: '#fafafa', fontWeight: 600, textAlign: 'right' }}>${r.price}</span>
          <span style={{ width: 90, fontSize: 11, fontFamily: 'monospace', color: r.up ? PUMP : REKT, fontWeight: 700, textAlign: 'right' }}>{r.ch}</span>
          <span style={{ width: 90, fontSize: 11, fontFamily: 'monospace', color: '#737373', textAlign: 'right' }}>{r.vol}</span>
        </div>
      ))}
    </div>
  );
}

function ETFPreview() {
  const funds = [
    { ticker: 'IBIT', issuer: 'BlackRock',   aum: '$58.2B', ch: 2.4, up: true },
    { ticker: 'FBTC', issuer: 'Fidelity',    aum: '$22.1B', ch: 2.1, up: true },
    { ticker: 'GBTC', issuer: 'Grayscale',   aum: '$18.4B', ch: 1.8, up: true },
    { ticker: 'ARKB', issuer: 'ARK/21Sh',    aum: '$3.7B',  ch: 2.6, up: true },
    { ticker: 'BITB', issuer: 'Bitwise',     aum: '$2.9B',  ch: 2.2, up: true },
    { ticker: 'HODL', issuer: 'VanEck',      aum: '$1.1B',  ch: 1.9, up: true },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(34,197,94,0.05)' }}>
        <span style={{ width: 4, height: 14, background: PUMP, borderRadius: 2, marginRight: 8, display: 'flex' }} />
        <span style={{ fontSize: 11, fontWeight: 800, color: '#fafafa', textTransform: 'uppercase', letterSpacing: 1.2 }}>BTC SPOT ETF · TOTAL AUM</span>
        <div style={{ flex: 1, display: 'flex' }} />
        <span style={{ fontSize: 18, fontWeight: 900, color: PUMP, fontFamily: 'monospace' }}>$106.4B</span>
      </div>
      {funds.map((f, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '11px 16px', borderBottom: i < funds.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
          <span style={{ width: 70, fontSize: 14, fontWeight: 800, color: '#fafafa' }}>{f.ticker}</span>
          <span style={{ flex: 1, fontSize: 11, color: '#737373' }}>{f.issuer}</span>
          <span style={{ width: 80, fontSize: 12, fontFamily: 'monospace', color: '#fafafa', fontWeight: 600, textAlign: 'right' }}>{f.aum}</span>
          <span style={{ width: 70, fontSize: 11, fontFamily: 'monospace', color: f.up ? PUMP : REKT, fontWeight: 700, textAlign: 'right' }}>+{f.ch.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

function OptionsPreview() {
  const expiries = [
    { date: 'Dec 27', vol: 1842, maxPain: '70K' },
    { date: 'Jan 31', vol: 952, maxPain: '72K' },
    { date: 'Feb 28', vol: 421, maxPain: '74K' },
    { date: 'Mar 28', vol: 318, maxPain: '78K' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', padding: 18, borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ width: 4, height: 14, background: '#a78bfa', borderRadius: 2, marginRight: 8, display: 'flex' }} />
        <span style={{ fontSize: 11, fontWeight: 800, color: '#fafafa', textTransform: 'uppercase', letterSpacing: 1.4 }}>BTC OPTIONS · MAX PAIN</span>
      </div>
      {expiries.map((e, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: i < expiries.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
          <span style={{ width: 80, fontSize: 13, fontWeight: 700, color: '#fafafa' }}>{e.date}</span>
          <div style={{ flex: 1, height: 12, position: 'relative', display: 'flex', alignItems: 'center' }}>
            <div style={{ width: `${Math.max(20, (e.vol / 1842) * 100)}%`, height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, rgba(167,139,250,0.5), rgba(167,139,250,0.2))', display: 'flex' }} />
          </div>
          <span style={{ width: 70, fontSize: 11, fontFamily: 'monospace', color: '#a78bfa', fontWeight: 700, textAlign: 'right' }}>${e.maxPain}</span>
        </div>
      ))}
    </div>
  );
}

function ChangelogPreview() {
  // Showcase the latest shipped tools as a 3×3 tile layout.
  //
  // IMPORTANT: Satori (next/og's renderer) only supports flexbox,
  // NOT CSS Grid. The previous version used `display: 'grid'` which
  // threw at render time → the entire OG handler returned 504. Now
  // split into 3 flex rows of 3 tiles each.
  const tiles: { label: string; sub: string; tone: string }[] = [
    { label: 'Cycle Phase',       sub: 'composite signal', tone: PUMP },
    { label: 'Crowdedness',       sub: 'positioning extremes', tone: ACCENT },
    { label: 'Funding Predictor', sub: 'next-window rate', tone: ACCENT },
    { label: 'CME Basis',         sub: 'futures vs spot', tone: PUMP },
    { label: 'ETF Flows',         sub: 'daily inflows', tone: ACCENT },
    { label: 'Skew',              sub: 'put-call IV per expiry', tone: '#a78bfa' },
    { label: 'Hash Ribbons',      sub: 'miner capitulation', tone: PUMP },
    { label: 'Memecoin Radar',    sub: 'Solana 1h velocity', tone: '#fb923c' },
    { label: 'Trade Optimizer',   sub: 'cheapest venue', tone: PUMP },
  ];
  // Chunk into rows of 3
  const rows: typeof tiles[] = [tiles.slice(0, 3), tiles.slice(3, 6), tiles.slice(6, 9)];
  const Tile = ({ t }: { t: typeof tiles[number] }) => (
    <div
      style={{
        flex: 1,
        display: 'flex', flexDirection: 'column',
        padding: '14px 12px',
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${t.tone}40`,
        borderRadius: 10,
        gap: 4,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 800, color: '#fafafa', display: 'flex' }}>{t.label}</div>
      <div style={{ fontSize: 10, color: t.tone, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700, display: 'flex' }}>{t.sub}</div>
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Use "NEW" pill instead of ✨ emoji — Satori's bundled font
            subset doesn't have the emoji glyph and the route fell back
            to a tofu box. */}
        <span style={{
          fontSize: 10, fontWeight: 800, color: ACCENT,
          padding: '3px 8px', borderRadius: 4,
          background: `${ACCENT}22`, letterSpacing: 1.4,
          textTransform: 'uppercase', display: 'flex',
        }}>NEW</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#fafafa', textTransform: 'uppercase', letterSpacing: 1.4, display: 'flex' }}>
          Now shipping
        </span>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)', display: 'flex' }} />
      </div>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'flex', gap: 8 }}>
          {row.map(t => <Tile key={t.label} t={t} />)}
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
        <span style={{ fontSize: 10, color: '#737373', fontFamily: 'ui-monospace, monospace', display: 'flex' }}>
          + 21 more new tools · /changelog
        </span>
      </div>
    </div>
  );
}

function PreviewByVariant({ variant }: { variant: Variant }) {
  switch (variant) {
    case 'liquidations': return <LiquidationsPreview />;
    case 'oi':           return <OIPreview />;
    case 'screener':     return <ScreenerPreview />;
    case 'news':         return <NewsPreview />;
    case 'heatmap':      return <HeatmapPreview />;
    case 'chart':        return <ChartPreview />;
    case 'donate':       return <DonatePreview />;
    case 'ratios':       return <RatiosPreview />;
    case 'etf':          return <ETFPreview />;
    case 'options':      return <OptionsPreview />;
    case 'changelog':    return <ChangelogPreview />;
    case 'funding':
    case 'default':
    default:             return <FundingPreview />;
  }
}

function badgesForVariant(variant: Variant): { label: string; color: string }[] {
  switch (variant) {
    case 'liquidations':
      return [{ label: 'Live Feed', color: REKT }, { label: `${ALL_EXCHANGES.length}+ Venues`, color: ACCENT }];
    case 'news':
      return [{ label: '21+ Sources', color: '#f59e0b' }, { label: 'Live', color: PUMP }];
    case 'donate':
      return [{ label: 'BTC · ETH · SOL · HYPE', color: '#f43f5e' }, { label: 'Day-One Perk', color: ACCENT }];
    case 'options':
      return [{ label: 'Deribit', color: '#a78bfa' }, { label: 'BTC + ETH', color: ACCENT }];
    case 'etf':
      return [{ label: 'BTC + ETH', color: ACCENT }, { label: 'Live', color: PUMP }];
    case 'heatmap':
      return [{ label: 'Top 100', color: ACCENT }, { label: 'Live', color: PUMP }];
    case 'changelog':
      return [{ label: '30 New Tools', color: ACCENT }, { label: 'All Free', color: PUMP }];
    default:
      return [{ label: `${ALL_EXCHANGES.length}+ Exchanges`, color: ACCENT }, { label: 'LIVE', color: PUMP }];
  }
}

// ────────────────────────────────────────────────────────────────────
// "Read the tape" hero variant — matches the May 2026 design refresh.
// Different from the other variants because it has its own logo+ticker
// header, headline split across two lines (with one orange word), and
// a stats footer — so it skips the standard 2-column chrome.
//
// Renders live market data when reachable, falls back to credible
// recent values when upstream is down (so the OG always renders, even
// during a venue outage).
// ────────────────────────────────────────────────────────────────────

interface LiveTickers {
  /** Symbol → { price, change24hPct } chosen from the highest-volume venue. */
  symbols: Record<string, { price: number; change24hPct: number } | undefined>;
  /** Aggregate 24h volume in USD across all venues. */
  totalVolume24h: number | null;
  /** Aggregate open interest in USD across all venues. */
  totalOpenInterest: number | null;
  /** Hourly-bucketed BTC funding rate series (last 24 hours). Each value
   *  is a fractional rate (0.0001 = 0.01%). 24 points or fewer if data
   *  is sparse. */
  btcFundingHourly: number[];
  /** Most recent BTC funding rate (fractional, e.g. 0.0001 = 0.01%). */
  btcFundingNow: number | null;
  /** ms-epoch when the data was rendered (for "as of HH:MM" stamp). */
  generatedAt: number;
}

const FALLBACK_TICKERS: LiveTickers = {
  symbols: {
    BTC:  { price: 80000,  change24hPct: 0.6 },
    ETH:  { price: 2300,   change24hPct: 0.4 },
    SOL:  { price: 93,     change24hPct: -0.1 },
    HYPE: { price: 42.5,   change24hPct: -2.3 },
  },
  totalVolume24h: 90_000_000_000,
  totalOpenInterest: 90_000_000_000,
  // Mild positive sloping shape — rendered when funding-history is
  // unreachable; matches the "+0.01%" fallback below.
  btcFundingHourly: [0.0001, 0.00012, 0.00008, 0.00015, 0.00009, 0.00013, 0.00011, 0.00014, 0.00010, 0.00012,
                     0.00009, 0.00011, 0.00013, 0.00015, 0.00012, 0.00014, 0.00010, 0.00013, 0.00015, 0.00012,
                     0.00014, 0.00016, 0.00013, 0.00015],
  btcFundingNow: 0.0001,
  generatedAt: 0,
};

/**
 * Pull live tickers + OI from the existing aggregator endpoints.
 * Wrapped in Promise.allSettled so a single venue blip doesn't fail
 * the whole render. Aggressive 5s timeout — OG must respond fast.
 */
async function fetchLiveTickers(baseUrl: string): Promise<LiveTickers> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const [tickersRes, oiRes, fundingHistRes, fundingNowRes] = await Promise.allSettled([
      fetch(`${baseUrl}/api/tickers?symbols=BTC,ETH,SOL,HYPE`, { signal: ctrl.signal, next: { revalidate: 60 } }),
      fetch(`${baseUrl}/api/openinterest`, { signal: ctrl.signal, next: { revalidate: 60 } }),
      fetch(`${baseUrl}/api/history/funding?symbol=BTC&hours=24`, { signal: ctrl.signal, next: { revalidate: 300 } }),
      fetch(`${baseUrl}/api/funding?symbol=BTC`, { signal: ctrl.signal, next: { revalidate: 60 } }),
    ]);
    clearTimeout(timer);

    const symbols: LiveTickers['symbols'] = { ...FALLBACK_TICKERS.symbols };
    let totalVolume: number | null = FALLBACK_TICKERS.totalVolume24h;
    let totalOI: number | null = FALLBACK_TICKERS.totalOpenInterest;
    let btcFundingHourly: number[] = FALLBACK_TICKERS.btcFundingHourly;
    let btcFundingNow: number | null = FALLBACK_TICKERS.btcFundingNow;

    if (tickersRes.status === 'fulfilled' && tickersRes.value.ok) {
      const json = await tickersRes.value.json();
      // Pick highest-volume entry per symbol. The aggregator returns
      // the same symbol from many venues — best signal is the one with
      // the most quoteVolume24h.
      const best = new Map<string, { price: number; change24hPct: number; vol: number }>();
      for (const t of (json.data ?? []) as Array<{ symbol: string; price: number; priceChangePercent24h: number; quoteVolume24h: number }>) {
        const sym = t.symbol?.toUpperCase();
        if (!sym || !['BTC', 'ETH', 'SOL', 'HYPE'].includes(sym)) continue;
        const px = Number(t.price);
        const ch = Number(t.priceChangePercent24h);
        const vol = Number(t.quoteVolume24h) || 0;
        if (!Number.isFinite(px) || px <= 0) continue;
        const prev = best.get(sym);
        if (!prev || vol > prev.vol) best.set(sym, { price: px, change24hPct: Number.isFinite(ch) ? ch : 0, vol });
      }
      best.forEach((v, sym) => {
        symbols[sym] = { price: v.price, change24hPct: v.change24hPct };
      });
      if (json.meta?.totalVolume && Number.isFinite(Number(json.meta.totalVolume))) {
        totalVolume = Number(json.meta.totalVolume);
      }
    }

    if (oiRes.status === 'fulfilled' && oiRes.value.ok) {
      const json = await oiRes.value.json();
      const sum = ((json.data ?? []) as Array<{ openInterestValue?: number }>)
        .reduce((acc, r) => acc + (Number(r.openInterestValue) || 0), 0);
      if (Number.isFinite(sum) && sum > 0) totalOI = sum;
    }

    // Funding history → bucket into 1-hour windows for the last 24 hours.
    // Endpoint returns ALL exchanges' rates as flat points {t, rate}.
    // Average within each bucket so multiple venues don't double-count.
    if (fundingHistRes.status === 'fulfilled' && fundingHistRes.value.ok) {
      const json = await fundingHistRes.value.json();
      const points = (json.points ?? []) as Array<{ t: number; rate: number }>;
      const now = Date.now();
      const cutoff = now - 24 * 3600_000;
      const buckets = new Map<number, { sum: number; n: number }>();
      for (const p of points) {
        const t = Number(p.t);
        const r = Number(p.rate);
        if (!Number.isFinite(t) || !Number.isFinite(r) || t < cutoff) continue;
        const hour = Math.floor(t / 3600_000); // hour-of-epoch
        const cur = buckets.get(hour) ?? { sum: 0, n: 0 };
        cur.sum += r;
        cur.n += 1;
        buckets.set(hour, cur);
      }
      if (buckets.size >= 3) {
        const sortedHours = Array.from(buckets.keys()).sort((a, b) => a - b);
        btcFundingHourly = sortedHours.map(h => {
          const b = buckets.get(h)!;
          return b.sum / b.n;
        });
      }
    }

    // Current funding rate — average across exchanges.
    if (fundingNowRes.status === 'fulfilled' && fundingNowRes.value.ok) {
      const json = await fundingNowRes.value.json();
      const btcRows = ((json.data ?? []) as Array<{ symbol: string; fundingRate: number }>)
        .filter(r => r.symbol === 'BTC' && Number.isFinite(Number(r.fundingRate)));
      if (btcRows.length > 0) {
        const avg = btcRows.reduce((s, r) => s + Number(r.fundingRate), 0) / btcRows.length;
        if (Number.isFinite(avg)) btcFundingNow = avg;
      }
    }

    return {
      symbols,
      totalVolume24h: totalVolume,
      totalOpenInterest: totalOI,
      btcFundingHourly,
      btcFundingNow,
      generatedAt: Date.now(),
    };
  } catch {
    clearTimeout(timer);
    return { ...FALLBACK_TICKERS, generatedAt: Date.now() };
  }
}

/** Compact USD formatter for OG card — "$112,842" / "$4,221" / "$38.21". */
function fmtPrice(v: number): string {
  if (!Number.isFinite(v)) return '—';
  if (v >= 1000) return `$${Math.round(v).toLocaleString('en-US')}`;
  if (v >= 100) return `$${v.toFixed(2)}`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  if (v >= 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toPrecision(3)}`;
}
function fmtBig(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${Math.round(v)}`;
}
function fmtDelta(v: number): string {
  if (!Number.isFinite(v)) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

function TapeFundingCard({ live }: { live: LiveTickers }) {
  // Card on the right side: FUNDING · 8H header with LIVE pulse,
  // 4 perp rows (BTC/ETH/SOL/HYPE) populated from live data, and a
  // sparkline footer for BTC 1H.
  const meta = [
    { sym: 'BTC',  full: 'BITCOIN',     bg: '#f7931a', fg: '#fff' },
    { sym: 'ETH',  full: 'ETHEREUM',    bg: '#627eea', fg: '#fff' },
    { sym: 'SOL',  full: 'SOLANA',      bg: '#9945ff', fg: '#fff' },
    { sym: 'HYPE', full: 'HYPERLIQUID', bg: '#50d2c1', fg: '#000', hot: true },
  ];
  const rows = meta.map(m => {
    const t = live.symbols[m.sym] ?? FALLBACK_TICKERS.symbols[m.sym]!;
    return {
      ...m,
      price: fmtPrice(t.price),
      // Always 2-decimal % so the column is visually consistent with
      // the chips above the headline (no mix of "+0.6" and "-2.34").
      delta: fmtDelta(t.change24hPct),
      up: t.change24hPct >= 0,
    };
  });
  // BTC funding sparkline — real hourly buckets from the last 24 hours.
  // Filter to finite numbers (defensive — upstream sometimes returns
  // sparse rows) and keep the natural sign so up = funding paid by
  // longs, down = funding paid by shorts.
  const sparkRaw = (live.btcFundingHourly.length >= 3 ? live.btcFundingHourly : FALLBACK_TICKERS.btcFundingHourly)
    .filter(Number.isFinite);
  const spark = sparkRaw.length >= 3 ? sparkRaw : FALLBACK_TICKERS.btcFundingHourly;
  // Whether the trailing rate is positive (color the line green) or
  // negative (red). Use the latest known value, fall back to spark trend.
  const fundingNow = live.btcFundingNow ?? spark[spark.length - 1] ?? 0;
  const fundingPositive = fundingNow >= 0;
  const w = 540;
  const h = 56;
  const pad = 6;
  const max = Math.max(...spark);
  const min = Math.min(...spark);
  const stepX = (w - 2 * pad) / (spark.length - 1);
  const points = spark.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (h - 2 * pad) * (1 - (v - min) / Math.max(1, max - min));
    return [x, y] as const;
  });
  const path = points.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(' ');
  const fill = `${path} L${points[points.length - 1][0]},${h - pad} L${points[0][0]},${h - pad} Z`;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', width: '100%',
      borderRadius: 16, overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(12,14,18,0.92)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ width: 3, height: 16, background: ACCENT, borderRadius: 2, marginRight: 10, display: 'flex' }} />
        <span style={{ fontSize: 12, fontWeight: 800, color: '#fafafa', textTransform: 'uppercase', letterSpacing: 1.6 }}>
          FUNDING · 8H
        </span>
        <div style={{ flex: 1, display: 'flex' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: PUMP, display: 'flex' }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: PUMP, textTransform: 'uppercase', letterSpacing: 1.2 }}>STREAM</span>
        </div>
      </div>

      {/* Rows */}
      {rows.map((r, i) => (
        <div key={r.sym} style={{
          display: 'flex', alignItems: 'center',
          padding: '14px 20px',
          borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
          background: r.hot ? 'rgba(80,210,193,0.05)' : 'transparent',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: r.bg, color: r.fg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginRight: 14, fontSize: 13, fontWeight: 900,
          }}>
            {r.sym.slice(0, 1)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: r.hot ? '#50d2c1' : '#fafafa' }}>{r.sym}-PERP</span>
              {/* "HOT" pill instead of a ▲ glyph — the triangle wasn't in
                  the Inter subset Satori embeds and fell back to a tofu
                  box in the rendered PNG. Pill is a deterministic shape. */}
              {r.hot && (
                <span style={{
                  fontSize: 9, fontWeight: 800, color: ACCENT,
                  padding: '2px 6px', borderRadius: 4,
                  background: `${ACCENT}22`, letterSpacing: 0.8,
                  display: 'flex',
                }}>HOT</span>
              )}
            </div>
            <span style={{ fontSize: 10, color: '#525252', fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 1 }}>
              {r.full}
            </span>
          </div>
          <div style={{ flex: 1, display: 'flex' }} />
          <span style={{ fontSize: 18, fontWeight: 800, color: '#fafafa', fontFamily: 'monospace', marginRight: 14 }}>
            {r.price}
          </span>
          <span style={{
            fontSize: 12, fontWeight: 700, color: r.up ? PUMP : REKT, fontFamily: 'monospace',
            minWidth: 38, display: 'flex', justifyContent: 'flex-end',
          }}>
            {r.delta}
          </span>
        </div>
      ))}

      {/* Sparkline footer */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        padding: '12px 20px 14px',
        background: 'rgba(255,255,255,0.015)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: 1.2 }}>
            BTC · 24H FUNDING
          </span>
          <div style={{ flex: 1, display: 'flex' }} />
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: fundingPositive ? PUMP : REKT,
            fontFamily: 'monospace',
          }}>
            {fundingNow >= 0 ? '+' : ''}{(fundingNow * 100).toFixed(4)}%
          </span>
        </div>
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'flex' }}>
          <defs>
            <linearGradient id="tapeFundingFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={fundingPositive ? PUMP : REKT} stopOpacity="0.35" />
              <stop offset="100%" stopColor={fundingPositive ? PUMP : REKT} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={fill} fill="url(#tapeFundingFill)" />
          <path
            d={path}
            fill="none"
            stroke={fundingPositive ? PUMP : REKT}
            strokeWidth={1.6}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}

function renderTapeImage(live: LiveTickers) {
  // Live ticker chips for the LEFT column — pulled fresh from the
  // aggregator at request time, with credible fallbacks if a venue blip
  // takes upstream offline. Cloudflare's 5-min cache below means the
  // image refreshes regularly even though OG consumers (Twitter/Slack)
  // cache per-URL much longer.
  const btc = live.symbols.BTC ?? FALLBACK_TICKERS.symbols.BTC!;
  const eth = live.symbols.ETH ?? FALLBACK_TICKERS.symbols.ETH!;
  const hype = live.symbols.HYPE ?? FALLBACK_TICKERS.symbols.HYPE!;
  const tickers = [
    { sym: 'BTC',  px: fmtPrice(btc.price),  delta: fmtDelta(btc.change24hPct),  up: btc.change24hPct >= 0 },
    { sym: 'ETH',  px: fmtPrice(eth.price),  delta: fmtDelta(eth.change24hPct),  up: eth.change24hPct >= 0 },
    { sym: 'HYPE', px: fmtPrice(hype.price), delta: fmtDelta(hype.change24hPct), up: hype.change24hPct >= 0, glow: true },
  ];
  const stats = [
    { label: '24H VOL',       value: fmtBig(live.totalVolume24h),     tone: '#fafafa' },
    { label: 'OPEN INTEREST', value: fmtBig(live.totalOpenInterest),  tone: '#fafafa' },
    { label: 'VENUES',        value: `${ALL_EXCHANGES.length}`,        tone: PUMP },
    { label: 'INFOHUB.IO',    value: '→',                              tone: ACCENT, isLink: true },
  ];
  // "AS OF HH:MM UTC" — small freshness stamp so viewers can tell the
  // image is real data not just a marketing render.
  const ts = live.generatedAt > 0 ? new Date(live.generatedAt) : new Date();
  const hh = String(ts.getUTCHours()).padStart(2, '0');
  const mm = String(ts.getUTCMinutes()).padStart(2, '0');
  const asOfStamp = `${hh}:${mm} UTC`;

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: '#070809',
      fontFamily: 'Inter, system-ui, sans-serif',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Ambient glows */}
      <div style={{ position: 'absolute', top: -180, left: -100, width: 700, height: 700, borderRadius: '50%', background: `radial-gradient(circle, ${ACCENT}1c 0%, transparent 65%)`, display: 'flex' }} />
      <div style={{ position: 'absolute', bottom: -100, right: 50, width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(80,210,193,0.10) 0%, transparent 60%)', display: 'flex' }} />

      {/* Top accent strip */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${ACCENT}, ${ACCENT_DARK}, ${ACCENT}, transparent)`, display: 'flex' }} />

      <div style={{ display: 'flex', flex: 1, padding: '40px 48px 32px' }}>
        {/* ── LEFT column ───────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', width: 580, paddingRight: 32 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
            <span style={{ fontSize: 38, fontWeight: 900, color: '#fff', letterSpacing: -1.5, lineHeight: 1 }}>Info</span>
            <span style={{
              fontSize: 38, fontWeight: 900,
              color: '#000', letterSpacing: -1.5, lineHeight: 1,
              background: `linear-gradient(135deg, #FFB800, ${ACCENT}, ${ACCENT_DARK})`,
              padding: '3px 10px', borderRadius: 8, marginLeft: 2,
            }}>hub</span>
          </div>

          {/* Live tickers row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: ACCENT, display: 'flex' }} />
              <span style={{ fontSize: 12, fontWeight: 800, color: ACCENT, letterSpacing: 1.4, textTransform: 'uppercase' }}>LIVE</span>
            </div>
            <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.12)', display: 'flex' }} />
            {tickers.slice(0, 2).map(t => (
              <div key={t.sym} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#fafafa', letterSpacing: 0.4 }}>{t.sym}</span>
                <span style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: '#fafafa' }}>{t.px}</span>
                <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: t.up ? PUMP : REKT }}>{t.delta}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
            {tickers.slice(2).map(t => (
              <div key={t.sym} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontSize: 13, fontWeight: 800, color: t.glow ? '#50d2c1' : '#fafafa', letterSpacing: 0.4,
                }}>{t.sym}</span>
                <span style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: '#fafafa' }}>{t.px}</span>
                <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: t.up ? PUMP : REKT }}>{t.delta}</span>
              </div>
            ))}
          </div>

          {/* Headline (two lines, "tape" in orange). Padding-right on
              the "the" gives reliable spacing — trailing whitespace in
              JSX gets collapsed by Satori's flex layout, which was
              previously rendering as "thetape" jammed together. */}
          <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 22 }}>
            <span style={{ fontSize: 92, fontWeight: 900, color: '#fafafa', letterSpacing: -4, lineHeight: 0.95, display: 'flex' }}>
              Read
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline' }}>
              <span style={{ fontSize: 92, fontWeight: 900, color: '#fafafa', letterSpacing: -4, lineHeight: 0.95, paddingRight: 22, display: 'flex' }}>the</span>
              <span style={{
                fontSize: 92, fontWeight: 900, letterSpacing: -4, lineHeight: 0.95,
                background: `linear-gradient(135deg, #FFB800, ${ACCENT})`,
                backgroundClip: 'text',
                color: 'transparent',
                display: 'flex',
              }}>tape</span>
              <span style={{ fontSize: 92, fontWeight: 900, color: ACCENT, letterSpacing: -4, lineHeight: 0.95, display: 'flex' }}>.</span>
            </div>
          </div>

          {/* Subtitle */}
          <div style={{ fontSize: 18, color: '#9ca3af', lineHeight: 1.5, maxWidth: 480, display: 'flex' }}>
            Funding, OI &amp; liquidations from {ALL_EXCHANGES.length} venues — wired to one live data bus.
          </div>
        </div>

        {/* ── RIGHT column ──────────────────────────────────────────── */}
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <TapeFundingCard live={live} />
        </div>
      </div>

      {/* ── Bottom stats strip ────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '0 48px 28px', gap: 32,
      }}>
        {stats.map((s) => (
          <div key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{
              fontSize: s.isLink ? 24 : 28, fontWeight: 900, color: s.tone,
              letterSpacing: -0.5, lineHeight: 1,
            }}>
              {s.value}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 700, color: '#525252',
              letterSpacing: 1.2, textTransform: 'uppercase',
            }}>
              {s.label}
            </span>
          </div>
        ))}
        <div style={{ flex: 1, display: 'flex' }} />
        {/* "as of HH:MM UTC" freshness stamp — anchored bottom-right of
            the stats strip. Lets viewers see how stale the cached image is. */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, color: '#525252',
            letterSpacing: 1.2, textTransform: 'uppercase', fontFamily: 'monospace',
          }}>
            AS OF {asOfStamp}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: PUMP, display: 'flex' }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: PUMP, letterSpacing: 1 }}>LIVE FEED</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Main handler
// ────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const title = (searchParams.get('title') || 'Real-Time Derivatives Data').slice(0, 100);
  const description = (searchParams.get('desc') || `Funding Rates · Open Interest · Liquidations · ${ALL_EXCHANGES.length}+ Exchanges`).slice(0, 200);
  const variant = ((searchParams.get('v') || 'default').toLowerCase()) as Variant;

  // "tape" is the live-data hero — only /home opts in via its
  // PAGE_META.ogVariant. Every other page (including 'default' fallback)
  // renders the standard 2-column chrome below, which respects the
  // per-page title + description the caller passed in. Previously
  // 'default' also rendered the hero, which meant every page that
  // didn't have an explicit variant got the same "Read the tape"
  // headline regardless of what the page was actually about.
  if (variant === 'tape') {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${request.headers.get('host')}`;
    const live = await fetchLiveTickers(baseUrl);
    const img = new ImageResponse(renderTapeImage(live), { width: 1200, height: 630 });
    // ImageResponse sets a 1-year `Cache-Control: public, immutable,
    // no-transform, max-age=31536000` by default. The `headers` option
    // APPENDS instead of replacing, which produces a malformed header
    // with TWO `max-age` values — clients use the first one (1 year)
    // and ignore our 5-min override. Fix by deleting the default header
    // off the response before setting our own.
    img.headers.delete('Cache-Control');
    img.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=900');
    return img;
  }

  const badges = badgesForVariant(variant);

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        background: '#070809',
        fontFamily: 'Inter, system-ui, sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Ambient glows */}
        <div style={{ position: 'absolute', top: -120, left: 60, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,140,0,0.13) 0%, transparent 65%)', display: 'flex' }} />
        <div style={{ position: 'absolute', bottom: -80, right: 100, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,197,94,0.08) 0%, transparent 65%)', display: 'flex' }} />
        <div style={{ position: 'absolute', top: 200, right: -50, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(239,68,68,0.06) 0%, transparent 65%)', display: 'flex' }} />

        {/* Top accent strip */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${ACCENT}, ${ACCENT_DARK}, ${ACCENT}, transparent)`, display: 'flex' }} />

        <div style={{ display: 'flex', flex: 1, padding: '52px 56px 64px' }}>
          {/* ── Left: text ── */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', width: 520, paddingRight: 40 }}>
            {/* Logo — matches the in-app wordmark exactly so social
                previews feel like part of the product. */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32 }}>
              <span style={{ fontSize: 42, fontWeight: 900, color: '#fff', letterSpacing: -1.6, lineHeight: 1, display: 'flex' }}>Info</span>
              <span style={{
                fontSize: 42, fontWeight: 900,
                color: '#000', letterSpacing: -1.6, lineHeight: 1,
                background: `linear-gradient(135deg, #FFB800, ${ACCENT}, ${ACCENT_DARK})`,
                padding: '3px 9px', borderRadius: 7, marginLeft: 2,
                display: 'flex',
              }}>hub</span>
            </div>

            {/* Title — bigger than before (was 42px, now 56px) so it
                actually reads at Twitter-card thumbnail size where the
                whole image renders at ~600×314. Letter-spacing tight
                for the bold display feel. */}
            <div style={{ fontSize: 56, fontWeight: 800, color: '#fafafa', lineHeight: 1.02, letterSpacing: -2.2, marginBottom: 20, display: 'flex' }}>
              {title}
            </div>

            {/* Description — neutral grey, generous line-height. */}
            <div style={{ fontSize: 20, color: '#9ca3af', lineHeight: 1.5, marginBottom: 30, display: 'flex' }}>
              {description}
            </div>

            {/* Badges */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {badges.map((b, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 100,
                  background: `${b.color}1c`,
                  border: `1px solid ${b.color}55`,
                }}>
                  {(b.label === 'LIVE' || b.label === 'Live') && (
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: b.color, display: 'flex' }} />
                  )}
                  <span style={{ fontSize: 14, fontWeight: 700, color: b.color, letterSpacing: 0.3 }}>{b.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: variant preview ── */}
          <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <PreviewByVariant variant={variant} />
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 48px 20px', position: 'absolute', bottom: 0, left: 0, right: 0 }}>
          <span style={{ fontSize: 15, color: '#525252', fontWeight: 600, letterSpacing: 0.5 }}>info-hub.io</span>
          <span style={{ fontSize: 12, color: '#3a3a3a', fontFamily: 'monospace' }}>CEX · DEX · Crypto · Stocks · Forex · Commodities</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
