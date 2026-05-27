/**
 * POST /api/track-page-view
 *
 * Body: { route: string }
 *
 * Anonymous-safe page-view beacon. The client fires this on every
 * route change to populate the page_views rollup that the admin
 * Growth tab reads from.
 *
 * Route normalisation: dynamic segments (numeric IDs, addresses) are
 * collapsed to placeholders so we don't blow up cardinality. Examples:
 *   /symbol/BTC      → /symbol/[symbol]
 *   /trader/0xabc…   → /trader/[address]
 *   /api/...         → DROPPED (we never want API hits in this table)
 *
 * The beacon is rate-limited by the global middleware so a noisy
 * client can't flood the table. Failures are silently swallowed —
 * page views are best-effort analytics, never user-facing.
 */
import { NextRequest, NextResponse } from 'next/server';
import { isDBConfigured, recordPageView } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

function normalize(raw: string): string | null {
  if (typeof raw !== 'string' || !raw.startsWith('/')) return null;
  // Strip query + hash
  const path = raw.split('?')[0].split('#')[0];
  if (path.length > 200) return null;
  // Drop API + internal Next paths
  if (path.startsWith('/api/') || path.startsWith('/_next/')) return null;

  // Normalise dynamic segments
  const segs = path.split('/').map(s => {
    if (!s) return s;
    if (/^0x[a-fA-F0-9]{6,}$/.test(s)) return '[address]';
    if (/^[a-zA-Z0-9]{20,}$/.test(s))  return '[id]';      // long ids
    if (/^[0-9]+$/.test(s) && s.length >= 4) return '[id]';  // numeric ids
    return s;
  });

  const norm = segs.join('/');
  // Catch known dynamic routes by parent path so /symbol/BTC, /symbol/eth
  // both collapse to /symbol/[symbol]
  return norm
    .replace(/^\/symbol\/[^/]+$/,  '/symbol/[symbol]')
    .replace(/^\/trader\/[^/]+$/,  '/trader/[address]')
    .replace(/^\/wallet\/[^/]+$/,  '/wallet/[address]')
    .replace(/^\/u\/[^/]+$/,       '/u/[id]');
}

export async function POST(request: NextRequest) {
  if (!isDBConfigured()) {
    // Silently 204 so the client never sees an error from analytics
    return new NextResponse(null, { status: 204 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const route = normalize(body?.route);
  if (!route) {
    return new NextResponse(null, { status: 204 });
  }

  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  await recordPageView(route, day);

  return new NextResponse(null, { status: 204 });
}
