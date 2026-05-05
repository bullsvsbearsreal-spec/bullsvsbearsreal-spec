/**
 * GET /api/crowdedness
 *
 * Per-coin "positioning crowdedness" score combining 3 independent signals:
 *
 *   1. FUNDING — abs(current rate). Extreme funding = extreme one-sided
 *      positioning. Score 0-100 from |rate|.
 *   2. OI MOMENTUM — 7-day OI change %. Rapid OI growth on top of an
 *      extreme funding bias = late-stage crowding. Score 0-100.
 *   3. LONG/SHORT RATIO — Binance global L/S ratio departure from 1.0.
 *      Values above 1.5 = retail heavily long; below 0.7 = heavily short.
 *
 * Composite = weighted avg (40% funding, 30% OI mom, 30% L/S).
 * High score (>70) = crowded → fade signal. Low score (<30) = balanced.
 *
 * Free Binance public endpoints. L1 cached 5 min.
 */
import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface SignalScore {
  raw: number | null;
  score: number | null; // 0-100, where 100 = maximally crowded one-sided
  /** 'long' = crowd is on the long side, 'short' = crowd is on the short side, 'balanced' */
  side: 'long' | 'short' | 'balanced';
  reading: string;
}

interface CrowdRow {
  symbol: string;
  /** Composite crowdedness 0-100, where higher = more crowded one-sided positioning */
  composite: number | null;
  /** 'long' or 'short' — which side the crowd is on (when composite high). */
  crowdSide: 'long' | 'short' | 'balanced';
  funding: SignalScore;
  oiMomentum: SignalScore;
  longShortRatio: SignalScore;
  markPrice: number | null;
}

interface ApiResponse {
  rows: CrowdRow[];
  ts: number;
}

const SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE', 'HYPE', 'AVAX', 'LINK', 'SUI',
  'TRX', 'TON', 'ADA', 'DOT', 'NEAR', 'APT', 'ARB', 'OP'];

const TIMEOUT = 8000;
let l1: { body: ApiResponse; ts: number } | null = null;
const L1_TTL = 5 * 60 * 1000;

/* ─── Score helpers ──────────────────────────────────────────────────── */

/** Funding score: |rate| over 0.05% saturates to 100. Sign drives side. */
function scoreFunding(rate: number | null): SignalScore {
  if (rate == null) return { raw: null, score: null, side: 'balanced', reading: 'no data' };
  const abs = Math.abs(rate);
  const score = Math.min(100, (abs / 0.0005) * 100);
  const side = rate > 0.00005 ? 'long' : rate < -0.00005 ? 'short' : 'balanced';
  let reading: string;
  if (abs > 0.0005) reading = side === 'long' ? 'extreme long crowding' : 'extreme short crowding';
  else if (abs > 0.0002) reading = side === 'long' ? 'longs paying meaningfully' : 'shorts paying meaningfully';
  else if (abs > 0.00005) reading = side === 'long' ? 'mild long bias' : 'mild short bias';
  else reading = 'balanced';
  return { raw: rate, score, side, reading };
}

/** OI momentum score: 7d % change. Above 30% saturates. */
function scoreOiMomentum(pctChange: number | null, fundingSide: 'long' | 'short' | 'balanced'): SignalScore {
  if (pctChange == null) return { raw: null, score: null, side: 'balanced', reading: 'no data' };
  const score = Math.min(100, (Math.abs(pctChange) / 0.30) * 100);
  // Side is the funding side amplified by OI growth — if OI growing alongside long-paying funding, longs are piling in.
  const side = fundingSide;
  let reading: string;
  if (pctChange > 0.20) reading = 'OI surging — fresh leverage entering';
  else if (pctChange > 0.05) reading = 'OI growing';
  else if (pctChange > -0.05) reading = 'OI flat';
  else if (pctChange > -0.20) reading = 'OI shrinking';
  else reading = 'OI collapsing — deleveraging';
  return { raw: pctChange, score, side, reading };
}

/** L/S ratio score: deviation from 1.0. Heavy = > 1.7 or < 0.6. */
function scoreLongShort(ratio: number | null): SignalScore {
  if (ratio == null) return { raw: null, score: null, side: 'balanced', reading: 'no data' };
  // Convert to log-scale distance from 1.0, then map to 0-100.
  const logDev = Math.abs(Math.log(ratio));
  // |log(2)| = 0.69 ≈ 100 score
  const score = Math.min(100, (logDev / 0.69) * 100);
  const side = ratio > 1.10 ? 'long' : ratio < 0.91 ? 'short' : 'balanced';
  let reading: string;
  if (ratio > 2.0) reading = 'retail extremely long';
  else if (ratio > 1.5) reading = 'retail meaningfully long';
  else if (ratio > 1.10) reading = 'retail leaning long';
  else if (ratio > 0.91) reading = 'balanced';
  else if (ratio > 0.66) reading = 'retail leaning short';
  else if (ratio > 0.5) reading = 'retail meaningfully short';
  else reading = 'retail extremely short';
  return { raw: ratio, score, side, reading };
}

/* ─── Per-symbol fetcher ─────────────────────────────────────────────── */

async function fetchSymbol(sym: string): Promise<CrowdRow | null> {
  try {
    const symPair = `${sym}USDT`;
    // Funding rate (current) + mark price
    const premiumP = fetchWithTimeout(
      `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symPair}`, {}, TIMEOUT,
    );
    // OI history (7d) — Binance returns 5min/15min/30min/1h/4h/1d candles
    const oiP = fetchWithTimeout(
      `https://fapi.binance.com/futures/data/openInterestHist?symbol=${symPair}&period=1d&limit=8`, {}, TIMEOUT,
    );
    // L/S ratio (global account ratio)
    const lsP = fetchWithTimeout(
      `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${symPair}&period=1h&limit=1`, {}, TIMEOUT,
    );

    const [premiumRes, oiRes, lsRes] = await Promise.all([premiumP, oiP, lsP]);

    let fundingRate: number | null = null;
    let markPrice: number | null = null;
    if (premiumRes.ok) {
      const j = await premiumRes.json() as { lastFundingRate: string; markPrice: string };
      fundingRate = Number(j.lastFundingRate);
      markPrice = Number(j.markPrice);
      if (!Number.isFinite(fundingRate)) fundingRate = null;
      if (!Number.isFinite(markPrice)) markPrice = null;
    }

    let oiPctChange: number | null = null;
    if (oiRes.ok) {
      const arr = await oiRes.json() as Array<{ sumOpenInterest: string; timestamp: number }>;
      if (Array.isArray(arr) && arr.length >= 2) {
        const sorted = arr.slice().sort((a, b) => a.timestamp - b.timestamp);
        const first = Number(sorted[0].sumOpenInterest);
        const last = Number(sorted[sorted.length - 1].sumOpenInterest);
        if (first > 0 && Number.isFinite(last)) oiPctChange = (last - first) / first;
      }
    }

    let lsRatio: number | null = null;
    if (lsRes.ok) {
      const arr = await lsRes.json() as Array<{ longShortRatio: string }>;
      if (Array.isArray(arr) && arr.length > 0) {
        const r = Number(arr[0].longShortRatio);
        if (Number.isFinite(r)) lsRatio = r;
      }
    }

    const funding = scoreFunding(fundingRate);
    const oiMom = scoreOiMomentum(oiPctChange, funding.side);
    const ls = scoreLongShort(lsRatio);

    const scores = [funding, oiMom, ls];
    const validScores = scores.filter(s => s.score != null) as Array<SignalScore & { score: number }>;
    if (validScores.length === 0) return null;
    // Weighted: 40 funding, 30 oi, 30 LS — but only over available
    const weights = { funding: 0.4, oi: 0.3, ls: 0.3 };
    let weightedSum = 0;
    let totalWeight = 0;
    if (funding.score != null) { weightedSum += funding.score * weights.funding; totalWeight += weights.funding; }
    if (oiMom.score != null)   { weightedSum += oiMom.score * weights.oi;        totalWeight += weights.oi; }
    if (ls.score != null)      { weightedSum += ls.score * weights.ls;           totalWeight += weights.ls; }
    const composite = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null;

    // Crowd side: majority side across non-balanced signals
    const sides = validScores.map(s => s.side).filter(s => s !== 'balanced') as ('long' | 'short')[];
    const longCount = sides.filter(s => s === 'long').length;
    const shortCount = sides.filter(s => s === 'short').length;
    const crowdSide: CrowdRow['crowdSide'] = longCount > shortCount ? 'long' : shortCount > longCount ? 'short' : 'balanced';

    return { symbol: sym, composite, crowdSide, funding, oiMomentum: oiMom, longShortRatio: ls, markPrice };
  } catch {
    return null;
  }
}

export async function GET() {
  if (l1 && Date.now() - l1.ts < L1_TTL) {
    return NextResponse.json(l1.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=240, stale-while-revalidate=600' },
    });
  }

  // Fetch in batches of 6 to be polite
  const rows: CrowdRow[] = [];
  const BATCH = 6;
  for (let i = 0; i < SYMBOLS.length; i += BATCH) {
    const slice = SYMBOLS.slice(i, i + BATCH);
    const results = await Promise.allSettled(slice.map(fetchSymbol));
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) rows.push(r.value);
    }
  }

  // Sort by composite descending — most crowded first
  rows.sort((a, b) => (b.composite ?? -1) - (a.composite ?? -1));

  const body: ApiResponse = { rows, ts: Date.now() };
  if (rows.length > 0) l1 = { body, ts: Date.now() };

  return NextResponse.json(body, {
    headers: {
      'X-Cache': 'MISS',
      'Cache-Control': rows.length > 0 ? 'public, s-maxage=240, stale-while-revalidate=600' : 'no-store',
    },
  });
}
