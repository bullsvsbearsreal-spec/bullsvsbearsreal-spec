/** /spreads OG image */
import { ImageResponse } from 'next/og';
import { OG_SIZE, OG_CONTENT_TYPE, ogFrame, ogBrandMark, ogChip } from '@/lib/og-shared';

export const runtime = 'nodejs';
export const alt = 'InfoHub Spreads — cross-venue arbitrage net of fees';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function OgImage() {
  return new ImageResponse(
    ogFrame({
      accent: 'emerald',
      children: (
        <>
          {ogBrandMark({ subtitle: 'Spreads' })}
          <div style={{ display: 'flex', flexDirection: 'column', zIndex: 1, marginTop: 'auto', gap: 18 }}>
            <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.04 }}>
              Spreads,{' '}
              <span style={{ background: 'linear-gradient(135deg, #34d399 0%, #06b6d4 100%)', backgroundClip: 'text', color: 'transparent' }}>
                net of fees
              </span>.
            </div>
            <div style={{ fontSize: 24, color: '#d4d4d4', lineHeight: 1.4, maxWidth: 1000 }}>
              Every cross-venue arbitrage opportunity, with the fee math already done. Don&apos;t chase phantom edge.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, zIndex: 1, marginTop: 30, alignItems: 'center' }}>
            {ogChip({ label: 'Fee-aware net APR', color: '#34d399' })}
            {ogChip({ label: 'Taker + maker breakdown', color: '#06b6d4' })}
            {ogChip({ label: 'OpenAPI spec', color: '#fbbf24' })}
            <div style={{ marginLeft: 'auto', fontSize: 14, color: '#737373' }}>
              info-hub.io/spreads
            </div>
          </div>
        </>
      ),
    }),
    { ...OG_SIZE },
  );
}
