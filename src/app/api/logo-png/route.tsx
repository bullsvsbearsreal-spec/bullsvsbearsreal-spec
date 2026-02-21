import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  // Redirect all logo-png requests to the static PNG files
  const { searchParams } = new URL(req.url);
  const size = Number(searchParams.get('size') || 512);

  // Map to closest available static PNG
  let file = '/icon-512.png';
  if (size <= 32) file = '/favicon.png';
  else if (size <= 192) file = '/icon-192.png';
  else file = '/icon-512.png';

  // Redirect to the static file
  const url = new URL(file, req.url);
  return NextResponse.redirect(url, { status: 302, headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } });
}
