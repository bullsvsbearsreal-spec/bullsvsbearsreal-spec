/**
 * Root OG image — info-hub.io/ shares.
 *
 * Auto-generated 1200×630 image via next/og. Fires on every share to
 * Twitter, Telegram, Slack, etc. NO external images / fonts — keeps the
 * Edge runtime fast + reliable. Live numbers (exchange count) come from
 * the build-time constant; no runtime data fetch on the OG path to keep
 * Twitter's ~5s timeout happy.
 *
 * To preview locally: visit /opengraph-image directly in dev.
 */

import { ImageResponse } from 'next/og';
import { ALL_EXCHANGES } from '@/lib/constants/exchanges';

export const runtime = 'nodejs';
export const alt = 'InfoHub — crypto derivatives terminal';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#0a0a0a',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 60,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: '#fff',
          position: 'relative',
        }}
      >
        {/* Gradient mesh */}
        <div
          style={{
            position: 'absolute', top: -200, right: -200,
            width: 800, height: 800, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16,185,129,0.18) 0%, transparent 70%)',
          }}
        />
        <div
          style={{
            position: 'absolute', bottom: -250, left: -150,
            width: 700, height: 700, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(245,166,35,0.12) 0%, transparent 70%)',
          }}
        />

        {/* Brand mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, zIndex: 1 }}>
          <div
            style={{
              width: 56, height: 56, borderRadius: 14,
              background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 36, fontWeight: 900,
              color: '#0a0a0a',
            }}
          >
            ◆
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em' }}>InfoHub</div>
            <div style={{ fontSize: 13, color: '#a3a3a3', letterSpacing: '0.1em', textTransform: 'uppercase' }}>info-hub.io</div>
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: 'flex', flexDirection: 'column', zIndex: 1, gap: 14 }}>
          <div
            style={{
              fontSize: 78, fontWeight: 800,
              letterSpacing: '-0.03em', lineHeight: 1.05,
              maxWidth: 1000,
            }}
          >
            Crypto derivatives terminal,{' '}
            <span style={{ background: 'linear-gradient(135deg, #34d399 0%, #fbbf24 100%)', backgroundClip: 'text', color: 'transparent' }}>
              free
            </span>.
          </div>
          <div style={{ fontSize: 26, color: '#d4d4d4', lineHeight: 1.4, maxWidth: 900 }}>
            Funding rates · Open Interest · Liquidations · Spreads ·{' '}
            Whale trades · Real-time alerts across {ALL_EXCHANGES.length} exchanges.
          </div>
        </div>

        {/* Footer chip row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, zIndex: 1 }}>
          <Chip label={`${ALL_EXCHANGES.length} exchanges`} color="#34d399" />
          <Chip label="$12 Pro / $59 Whale" color="#fbbf24" />
          <Chip label="20% lifetime affiliate" color="#60a5fa" />
          <div style={{ marginLeft: 'auto', fontSize: 14, color: '#737373' }}>
            Free during launch · No card required
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
        background: `${color}1A`,           // 10% alpha
        border: `1px solid ${color}40`,     // 25% alpha
        color,
        fontSize: 16,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {label}
    </div>
  );
}
