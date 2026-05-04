/**
 * GET /api/funding-flips
 *
 * Detects coins where funding has just flipped sign — i.e. the most recent
 * 8h funding payment has opposite sign from the past few days' average.
 *
 * A flip from positive → negative means longs were paying and now shorts
 * are paying, which usually coincides with sentiment shifts (squeeze / dump).
 *
 * Uses Binance USDT-M Futures `/fapi/v1/fundingRate` per symbol (free, no
 * auth). L1 cached 10 minutes.
 */
import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface FlipRow {
  symbol: string;
  /** Most recent funding rate (decimal). */
  current: number;
  /** Average funding rate over the past 7 days. */
  avg7d: number;
  /** Magnitude of the flip — abs(current - avg). */
  delta: number;
  /** 'pos→neg' (longs paying flipped to shorts) or 'neg→pos'. */
  direction: 'pos→neg' | 'neg→pos';
  /** Timestamp of the most recent funding payment. */
  lastTs: number;
  /** Strength tier. */
  tier: 'major' | 'notable' | 'subtle';
}

interface ApiResponse {
  flips: FlipRow[];
  scannedSymbols: number;
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
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

let l1: { body: ApiResponse; ts: number } | null = null;
const L1_TTL = 10 * 60 * 1000;

async function detectFlip(sym: string): Promise<FlipRow | null> {
  try {
    const startTime = Date.now() - WINDOW_MS;
    const res = await fetchWithTimeout(
      `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${sym}USDT&startTime=${startTime}&limit=1000`,
      {},
      TIMEOUT,
    );
    if (!res.ok) return null;
    const arr = await res.json() as Array<{ fundingRate: string; fundingTime: number }>;
    if (!Array.isArray(arr) || arr.length < 5) return null;

    // Sort newest first
    const rows = arr
      .map(r => ({ rate: Number(r.fundingRate), ts: r.fundingTime }))
      .filter(r => Number.isFinite(r.rate))
      .sort((a, b) => b.ts - a.ts);
    if (rows.length === 0) return null;

    const current = rows[0].rate;
    const past = rows.slice(1, Math.min(rows.length, 22)); // ~7d × 3/day = 21
    if (past.length < 5) return null;
    const avg = past.reduce((s, r) => s + r.rate, 0) / past.length;

    // Only flag if signs are opposite AND magnitudes are non-trivial.
    if ((current >= 0 && avg >= 0) || (current <= 0 && avg <= 0)) return null;
    if (Math.abs(current) < 0.00001 && Math.abs(avg) < 0.00001) return null;

    const delta = Math.abs(current - avg);
    const tier: FlipRow['tier'] = delta > 0.0005 ? 'major' : delta > 0.0001 ? 'notable' : 'subtle';

    return {
      symbol: sym,
      current,
      avg7d: avg,
      delta,
      direction: avg > 0 && current < 0 ? 'pos→neg' : 'neg→pos',
      lastTs: rows[0].ts,
      tier,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  if (l1 && Date.now() - l1.ts < L1_TTL) {
    return NextResponse.json(l1.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  }

  const flips: FlipRow[] = [];
  const BATCH = 8;
  for (let i = 0; i < SYMBOLS.length; i += BATCH) {
    const batch = SYMBOLS.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map(detectFlip));
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) flips.push(r.value);
    }
  }

  // Sort: major > notable > subtle, then by delta desc
  flips.sort((a, b) => {
    const tierRank = { major: 0, notable: 1, subtle: 2 };
    if (tierRank[a.tier] !== tierRank[b.tier]) return tierRank[a.tier] - tierRank[b.tier];
    return b.delta - a.delta;
  });

  const body: ApiResponse = {
    flips,
    scannedSymbols: SYMBOLS.length,
    ts: Date.now(),
  };

  l1 = { body, ts: Date.now() };

  return NextResponse.json(body, {
    headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}
