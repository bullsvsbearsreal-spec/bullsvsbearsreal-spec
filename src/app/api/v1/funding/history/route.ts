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
 * tier-clamped per /pricing (Free 30d / Trader 180d / Pro 1y / Whale 5y) —
 * a `days` param above the tier cap is rounded down to it and reported in
 * `meta.days` (with `meta.requestedDays` when it differed).
 *
 * The archive accrues from launch forward: full-resolution data is kept for
 * 30 days and a daily-downsampled rollup beyond that, so deep windows fill in
 * over time rather than being backfilled. `meta.coverageDays` / `meta.earliestDay`
 * report the actual span returned, and `meta.note` flags when current coverage
 * is shallower than the requested window — no silent gap.
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

    // Actual coverage. The archive accrues forward, so the real span returned
    // can be shallower than the (tier-clamped) requested window. Surface the
    // earliest datapoint + span so partners never mistake "30 days of data"
    // for "the 180 I asked for". Each symbol's series is day-ascending, so
    // points[0] is its earliest day.
    let earliestDay: string | null = null;
    historyMap.forEach((points) => {
      const first = points[0];
      if (first && (!earliestDay || first.day < earliestDay)) {
        earliestDay = first.day;
      }
    });
    const coverageDays = earliestDay
      ? Math.floor((Date.now() - Date.parse(`${earliestDay}T00:00:00Z`)) / 86_400_000) + 1
      : 0;

    return NextResponse.json({
      success: true,
      data: history,
      meta: {
        timestamp: Date.now(),
        symbols: symbols.length,
        days,
        // Tier context so partners can detect when their `days` param
        // got clamped by the tier cap (e.g. Free user asks for 365d,
        // gets 30). `requestedDays` only present when it differs.
        tier,
        tierMaxDays,
        // Actual span of data returned (≤ days while the archive is still
        // filling in). `note` flags the shortfall explicitly.
        coverageDays,
        earliestDay,
        ...(coverageDays < days
          ? { note: 'Archive accrues from launch; windows deeper than current coverage fill in over time.' }
          : {}),
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
