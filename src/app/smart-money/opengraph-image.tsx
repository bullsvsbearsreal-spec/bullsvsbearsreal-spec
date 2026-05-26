/** /smart-money OG image */
import { ImageResponse } from 'next/og';
import { OG_SIZE, OG_CONTENT_TYPE, ogFrame, ogBrandMark, ogChip } from '@/lib/og-shared';

export const runtime = 'nodejs';
export const alt = 'InfoHub Smart Money — proven alpha leaderboard';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function OgImage() {
  return new ImageResponse(
    ogFrame({
      accent: 'amber',
      children: (
        <>
          {ogBrandMark({ subtitle: 'Smart money' })}
          <div style={{ display: 'flex', flexDirection: 'column', zIndex: 1, marginTop: 'auto', gap: 18 }}>
            <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.04 }}>
              Follow{' '}
              <span style={{ background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)', backgroundClip: 'text', color: 'transparent' }}>
                proven
              </span>{' '}
              alpha.
            </div>
            <div style={{ fontSize: 24, color: '#d4d4d4', lineHeight: 1.4, maxWidth: 1000 }}>
              Traders with real size, real PnL, real win rates. Their live positions, their bias, in one feed.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, zIndex: 1, marginTop: 30, alignItems: 'center' }}>
            {ogChip({ label: 'GMX + Hyperliquid', color: '#fbbf24' })}
            {ogChip({ label: '>$10M lifetime volume', color: '#34d399' })}
            {ogChip({ label: '>55% win rate', color: '#7dd3fc' })}
            <div style={{ marginLeft: 'auto', fontSize: 14, color: '#737373' }}>
              info-hub.io/smart-money
            </div>
          </div>
        </>
      ),
    }),
    { ...OG_SIZE },
  );
}
