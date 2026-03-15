/**
 * GET /api/etf?type=btc|eth
 *
 * Crypto ETF data: live quotes from Yahoo Finance, flow data from SoSoValue,
 * and historical price data for charting. Gracefully degrades if sources fail.
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

/* ─── Cache ─────────────────────────────────────────────────────────── */

const l1Cache = new Map<string, { body: any; timestamp: number }>();
const L1_TTL = 5 * 60 * 1000; // 5 minutes

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
    const price = dailyCloses.length > 0 ? dailyCloses[dailyCloses.length - 1] : metaPrice;
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
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; InfoHub/1.0)' } },
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
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  }

  const funds = type === 'btc' ? BTC_ETFS : ETH_ETFS;
  const leadTicker = funds[0].ticker;

  // Fetch all sources in parallel
  const [sosoData, yahooQuotes, history] = await Promise.all([
    fetchSoSoValueData(type),
    Promise.all(funds.map((f) => fetchYahooQuote(f.ticker))),
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
    const marketCap = soso?.marketCap ?? soso?.aum ?? soso?.totalNetAssets ?? null;

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
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  });
}
