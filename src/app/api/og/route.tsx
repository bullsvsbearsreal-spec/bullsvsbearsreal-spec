import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { ALL_EXCHANGES } from '@/lib/constants';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const title = (searchParams.get('title') || 'Real-Time Derivatives Data').slice(0, 100);
  const description = (searchParams.get('desc') || `Funding Rates · Open Interest · Liquidations · ${ALL_EXCHANGES.length}+ Exchanges`).slice(0, 200);

  // Heatmap cell data — realistic funding rates
  const rows = [
    { sym: 'BTC',  vals: [ 0.0043, -0.0045,  0.0079,  0.0012, -0.0031,  0.0058] },
    { sym: 'ETH',  vals: [ 0.0053,  0.0032,  0.0014, -0.0067,  0.0041, -0.0019] },
    { sym: 'SOL',  vals: [-0.0089, -0.0038, -0.0085,  0.0023, -0.0056,  0.0011] },
    { sym: 'XRP',  vals: [ 0.0074,  0.0034, -0.0040,  0.0015,  0.0062, -0.0028] },
    { sym: 'DOGE', vals: [ 0.0100,  0.0064,  0.0000, -0.0051,  0.0033,  0.0072] },
    { sym: 'BNB',  vals: [-0.0016,  0.0048,  0.0091, -0.0035,  0.0027,  0.0063] },
  ];

  const cellColor = (r: number) => {
    const a = Math.min(Math.abs(r), 0.01);
    const t = a / 0.01;
    if (r > 0) return `rgba(16, 185, 129, ${(0.2 + t * 0.6).toFixed(2)})`;
    if (r < 0) return `rgba(244, 63, 94, ${(0.2 + t * 0.6).toFixed(2)})`;
    return 'rgba(255,255,255,0.06)';
  };

  const textColor = (r: number) => {
    if (r > 0) return '#6ee7b7';
    if (r < 0) return '#fda4af';
    return '#a3a3a3';
  };

  const fmt = (r: number) => `${r >= 0 ? '+' : ''}${(r * 100).toFixed(3)}%`;

  const exNames = ['Binance', 'Bybit', 'OKX', 'Bitget', 'MEXC', 'BingX'];

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#080808',
          fontFamily: 'Inter, system-ui, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Ambient glow effects */}
        <div style={{ position: 'absolute', top: '-120px', left: '60px', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,140,0,0.12) 0%, transparent 65%)', display: 'flex' }} />
        <div style={{ position: 'absolute', bottom: '-80px', right: '100px', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 65%)', display: 'flex' }} />
        <div style={{ position: 'absolute', top: '200px', right: '-50px', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(244,63,94,0.06) 0%, transparent 65%)', display: 'flex' }} />

        {/* Top gradient accent */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, transparent, #FFB800, #FF8C00, #E06600, #FF8C00, transparent)', display: 'flex' }} />

        {/* Main layout: left side text, right side heatmap */}
        <div style={{ display: 'flex', flex: 1, padding: '48px' }}>
          {/* Left column — branding + text */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '420px', paddingRight: '40px' }}>
            {/* Logo — matches src/components/Logo.tsx */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '28px' }}>
              <span style={{ fontSize: '52px', fontWeight: 900, color: '#ffffff', letterSpacing: '-2px', lineHeight: 1 }}>Info</span>
              <span style={{
                fontSize: '52px',
                fontWeight: 900,
                color: '#000000',
                letterSpacing: '-2px',
                lineHeight: 1,
                background: 'linear-gradient(135deg, #FFB800, #FF8C00, #E06600)',
                padding: '4px 10px',
                borderRadius: '8px',
                marginLeft: '2px',
              }}>Hub</span>
            </div>

            {/* Title */}
            <div style={{ fontSize: '42px', fontWeight: 800, color: '#ffffff', lineHeight: 1.05, letterSpacing: '-1.5px', marginBottom: '16px' }}>
              {title}
            </div>

            {/* Description */}
            <div style={{ fontSize: '18px', color: '#737373', lineHeight: 1.5, marginBottom: '32px' }}>
              {description}
            </div>

            {/* Stats pills */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '100px', background: 'rgba(255,140,0,0.1)', border: '1px solid rgba(255,140,0,0.25)' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#FFA500' }}>{ALL_EXCHANGES.length}+ Exchanges</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '100px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e', display: 'flex' }} />
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#22c55e' }}>LIVE</span>
              </div>
            </div>
          </div>

          {/* Right column — heatmap */}
          <div style={{ display: 'flex', flex: 1, alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
              {/* Header */}
              <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.025)' }}>
                <div style={{ width: '72px', padding: '12px 14px', fontSize: '10px', fontWeight: 700, color: '#404040', textTransform: 'uppercase' as const, letterSpacing: '0.8px', display: 'flex' }}>
                  Pair
                </div>
                {exNames.map((n) => (
                  <div key={n} style={{ flex: 1, padding: '12px 2px', fontSize: '10px', fontWeight: 600, color: '#404040', display: 'flex', justifyContent: 'center' }}>
                    {n}
                  </div>
                ))}
              </div>

              {/* Rows */}
              {rows.map((row) => (
                <div key={row.sym} style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ width: '72px', padding: '0 14px', display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '15px', fontWeight: 800, color: '#e5e5e5' }}>{row.sym}</span>
                  </div>
                  {row.vals.map((v, i) => (
                    <div key={i} style={{ flex: 1, padding: '5px 3px', display: 'flex', justifyContent: 'center' }}>
                      <div style={{
                        width: '100%',
                        padding: '10px 2px',
                        borderRadius: '6px',
                        background: cellColor(v),
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: textColor(v), fontFamily: 'monospace' }}>
                          {fmt(v)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 48px 20px', position: 'absolute', bottom: 0, left: 0, right: 0 }}>
          <span style={{ fontSize: '15px', color: '#404040', fontWeight: 500, letterSpacing: '0.5px' }}>info-hub.io</span>
          <span style={{ fontSize: '13px', color: '#2a2a2a' }}>CEX + DEX · Crypto · Stocks · Forex · Commodities</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
