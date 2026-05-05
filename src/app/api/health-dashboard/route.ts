/**
 * GET /api/health-dashboard
 *
 * Hits every InfoHub API endpoint in parallel and reports status, latency,
 * and response size. Acts as a fast smoke test — if a row turns red on the
 * page, the underlying endpoint is broken on production.
 *
 * Server-side because client-side same-origin polling triggers Cloudflare's
 * rate limiter; doing it once here and broadcasting to clients is friendlier.
 *
 * No upstream calls — this is local-only. L1 cached 60s so the page can
 * refresh aggressively without re-hitting every endpoint.
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface EndpointCheck {
  name: string;
  path: string;
  /** Optional query params to make the call meaningful. */
  query?: string;
  /** Group label for display. */
  group: 'Funding' | 'Options' | 'ETFs' | 'Discovery' | 'Synthesis' | 'On-Chain' | 'Equities' | 'Tools' | 'Events';
  /** Bytes below which the response is considered "thin" (likely degraded). */
  minBytes?: number;
}

interface CheckResult {
  name: string;
  path: string;
  group: EndpointCheck['group'];
  status: number;
  ok: boolean;
  thin: boolean;
  latencyMs: number;
  bytes: number;
  /** Cache-Control header echoed for diagnostics. */
  cacheControl: string | null;
  xCache: string | null;
  /** First 120 chars of response body if status !== 200, for diagnostics. */
  errorPreview?: string;
}

interface ApiResponse {
  rows: CheckResult[];
  summary: {
    total: number;
    ok: number;
    failed: number;
    degraded: number;
    avgLatencyMs: number;
  };
  ts: number;
}

const ENDPOINTS: EndpointCheck[] = [
  { name: 'Funding Countdown', path: '/api/funding-countdown', group: 'Funding', minBytes: 500 },
  { name: 'Funding Predictor',  path: '/api/funding-predictor',  group: 'Funding', minBytes: 500 },
  { name: 'Funding Flips',      path: '/api/funding-flips',      group: 'Funding', minBytes: 80 },
  { name: 'Funding Paid 30d',   path: '/api/funding-paid',       group: 'Funding', minBytes: 500 },
  { name: 'Funding Leaderboard', path: '/api/funding-leaderboard', group: 'Funding', minBytes: 500 },
  { name: 'Skew',               path: '/api/skew',     query: '?asset=BTC', group: 'Options', minBytes: 200 },
  { name: 'RV vs IV',           path: '/api/rv-iv',    query: '?asset=BTC', group: 'Options', minBytes: 200 },
  { name: 'CME Basis',          path: '/api/cme-basis', group: 'Options', minBytes: 100 },
  { name: 'ETF Flows BTC',      path: '/api/etf-flows', query: '?asset=btc', group: 'ETFs', minBytes: 100 },
  { name: 'ETF Flows ETH',      path: '/api/etf-flows', query: '?asset=eth', group: 'ETFs', minBytes: 100 },
  { name: 'ETF Counterfactual', path: '/api/etf-counterfactual', query: '?asset=btc', group: 'ETFs', minBytes: 100 },
  { name: 'Crypto Stocks',      path: '/api/crypto-stocks', group: 'Equities', minBytes: 500 },
  { name: 'Sectors',            path: '/api/sectors',         group: 'Discovery', minBytes: 1000 },
  { name: 'Memecoin Radar',     path: '/api/memecoin-radar',  group: 'Discovery', minBytes: 200 },
  { name: 'Top Movers',         path: '/api/top-movers',      group: 'Discovery', minBytes: 500 },
  { name: 'Trending Tokens',    path: '/api/trending-tokens', group: 'Discovery', minBytes: 100 },
  { name: 'TGE Calendar',       path: '/api/tge-calendar',    group: 'Events', minBytes: 200 },
  { name: 'FOMC Playbook',      path: '/api/fomc-playbook',   group: 'Events', minBytes: 500 },
  { name: 'Stablecoin Supply',  path: '/api/stablecoin-supply', group: 'On-Chain', minBytes: 1000 },
  { name: 'Validators',         path: '/api/validators',      group: 'On-Chain', minBytes: 500 },
  { name: 'Volume Share',       path: '/api/volume-share',    group: 'On-Chain', minBytes: 500 },
  { name: 'On-Chain (BTC)',     path: '/api/onchain',         group: 'On-Chain', minBytes: 1000 },
  { name: 'Cycle Phase',        path: '/api/cycle-phase',     group: 'Synthesis', minBytes: 200 },
  { name: 'Crowdedness',        path: '/api/crowdedness',     group: 'Synthesis', minBytes: 500 },
  { name: 'Insider Watch',      path: '/api/insider-transfers', group: 'Synthesis', minBytes: 50 },
  { name: 'Smart Money',        path: '/api/smart-money?limit=10', group: 'Synthesis', minBytes: 500 },
  { name: 'OB Imbalance',       path: '/api/orderbook/multi', query: '?symbol=BTC&exchanges=Binance,Bybit&depth=true', group: 'Tools', minBytes: 200 },
];

const PER_CHECK_TIMEOUT = 10_000;
let l1: { body: ApiResponse; ts: number } | null = null;
const L1_TTL = 60_000;

async function checkOne(origin: string, ep: EndpointCheck): Promise<CheckResult> {
  const url = `${origin}${ep.path}${ep.query ?? ''}`;
  const start = Date.now();
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(PER_CHECK_TIMEOUT),
      // Bypass our own L1 cache to get a real reading. The Cache-Control
      // header on the response tells us if CF served a HIT or MISS.
      cache: 'no-store',
      headers: { 'cache-control': 'no-cache' },
    });
    const latencyMs = Date.now() - start;
    const cacheControl = res.headers.get('cache-control');
    const xCache = res.headers.get('x-cache');
    let bytes = 0;
    let errorPreview: string | undefined;
    if (res.body) {
      const text = await res.text();
      bytes = text.length;
      if (!res.ok) errorPreview = text.slice(0, 120);
    }
    const thin = ep.minBytes != null && bytes < ep.minBytes;
    return {
      name: ep.name,
      path: ep.path,
      group: ep.group,
      status: res.status,
      ok: res.ok,
      thin,
      latencyMs,
      bytes,
      cacheControl,
      xCache,
      errorPreview,
    };
  } catch (e) {
    return {
      name: ep.name,
      path: ep.path,
      group: ep.group,
      status: 0,
      ok: false,
      thin: false,
      latencyMs: Date.now() - start,
      bytes: 0,
      cacheControl: null,
      xCache: null,
      errorPreview: e instanceof Error ? e.message.slice(0, 120) : 'fetch error',
    };
  }
}

export async function GET(request: NextRequest) {
  if (l1 && Date.now() - l1.ts < L1_TTL) {
    return NextResponse.json(l1.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  }

  const origin = request.nextUrl.origin;

  // Fan out in parallel but cap concurrency at 8 to avoid CF rate-limiter
  // tripping on our own self-checks.
  const BATCH = 8;
  const rows: CheckResult[] = [];
  for (let i = 0; i < ENDPOINTS.length; i += BATCH) {
    const slice = ENDPOINTS.slice(i, i + BATCH);
    const results = await Promise.all(slice.map(ep => checkOne(origin, ep)));
    rows.push(...results);
  }

  const ok = rows.filter(r => r.ok && !r.thin).length;
  const failed = rows.filter(r => !r.ok).length;
  const degraded = rows.filter(r => r.ok && r.thin).length;
  const avgLatencyMs = Math.round(rows.reduce((s, r) => s + r.latencyMs, 0) / Math.max(1, rows.length));

  const body: ApiResponse = {
    rows,
    summary: { total: rows.length, ok, failed, degraded, avgLatencyMs },
    ts: Date.now(),
  };

  l1 = { body, ts: Date.now() };

  return NextResponse.json(body, {
    headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  });
}
