/**
 * GET /api/etf?type=btc|eth
 *
 * Crypto ETF data: live quotes from Yahoo Finance, flow data from SoSoValue,
 * and historical price data for charting. Gracefully degrades if sources fail.
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout, maybeProxyUrl } from '../_shared/fetch';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

/* ─── Cache ─────────────────────────────────────────────────────────── */

const l1Cache = new Map<string, { body: any; timestamp: number }>();
const L1_TTL = 2 * 60 * 1000; // 2 minutes — ETF prices should feel live during market hours

/* ─── Static fund metadata ──────────────────────────────────────────── */

interface FundMeta {
  ticker: string;
  name: string;
  issuer: string;
  fee: number;
}

const BTC_ETFS: FundMeta[] = [
  { ticker: 'IBIT', name: 'iShares Bitcoin Trust ETF', issuer: 'BlackRock', fee: 0.25 },
  { ticker: 'FBTC', name: 'Fidelity Wise Origin Bitcoin Fund', issuer: 'Fidelity', fee: 0.25 },
  { ticker: 'GBTC', name: 'Grayscale Bitcoin Trust', issuer: 'Grayscale', fee: 1.50 },
  { ticker: 'ARKB', name: 'ARK 21Shares Bitcoin ETF', issuer: 'ARK/21Shares', fee: 0.21 },
  { ticker: 'BITB', name: 'Bitwise Bitcoin ETF', issuer: 'Bitwise', fee: 0.20 },
  { ticker: 'HODL', name: 'VanEck Bitcoin Trust', issuer: 'VanEck', fee: 0.20 },
  { ticker: 'BRRR', name: 'CoinShares Valkyrie Bitcoin Fund', issuer: 'Valkyrie', fee: 0.25 },
  { ticker: 'BTCO', name: 'Invesco Galaxy Bitcoin ETF', issuer: 'Invesco', fee: 0.25 },
  { ticker: 'EZBC', name: 'Franklin Bitcoin ETF', issuer: 'Franklin Templeton', fee: 0.19 },
  { ticker: 'BTCW', name: 'WisdomTree Bitcoin Fund', issuer: 'WisdomTree', fee: 0.30 },
];

const ETH_ETFS: FundMeta[] = [
  { ticker: 'ETHA', name: 'iShares Ethereum Trust ETF', issuer: 'BlackRock', fee: 0.25 },
  { ticker: 'ETHE', name: 'Grayscale Ethereum Trust', issuer: 'Grayscale', fee: 1.50 },
  { ticker: 'FETH', name: 'Fidelity Ethereum Fund', issuer: 'Fidelity', fee: 0.25 },
  { ticker: 'ETHW', name: 'Bitwise Ethereum ETF', issuer: 'Bitwise', fee: 0.20 },
  { ticker: 'CETH', name: 'Franklin Ethereum ETF', issuer: 'Franklin Templeton', fee: 0.19 },
  { ticker: 'ETHV', name: 'VanEck Ethereum Trust', issuer: 'VanEck', fee: 0.20 },
  { ticker: 'QETH', name: '21Shares Core Ethereum ETF', issuer: '21Shares', fee: 0.21 },
];

/* ─── Yahoo Finance fetching ────────────────────────────────────────── */

interface YahooQuote {
  price: number;
  previousClose: number;
  changePct: number;
  volume: number;
}

async function fetchYahooQuote(ticker: string): Promise<YahooQuote | null> {
  try {
    const res = await fetchWithTimeout(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=5d&interval=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' } },
      6000,
    );
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const meta = result?.meta;
    if (!meta) return null;

    // On datacenter IPs, Yahoo's meta.regularMarketPrice can be 1-2 days stale.
    // The last candle close from the chart data is always the most recent trading day.
    // Yahoo sometimes duplicates the last candle (same timestamp), so deduplicate by date.
    const timestamps = result?.timestamp as number[] | undefined;
    const closes = result?.indicators?.quote?.[0]?.close as number[] | undefined;
    // Build unique daily closes (last value per date wins)
    const dailyCloses: number[] = [];
    if (Array.isArray(timestamps) && Array.isArray(closes)) {
      const seen = new Set<string>();
      // Walk backwards to get most recent value per date
      for (let i = timestamps.length - 1; i >= 0; i--) {
        const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
        if (!seen.has(date) && closes[i] != null) {
          seen.add(date);
          dailyCloses.unshift(closes[i]);
        }
      }
    }
    const metaPrice = meta.regularMarketPrice || 0;
    const chartPrice = dailyCloses.length > 0 ? dailyCloses[dailyCloses.length - 1] : 0;
    // Use whichever is more recent: meta.regularMarketPrice (real-time during market hours)
    // or the last chart candle close (end-of-day). During market hours, meta is fresher.
    // If they differ significantly (>0.5%), prefer meta as it updates in real-time.
    const priceDiffPct = chartPrice > 0 && metaPrice > 0
      ? Math.abs(metaPrice - chartPrice) / chartPrice * 100
      : 0;
    const price = metaPrice > 0 && (priceDiffPct > 0.5 || chartPrice === 0) ? metaPrice : (chartPrice || metaPrice);
    // For daily change: use the day before, or chartPreviousClose as fallback
    const prev = dailyCloses.length > 1
      ? dailyCloses[dailyCloses.length - 2]
      : (meta.chartPreviousClose || meta.previousClose || 0);

    // Volume: prefer last candle volume, fall back to meta
    const volumes = result?.indicators?.quote?.[0]?.volume as number[] | undefined;
    const lastVolume = Array.isArray(volumes) && volumes.length > 0
      ? volumes[volumes.length - 1] || 0
      : 0;

    return {
      price,
      previousClose: prev,
      changePct: prev > 0 ? ((price - prev) / prev) * 100 : 0,
      volume: lastVolume || meta.regularMarketVolume || 0,
    };
  } catch {
    return null;
  }
}

async function fetchLeadHistory(
  ticker: string,
): Promise<Array<{ date: string; close: number; volume: number }>> {
  try {
    const res = await fetchWithTimeout(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=3mo&interval=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' } },
      8000,
    );
    if (!res.ok) return [];
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result?.timestamp) return [];

    const ts: number[] = result.timestamp;
    const q = result.indicators?.quote?.[0] || {};

    return ts
      .map((t: number, i: number) => ({
        date: new Date(t * 1000).toISOString().split('T')[0],
        close: q.close?.[i] ?? null,
        volume: q.volume?.[i] ?? null,
      }))
      .filter((h: any) => h.close !== null);
  } catch {
    return [];
  }
}

/* ─── Yahoo Finance AUM (crumb-auth flow) ──────────────────────────────
 *
 * Yahoo's quoteSummary v10 endpoint requires a "crumb" auth token with a
 * matching session cookie since their 2024 anti-scrape lockdown. Flow:
 *   1. GET https://fc.yahoo.com/ to set the session cookie.
 *   2. GET /v1/test/getcrumb with that cookie → returns the crumb token.
 *   3. GET /v10/finance/quoteSummary/<TICKER>?modules=...&crumb=<crumb>
 *      with the same cookie → returns full ETF data including totalAssets.
 *
 * The crumb is per-cookie, so we cache the (cookie, crumb) pair for an
 * hour to amortise the 2 round-trips.
 *
 * Replaces the dead SoSoValue source. SoSoValue's .com returns 000 (DNS)
 * and .xyz returns 401 since their May 2026 API rework. Yahoo gives us
 * `totalAssets` directly which IS the AUM figure we surface.
 */

const YAHOO_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

interface YahooSession {
  cookie: string;
  crumb: string;
  ts: number;
}
let yahooSession: YahooSession | null = null;
const YAHOO_SESSION_TTL = 60 * 60 * 1000; // 1h — crumbs are fairly long-lived

/** Raw fetch with timeout — bypasses fetchWithTimeout's automatic proxy
 *  routing. Critical for Yahoo's crumb flow because the proxy strips
 *  cookies (the whole reason crumb auth exists) and the cookie returned
 *  by the proxy wouldn't match the crumb returned by the proxy on a
 *  separate call. */
async function rawFetch(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

async function getYahooSession(): Promise<YahooSession | null> {
  if (yahooSession && Date.now() - yahooSession.ts < YAHOO_SESSION_TTL) {
    return yahooSession;
  }
  try {
    // Step 1: hit fc.yahoo.com to get the session cookie.
    // IMPORTANT: use rawFetch (not fetchWithTimeout) — Yahoo is in
    // PROXIED_DOMAINS so fetchWithTimeout would route through PROXY_URL,
    // which strips cookies and breaks the crumb-auth chain.
    const cookieRes = await rawFetch(
      'https://fc.yahoo.com/',
      { headers: { 'User-Agent': YAHOO_UA }, redirect: 'manual' },
      5000,
    );
    const setCookie = cookieRes.headers.get('set-cookie') || '';
    // Extract just the name=value pair(s) we need (Yahoo sets multiple).
    const cookie = setCookie
      .split(/,\s*(?=[A-Z])/)
      .map(c => c.split(';')[0].trim())
      .filter(Boolean)
      .join('; ');
    if (!cookie) return null;

    // Step 2: get the crumb with that cookie. Same proxy-bypass.
    const crumbRes = await rawFetch(
      'https://query2.finance.yahoo.com/v1/test/getcrumb',
      { headers: { 'User-Agent': YAHOO_UA, Cookie: cookie } },
      5000,
    );
    if (!crumbRes.ok) return null;
    const crumb = (await crumbRes.text()).trim();
    if (!crumb || crumb.length < 5) return null;

    yahooSession = { cookie, crumb, ts: Date.now() };
    return yahooSession;
  } catch {
    return null;
  }
}

interface YahooFundDetail {
  totalAssets: number | null;   // AUM in USD
  netAssets: number | null;     // Sometimes the only field set
  expenseRatio: number | null;  // Annual fee, decimal (0.0025 = 0.25%)
}

async function fetchYahooFundDetail(ticker: string, sess: YahooSession): Promise<YahooFundDetail | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}` +
      `?modules=defaultKeyStatistics,summaryDetail,fundProfile&crumb=${encodeURIComponent(sess.crumb)}`;
    // rawFetch — same reason as in getYahooSession. The crumb is bound
    // to the cookie we obtained, so the proxy can't substitute its own.
    const res = await rawFetch(
      url,
      { headers: { 'User-Agent': YAHOO_UA, Cookie: sess.cookie } },
      6000,
    );
    if (!res.ok) return null;
    const json = await res.json();
    const r = json?.quoteSummary?.result?.[0];
    if (!r) return null;

    // totalAssets sits on defaultKeyStatistics.totalAssets.raw for ETFs.
    const totalAssets = r.defaultKeyStatistics?.totalAssets?.raw ?? null;
    // Some funds report as netAssets via summaryDetail.netAssets.raw.
    const netAssets = r.summaryDetail?.netAssets?.raw
      ?? r.summaryDetail?.totalAssets?.raw
      ?? null;
    const expenseRatio = r.fundProfile?.feesExpensesInvestment?.annualReportExpenseRatio?.raw ?? null;

    return {
      totalAssets: typeof totalAssets === 'number' && totalAssets > 0 ? totalAssets : null,
      netAssets: typeof netAssets === 'number' && netAssets > 0 ? netAssets : null,
      expenseRatio: typeof expenseRatio === 'number' && expenseRatio >= 0 ? expenseRatio : null,
    };
  } catch {
    return null;
  }
}

/** Fetch AUM for every fund in parallel. Single map: ticker → AUM in USD. */
async function fetchAllYahooAum(tickers: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const sess = await getYahooSession();
  if (!sess) return out;

  const results = await Promise.allSettled(
    tickers.map(async (t) => ({ ticker: t, detail: await fetchYahooFundDetail(t, sess) })),
  );
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const aum = r.value.detail?.totalAssets ?? r.value.detail?.netAssets ?? null;
    if (aum && aum > 0) out.set(r.value.ticker, aum);
  }
  return out;
}

/* ─── SoSoValue fetching ────────────────────────────────────────────── */

async function fetchSoSoValueData(type: 'btc' | 'eth'): Promise<any | null> {
  const slug = type === 'btc' ? 'us-btc-spot' : 'us-eth-spot';
  for (const domain of ['api.sosovalue.com', 'api.sosovalue.xyz']) {
    try {
      const res = await fetchWithTimeout(
        `https://${domain}/haveFun/etf/board/list?etfType=${slug}`,
        { headers: { Accept: 'application/json' } },
        8000,
      );
      if (res.ok) {
        const json = await res.json();
        if (json.data) return json.data;
      }
    } catch {
      /* silent */
    }
  }
  return null;
}

function findFundData(liveData: any, ticker: string): any {
  if (!Array.isArray(liveData)) return null;
  return (
    liveData.find(
      (item: any) =>
        item.ticker === ticker ||
        item.symbol === ticker ||
        item.etfTicker === ticker ||
        (item.name && item.name.includes(ticker)),
    ) || null
  );
}

/* ─── Main handler ──────────────────────────────────────────────────── */

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const type = (searchParams.get('type') || 'btc').toLowerCase() as 'btc' | 'eth';

  if (!['btc', 'eth'].includes(type)) {
    return NextResponse.json({ error: 'type must be btc or eth' }, { status: 400 });
  }

  const cacheKey = `etf_v2_${type}`;
  const cached = l1Cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < L1_TTL) {
    return NextResponse.json(cached.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' },
    });
  }

  const funds = type === 'btc' ? BTC_ETFS : ETH_ETFS;
  const leadTicker = funds[0].ticker;
  const tickers = funds.map((f) => f.ticker);

  // Fetch all sources in parallel. Yahoo's crumb-flow is the new primary
  // AUM source (SoSoValue's API died May 2026: .com → 000, .xyz → 401).
  // SoSoValue is kept as a tertiary fallback in case it ever comes back.
  const [sosoData, yahooQuotes, yahooAum, history] = await Promise.all([
    fetchSoSoValueData(type),
    Promise.all(funds.map((f) => fetchYahooQuote(f.ticker))),
    fetchAllYahooAum(tickers),
    fetchLeadHistory(leadTicker),
  ]);

  // Merge data
  let totalVolume = 0;
  let totalMarketCap = 0;

  const enrichedFunds = funds.map((f, i) => {
    const yahoo = yahooQuotes[i];
    const soso = sosoData ? findFundData(sosoData, f.ticker) : null;

    const price = yahoo?.price ?? soso?.price ?? null;
    const change24h = yahoo?.changePct ?? soso?.changePct ?? null;
    const volume = yahoo?.volume ?? soso?.volume ?? null;
    // Prefer Yahoo's totalAssets (working source as of May 2026), fall
    // through to SoSoValue if it ever returns. Drops to null only when
    // both sources fail.
    const marketCap = yahooAum.get(f.ticker)
      ?? soso?.marketCap
      ?? soso?.aum
      ?? soso?.totalNetAssets
      ?? null;

    if (volume) totalVolume += volume;
    if (marketCap) totalMarketCap += marketCap;

    return { ...f, price, change24h, volume, marketCap };
  });

  const liveCount = enrichedFunds.filter((f) => f.price !== null).length;

  const body = {
    type,
    asset: type === 'btc' ? 'Bitcoin' : 'Ethereum',
    summary: {
      totalFunds: funds.length,
      dailyVolume: totalVolume || null,
      totalAum: totalMarketCap || null,
      liveQuotes: liveCount,
    },
    funds: enrichedFunds,
    history,
    timestamp: Date.now(),
  };

  l1Cache.set(cacheKey, { body, timestamp: Date.now() });

  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' },
  });
}
