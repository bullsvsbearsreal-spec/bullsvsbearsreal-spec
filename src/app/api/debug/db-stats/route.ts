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

    const [fundingCount, oiCount, markPriceCount, recentFunding, recentOI] = await Promise.all([
      sql`SELECT COUNT(*) as cnt FROM funding_snapshots`,
      sql`SELECT COUNT(*) as cnt FROM oi_snapshots`,
      sql`SELECT COUNT(*) as cnt FROM funding_snapshots WHERE mark_price IS NOT NULL AND mark_price > 0`,
      sql`SELECT symbol, exchange, rate, mark_price, ts FROM funding_snapshots ORDER BY ts DESC LIMIT 5`,
      sql`SELECT symbol, exchange, oi_usd, ts FROM oi_snapshots ORDER BY ts DESC LIMIT 3`,
    ]);

    return NextResponse.json({
      funding_total: Number(fundingCount[0]?.cnt),
      oi_total: Number(oiCount[0]?.cnt),
      mark_price_non_null: Number(markPriceCount[0]?.cnt),
      recent_funding: recentFunding.map((r: any) => ({
        symbol: r.symbol,
        exchange: r.exchange,
        rate: r.rate,
        mark_price: r.mark_price,
        ts: r.ts,
      })),
      recent_oi: recentOI.map((r: any) => ({
        symbol: r.symbol,
        exchange: r.exchange,
        oi_usd: r.oi_usd,
        ts: r.ts,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
