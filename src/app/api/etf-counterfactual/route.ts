/**
 * GET /api/etf-counterfactual?asset=btc|eth
 *
 * Counterfactual price model: "where would BTC be without ETF flows?".
 *
 * Methodology (intentionally simple, transparency over precision):
 * 1. Pull daily ETF net flows ($) from /api/etf-flows
 * 2. Pull daily BTC closes from CoinGecko market_chart
 * 3. Estimate ETF "absorption" — what fraction of BTC daily price action
 *    is attributable to net ETF flow vs the rest of the market.
 *
 * We use a coarse linear approximation: every $X of net flow is assumed
 * to support roughly $Y of marginal price impact, calibrated from the
 * regression of (daily_flow_usd) vs (daily_btc_return). Then we strip
 * that contribution out and compound the residual returns to build the
 * counterfactual price path.
 *
 * Caveats baked into the response: this is a directional/illustrative
 * tool, not a research-grade model. Free APIs only. L1 cached 30 min.
 */
import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

interface FarsideFlowDay { date: string; total: number /* $M */ }

interface ApiResponse {
  asset: 'btc' | 'eth';
  /** Calibrated impact per $1B of daily flow → % price move (e.g. 0.012 = 1.2% per $B). */
  impactPerBillion: number;
  /** Number of overlapping days used to fit the regression. */
  fitN: number;
  /** Pearson R between daily flow and daily return — fit quality indicator. */
  fitR: number;
  /** Aligned daily series most-recent first. */
  days: Array<{
    date: string;
    actualPrice: number;
    counterfactualPrice: number;
    netFlowM: number;
  }>;
  /** Latest day */
  latest: { date: string; actualPrice: number; counterfactualPrice: number; gapPct: number } | null;
  ts: number;
}

const TIMEOUT = 12_000;
const l1Cache = new Map<string, { body: ApiResponse; ts: number }>();
const L1_TTL = 30 * 60 * 1000;

interface CGMarketChart { prices: Array<[number, number]> }

async function fetchPriceHistory(asset: 'btc' | 'eth'): Promise<Array<{ date: string; close: number }>> {
  const id = asset === 'btc' ? 'bitcoin' : 'ethereum';
  const res = await fetchWithTimeout(
    `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=180&interval=daily`,
    { headers: { 'Accept': 'application/json' } },
    TIMEOUT,
  );
  if (!res.ok) return [];
  const json = await res.json() as CGMarketChart;
  if (!Array.isArray(json.prices)) return [];
  // CoinGecko returns ms timestamps + close prices. Normalise to YYYY-MM-DD.
  return json.prices.map(([ms, close]) => ({
    date: new Date(ms).toISOString().slice(0, 10),
    close,
  }));
}

async function fetchEtfFlows(asset: 'btc' | 'eth', request: NextRequest): Promise<FarsideFlowDay[]> {
  // Reuse the etf-flows endpoint we already built — same Farside source,
  // already cached server-side. Build absolute URL using the request origin.
  const origin = request.nextUrl.origin;
  const res = await fetchWithTimeout(
    `${origin}/api/etf-flows?asset=${asset}`,
    {},
    TIMEOUT,
  );
  if (!res.ok) return [];
  const json = await res.json() as { days?: Array<{ date: string; total: number }> };
  return (json.days ?? []).map(d => ({ date: d.date, total: d.total }));
}

/** Pearson correlation. */
function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 5) return 0;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den > 0 ? num / den : 0;
}

/** Slope of OLS regression y ~ x (no intercept needed when both centered). */
function olsSlope(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 5) return 0;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    num += a * (ys[i] - my);
    den += a * a;
  }
  return den > 0 ? num / den : 0;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const asset = (searchParams.get('asset') || 'btc').toLowerCase() as 'btc' | 'eth';
  if (asset !== 'btc' && asset !== 'eth') {
    return NextResponse.json({ error: 'asset must be btc or eth' }, { status: 400 });
  }

  const cacheKey = `etf_cf_${asset}`;
  const cached = l1Cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < L1_TTL) {
    return NextResponse.json(cached.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' },
    });
  }

  try {
    const [priceHist, flows] = await Promise.all([
      fetchPriceHistory(asset),
      fetchEtfFlows(asset, request),
    ]);

    if (priceHist.length < 30 || flows.length < 30) {
      return NextResponse.json(
        { error: 'insufficient overlap for fit', hint: 'Need 30+ days of both flow and price.' },
        { status: 503 },
      );
    }

    // Index by date
    const flowByDate = new Map(flows.map(f => [f.date, f.total])); // $M
    // Build aligned daily series from oldest → newest
    const sorted = [...priceHist].sort((a, b) => a.date.localeCompare(b.date));
    const aligned: Array<{ date: string; close: number; ret: number; flow: number }> = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1].close;
      if (prev <= 0) continue;
      const ret = (sorted[i].close - prev) / prev;
      const flow = flowByDate.get(sorted[i].date) ?? null;
      // Only include days we have *both* flow and return. Weekends/holidays
      // have no ETF flow and would corrupt the regression — skip them.
      if (flow == null) continue;
      aligned.push({ date: sorted[i].date, close: sorted[i].close, ret, flow });
    }

    if (aligned.length < 30) {
      return NextResponse.json(
        { error: 'too few aligned days', hint: 'Need 30+ overlapping flow+price days.' },
        { status: 503 },
      );
    }

    // Fit ret ~ slope × (flow / 1000) + e   →   slope is "% return per $B"
    const xsBn = aligned.map(d => d.flow / 1000); // $B
    const ys = aligned.map(d => d.ret);
    const slope = olsSlope(xsBn, ys);
    const r = pearson(xsBn, ys);
    // impactPerBillion: e.g. 0.0125 = 1.25% expected price move per $B inflow
    const impactPerBillion = slope;

    // Build counterfactual price path: strip out (slope × flow$B) from each
    // daily return and compound forward starting from the same start price.
    const startIdx = sorted.findIndex(p => p.date === aligned[0].date) - 1;
    const startPrice = sorted[Math.max(0, startIdx)]?.close ?? sorted[0].close;
    const days: ApiResponse['days'] = [];
    let cf = startPrice;
    for (const d of aligned) {
      const flowBn = d.flow / 1000;
      const stripped = d.ret - slope * flowBn;
      cf = cf * (1 + stripped);
      days.push({
        date: d.date,
        actualPrice: Math.round(d.close * 100) / 100,
        counterfactualPrice: Math.round(cf * 100) / 100,
        netFlowM: d.flow,
      });
    }

    days.reverse(); // most recent first

    const latest = days[0]
      ? {
          date: days[0].date,
          actualPrice: days[0].actualPrice,
          counterfactualPrice: days[0].counterfactualPrice,
          gapPct: days[0].counterfactualPrice > 0
            ? Math.round(((days[0].actualPrice - days[0].counterfactualPrice) / days[0].counterfactualPrice) * 1000) / 10
            : 0,
        }
      : null;

    const body: ApiResponse = {
      asset,
      impactPerBillion: Math.round(impactPerBillion * 1e5) / 1e5,
      fitN: aligned.length,
      fitR: Math.round(r * 100) / 100,
      days: days.slice(0, 90),
      latest,
      ts: Date.now(),
    };

    l1Cache.set(cacheKey, { body, ts: Date.now() });

    return NextResponse.json(body, {
      headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'failed' },
      { status: 502 },
    );
  }
}
