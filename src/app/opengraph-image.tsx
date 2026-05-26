/**
 * Root OG image — info-hub.io/ shares.
 *
 * Minimal version to debug DO compatibility. If this works, the previous
 * version's issue was specific CSS Satori couldn't render. If this STILL
 * 503s, the issue is next/og itself on DO App Platform's nodejs runtime
 * and we need a different OG strategy (static PNGs or external service).
 */

import { ImageResponse } from 'next/og';

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
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 72,
          fontWeight: 700,
        }}
      >
        InfoHub
      </div>
    ),
    { ...size },
  );
}
