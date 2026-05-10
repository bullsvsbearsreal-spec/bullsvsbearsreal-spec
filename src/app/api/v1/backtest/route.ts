import { NextRequest, NextResponse } from 'next/server';
import { authenticateV1Request } from '@/lib/api/v1-auth';
import { runDcaBacktest, runFundingCarryBacktest } from '@/lib/backtest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * POST /api/v1/backtest
 *
 * Run a strategy backtest. Same shape as the public route but bearer-authed.
 *
 * Body:
 *   { strategy: 'dca' | 'funding-carry', config: {...} }
 *
 * Auth: Bearer ih_xxx (free tier OK).
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateV1Request(request);
  if (!auth.ok) return auth.response;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  // Cap user-supplied lookbackDays to prevent unbounded queries against
  // long history (an attacker passing 99999999 would scan years of data).
  // Same cap as smart-money-leaderboard for consistency.
  const safeLookback = (raw: unknown, fallback: number) => {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return Math.min(Math.floor(n), 365);
  };

  try {
    let result;
    if (body.strategy === 'dca') {
      result = await runDcaBacktest({
        asset: String(body.config?.asset ?? 'bitcoin'),
        amountUsd: Math.min(Number(body.config?.amountUsd) || 100, 1_000_000_000),
        intervalDays: Math.min(Math.max(1, Number(body.config?.intervalDays) || 7), 365),
        lookbackDays: safeLookback(body.config?.lookbackDays, 90),
      });
    } else if (body.strategy === 'funding-carry') {
      result = await runFundingCarryBacktest({
        notionalUsd: Math.min(Number(body.config?.notionalUsd) || 10_000, 1_000_000_000),
        lookbackDays: safeLookback(body.config?.lookbackDays, 30),
        symbol: body.config?.symbol ? String(body.config.symbol).toUpperCase().slice(0, 16) : undefined,
      });
    } else {
      return NextResponse.json({ success: false, error: 'Unknown strategy. Use "dca" or "funding-carry"' }, { status: 400 });
    }

    // POST endpoint with user-supplied body — must NOT be public-cached.
    // Cloudflare doesn't include POST body in cache key by default, so a
    // public Cache-Control could serve one user's bespoke result to
    // another caller whose request happens to share the URL. Use no-store.
    return NextResponse.json({ success: true, result }, {
      headers: {
        'Cache-Control': 'no-store',
        ...auth.headers,
      },
    });
  } catch (e) {
    // Log the real error server-side, but return an opaque message to
    // the external caller. Internal errors may include DB query
    // fragments, file paths, or environment hints.
    console.error('v1/backtest error:', e);
    return NextResponse.json(
      { success: false, error: 'Backtest failed' },
      { status: 500 },
    );
  }
}
