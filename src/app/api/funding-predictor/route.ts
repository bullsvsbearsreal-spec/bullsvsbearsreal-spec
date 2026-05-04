/**
 * GET /api/funding-predictor
 *
 * Predicted next-window funding rate per major coin, derived from
 * Binance Futures' /fapi/v1/premiumIndex which exposes:
 *   - lastFundingRate         (settled — what just paid)
 *   - markPrice / indexPrice  (used to compute the live premium)
 *   - nextFundingTime
 *
 * Binance's funding formula caps the contributing premium at ±0.05%
 * per period and adds a fixed interest rate of 0.01% (this is the
 * standard Binance perp formula; see Binance funding-rate docs).
 *
 * Predicted rate ≈ clamp(premium, -0.05%, +0.05%) + 0.01%
 *
 * It's not exact (Binance time-weighted-averages the premium across
 * the funding window, our snapshot uses the latest premium index)
 * but it's directionally accurate within minutes of settlement.
 *
 * Free public endpoint, no auth. L1 cached 30s.
 */
import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

interface PremiumRow {
  symbol: string;
  markPrice: string;
  indexPrice: string;
  lastFundingRate: string;
  nextFundingTime: number;
  estimatedSettlePrice?: string;
  time?: number;
  interestRate?: string;
}

interface PredictedRow {
  symbol: string;
  /** Latest settled funding (decimal, e.g. 0.0001 = 0.01%). */
  lastSettled: number;
  /** Live premium = (markPrice - indexPrice) / indexPrice. */
  premium: number;
  /** Predicted next-window rate, clamped + interest. */
  predicted: number;
  /** ms until next settlement. */
  msToNextFunding: number;
  markPrice: number;
}

interface ApiResponse {
  rows: PredictedRow[];
  ts: number;
}

const SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE', 'HYPE', 'AVAX', 'LINK', 'SUI',
  'TRX', 'TON', 'ADA', 'DOT', 'NEAR', 'APT'];

const TIMEOUT = 6000;
let l1: { body: ApiResponse; ts: number } | null = null;
const L1_TTL = 30_000;

const FUNDING_CAP = 0.0005;       // 0.05%
const INTEREST_RATE = 0.0001;     // 0.01% per 8h, per Binance docs

function predictRate(premium: number): number {
  const clamped = Math.max(-FUNDING_CAP, Math.min(FUNDING_CAP, premium));
  return clamped + INTEREST_RATE;
}

export async function GET() {
  if (l1 && Date.now() - l1.ts < L1_TTL) {
    return NextResponse.json(l1.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=60' },
    });
  }

  try {
    const res = await fetchWithTimeout(
      'https://fapi.binance.com/fapi/v1/premiumIndex',
      {},
      TIMEOUT,
    );
    if (!res.ok) {
      if (l1) return NextResponse.json(l1.body, { headers: { 'X-Cache': 'STALE' } });
      return NextResponse.json({ error: `Binance HTTP ${res.status}` }, { status: 502 });
    }
    const arr = await res.json() as PremiumRow[];
    if (!Array.isArray(arr)) {
      if (l1) return NextResponse.json(l1.body, { headers: { 'X-Cache': 'STALE' } });
      return NextResponse.json({ error: 'invalid response' }, { status: 502 });
    }

    const now = Date.now();
    const rows: PredictedRow[] = [];
    for (const sym of SYMBOLS) {
      const m = arr.find(r => r.symbol === `${sym}USDT`);
      if (!m) continue;
      const mark = Number(m.markPrice);
      const index = Number(m.indexPrice);
      if (!Number.isFinite(mark) || !Number.isFinite(index) || index <= 0) continue;
      const premium = (mark - index) / index;
      const predicted = predictRate(premium);
      rows.push({
        symbol: sym,
        lastSettled: Number(m.lastFundingRate) || 0,
        premium,
        predicted,
        msToNextFunding: Math.max(0, Number(m.nextFundingTime) - now),
        markPrice: mark,
      });
    }

    // Sort by abs(predicted) descending — biggest moves first
    rows.sort((a, b) => Math.abs(b.predicted) - Math.abs(a.predicted));

    const body: ApiResponse = { rows, ts: now };
    if (rows.length > 0) l1 = { body, ts: now };

    return NextResponse.json(body, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': rows.length > 0 ? 'public, s-maxage=20, stale-while-revalidate=60' : 'no-store',
      },
    });
  } catch (e) {
    if (l1) return NextResponse.json(l1.body, { headers: { 'X-Cache': 'STALE' } });
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 502 });
  }
}
