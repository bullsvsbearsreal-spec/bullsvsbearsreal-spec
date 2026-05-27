/**
 * GET /api/admin/top-pages?days=7&limit=10
 *
 * Returns top routes by aggregated view count from the page_views
 * rollup table. Populated by the /api/track-page-view beacon and
 * the daily /api/cron/aggregate-page-views job.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrAdvisor } from '@/lib/auth';
import { initDB, isDBConfigured, getTopPages } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const denied = await requireAdminOrAdvisor();
  if (denied) return denied;
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const url = new URL(request.url);
  const rawDays  = parseInt(url.searchParams.get('days')  || '7',  10);
  const rawLimit = parseInt(url.searchParams.get('limit') || '10', 10);
  const days  = Number.isFinite(rawDays)  && rawDays  > 0 ? Math.min(rawDays,  90) : 7;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 50) : 10;

  try {
    // Ensure page_views table exists (initDB is idempotent).
    await initDB();
    const pages = await getTopPages(days, limit);
    return NextResponse.json({ pages, days, limit });
  } catch (e) {
    console.error('Top pages error:', e);
    return NextResponse.json({ error: 'Failed to fetch top pages' }, { status: 500 });
  }
}
