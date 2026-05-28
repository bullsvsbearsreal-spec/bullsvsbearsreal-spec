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
import { initDB, isDBConfigured, recordPageView } from '@/lib/db';
import { normalizePageRoute } from '@/lib/utils/normalizePageRoute';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

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

  const route = normalizePageRoute(body?.route);
  if (!route) {
    return new NextResponse(null, { status: 204 });
  }

  // Lazy-init schema (idempotent) so the page_views table exists.
  await initDB().catch(() => {});

  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  await recordPageView(route, day);

  return new NextResponse(null, { status: 204 });
}
