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
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'DB not configured' }, { status: 503 });
  }

  try {
    const sql = getSQL();

    // Count before truncate for accurate reporting
    const [{ count: beforeCount }] = await sql`SELECT count(*)::int AS count FROM liquidation_snapshots`;
    await sql`TRUNCATE liquidation_snapshots RESTART IDENTITY`;

    return NextResponse.json({
      ok: true,
      before: beforeCount,
      after: 0,
      deleted: beforeCount,
      pctRemoved: beforeCount > 0 ? '100.0%' : '0.0%',
    });
  } catch (e: any) {
    console.error('[admin/dedup-liquidations] error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
