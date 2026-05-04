/**
 * GET /api/etf-flows?asset=btc|eth
 *
 * Spot-ETF daily NET FLOW timeseries scraped from farside.co.uk's
 * publicly-published HTML tables. Farside aggregates daily creation/
 * redemption from each issuer's filings — they're the canonical source
 * everyone screenshots.
 *
 * Free, no auth. L1 cached 30 min — Farside updates once per US trading
 * day after market close so a long cache is appropriate.
 */
import { NextRequest, NextResponse } from 'next/server';
import { fetchFarsideFlows, type FlowDay } from '@/lib/etf-flows-fetch';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

interface ApiResponse {
  asset: 'btc' | 'eth';
  issuers: string[];
  days: FlowDay[];
  cumulative7d: number;
  cumulative30d: number;
  latestDay: FlowDay | null;
  dataAvailable: boolean;
  note?: string;
  ts: number;
}

const l1Cache = new Map<string, { body: ApiResponse; ts: number }>();
const L1_TTL = 30 * 60 * 1000;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const asset = (searchParams.get('asset') || 'btc').toLowerCase() as 'btc' | 'eth';
  if (asset !== 'btc' && asset !== 'eth') {
    return NextResponse.json({ error: 'asset must be btc or eth' }, { status: 400 });
  }

  const cacheKey = `etf_flows_${asset}`;
  const cached = l1Cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < L1_TTL) {
    return NextResponse.json(cached.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' },
    });
  }

  const result = await fetchFarsideFlows(asset);

  if (!result.dataAvailable) {
    if (cached) return NextResponse.json(cached.body, { headers: { 'X-Cache': 'STALE' } });
    return NextResponse.json(
      {
        asset,
        issuers: [],
        days: [],
        cumulative7d: 0,
        cumulative30d: 0,
        latestDay: null,
        dataAvailable: false,
        note: result.note ?? 'Source unavailable.',
        ts: Date.now(),
      },
      { headers: { 'X-Cache': 'BYPASS', 'Cache-Control': 'no-store' } },
    );
  }

  const last7 = result.days.slice(0, 7);
  const last30 = result.days.slice(0, 30);
  const cumulative7d = Math.round(last7.reduce((s, d) => s + d.total, 0) * 10) / 10;
  const cumulative30d = Math.round(last30.reduce((s, d) => s + d.total, 0) * 10) / 10;

  const body: ApiResponse = {
    asset,
    issuers: result.issuers,
    days: result.days.slice(0, 90),
    cumulative7d,
    cumulative30d,
    latestDay: result.days[0] ?? null,
    dataAvailable: true,
    ts: Date.now(),
  };

  l1Cache.set(cacheKey, { body, ts: Date.now() });

  return NextResponse.json(body, {
    headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' },
  });
}
