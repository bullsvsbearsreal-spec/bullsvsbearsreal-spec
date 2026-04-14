export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { isDBConfigured, getSQL } from '@/lib/db';

/**
 * POST /api/admin/dedup-liquidations
 *
 * Deduplicates liquidation_snapshots by removing duplicate rows,
 * keeping the one with the lowest id per unique
 * (symbol, exchange, side, round(price,2), ts rounded to second).
 *
 * Protected by admin session auth.
 */
export async function POST(request: NextRequest) {
  const adminErr = await requireAdmin();
  if (adminErr) return adminErr;

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'DB not configured' }, { status: 503 });
  }

  // Require explicit confirmation via request body
  let body: { confirm?: boolean } = {};
  try { body = await request.json(); } catch { /* empty body is fine for dry run */ }

  try {
    const sql = getSQL();

    const [{ count: beforeCount }] = await sql`SELECT count(*)::int AS count FROM liquidation_snapshots`;

    // Find duplicates (rows that are NOT the min-id per dedup key)
    const [{ count: dupeCount }] = await sql`
      SELECT count(*)::int AS count FROM liquidation_snapshots
      WHERE id NOT IN (
        SELECT MIN(id) FROM liquidation_snapshots
        GROUP BY symbol, exchange, side, ROUND(price::numeric, 2), DATE_TRUNC('second', ts)
      )
    `;

    // Dry run unless explicitly confirmed
    if (!body.confirm) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        before: beforeCount,
        duplicates: dupeCount,
        afterEstimate: beforeCount - dupeCount,
        pctDuplicates: beforeCount > 0 ? `${((dupeCount / beforeCount) * 100).toFixed(1)}%` : '0.0%',
        message: 'Send { "confirm": true } to execute the dedup.',
      });
    }

    // Execute dedup — delete only duplicate rows, keep one per group
    const result = await sql`
      DELETE FROM liquidation_snapshots
      WHERE id NOT IN (
        SELECT MIN(id) FROM liquidation_snapshots
        GROUP BY symbol, exchange, side, ROUND(price::numeric, 2), DATE_TRUNC('second', ts)
      )
    `;

    const deleted = result.count ?? dupeCount;
    const afterCount = beforeCount - deleted;

    return NextResponse.json({
      ok: true,
      dryRun: false,
      before: beforeCount,
      after: afterCount,
      deleted,
      pctRemoved: beforeCount > 0 ? `${((deleted / beforeCount) * 100).toFixed(1)}%` : '0.0%',
    });
  } catch (e: any) {
    console.error('[admin/dedup-liquidations] error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
