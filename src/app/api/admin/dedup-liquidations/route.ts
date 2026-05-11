export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, verifySameOrigin } from '@/lib/auth';
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
  const originErr = verifySameOrigin(request);
  if (originErr) return originErr;
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

    // Bound the dedup window. The previous query did `NOT IN (SELECT MIN(id)
    // FROM liquidation_snapshots GROUP BY ...)` which scans the ENTIRE
    // table twice (count + delete) with no row limit. With millions of
    // rows this exhausts working memory in Postgres. Now we restrict to
    // the last 7 days, which is the realistic window where dupe inserts
    // happen anyway (older rows would have been deduped on previous runs).
    const [{ count: beforeCount }] = await sql`
      SELECT count(*)::int AS count
      FROM liquidation_snapshots
      WHERE ts > NOW() - INTERVAL '7 days'
    `;

    // Find duplicates within the bounded window
    const [{ count: dupeCount }] = await sql`
      SELECT count(*)::int AS count FROM liquidation_snapshots
      WHERE ts > NOW() - INTERVAL '7 days'
        AND id NOT IN (
          SELECT MIN(id) FROM liquidation_snapshots
          WHERE ts > NOW() - INTERVAL '7 days'
          GROUP BY symbol, exchange, side, ROUND(price::numeric, 2), DATE_TRUNC('second', ts)
        )
    `;

    // Dry run unless explicitly confirmed
    if (!body.confirm) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        scope: 'last 7 days',
        before: beforeCount,
        duplicates: dupeCount,
        afterEstimate: beforeCount - dupeCount,
        pctDuplicates: beforeCount > 0 ? `${((dupeCount / beforeCount) * 100).toFixed(1)}%` : '0.0%',
        message: 'Send { "confirm": true } to execute the dedup. Scope is the last 7 days.',
      });
    }

    // Execute dedup — delete only duplicate rows in the bounded window
    const result = await sql`
      DELETE FROM liquidation_snapshots
      WHERE ts > NOW() - INTERVAL '7 days'
        AND id NOT IN (
          SELECT MIN(id) FROM liquidation_snapshots
          WHERE ts > NOW() - INTERVAL '7 days'
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
