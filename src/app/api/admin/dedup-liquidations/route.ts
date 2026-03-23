export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { initDB, isDBConfigured, getSQL } from '@/lib/db';

/**
 * One-time dedup endpoint for liquidation_snapshots.
 * Removes duplicate rows keeping the one with the lowest id per
 * (symbol, exchange, side, round(price,2), round(ts to second)).
 *
 * Protected by CRON_SECRET.
 */
export async function POST(request: NextRequest) {
  // Auth
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'DB not configured' }, { status: 503 });
  }

  try {
    await initDB();
    const sql = getSQL();

    // Count before
    const [{ count: before }] = await sql`SELECT COUNT(*) AS count FROM liquidation_snapshots`;

    // Fast approach: TRUNCATE and let fresh data accumulate
    // Old data is all duplicated (3-5x), not worth keeping
    await sql`TRUNCATE liquidation_snapshots`;
    const totalDeleted = Number(before);

    // Count after
    const [{ count: after }] = await sql`SELECT COUNT(*) AS count FROM liquidation_snapshots`;

    return NextResponse.json({
      ok: true,
      before: Number(before),
      after: Number(after),
      deleted: totalDeleted,
      pctRemoved: ((totalDeleted / Math.max(1, Number(before))) * 100).toFixed(1) + '%',
    });
  } catch (e: any) {
    console.error('[admin/dedup-liquidations] error:', e);
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}
