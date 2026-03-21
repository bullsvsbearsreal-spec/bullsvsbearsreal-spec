export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { initDB, getSQL, isDBConfigured } from '@/lib/db';

export async function GET() {
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'DB not configured' }, { status: 503 });
  }

  try {
    await initDB();
    const sql = getSQL();

    // Check if mark_price column exists
    const columns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'funding_snapshots'
      ORDER BY ordinal_position
    `;

    // Try ALTER TABLE explicitly
    let alterResult = 'skipped';
    const hasMark = columns.some((c: any) => c.column_name === 'mark_price');
    if (!hasMark) {
      try {
        await sql`ALTER TABLE funding_snapshots ADD COLUMN mark_price REAL`;
        alterResult = 'added_column';
      } catch (e: any) {
        alterResult = 'error: ' + e.message;
      }
    } else {
      alterResult = 'column_exists';
    }

    // Test insert with mark_price
    let testResult: any = null;
    try {
      await sql`INSERT INTO funding_snapshots (symbol, exchange, rate, predicted, mark_price)
        VALUES ('_TEST', '_TEST', 0.001, null, 70000.0)`;
      const testRow = await sql`SELECT id, mark_price FROM funding_snapshots WHERE symbol = '_TEST' ORDER BY ts DESC LIMIT 1`;
      testResult = { inserted: true, mark_price: testRow[0]?.mark_price, id: testRow[0]?.id };
      await sql`DELETE FROM funding_snapshots WHERE symbol = '_TEST'`;
    } catch (e: any) {
      testResult = { inserted: false, error: e.message };
    }

    const [fundingCount, markPriceCount, recentFunding] = await Promise.all([
      sql`SELECT COUNT(*) as cnt FROM funding_snapshots`,
      sql`SELECT COUNT(*) as cnt FROM funding_snapshots WHERE mark_price IS NOT NULL AND mark_price > 0`,
      sql`SELECT symbol, exchange, rate, mark_price, ts FROM funding_snapshots ORDER BY ts DESC LIMIT 3`,
    ]);

    return NextResponse.json({
      columns: columns.map((c: any) => `${c.column_name}:${c.data_type}`),
      has_mark_price_column: hasMark,
      alter_result: alterResult,
      test_insert: testResult,
      funding_total: Number(fundingCount[0]?.cnt),
      mark_price_non_null: Number(markPriceCount[0]?.cnt),
      recent_funding: recentFunding.map((r: any) => ({
        s: r.symbol, e: r.exchange, rate: r.rate, mark: r.mark_price, ts: r.ts,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, stack: e.stack?.split('\n').slice(0, 3) }, { status: 500 });
  }
}
