/** /spread-scanner OG image */
import { ImageResponse } from 'next/og';
import { OG_SIZE, OG_CONTENT_TYPE, ogFrame, ogBrandMark, ogChip } from '@/lib/og-shared';

export const runtime = 'edge';
export const alt = 'InfoHub Spread Scanner — cross-venue arbitrage';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function OgImage() {
  return new ImageResponse(
    ogFrame({
      accent: 'sky',
      children: (
        <>
          {ogBrandMark({ subtitle: 'Spread scanner' })}
          <div style={{ display: 'flex', flexDirection: 'column', zIndex: 1, marginTop: 'auto', gap: 18 }}>
            <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.04 }}>
              Cross-venue spreads,{' '}
              <span style={{ background: 'linear-gradient(135deg, #7dd3fc 0%, #34d399 100%)', backgroundClip: 'text', color: 'transparent' }}>
                live
              </span>.
            </div>
            <div style={{ fontSize: 24, color: '#d4d4d4', lineHeight: 1.4, maxWidth: 1000 }}>
              Bid/ask across every major exchange, side-by-side. Catch the venue mispricing before the bots do.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, zIndex: 1, marginTop: 30, alignItems: 'center' }}>
            {ogChip({ label: 'Real-time', color: '#7dd3fc' })}
            {ogChip({ label: 'Filterable by symbol', color: '#34d399' })}
            {ogChip({ label: 'No paywall', color: '#fbbf24' })}
            <div style={{ marginLeft: 'auto', fontSize: 14, color: '#737373' }}>
              info-hub.io/spread-scanner
            </div>
          </div>
        </>
      ),
    }),
    { ...OG_SIZE },
  );
}
