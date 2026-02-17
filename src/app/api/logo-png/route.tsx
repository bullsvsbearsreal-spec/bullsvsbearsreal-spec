import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const size = Math.min(Number(searchParams.get('size') || 512), 2048);
  const variant = searchParams.get('variant') || 'icon'; // icon | dark | white

  // History Channel-style IH monogram
  const IconSVG = () => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="hi" x1="20" y1="4" x2="20" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFE680" />
          <stop offset="0.2" stopColor="#FFD700" />
          <stop offset="0.5" stopColor="#FFA500" />
          <stop offset="0.8" stopColor="#FF7700" />
          <stop offset="1" stopColor="#CC5500" />
        </linearGradient>
        <linearGradient id="bg" x1="20" y1="0" x2="20" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#151515" />
          <stop offset="1" stopColor="#0A0A0A" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="4" fill="url(#bg)" />
      <rect x="1.5" y="1.5" width="37" height="37" rx="3.5" stroke="#FF7700" strokeWidth="0.3" strokeOpacity="0.25" fill="none" />
      {/* Serif I */}
      <path
        d="M6 9.5 L13 9.5 L13 10.2 L11.2 10.8 L11.2 28.2 L13 28.8 L13 29.5 L6 29.5 L6 28.8 L7.8 28.2 L7.8 10.8 L6 10.2 Z"
        fill="url(#hi)"
      />
      {/* Serif H */}
      <path
        d="M15.5 9.5 L21.5 9.5 L21.5 10.2 L20 10.8 L20 18.8 L29.5 18.8 L29.5 10.8 L28 10.2 L28 9.5 L34 9.5 L34 10.2 L32.5 10.8 L32.5 28.2 L34 28.8 L34 29.5 L28 29.5 L28 28.8 L29.5 28.2 L29.5 20.5 L20 20.5 L20 28.2 L21.5 28.8 L21.5 29.5 L15.5 29.5 L15.5 28.8 L17 28.2 L17 10.8 L15.5 10.2 Z"
        fill="url(#hi)"
      />
      {/* Underline */}
      <rect x="5" y="32" width="30" height="0.7" rx="0.35" fill="url(#hi)" opacity="0.6" />
    </svg>
  );

  // White variant (for light backgrounds)
  const WhiteSVG = () => (
    <svg width={size} height={size} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="38" height="38" rx="4" fill="white" />
      <path d="M6 9.5 L13 9.5 L13 10.2 L11.2 10.8 L11.2 28.2 L13 28.8 L13 29.5 L6 29.5 L6 28.8 L7.8 28.2 L7.8 10.8 L6 10.2 Z" fill="#0A0A0A" />
      <path d="M15.5 9.5 L21.5 9.5 L21.5 10.2 L20 10.8 L20 18.8 L29.5 18.8 L29.5 10.8 L28 10.2 L28 9.5 L34 9.5 L34 10.2 L32.5 10.8 L32.5 28.2 L34 28.8 L34 29.5 L28 29.5 L28 28.8 L29.5 28.2 L29.5 20.5 L20 20.5 L20 28.2 L21.5 28.8 L21.5 29.5 L15.5 29.5 L15.5 28.8 L17 28.2 L17 10.8 L15.5 10.2 Z" fill="#0A0A0A" />
      <rect x="5" y="32" width="30" height="0.7" rx="0.35" fill="#0A0A0A" opacity="0.6" />
    </svg>
  );

  const svg = variant === 'white' ? <WhiteSVG /> : <IconSVG />;

  const response = new ImageResponse(
    (
      <div style={{ display: 'flex', width: size, height: size }}>
        {svg}
      </div>
    ),
    { width: size, height: size },
  );

  // Set headers for PNG download
  const filename = `infohub-logo-${variant}-${size}x${size}.png`;
  response.headers.set('Content-Disposition', `attachment; filename="${filename}"`);
  response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  return response;
}
