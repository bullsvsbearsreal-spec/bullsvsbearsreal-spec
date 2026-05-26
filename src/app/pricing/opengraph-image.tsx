/**
 * /pricing OG image — surfaces the 4-tier ladder for Twitter/Telegram shares.
 *
 * Same Edge-runtime + no-external-assets pattern as the root OG image.
 * Pulls tier prices from the source of truth (lib/constants/tiers) so the
 * social card stays in sync if pricing rotates.
 */

import { ImageResponse } from 'next/og';
import { TIER_PRICE_MONTHLY, TIER_BRANDING } from '@/lib/constants/tiers';

export const runtime = 'edge';
export const alt = 'InfoHub pricing — Free / Trader / Pro / Whale';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const TIER_COLORS: Record<string, string> = {
  free: '#a3a3a3',
  trader: '#7dd3fc',     // sky-300
  pro: '#34d399',        // emerald-400
  whale: '#fbbf24',      // amber-400
};

export default async function OgImage() {
  const tiers = (['free', 'trader', 'pro', 'whale'] as const).map((t) => ({
    key: t,
    label: TIER_BRANDING[t].label,
    price: TIER_PRICE_MONTHLY[t],
    color: TIER_COLORS[t],
  }));

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
        {/* Gradient mesh */}
        <div
          style={{
            position: 'absolute', top: -200, right: -200,
            width: 800, height: 800, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)',
          }}
        />

        {/* Top bar — brand + page */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, zIndex: 1, marginBottom: 'auto' }}>
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
          <div style={{ fontSize: 20, fontWeight: 700 }}>InfoHub Pricing</div>
        </div>

        {/* Headline */}
        <div style={{ display: 'flex', flexDirection: 'column', zIndex: 1, marginTop: 30, marginBottom: 40 }}>
          <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>
            Pick your tier
          </div>
          <div style={{ fontSize: 22, color: '#a3a3a3', marginTop: 14 }}>
            Free during launch · 4 tiers · annual saves 17%
          </div>
        </div>

        {/* 4-tier cards */}
        <div style={{ display: 'flex', gap: 16, zIndex: 1 }}>
          {tiers.map((t) => {
            const isPopular = t.key === 'pro';
            return (
              <div
                key={t.key}
                style={{
                  flex: 1,
                  padding: '20px 18px',
                  borderRadius: 14,
                  background: isPopular ? `${t.color}14` : 'rgba(255,255,255,0.03)',
                  border: `2px solid ${isPopular ? `${t.color}80` : 'rgba(255,255,255,0.08)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                }}
              >
                {isPopular && (
                  <div
                    style={{
                      position: 'absolute', top: -10, left: 18,
                      fontSize: 9, fontWeight: 800,
                      letterSpacing: '0.15em', textTransform: 'uppercase',
                      padding: '4px 8px', borderRadius: 6,
                      background: '#10b981', color: '#0a0a0a',
                    }}
                  >
                    Popular
                  </div>
                )}
                <div style={{ fontSize: 14, fontWeight: 700, color: t.color, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {t.label}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 14 }}>
                  <div style={{ fontSize: 44, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
                    ${t.price}
                  </div>
                  <div style={{ fontSize: 14, color: '#737373' }}>{t.price === 0 ? 'forever' : '/mo'}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer line */}
        <div style={{ marginTop: 30, fontSize: 14, color: '#737373', display: 'flex', alignItems: 'center', gap: 8 }}>
          info-hub.io/pricing · USDT checkout · Cancel anytime
        </div>
      </div>
    ),
    { ...size },
  );
}
