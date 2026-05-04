/**
 * GET /api/funding-paid
 *
 * Estimated 30-day funding-paid leaderboard per coin. Methodology: pull
 * Binance Futures funding history for the top USDT-margined symbols,
 * aggregate to a "what would a $1 long have paid YTD" number. Useful as
 * a quick view of which coins are most expensive to be levered long in.
 *
 * Free Binance public endpoint, no auth. L1 cached 30 min.
 */
import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface CoinFunding {
  symbol: string;
  /** Cumulative funding rate decimal over the window (e.g. 0.012 = 1.2% paid by longs). */
  cumulative30d: number;
  /** Annualized estimate (cumulative × (365/30)). */
  annualized: number;
  /** Average per-8h rate over the window. */
  avg8h: number;
  /** Number of 8h windows we have data for. */
  windows: number;
  /** Most recent timestamp. */
  lastTs: number;
}

interface ApiResponse {
  coins: CoinFunding[];
  windowDays: 30;
  ts: number;
}

const SYMBOLS = [
  'BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE', 'HYPE', 'AVAX', 'LINK', 'SUI',
  'TRX', 'TON', 'ADA', 'DOT', 'NEAR', 'APT', 'LTC', 'BCH', 'ARB', 'OP',
  'PEPE', 'WIF', 'BONK', 'SHIB', 'FLOKI',
  'RENDER', 'TAO', 'FET', 'WLD', 'ENA',
  'AAVE', 'UNI', 'MKR', 'PENDLE', 'JUP',
];

const TIMEOUT = 8000;
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

let l1: { body: ApiResponse; ts: number } | null = null;
const L1_TTL = 30 * 60 * 1000;

async function fetchSymbolFunding(sym: string): Promise<CoinFunding | null> {
  try {
    const startTime = Date.now() - WINDOW_MS;
    const url = `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${sym}USDT&startTime=${startTime}&limit=1000`;
    const res = await fetchWithTimeout(url, {}, TIMEOUT);
    if (!res.ok) return null;
    const arr = await res.json() as Array<{ symbol: string; fundingRate: string; fundingTime: number }>;
    if (!Array.isArray(arr) || arr.length === 0) return null;

    let cumulative = 0;
    let lastTs = 0;
    for (const r of arr) {
      const rate = Number(r.fundingRate);
      if (Number.isFinite(rate)) cumulative += rate;
      if (r.fundingTime > lastTs) lastTs = r.fundingTime;
    }

    const windows = arr.length;
    const avg8h = windows > 0 ? cumulative / windows : 0;
    const annualized = cumulative * (365 / 30);

    return {
      symbol: sym,
      cumulative30d: Math.round(cumulative * 1e7) / 1e7,
      annualized: Math.round(annualized * 1e7) / 1e7,
      avg8h: Math.round(avg8h * 1e7) / 1e7,
      windows,
      lastTs,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  if (l1 && Date.now() - l1.ts < L1_TTL) {
    return NextResponse.json(l1.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' },
    });
  }

  // Fetch in batches of 10 to be polite to Binance
  const BATCH = 10;
  const all: CoinFunding[] = [];
  for (let i = 0; i < SYMBOLS.length; i += BATCH) {
    const slice = SYMBOLS.slice(i, i + BATCH);
    const results = await Promise.allSettled(slice.map(fetchSymbolFunding));
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) all.push(r.value);
    }
  }

  // Sort: most expensive longs first (highest cumulative paid)
  all.sort((a, b) => b.cumulative30d - a.cumulative30d);

  const body: ApiResponse = {
    coins: all,
    windowDays: 30,
    ts: Date.now(),
  };

  if (all.length > 0) l1 = { body, ts: Date.now() };

  return NextResponse.json(body, {
    headers: {
      'X-Cache': 'MISS',
      'Cache-Control': all.length > 0
        ? 'public, s-maxage=900, stale-while-revalidate=1800'
        : 'no-store',
    },
  });
}
