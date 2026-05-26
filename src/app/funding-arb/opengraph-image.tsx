/** /funding-arb OG image — pair grader pitch */
import { ImageResponse } from 'next/og';
import { OG_SIZE, OG_CONTENT_TYPE, ogFrame, ogBrandMark, ogChip } from '@/lib/og-shared';

export const runtime = 'nodejs';
export const alt = 'InfoHub Funding Arb — pair grader A→D';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function OgImage() {
  return new ImageResponse(
    ogFrame({
      accent: 'emerald',
      children: (
        <>
          {ogBrandMark({ subtitle: 'Funding arbitrage' })}
          <div style={{ display: 'flex', flexDirection: 'column', zIndex: 1, marginTop: 'auto', gap: 18 }}>
            <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.04 }}>
              Funding arb pairs,{' '}
              <span style={{ background: 'linear-gradient(135deg, #34d399 0%, #fbbf24 100%)', backgroundClip: 'text', color: 'transparent' }}>
                graded A→D
              </span>.
            </div>
            <div style={{ fontSize: 24, color: '#d4d4d4', lineHeight: 1.4, maxWidth: 1000 }}>
              Long-side cheap, short-side rich, net of fees. Cross-venue. Live. Filterable.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, zIndex: 1, marginTop: 30, alignItems: 'center' }}>
            {ogChip({ label: 'Net of fees', color: '#34d399' })}
            {ogChip({ label: 'A · B · C · D grade', color: '#fbbf24' })}
            {ogChip({ label: 'All major venues', color: '#7dd3fc' })}
            <div style={{ marginLeft: 'auto', fontSize: 14, color: '#737373' }}>
              info-hub.io/funding-arb
            </div>
          </div>
        </>
      ),
    }),
    { ...OG_SIZE },
  );
}
