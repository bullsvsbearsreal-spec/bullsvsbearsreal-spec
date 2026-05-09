/**
 * GET /api/account/history?days=30
 *
 * Returns the calling user's daily equity snapshots from
 * `portfolio_snapshots` (populated by the `portfolio-snapshot` cron at
 * 12:00 UTC daily). Each point is { t: ms-epoch, value, pnl }.
 *
 * Used by /account's equity sparkline to render real history rather
 * than a synthesized shape. Capped at 365 days.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isDBConfigured, getPortfolioHistory } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });
  }
  if (!isDBConfigured()) {
    return NextResponse.json({ points: [] }, { headers: NO_STORE });
  }

  const daysParam = parseInt(req.nextUrl.searchParams.get('days') || '30', 10);
  const days = Number.isFinite(daysParam) ? Math.min(365, Math.max(1, daysParam)) : 30;

  try {
    const points = await getPortfolioHistory(session.user.id, days);
    return NextResponse.json({ points }, { headers: NO_STORE });
  } catch (e) {
    console.error('[account/history] error:', e);
    return NextResponse.json({ points: [] }, { headers: NO_STORE });
  }
}
