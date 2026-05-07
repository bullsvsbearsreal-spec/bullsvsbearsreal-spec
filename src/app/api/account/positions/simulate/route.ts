/**
 * POST /api/account/positions/simulate
 *
 * "What if I open this position?" — given a hypothetical trade, recompute
 * the user's whole-book aggregates AS IF the trade were already filled.
 * Returns before/after deltas for:
 *   - Per-position health score on the new position (so users see
 *     "this would be 'critical' / 'caution' / 'healthy' on day-1")
 *   - Aggregate equity / nominal / leverage long-short
 *   - Aggregate daily funding carry
 *
 * No state mutation — read-only. Validates inputs, plugs the hypothetical
 * into the same lib functions /positions uses for live data, returns the
 * comparison.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isDBConfigured, listUserPositions } from '@/lib/db';
import { scorePositionHealth } from '@/lib/position-health';
import { dailyFundingCarryUsd, intervalHoursFor } from '@/lib/funding-intervals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

interface SimulateBody {
  /** e.g. "BTC", "ETH" */
  symbol: string;
  side: 'long' | 'short';
  /** Position notional in USD. */
  positionValueUsd: number;
  /** Effective leverage (e.g. 10). */
  leverage: number;
  /** Exchange the trade would land on. Drives funding interval + style. */
  exchange: string;
  /** Optional: current mark price. We try to fetch from /api/funding when omitted. */
  markPrice?: number;
  /** Optional: TP / SL trigger prices. */
  tpPrice?: number | null;
  slPrice?: number | null;
  /** Optional: current funding rate (% per native interval). When omitted
   *  we look it up from /api/funding for the (exchange, symbol). */
  currentFundingPct?: number | null;
}

function clampNumber(n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'DB unavailable' }, { status: 503, headers: NO_STORE });
  }

  let body: SimulateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: NO_STORE });
  }

  // Validate
  const symbol = (body.symbol ?? '').trim().toUpperCase();
  if (!symbol) {
    return NextResponse.json({ error: 'symbol required' }, { status: 400, headers: NO_STORE });
  }
  const side = body.side === 'long' || body.side === 'short' ? body.side : null;
  if (!side) {
    return NextResponse.json({ error: 'side must be long or short' }, { status: 400, headers: NO_STORE });
  }
  const positionValueUsd = clampNumber(body.positionValueUsd, 1, 1_000_000_000);
  if (positionValueUsd == null) {
    return NextResponse.json({ error: 'positionValueUsd must be a positive number' }, { status: 400, headers: NO_STORE });
  }
  const leverage = clampNumber(body.leverage, 1, 200);
  if (leverage == null) {
    return NextResponse.json({ error: 'leverage must be 1..200' }, { status: 400, headers: NO_STORE });
  }
  const exchange = (body.exchange ?? '').trim();
  if (!exchange) {
    return NextResponse.json({ error: 'exchange required' }, { status: 400, headers: NO_STORE });
  }

  // Look up live mark + funding from /api/funding when caller didn't pass them.
  let markPrice = body.markPrice ?? null;
  let currentFundingPct = body.currentFundingPct ?? null;
  if (markPrice == null || currentFundingPct == null) {
    try {
      const origin = process.env.NEXT_PUBLIC_BASE_URL || 'https://info-hub.io';
      const res = await fetch(`${origin}/api/funding?asset=${symbol}`, {
        signal: AbortSignal.timeout(8_000),
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const json = await res.json();
        const rows: any[] = json?.data ?? [];
        const exchangeRow = rows.find(r => r.symbol === symbol && r.exchange === exchange);
        if (exchangeRow) {
          if (markPrice == null && exchangeRow.markPrice) markPrice = exchangeRow.markPrice;
          if (currentFundingPct == null && exchangeRow.fundingRate != null) {
            currentFundingPct = exchangeRow.fundingRate;
          }
        }
      }
    } catch { /* live lookup failed — keep nulls */ }
  }

  // Compute hypothetical liquidation price using the standard textbook
  // formula at user-supplied leverage. mmf=0.5% (typical major market).
  const MMF = 0.005;
  const margin = positionValueUsd / leverage;
  const buffer = margin; // pre-fee/funding — close enough for the on-open snapshot
  let liquidationPrice: number | null = null;
  if (markPrice && markPrice > 0 && positionValueUsd > 0) {
    const ratio = (buffer / positionValueUsd) * (1 - MMF);
    liquidationPrice = side === 'long'
      ? markPrice * Math.max(0, 1 - ratio)
      : markPrice * (1 + ratio);
    if (!Number.isFinite(liquidationPrice) || liquidationPrice <= 0) liquidationPrice = null;
  }

  // Score the new position in isolation
  const newPositionHealth = scorePositionHealth({
    side,
    markPrice,
    entryPrice: markPrice ?? 0, // assume opened at mark
    leverage,
    liquidationPrice,
    tpPrice: body.tpPrice ?? null,
    slPrice: body.slPrice ?? null,
    unrealizedPnl: 0,
    marginUsed: margin,
    currentFunding: currentFundingPct,
  });

  const newPositionDailyCarry = dailyFundingCarryUsd({
    side,
    positionValue: positionValueUsd,
    currentFundingPct,
    exchange,
  });

  // ─── Aggregate before/after ─────────────────────────────────────────
  const existing = await listUserPositions(session.user.id);

  const aggBefore = {
    nominal: 0,
    totalLong: 0,
    totalShort: 0,
    equity: 0,
    leverageLong: 0,
    leverageShort: 0,
  };
  for (const p of existing) {
    const value = p.positionValue ?? (p.markPrice ? p.size * p.markPrice : p.size * p.entryPrice);
    aggBefore.nominal += value;
    if (p.side === 'long') aggBefore.totalLong += value;
    else aggBefore.totalShort += value;
    if (p.marginUsed != null) aggBefore.equity += p.marginUsed;
    if (p.unrealizedPnl != null) aggBefore.equity += p.unrealizedPnl;
  }
  aggBefore.leverageLong = aggBefore.equity > 0 ? aggBefore.totalLong / aggBefore.equity : 0;
  aggBefore.leverageShort = aggBefore.equity > 0 ? aggBefore.totalShort / aggBefore.equity : 0;

  const aggAfter = { ...aggBefore };
  aggAfter.nominal += positionValueUsd;
  if (side === 'long') aggAfter.totalLong += positionValueUsd;
  else aggAfter.totalShort += positionValueUsd;
  aggAfter.equity += margin;  // assume the new margin is sourced from new capital
  aggAfter.leverageLong = aggAfter.equity > 0 ? aggAfter.totalLong / aggAfter.equity : 0;
  aggAfter.leverageShort = aggAfter.equity > 0 ? aggAfter.totalShort / aggAfter.equity : 0;

  // Daily carry across the whole book — before vs after. We can't easily
  // recompute existing-position carry without re-fetching live funding for
  // each (exchange, symbol) pair (the /positions API does this server-side
  // but we don't import its lib here — that'd require bigger refactor).
  // For now, scope the comparison to the NEW position only: caller still
  // gets a clear "this trade adds $X/day in carry" delta against zero,
  // which is the most useful read for the pre-trade check anyway.
  const dailyCarryBefore: number | null = newPositionDailyCarry != null ? 0 : null;
  const dailyCarryAfter: number | null = newPositionDailyCarry;

  return NextResponse.json({
    success: true,
    hypothetical: {
      symbol,
      side,
      positionValueUsd,
      leverage,
      exchange,
      markPrice,
      liquidationPrice,
      currentFundingPct,
      tpPrice: body.tpPrice ?? null,
      slPrice: body.slPrice ?? null,
      health: newPositionHealth,
      dailyFundingCarryUsd: newPositionDailyCarry,
      intervalHours: intervalHoursFor(exchange),
    },
    aggregate: {
      before: aggBefore,
      after: aggAfter,
      delta: {
        nominal: aggAfter.nominal - aggBefore.nominal,
        totalLong: aggAfter.totalLong - aggBefore.totalLong,
        totalShort: aggAfter.totalShort - aggBefore.totalShort,
        equity: aggAfter.equity - aggBefore.equity,
        leverageLong: aggAfter.leverageLong - aggBefore.leverageLong,
        leverageShort: aggAfter.leverageShort - aggBefore.leverageShort,
      },
      dailyFundingCarryUsdBefore: dailyCarryBefore,
      dailyFundingCarryUsdAfter: dailyCarryAfter,
    },
    existingPositionCount: existing.length,
    ts: Date.now(),
  }, { headers: NO_STORE });
}
