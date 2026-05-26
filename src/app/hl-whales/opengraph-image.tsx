/** /hl-whales OG image */
import { ImageResponse } from 'next/og';
import { OG_SIZE, OG_CONTENT_TYPE, ogFrame, ogBrandMark, ogChip } from '@/lib/og-shared';

export const runtime = 'nodejs';
export const alt = 'InfoHub HL Whales — Hyperliquid whale tracker';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function OgImage() {
  return new ImageResponse(
    ogFrame({
      accent: 'rose',
      children: (
        <>
          {ogBrandMark({ subtitle: 'Hyperliquid whales' })}
          <div style={{ display: 'flex', flexDirection: 'column', zIndex: 1, marginTop: 'auto', gap: 18 }}>
            <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.04 }}>
              Watch the{' '}
              <span style={{ background: 'linear-gradient(135deg, #f472b6 0%, #fbbf24 100%)', backgroundClip: 'text', color: 'transparent' }}>
                whales
              </span>{' '}
              move.
            </div>
            <div style={{ fontSize: 24, color: '#d4d4d4', lineHeight: 1.4, maxWidth: 1000 }}>
              Top Hyperliquid wallets, live positions + entries + liq prices + unrealised PnL. Alert me on changes.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, zIndex: 1, marginTop: 30, alignItems: 'center' }}>
            {ogChip({ label: 'Live position feed', color: '#f472b6' })}
            {ogChip({ label: 'Open + close + funding alerts', color: '#34d399' })}
            {ogChip({ label: 'Free up to 10 wallets', color: '#fbbf24' })}
            <div style={{ marginLeft: 'auto', fontSize: 14, color: '#737373' }}>
              info-hub.io/hl-whales
            </div>
          </div>
        </>
      ),
    }),
    { ...OG_SIZE },
  );
}
