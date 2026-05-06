/**
 * GET /api/etf-flows?asset=btc|eth
 *
 * Spot-ETF daily NET FLOW timeseries scraped from farside.co.uk's
 * publicly-published HTML tables. Farside aggregates daily creation/
 * redemption from each issuer's filings — they're the canonical source.
 *
 * Cache hierarchy:
 *   1. In-process L1 (per-asset, 30 min TTL).
 *   2. Live Farside fetch — when reachable.
 *   3. Upstash Redis warm cache populated by cron/refresh-etf-flows
 *      every 30 min — survives Edge cold starts AND survives Farside
 *      occasionally returning a Cloudflare bot challenge (we serve
 *      the last-good payload from warm cache instead of "Source
 *      temporarily unavailable").
 *
 * Updated once per US trading day after market close, so a long warm-
 * cache freshness (36h) is appropriate.
 */
import { NextRequest, NextResponse } from 'next/server';
import { fetchFarsideFlows, type FlowDay } from '@/lib/etf-flows-fetch';
import { getWarmCache } from '@/lib/api/warm-cache';

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
  /** True when this response came from the Redis warm cache rather than a
   *  fresh Farside fetch. UI uses this to show a "cached" hint. */
  cached?: boolean;
  note?: string;
  ts: number;
}

const l1Cache = new Map<string, { body: ApiResponse; ts: number }>();
const L1_TTL = 30 * 60 * 1000;
const WARM_FRESHNESS_MS = 36 * 60 * 60 * 1000;

function buildBody(asset: 'btc' | 'eth', days: FlowDay[], issuers: string[]): ApiResponse {
  const last7 = days.slice(0, 7);
  const last30 = days.slice(0, 30);
  return {
    asset,
    issuers,
    days: days.slice(0, 90),
    cumulative7d: Math.round(last7.reduce((s, d) => s + d.total, 0) * 10) / 10,
    cumulative30d: Math.round(last30.reduce((s, d) => s + d.total, 0) * 10) / 10,
    latestDay: days[0] ?? null,
    dataAvailable: true,
    ts: Date.now(),
  };
}

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
      headers: { 'X-Cache': 'L1', 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' },
    });
  }

  // Live fetch — try Farside first.
  const result = await fetchFarsideFlows(asset);
  if (result.dataAvailable) {
    const body = buildBody(asset, result.days, result.issuers);
    l1Cache.set(cacheKey, { body, ts: Date.now() });
    return NextResponse.json(body, {
      headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' },
    });
  }

  // Farside blocked / failed — fall back to Redis warm cache populated by
  // cron/refresh-etf-flows whenever Farside is reachable.
  try {
    const warm = await getWarmCache<{ days: FlowDay[]; issuers: string[] }>(cacheKey);
    if (warm && Date.now() - warm.ts < WARM_FRESHNESS_MS && warm.body.days.length > 0) {
      const body = buildBody(asset, warm.body.days, warm.body.issuers);
      const ageHours = Math.round((Date.now() - warm.ts) / 3_600_000);
      body.cached = true;
      body.note = ageHours <= 1
        ? `Showing recent cached data. Farside currently rate-limiting.`
        : `Showing data ~${ageHours}h old (Farside currently rate-limiting from this datacenter).`;
      l1Cache.set(cacheKey, { body, ts: Date.now() });
      return NextResponse.json(body, {
        headers: { 'X-Cache': 'WARM-FALLBACK', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=1800' },
      });
    }
  } catch { /* ignore */ }

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
