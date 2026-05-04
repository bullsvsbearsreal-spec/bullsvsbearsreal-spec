/**
 * GET /api/cycle-phase
 *
 * Synthesizes a single "Where in the cycle is BTC?" verdict by combining
 * five independent signals:
 *
 *   1. Hash Ribbons  (30d MA hash > 60d MA hash)             [/onchain]
 *   2. Puell Multiple                                          [/onchain]
 *   3. MVRV Z-score                                            [/onchain]
 *   4. Funding regime  (avg of last 3 BTC funding rates)       [Binance]
 *   5. Price vs 200d SMA (% above/below)                       [CoinGecko]
 *
 * Each signal contributes a score in [-2, +2]:
 *   -2 strong bear, -1 mild bear, 0 neutral, +1 mild bull, +2 strong bull
 * Average → phase tag: Capitulation / Accumulation / Recovery / Bull / Euphoria
 *
 * Reuses /api/onchain (already cached). Free Binance + CoinGecko fallbacks.
 * L1 cached 30 min — synthesis updates slowly.
 */
import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

interface SignalReading {
  name: string;
  value: number | null;
  /** -2 (strong bear) to +2 (strong bull). Null when signal unavailable. */
  score: number | null;
  /** Human-readable interpretation. */
  reading: string;
}

interface ApiResponse {
  /** Composite score [-2, +2]. */
  composite: number | null;
  /** Cycle phase tag derived from composite. */
  phase: 'Capitulation' | 'Accumulation' | 'Recovery' | 'Bull' | 'Euphoria' | 'Unknown';
  /** Confidence 0-100 based on how many signals returned non-null. */
  confidence: number;
  signals: {
    hashRibbons: SignalReading;
    puell: SignalReading;
    mvrv: SignalReading;
    funding: SignalReading;
    sma200: SignalReading;
  };
  underlying: {
    btcPrice: number | null;
    sma200: number | null;
  };
  ts: number;
}

const TIMEOUT = 8000;
let l1: { body: ApiResponse; ts: number } | null = null;
const L1_TTL = 30 * 60 * 1000;

/* ─── Signal extractors ───────────────────────────────────────────────── */

interface OnchainResp {
  hashRate?: { history?: Array<{ time: number; value: number }> };
  puellMultiple?: { current: number | null };
  mvrv?: { current: number | null };
}

async function fetchOnchain(): Promise<OnchainResp | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://info-hub.io';
    const res = await fetchWithTimeout(`${baseUrl}/api/onchain`, {}, TIMEOUT);
    if (!res.ok) return null;
    return await res.json() as OnchainResp;
  } catch { return null; }
}

interface BinanceFundingHistoryRow { fundingRate: string; fundingTime: number }

async function fetchRecentFundingAvg(): Promise<number | null> {
  try {
    const res = await fetchWithTimeout(
      'https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=21',
      {},
      TIMEOUT,
    );
    if (!res.ok) return null;
    const arr = await res.json() as BinanceFundingHistoryRow[];
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const sum = arr.reduce((s, r) => s + (Number(r.fundingRate) || 0), 0);
    return sum / arr.length;
  } catch { return null; }
}

async function fetchBtcPriceWith200dSMA(): Promise<{ price: number | null; sma200: number | null }> {
  // 250d daily closes from Binance is plenty for a 200-bar SMA.
  try {
    const res = await fetchWithTimeout(
      'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=250',
      {},
      TIMEOUT,
    );
    if (!res.ok) return { price: null, sma200: null };
    const arr = await res.json() as Array<[number, string, string, string, string, ...unknown[]]>;
    if (!Array.isArray(arr) || arr.length < 200) return { price: null, sma200: null };
    const closes = arr.map(k => Number(k[4])).filter(c => c > 0);
    const last200 = closes.slice(-200);
    const sma = last200.reduce((s, x) => s + x, 0) / 200;
    return { price: closes[closes.length - 1], sma200: sma };
  } catch { return { price: null, sma200: null }; }
}

/* ─── Score helpers ───────────────────────────────────────────────────── */

function scoreHashRibbons(history: Array<{ time: number; value: number }> | undefined): SignalReading {
  if (!history || history.length < 60) {
    return { name: 'Hash Ribbons', value: null, score: null, reading: 'insufficient data' };
  }
  const sorted = [...history].sort((a, b) => a.time - b.time);
  const ma30 = sorted.slice(-30).reduce((s, p) => s + p.value, 0) / 30;
  const ma60 = sorted.slice(-60).reduce((s, p) => s + p.value, 0) / 60;
  const ratio = ma30 / ma60;
  // 30d above 60d → miners healthy → bullish
  let score = 0;
  let reading = 'neutral';
  if (ratio > 1.04) { score = 2; reading = 'strongly bullish — hash expanding aggressively'; }
  else if (ratio > 1.01) { score = 1; reading = 'bullish — 30d MA above 60d MA'; }
  else if (ratio > 0.99) { score = 0; reading = 'neutral — MAs converged'; }
  else if (ratio > 0.96) { score = -1; reading = 'bearish — capitulation in progress'; }
  else { score = -2; reading = 'strongly bearish — heavy miner capitulation'; }
  return { name: 'Hash Ribbons', value: ratio, score, reading };
}

function scorePuell(value: number | null): SignalReading {
  if (value == null) return { name: 'Puell Multiple', value: null, score: null, reading: 'insufficient data' };
  let score = 0;
  let reading = 'neutral';
  if (value < 0.5) { score = 2; reading = 'strong buy zone — miners under-paid historically'; }
  else if (value < 1.0) { score = 1; reading = 'undervalued — miners earning below average'; }
  else if (value < 1.5) { score = 0; reading = 'neutral — miners earning average'; }
  else if (value < 2.5) { score = -1; reading = 'overheated — miners earning well above average'; }
  else { score = -2; reading = 'extreme overheating — historical top zone'; }
  return { name: 'Puell Multiple', value, score, reading };
}

function scoreMvrv(value: number | null): SignalReading {
  if (value == null) return { name: 'MVRV', value: null, score: null, reading: 'insufficient data' };
  let score = 0;
  let reading = 'neutral';
  if (value < 0.8) { score = 2; reading = 'deeply undervalued — capitulation territory'; }
  else if (value < 1.2) { score = 1; reading = 'fair value — accumulation territory'; }
  else if (value < 2.0) { score = 0; reading = 'neutral — moderate premium to realized cap'; }
  else if (value < 3.0) { score = -1; reading = 'overheated — meaningful premium to realized'; }
  else { score = -2; reading = 'euphoria — historical top warning'; }
  return { name: 'MVRV', value, score, reading };
}

function scoreFunding(avgRate: number | null): SignalReading {
  if (avgRate == null) return { name: 'Funding regime', value: null, score: null, reading: 'insufficient data' };
  // Recent 7d avg rate — small ranges in % per 8h
  let score = 0;
  let reading = 'neutral';
  if (avgRate < -0.0005) { score = 2; reading = 'shorts heavily paying — squeeze fuel'; }
  else if (avgRate < -0.0001) { score = 1; reading = 'mild bearish — shorts paying'; }
  else if (avgRate < 0.0001) { score = 0; reading = 'balanced'; }
  else if (avgRate < 0.0005) { score = -1; reading = 'mild bullish — longs paying'; }
  else { score = -2; reading = 'heavy long crowding — top warning'; }
  return { name: 'Funding regime', value: avgRate, score, reading };
}

function score200dSma(price: number | null, sma: number | null): SignalReading {
  if (price == null || sma == null || sma <= 0) {
    return { name: 'Price vs 200d SMA', value: null, score: null, reading: 'insufficient data' };
  }
  const ratio = price / sma;
  let score = 0;
  let reading = 'neutral';
  if (ratio > 2.0) { score = -2; reading = 'extended — 100%+ above 200d SMA'; }
  else if (ratio > 1.4) { score = -1; reading = 'overextended — well above 200d'; }
  else if (ratio > 1.05) { score = 1; reading = 'bull regime — above 200d'; }
  else if (ratio > 0.95) { score = 0; reading = 'around 200d SMA — transition zone'; }
  else if (ratio > 0.7) { score = 1; reading = 'oversold — below 200d, often a buy'; }
  else { score = 2; reading = 'deeply oversold — historical bear-market low zone'; }
  return { name: 'Price vs 200d SMA', value: ratio, score, reading };
}

function phaseFromComposite(composite: number | null): ApiResponse['phase'] {
  if (composite == null) return 'Unknown';
  if (composite >= 1.4) return 'Capitulation';      // signals say buy → we're at the bottom
  if (composite >= 0.6) return 'Accumulation';
  if (composite >= -0.4) return 'Recovery';
  if (composite >= -1.2) return 'Bull';
  return 'Euphoria';
}

/* ─── Handler ─────────────────────────────────────────────────────────── */

export async function GET() {
  if (l1 && Date.now() - l1.ts < L1_TTL) {
    return NextResponse.json(l1.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' },
    });
  }

  const [onchain, fundingAvg, priceMa] = await Promise.all([
    fetchOnchain(),
    fetchRecentFundingAvg(),
    fetchBtcPriceWith200dSMA(),
  ]);

  const signals = {
    hashRibbons: scoreHashRibbons(onchain?.hashRate?.history),
    puell: scorePuell(onchain?.puellMultiple?.current ?? null),
    mvrv: scoreMvrv(onchain?.mvrv?.current ?? null),
    funding: scoreFunding(fundingAvg),
    sma200: score200dSma(priceMa.price, priceMa.sma200),
  };

  const allReadings: SignalReading[] = [signals.hashRibbons, signals.puell, signals.mvrv, signals.funding, signals.sma200];
  const valid = allReadings.filter(r => r.score != null) as Array<SignalReading & { score: number }>;
  const composite = valid.length > 0
    ? valid.reduce((s, r) => s + r.score, 0) / valid.length
    : null;
  const confidence = Math.round((valid.length / allReadings.length) * 100);
  const phase = phaseFromComposite(composite);

  const body: ApiResponse = {
    composite: composite != null ? Math.round(composite * 100) / 100 : null,
    phase,
    confidence,
    signals,
    underlying: { btcPrice: priceMa.price, sma200: priceMa.sma200 },
    ts: Date.now(),
  };

  if (composite != null) l1 = { body, ts: Date.now() };

  return NextResponse.json(body, {
    headers: {
      'X-Cache': 'MISS',
      'Cache-Control': composite != null ? 'public, s-maxage=900, stale-while-revalidate=3600' : 'no-store',
    },
  });
}
