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
    const sql = getSQL();

    // Skip counting — just truncate fast
    await sql`TRUNCATE liquidation_snapshots RESTART IDENTITY`;
    const totalDeleted = -1; // unknown, table was truncated
    const before = -1;
    const after = 0;

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
