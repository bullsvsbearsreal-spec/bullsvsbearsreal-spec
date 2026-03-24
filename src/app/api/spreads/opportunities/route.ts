import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL || '', { max: 2 });

export async function GET(req: NextRequest) {
  const days = Math.min(+(req.nextUrl.searchParams.get('days') || '7'), 30);
  const status = req.nextUrl.searchParams.get('status') || 'all'; // 'open', 'closed', 'all'

  try {
    let rows;
    if (status === 'all') {
      rows = await sql`
        SELECT * FROM arb_opportunities
        WHERE opened_at > NOW() - ${days + ' days'}::interval
        ORDER BY opened_at DESC
        LIMIT 100
      `;
    } else {
      rows = await sql`
        SELECT * FROM arb_opportunities
        WHERE status = ${status}
          AND opened_at > NOW() - ${days + ' days'}::interval
        ORDER BY opened_at DESC
        LIMIT 100
      `;
    }

    const data = rows.map(r => ({
      id: r.id,
      symbol: r.symbol,
      spreadUsd: +r.spread_usd,
      spreadPct: +r.spread_pct,
      highExchange: r.high_exchange,
      lowExchange: r.low_exchange,
      maxSpreadUsd: +r.max_spread_usd,
      maxSpreadPct: +r.max_spread_pct,
      openedAt: r.opened_at,
      closedAt: r.closed_at,
      status: r.status,
      durationMs: r.closed_at ? new Date(r.closed_at).getTime() - new Date(r.opened_at).getTime() : Date.now() - new Date(r.opened_at).getTime(),
    }));

    return NextResponse.json({ data, count: data.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
