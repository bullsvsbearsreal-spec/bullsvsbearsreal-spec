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

  try {
    let result;
    if (body.strategy === 'dca') {
      result = await runDcaBacktest({
        asset: String(body.config?.asset ?? 'bitcoin'),
        amountUsd: Number(body.config?.amountUsd) || 100,
        intervalDays: Number(body.config?.intervalDays) || 7,
        lookbackDays: Number(body.config?.lookbackDays) || 90,
      });
    } else if (body.strategy === 'funding-carry') {
      result = await runFundingCarryBacktest({
        notionalUsd: Number(body.config?.notionalUsd) || 10_000,
        lookbackDays: Number(body.config?.lookbackDays) || 30,
        symbol: body.config?.symbol ? String(body.config.symbol).toUpperCase() : undefined,
      });
    } else {
      return NextResponse.json({ success: false, error: 'Unknown strategy. Use "dca" or "funding-carry"' }, { status: 400 });
    }

    return NextResponse.json({ success: true, result }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        ...auth.headers,
      },
    });
  } catch (e) {
    console.error('v1/backtest error:', e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Backtest failed' },
      { status: 500 },
    );
  }
}
