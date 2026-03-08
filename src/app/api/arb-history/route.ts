/**
 * GET /api/arb-history?symbols=BTC,ETH,SOL
 *
 * Returns 7-day historical spread data for arbitrage stability analysis.
 * Computes per-symbol daily max-min spread across exchanges from funding_snapshots.
 *
 * Response: { data: { [symbol]: { avg7d, avg24h, avg6d } } }
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';

// In-memory cache (2-minute TTL)
let l1Cache: { data: Record<string, { avg7d: number; avg24h: number; avg6d: number }>; timestamp: number } | null = null;
const L1_TTL = 2 * 60 * 1000;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get('symbols');
  if (!symbolsParam) {
    return NextResponse.json({ error: 'symbols parameter required' }, { status: 400 });
  }

  const symbols = symbolsParam.split(',').slice(0, 200); // cap at 200

  // Check cache
  if (l1Cache && Date.now() - l1Cache.timestamp < L1_TTL) {
    // Filter to requested symbols
    const filtered: Record<string, { avg7d: number; avg24h: number; avg6d: number }> = {};
    symbols.forEach(s => { if (l1Cache!.data[s]) filtered[s] = l1Cache!.data[s]; });
    return NextResponse.json({ data: filtered }, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  }

  try {
    // Dynamic import to avoid bundling DB in edge contexts
    const { default: postgres } = await import('postgres');
    const DATABASE_URL = process.env.DATABASE_URL || '';
    if (!DATABASE_URL) {
      return NextResponse.json({ data: {} }, { headers: { 'Cache-Control': 'public, s-maxage=60' } });
    }

    const sql = postgres(DATABASE_URL, { max: 3, idle_timeout: 10, connect_timeout: 5, ssl: 'require' });

    let data: Record<string, { avg7d: number; avg24h: number; avg6d: number }> = {};
    try {
      // Query: per-symbol, per-day, compute max and min exchange rate → spread
      // Then average spread over 7 days, last 24h, and prior 6 days
      const rows = await sql`
        WITH daily_spreads AS (
          SELECT
            symbol,
            DATE(ts) AS day,
            MAX(rate) - MIN(rate) AS spread,
            COUNT(DISTINCT exchange) AS exchange_count
          FROM funding_snapshots
          WHERE symbol = ANY(${symbols})
            AND ts > NOW() - INTERVAL '7 days'
          GROUP BY symbol, DATE(ts)
          HAVING COUNT(DISTINCT exchange) >= 2
        )
        SELECT
          symbol,
          AVG(spread) AS avg7d,
          AVG(CASE WHEN day >= CURRENT_DATE - INTERVAL '1 day' THEN spread END) AS avg24h,
          AVG(CASE WHEN day < CURRENT_DATE - INTERVAL '1 day' THEN spread END) AS avg6d
        FROM daily_spreads
        GROUP BY symbol
      `;

      rows.forEach((r: any) => {
        data[r.symbol] = {
          avg7d: Number(r.avg7d) || 0,
          avg24h: Number(r.avg24h) || 0,
          avg6d: Number(r.avg6d) || 0,
        };
      });
    } finally {
      await sql.end();
    }

    // Update cache with ALL symbols we computed (not just requested ones)
    l1Cache = { data, timestamp: Date.now() };

    return NextResponse.json({ data }, {
      headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (error) {
    console.error('Arb history API error:', error instanceof Error ? error.message : error);

    // Return stale cache if available
    if (l1Cache) {
      const filtered: Record<string, { avg7d: number; avg24h: number; avg6d: number }> = {};
      symbols.forEach(s => { if (l1Cache!.data[s]) filtered[s] = l1Cache!.data[s]; });
      return NextResponse.json({ data: filtered }, {
        headers: { 'X-Cache': 'STALE', 'Cache-Control': 'public, s-maxage=30' },
      });
    }

    return NextResponse.json({ data: {} }, { status: 500 });
  }
}
