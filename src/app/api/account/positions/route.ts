/**
 * GET /api/account/positions
 *
 * Returns the calling user's open positions (from user_positions, refreshed
 * by the sync-positions cron every 60s) plus a summary roll-up:
 *   { equity, nominal, totalLong, totalShort, leverageLong, leverageShort }
 *
 * Mixes in 24h/48h funding-rate context per (exchange, symbol) by joining
 * with the existing funding_snapshots table (50 days of history). The
 * "current" funding rate column comes from the most-recent row, the 24h/48h
 * average over the matching window.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isDBConfigured, listUserPositions, getSQL } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

interface FundingContext {
  current: number | null;
  avg24h: number | null;
  avg48h: number | null;
}

async function loadFundingContext(
  pairs: { exchange: string; symbol: string }[],
): Promise<Map<string, FundingContext>> {
  const out = new Map<string, FundingContext>();
  if (pairs.length === 0) return out;

  const sql = getSQL();
  const exchanges = pairs.map(p => p.exchange);
  const symbols = pairs.map(p => p.symbol);

  // Single query: latest rate + 24h avg + 48h avg per (exchange, symbol).
  // Filter list keeps the working set small even when funding_snapshots
  // has tens of millions of rows.
  const rows = await sql`
    WITH wanted AS (
      SELECT * FROM UNNEST(
        ${sql.array(exchanges)}::text[],
        ${sql.array(symbols)}::text[]
      ) AS t(exchange, symbol)
    ),
    latest AS (
      SELECT DISTINCT ON (f.exchange, f.symbol)
        f.exchange, f.symbol, f.rate
      FROM funding_snapshots f
      JOIN wanted w ON w.exchange = f.exchange AND w.symbol = f.symbol
      WHERE f.ts > NOW() - INTERVAL '6 hours'
      ORDER BY f.exchange, f.symbol, f.ts DESC
    ),
    avg24 AS (
      SELECT f.exchange, f.symbol, AVG(f.rate) AS rate
      FROM funding_snapshots f
      JOIN wanted w ON w.exchange = f.exchange AND w.symbol = f.symbol
      WHERE f.ts > NOW() - INTERVAL '24 hours'
      GROUP BY f.exchange, f.symbol
    ),
    avg48 AS (
      SELECT f.exchange, f.symbol, AVG(f.rate) AS rate
      FROM funding_snapshots f
      JOIN wanted w ON w.exchange = f.exchange AND w.symbol = f.symbol
      WHERE f.ts > NOW() - INTERVAL '48 hours'
      GROUP BY f.exchange, f.symbol
    )
    SELECT w.exchange, w.symbol,
           latest.rate AS current,
           avg24.rate  AS avg24h,
           avg48.rate  AS avg48h
    FROM wanted w
    LEFT JOIN latest ON latest.exchange = w.exchange AND latest.symbol = w.symbol
    LEFT JOIN avg24  ON avg24.exchange  = w.exchange AND avg24.symbol  = w.symbol
    LEFT JOIN avg48  ON avg48.exchange  = w.exchange AND avg48.symbol  = w.symbol
  `;

  for (const r of rows as any[]) {
    out.set(`${r.exchange}|${r.symbol}`, {
      current: r.current === null ? null : Number(r.current),
      avg24h: r.avg24h === null ? null : Number(r.avg24h),
      avg48h: r.avg48h === null ? null : Number(r.avg48h),
    });
  }
  return out;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'DB unavailable' }, { status: 503, headers: NO_STORE });
  }

  const positions = await listUserPositions(session.user.id);

  // Pull funding context only when we have positions to look up.
  const fundingMap = await loadFundingContext(
    positions.map(p => ({ exchange: p.exchange, symbol: p.symbol })),
  );

  // Diagnostics: ?debug=1 returns which (exchange, symbol) pairs missed
  // the funding-snapshots join. Helps figure out whether the issue is
  // a stale label vs a missing cron ingestion vs a symbol case mismatch.
  const debug = request.nextUrl.searchParams.get('debug') === '1';

  // ─── Summary roll-up (matches christian's mockup top row) ───────────
  let totalLong = 0;
  let totalShort = 0;
  let totalMargin = 0;
  let totalUnrealized = 0;
  for (const p of positions) {
    const value = p.positionValue ?? (p.markPrice ? p.size * p.markPrice : p.size * p.entryPrice);
    if (p.side === 'long') totalLong += value;
    else totalShort += value;
    if (p.marginUsed) totalMargin += p.marginUsed;
    if (p.unrealizedPnl) totalUnrealized += p.unrealizedPnl;
  }
  const nominal = totalLong + totalShort;
  // Equity = sum of margin + open PnL. With CEX you'd also add free balance,
  // but we don't fetch wallet balance yet — Phase B+ will add it.
  const equity = totalMargin + totalUnrealized;
  const leverageLong = equity > 0 ? totalLong / equity : 0;
  const leverageShort = equity > 0 ? totalShort / equity : 0;

  // ─── Decorate each position with funding context ───────────────────
  const decorated = positions.map(p => {
    const f = fundingMap.get(`${p.exchange}|${p.symbol}`) ?? {
      current: null, avg24h: null, avg48h: null,
    };
    return {
      id: p.id,
      sourceType: p.sourceType,
      sourceId: p.sourceId,
      exchange: p.exchange,
      symbol: p.symbol,
      side: p.side,
      size: p.size,
      entryPrice: p.entryPrice,
      markPrice: p.markPrice,
      positionValue: p.positionValue,
      unrealizedPnl: p.unrealizedPnl,
      leverage: p.leverage,
      marginUsed: p.marginUsed,
      liquidationPrice: p.liquidationPrice,
      tpPrice: p.tpPrice,
      slPrice: p.slPrice,
      cumulativeFunding: p.cumulativeFunding,
      // funding context (rates already in % per native interval — UI doesn't
      // need to re-normalise to display)
      currentFunding: f.current,
      avg24hFunding: f.avg24h,
      avg48hFunding: f.avg48h,
      updatedAt: p.updatedAt,
    };
  });

  // Build debug payload only when explicitly asked (admin / dev tooling).
  let debugPayload: Record<string, unknown> | undefined;
  if (debug) {
    const sql = getSQL();
    const missing = positions
      .filter(p => {
        const f = fundingMap.get(`${p.exchange}|${p.symbol}`);
        return !f || (f.current == null && f.avg24h == null && f.avg48h == null);
      })
      .map(p => ({ exchange: p.exchange, symbol: p.symbol, side: p.side }));
    // What does funding_snapshots actually have for those pairs (any time)?
    const exList = Array.from(new Set(missing.map(m => m.exchange)));
    const symList = Array.from(new Set(missing.map(m => m.symbol)));
    const evidenceRows = exList.length > 0 && symList.length > 0
      ? await sql`
          SELECT exchange, symbol, MAX(ts) AS last_ts, COUNT(*) AS row_count
          FROM funding_snapshots
          WHERE exchange = ANY(${sql.array(exList)}::text[])
            AND symbol   = ANY(${sql.array(symList)}::text[])
          GROUP BY exchange, symbol
        `
      : [];
    debugPayload = {
      missingPairs: missing,
      evidenceForMissing: evidenceRows,
      fundingMapKeys: Array.from(fundingMap.keys()),
    };
  }

  return NextResponse.json(
    {
      summary: {
        equity,
        nominal,
        totalLong,
        totalShort,
        leverageLong,
        leverageShort,
        totalUnrealizedPnl: totalUnrealized,
      },
      positions: decorated,
      ts: Date.now(),
      ...(debugPayload ? { debug: debugPayload } : {}),
    },
    { headers: NO_STORE },
  );
}
