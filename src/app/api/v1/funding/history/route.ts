import { NextRequest, NextResponse } from 'next/server';
import { getBulkFundingHistory } from '@/lib/db';
import { authenticateV1Request } from '@/lib/api/v1-auth';
import { TIER_LIMITS, type Tier } from '@/lib/constants/tiers';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/funding/history
 *
 * Returns historical funding rate snapshots from DB. Lookback window is
 * tier-clamped per /pricing (Free 90d / Pro 365d / Whale 5y) — the
 * `days` param above the tier cap is silently rounded down and the
 * effective value is reported in `meta.days`.
 *
 * Query params:
 *   ?symbols=BTC,ETH   — required, comma-separated symbols (max 20)
 *   ?days=7             — lookback period (1 to tier cap, default: 7)
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateV1Request(request);
  if (!auth.ok) return auth.response;
  const { searchParams } = request.nextUrl;
  const symbolsParam = searchParams.get('symbols');
  const tier: Tier = (auth.user.tier === 'trader' || auth.user.tier === 'pro' || auth.user.tier === 'whale')
    ? auth.user.tier
    : 'free';
  // Whale = 5y, clamp to a sane int (Infinity isn't valid for SQL INTERVAL).
  const tierMaxDays = Number.isFinite(TIER_LIMITS[tier].historyDays)
    ? TIER_LIMITS[tier].historyDays
    : 365 * 5;
  const requestedDays = parseInt(searchParams.get('days') || '7', 10) || 7;
  const days = Math.min(tierMaxDays, Math.max(1, requestedDays));

  if (!symbolsParam) {
    return NextResponse.json(
      { success: false, error: 'Missing required parameter: symbols (e.g. ?symbols=BTC,ETH)' },
      { status: 400 },
    );
  }

  const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 20);
  if (symbols.length === 0) {
    return NextResponse.json(
      { success: false, error: 'No valid symbols provided' },
      { status: 400 },
    );
  }

  try {
    const historyMap = await getBulkFundingHistory(symbols, days);

    // Convert Map to plain object for JSON serialization
    const history: Record<string, Array<{ day: string; rate: number }>> = {};
    historyMap.forEach((value, key) => { history[key] = value; });

    return NextResponse.json({
      success: true,
      data: history,
      meta: {
        timestamp: Date.now(),
        symbols: symbols.length,
        days,
        // Tier context so partners can detect when their `days` param
        // got clamped by the tier cap (e.g. Free user asks for 365d,
        // gets 90). `requestedDays` only present when it differs.
        tier,
        tierMaxDays,
        ...(requestedDays !== days ? { requestedDays } : {}),
      },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
        ...auth.headers,
      },
    });
  } catch (e) {
    console.error('v1/funding/history error:', e);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch historical data' },
      { status: 500 },
    );
  }
}
