/**
 * GET /api/funding-leaderboard
 *
 * Per-exchange "funding fees redirected" leaderboard. For each top venue
 * we sum the 30d cumulative funding rate × open-interest as a proxy for
 * total funding $ paid by longs (or rebated to them, when negative).
 *
 * Useful for answering: "Which exchange has paid out the most funding
 * to retail short-sellers (or extracted the most from long-traders) this
 * past month?"
 *
 * Methodology (transparent in the response):
 *   For BTC + ETH on each venue:
 *     - 30-day funding history (sum of per-window rates)
 *     - Current open interest
 *     - Implied $ flow ≈ avg-rate × OI × number-of-windows × USD-mark
 *   Then aggregate across coins per exchange.
 *
 * Free Binance + Bybit + OKX + Bitget + Hyperliquid endpoints. L1 cached
 * 30 min — these numbers move slowly.
 */
import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface VenueRow {
  exchange: string;
  /** Implied total funding $ over 30 days, summed across BTC + ETH (positive = longs paid, neg = longs rebated). */
  flow30dUsd: number;
  /** Avg funding rate per 8h window over 30d, weighted by OI. */
  avgRate: number;
  /** Number of unique 8h windows in the 30d window. */
  windows: number;
  /** Aggregate OI across BTC + ETH at the venue (USD). */
  totalOi: number;
  /** Per-coin breakdown for transparency. */
  perCoin: Array<{ symbol: string; cumulative30d: number; oiUsd: number }>;
}

interface ApiResponse {
  rows: VenueRow[];
  totalFlow30d: number;
  ts: number;
}

const TIMEOUT = 8000;
let l1: { body: ApiResponse; ts: number } | null = null;
const L1_TTL = 30 * 60 * 1000;
const COINS = ['BTC', 'ETH'];

/* ─── Per-venue fetchers ──────────────────────────────────────────────── */

async function binanceCoinSnapshot(coin: string) {
  try {
    const sym = `${coin}USDT`;
    const startTime = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const [fundingRes, oiRes] = await Promise.all([
      fetchWithTimeout(
        `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${sym}&startTime=${startTime}&limit=1000`,
        {}, TIMEOUT,
      ),
      fetchWithTimeout(
        `https://fapi.binance.com/fapi/v1/openInterest?symbol=${sym}`,
        {}, TIMEOUT,
      ),
    ]);
    if (!fundingRes.ok || !oiRes.ok) return null;
    const fundingArr = await fundingRes.json() as Array<{ fundingRate: string }>;
    const oiJson = await oiRes.json() as { openInterest: string };
    const cumulative = fundingArr.reduce((s, r) => s + (Number(r.fundingRate) || 0), 0);
    // openInterest is in coins; multiply by mark price approx via averages
    const oiCoins = Number(oiJson.openInterest) || 0;
    // Pull last funding row's mark price isn't directly returned — approximate
    // using the latest premiumIndex hit:
    const markRes = await fetchWithTimeout(
      `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${sym}`,
      {}, TIMEOUT,
    );
    let mark = 0;
    if (markRes.ok) {
      const m = await markRes.json() as { markPrice: string };
      mark = Number(m.markPrice) || 0;
    }
    const oiUsd = oiCoins * mark;
    return { cumulative30d: cumulative, oiUsd, windows: fundingArr.length };
  } catch { return null; }
}

async function bybitCoinSnapshot(coin: string) {
  try {
    const sym = `${coin}USDT`;
    // Bybit: tickers for OI + funding (current); funding history
    const [tickerRes, fhRes] = await Promise.all([
      fetchWithTimeout(
        `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${sym}`,
        {}, TIMEOUT,
      ),
      fetchWithTimeout(
        `https://api.bybit.com/v5/market/funding/history?category=linear&symbol=${sym}&limit=200`,
        {}, TIMEOUT,
      ),
    ]);
    if (!tickerRes.ok || !fhRes.ok) return null;
    const tickerJson = await tickerRes.json() as { result?: { list?: Array<{ openInterest: string; markPrice: string }> } };
    const fhJson = await fhRes.json() as { result?: { list?: Array<{ fundingRate: string; fundingRateTimestamp: string }> } };
    const t = tickerJson.result?.list?.[0];
    const fh = fhJson.result?.list ?? [];
    if (!t || fh.length === 0) return null;
    const oiCoins = Number(t.openInterest) || 0;
    const mark = Number(t.markPrice) || 0;
    // Filter to last 30d
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const rows = fh.filter(r => Number(r.fundingRateTimestamp) >= since);
    const cumulative = rows.reduce((s, r) => s + (Number(r.fundingRate) || 0), 0);
    return { cumulative30d: cumulative, oiUsd: oiCoins * mark, windows: rows.length };
  } catch { return null; }
}

async function okxCoinSnapshot(coin: string) {
  try {
    const inst = `${coin}-USDT-SWAP`;
    const [oiRes, frHistoryRes] = await Promise.all([
      fetchWithTimeout(
        `https://www.okx.com/api/v5/public/open-interest?instId=${inst}`,
        {}, TIMEOUT,
      ),
      fetchWithTimeout(
        `https://www.okx.com/api/v5/public/funding-rate-history?instId=${inst}&limit=100`,
        {}, TIMEOUT,
      ),
    ]);
    if (!oiRes.ok || !frHistoryRes.ok) return null;
    const oiJson = await oiRes.json() as { data?: Array<{ oiUsd: string; oi: string }> };
    const frJson = await frHistoryRes.json() as { data?: Array<{ fundingRate: string; fundingTime: string }> };
    const oiData = oiJson.data?.[0];
    const fr = frJson.data ?? [];
    if (!oiData || fr.length === 0) return null;
    const oiUsd = Number(oiData.oiUsd) || (Number(oiData.oi) || 0);
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const rows = fr.filter(r => Number(r.fundingTime) >= since);
    const cumulative = rows.reduce((s, r) => s + (Number(r.fundingRate) || 0), 0);
    return { cumulative30d: cumulative, oiUsd, windows: rows.length };
  } catch { return null; }
}

async function hyperliquidCoinSnapshot(coin: string) {
  try {
    const res = await fetchWithTimeout(
      'https://api.hyperliquid.xyz/info',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'metaAndAssetCtxs' }) },
      TIMEOUT,
    );
    if (!res.ok) return null;
    const json = await res.json() as [{ universe: Array<{ name: string }> }, Array<{ funding: string; openInterest: string; markPx: string }>];
    const [meta, ctxs] = json;
    const idx = meta.universe.findIndex(u => u.name === coin);
    if (idx === -1) return null;
    const ctx = ctxs[idx];
    if (!ctx) return null;
    const oi = Number(ctx.openInterest) * Number(ctx.markPx);
    // HL is hourly funding; use historical funding aggregate via fundingHistory
    const histRes = await fetchWithTimeout(
      'https://api.hyperliquid.xyz/info',
      {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'fundingHistory', coin, startTime: Date.now() - 30 * 24 * 60 * 60 * 1000 }),
      },
      TIMEOUT,
    );
    if (!histRes.ok) return null;
    const hist = await histRes.json() as Array<{ fundingRate: string; time: number }>;
    if (!Array.isArray(hist) || hist.length === 0) return null;
    const cumulative = hist.reduce((s, r) => s + (Number(r.fundingRate) || 0), 0);
    return { cumulative30d: cumulative, oiUsd: oi, windows: hist.length };
  } catch { return null; }
}

/* ─── Aggregate ───────────────────────────────────────────────────────── */

async function snapshotForVenue(
  exchange: string,
  fetcher: (coin: string) => Promise<{ cumulative30d: number; oiUsd: number; windows: number } | null>,
): Promise<VenueRow | null> {
  const perCoinResults = await Promise.all(COINS.map(async coin => {
    const snap = await fetcher(coin);
    return snap ? { symbol: coin, ...snap } : null;
  }));
  const perCoin = perCoinResults.filter((c): c is NonNullable<typeof c> => c !== null);
  if (perCoin.length === 0) return null;

  // Total flow ≈ Σ (cumulative_rate_per_8h × OI) — already a 30d aggregate
  const flow30dUsd = perCoin.reduce((s, c) => s + c.cumulative30d * c.oiUsd, 0);
  const totalOi = perCoin.reduce((s, c) => s + c.oiUsd, 0);
  // Weighted-avg per-window rate (across 30 days)
  const avgRate = perCoin.reduce((s, c) => s + (c.windows > 0 ? c.cumulative30d / c.windows : 0) * c.oiUsd, 0) / Math.max(1, totalOi);
  const totalWindows = Math.max(...perCoin.map(c => c.windows), 0);

  return {
    exchange,
    flow30dUsd,
    avgRate,
    windows: totalWindows,
    totalOi,
    perCoin: perCoin.map(c => ({
      symbol: c.symbol,
      cumulative30d: Math.round(c.cumulative30d * 1e7) / 1e7,
      oiUsd: Math.round(c.oiUsd),
    })),
  };
}

export async function GET() {
  if (l1 && Date.now() - l1.ts < L1_TTL) {
    return NextResponse.json(l1.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' },
    });
  }

  const venues = await Promise.all([
    snapshotForVenue('Binance', binanceCoinSnapshot),
    snapshotForVenue('Bybit', bybitCoinSnapshot),
    snapshotForVenue('OKX', okxCoinSnapshot),
    snapshotForVenue('Hyperliquid', hyperliquidCoinSnapshot),
  ]);
  const rows: VenueRow[] = venues.filter((v): v is VenueRow => v !== null);
  rows.sort((a, b) => Math.abs(b.flow30dUsd) - Math.abs(a.flow30dUsd));

  const totalFlow30d = rows.reduce((s, r) => s + r.flow30dUsd, 0);

  const body: ApiResponse = { rows, totalFlow30d, ts: Date.now() };
  if (rows.length > 0) l1 = { body, ts: Date.now() };

  return NextResponse.json(body, {
    headers: {
      'X-Cache': 'MISS',
      'Cache-Control': rows.length > 0 ? 'public, s-maxage=900, stale-while-revalidate=3600' : 'no-store',
    },
  });
}
