/**
 * GET /api/admin/online-now
 *
 * Returns the count of users whose `last_seen` falls within the
 * window argument (default 5 min). The admin header polls this on
 * a fast 30s cadence so the dashboard always has an up-to-the-second
 * "online right now" indicator independent of the heavier 2-min
 * /api/admin/stats poll.
 *
 * Cheap query — single COUNT over an indexed column. Wrapped in
 * `initDB()` so the index gets created on cold-start.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrAdvisor } from '@/lib/auth';
import { initDB, isDBConfigured, getSQL } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const denied = await requireAdminOrAdvisor();
  if (denied) return denied;
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const rawMin = parseInt(request.nextUrl.searchParams.get('minutes') || '5', 10);
  const minutes = Number.isFinite(rawMin) && rawMin > 0 ? Math.min(rawMin, 60) : 5;

  try {
    await initDB();
    const db = getSQL();
    const interval = `${minutes} minutes`;
    const [row] = await db`
      SELECT COUNT(*)::int AS count
        FROM users
       WHERE last_seen > NOW() - ${interval}::interval
         AND suspended_at IS NULL
    `;
    return NextResponse.json({ count: Number(row?.count ?? 0), minutes, asOf: new Date().toISOString() });
  } catch (e) {
    console.error('Online-now error:', e);
    return NextResponse.json({ count: 0, minutes, asOf: new Date().toISOString() });
  }
}
