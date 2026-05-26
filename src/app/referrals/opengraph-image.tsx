/**
 * /referrals OG image — surfaces the 20% lifetime affiliate program.
 *
 * Optimised for ambassadors / creators to share — clear pitch in 5 seconds.
 */

import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'InfoHub affiliate — 20% lifetime · USDT payouts';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%',
          background: '#0a0a0a',
          display: 'flex', flexDirection: 'column',
          padding: 60,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: '#fff',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute', bottom: -300, right: -200,
            width: 900, height: 900, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16,185,129,0.16) 0%, transparent 70%)',
          }}
        />

        {/* Top */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, zIndex: 1 }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 900, color: '#0a0a0a',
            }}
          >
            ◆
          </div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>InfoHub · Affiliate Program</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', zIndex: 1, marginTop: 'auto', gap: 24 }}>
          {/* Big number */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <div
              style={{
                fontSize: 200, fontWeight: 900, letterSpacing: '-0.05em', lineHeight: 0.9,
                background: 'linear-gradient(135deg, #34d399 0%, #fbbf24 100%)',
                backgroundClip: 'text', color: 'transparent',
              }}
            >
              20%
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 32, fontWeight: 700 }}>recurring</div>
              <div style={{ fontSize: 32, fontWeight: 700 }}>lifetime</div>
            </div>
          </div>

          {/* Subline */}
          <div style={{ fontSize: 26, color: '#d4d4d4', lineHeight: 1.4, maxWidth: 1000 }}>
            Share InfoHub. Every paid signup earns you 20% of their subscription{' '}
            <strong style={{ color: '#34d399' }}>forever</strong>.{' '}
            Paid in USDT to your wallet.
          </div>
        </div>

        {/* Footer chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, zIndex: 1, marginTop: 24 }}>
          <Chip label="60-day cookie" color="#7dd3fc" />
          <Chip label="$25 min payout" color="#34d399" />
          <Chip label="10% off referrals" color="#fbbf24" />
          <div style={{ marginLeft: 'auto', fontSize: 14, color: '#737373' }}>
            info-hub.io/referrals
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <div
      style={{
        padding: '8px 16px',
        borderRadius: 999,
        background: `${color}1A`,
        border: `1px solid ${color}40`,
        color,
        fontSize: 16,
        fontWeight: 600,
      }}
    >
      {label}
    </div>
  );
}
