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

    // Delete duplicates: keep the row with the LOWEST id for each
    // (symbol, exchange, side, rounded_price, rounded_ts) group
    const result = await sql`
      DELETE FROM liquidation_snapshots
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM liquidation_snapshots
        GROUP BY symbol, exchange, side,
                 ROUND(price::numeric, 1),
                 date_trunc('second', ts)
      )
    `;

    // Count after
    const [{ count: after }] = await sql`SELECT COUNT(*) AS count FROM liquidation_snapshots`;

    const deleted = Number(before) - Number(after);

    return NextResponse.json({
      ok: true,
      before: Number(before),
      after: Number(after),
      deleted,
      pctRemoved: ((deleted / Number(before)) * 100).toFixed(1) + '%',
    });
  } catch (e: any) {
    console.error('[admin/dedup-liquidations] error:', e);
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}
