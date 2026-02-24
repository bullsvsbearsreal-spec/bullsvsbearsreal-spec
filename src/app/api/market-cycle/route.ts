/**
 * GET /api/market-cycle
 *
 * Fetches BTC daily price history from CoinGecko (~4 years) and calculates
 * market cycle indicators: Pi Cycle Top/Bottom, Rainbow Chart, 200-Week MA
 * Heatmap, and Stock-to-Flow model.
 *
 * Cached for 30 minutes (indicators move slowly on daily data).
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TimeValue {
  time: number;
  value: number;
}

interface TimePrice {
  time: number;
  price: number;
}

interface PiCycleData {
  ma111: TimeValue[];
  ma350x2: TimeValue[];
  signal: 'neutral' | 'approaching_top' | 'approaching_bottom';
}

interface RainbowBand {
  label: string;
  color: string;
  values: TimeValue[];
}

interface RainbowData {
  bands: RainbowBand[];
  currentBand: string;
}

interface WeeklyMA200Data {
  ma: TimeValue[];
  rateOfChange: TimeValue[];
}

interface StockToFlowData {
  ratio: number;
  modelPrice: number;
  actualPrice: number;
  deviation: number;
}

interface MarketCycleResponse {
  prices: TimePrice[];
  piCycle: PiCycleData;
  rainbow: RainbowData;
  weeklyMA200: WeeklyMA200Data;
  stockToFlow: StockToFlowData;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// L1 in-memory cache (30 min TTL)
// ---------------------------------------------------------------------------

let cachedResponse: MarketCycleResponse | null = null;
let cacheTime = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simple Moving Average — returns null for indices before enough data exists. */
function sma(prices: number[], period: number): (number | null)[] {
  return prices.map((_, i) => {
    if (i < period - 1) return null;
    const slice = prices.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

/** Convert CoinGecko ms timestamp to Unix seconds (for lightweight-charts). */
function toUnixSec(ms: number): number {
  return Math.floor(ms / 1000);
}

/**
 * Least-squares linear regression on (x, y) pairs.
 * Returns { slope, intercept } for y = slope * x + intercept.
 */
function linearRegression(xs: number[], ys: number[]): { slope: number; intercept: number } {
  const n = xs.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i];
    sumY += ys[i];
    sumXY += xs[i] * ys[i];
    sumX2 += xs[i] * xs[i];
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n };
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

// ---------------------------------------------------------------------------
// Indicator calculations
// ---------------------------------------------------------------------------

/** BTC genesis date — used for rainbow chart day counting. */
const BTC_GENESIS = new Date('2009-01-03T00:00:00Z').getTime();

function calcPiCycle(
  timestamps: number[],
  closePrices: number[],
): PiCycleData {
  const ma111Raw = sma(closePrices, 111);
  const ma350Raw = sma(closePrices, 350);

  const ma111: TimeValue[] = [];
  const ma350x2: TimeValue[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const t = toUnixSec(timestamps[i]);
    if (ma111Raw[i] !== null) {
      ma111.push({ time: t, value: ma111Raw[i] as number });
    }
    if (ma350Raw[i] !== null) {
      ma350x2.push({ time: t, value: (ma350Raw[i] as number) * 2 });
    }
  }

  // Determine signal from the last few data points where both MAs exist
  let signal: PiCycleData['signal'] = 'neutral';

  if (ma111.length > 0 && ma350x2.length > 0) {
    // Align by finding common time range
    const lastMa111 = ma111[ma111.length - 1];
    const lastMa350x2 = ma350x2[ma350x2.length - 1];

    // Look at last 10 points with both MAs present for crossover detection
    const overlapStart = Math.max(
      ma111[0].time,
      ma350x2[0].time,
    );

    const recent111 = ma111.filter((p) => p.time >= overlapStart);
    const recent350x2 = ma350x2.filter((p) => p.time >= overlapStart);

    if (recent111.length >= 2 && recent350x2.length >= 2) {
      // Build a map for the 350x2 values by time for alignment
      const map350: Record<number, number> = {};
      for (const p of recent350x2) map350[p.time] = p.value;

      // Find aligned pairs
      const aligned: { time: number; v111: number; v350x2: number }[] = [];
      for (const p of recent111) {
        if (map350[p.time] !== undefined) {
          aligned.push({ time: p.time, v111: p.value, v350x2: map350[p.time] });
        }
      }

      if (aligned.length >= 2) {
        const last = aligned[aligned.length - 1];
        const prev = aligned[aligned.length - 2];

        const diff = last.v111 - last.v350x2;
        const prevDiff = prev.v111 - prev.v350x2;
        const ratio = last.v350x2 !== 0 ? Math.abs(diff) / last.v350x2 : 1;

        // Crossed above or within 5%: approaching top
        if (diff > 0 || (diff < 0 && prevDiff > 0)) {
          signal = 'approaching_top';
        } else if (ratio < 0.05 && diff < 0) {
          // Within 5% from below: approaching top
          signal = 'approaching_top';
        }

        // If 111d is far below 350dx2 and converging: could be approaching bottom
        // (this occurs at macro bottoms when 111d is deep under 350dx2 and starting to rise)
        if (diff < 0 && prevDiff < diff) {
          // 111d is below and gap is shrinking — check if deep enough for bottom signal
          const gapPct = last.v350x2 !== 0 ? Math.abs(diff) / last.v350x2 : 0;
          if (gapPct > 0.3) {
            signal = 'approaching_bottom';
          }
        }
      }
    }

    // If no crossover logic triggered, use simple ratio of latest values
    if (signal === 'neutral' && lastMa111 && lastMa350x2) {
      const r = lastMa111.value / lastMa350x2.value;
      if (r > 0.95 && r <= 1.0) signal = 'approaching_top';
      else if (r > 1.0) signal = 'approaching_top';
    }
  }

  return { ma111, ma350x2, signal };
}

function calcRainbow(
  timestamps: number[],
  closePrices: number[],
): RainbowData {
  const multipliers = [0.4, 0.5, 0.6, 0.75, 1.0, 1.3, 1.6, 2.0];
  const labels = [
    'Fire Sale',
    'Buy',
    'Accumulate',
    'Still Cheap',
    'Hold',
    'Is this a bubble?',
    'FOMO',
    'Sell',
  ];
  const colors = [
    '#0000FF',
    '#0066FF',
    '#00CCFF',
    '#00FF66',
    '#FFFF00',
    '#FFCC00',
    '#FF6600',
    '#FF0000',
  ];

  // Fit logarithmic regression: ln(price) = a * ln(daysSinceGenesis) + b
  // We need daysSinceGenesis for each data point
  const xs: number[] = [];
  const ys: number[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const daysSinceGenesis = (timestamps[i] - BTC_GENESIS) / (1000 * 60 * 60 * 24);
    if (daysSinceGenesis > 0 && closePrices[i] > 0) {
      xs.push(Math.log(daysSinceGenesis));
      ys.push(Math.log(closePrices[i]));
    }
  }

  const { slope: a, intercept: b } = linearRegression(xs, ys);

  // Generate band values
  const bands: RainbowBand[] = multipliers.map((mult, idx) => ({
    label: labels[idx],
    color: colors[idx],
    values: [] as TimeValue[],
  }));

  let currentBand = 'Hold';
  const latestPrice = closePrices[closePrices.length - 1];

  for (let i = 0; i < timestamps.length; i++) {
    const daysSinceGenesis = (timestamps[i] - BTC_GENESIS) / (1000 * 60 * 60 * 24);
    if (daysSinceGenesis <= 0) continue;

    const lnDays = Math.log(daysSinceGenesis);
    const baseLogPrice = a * lnDays + b;
    const basePrice = Math.exp(baseLogPrice);
    const t = toUnixSec(timestamps[i]);

    for (let j = 0; j < multipliers.length; j++) {
      bands[j].values.push({ time: t, value: basePrice * multipliers[j] });
    }

    // Determine current band for the last data point
    if (i === timestamps.length - 1 && latestPrice > 0) {
      // Find which band the current price falls in
      const bandPrices = multipliers.map((m) => basePrice * m);
      currentBand = labels[labels.length - 1]; // default: Sell (above all)

      if (latestPrice < bandPrices[0]) {
        currentBand = labels[0]; // Below lowest band
      } else {
        for (let j = 0; j < bandPrices.length - 1; j++) {
          if (latestPrice >= bandPrices[j] && latestPrice < bandPrices[j + 1]) {
            currentBand = labels[j];
            break;
          }
        }
      }
    }
  }

  return { bands, currentBand };
}

function calcWeeklyMA200(
  timestamps: number[],
  closePrices: number[],
): WeeklyMA200Data {
  // 200-week ≈ 1400 days
  const period = 1400;
  const maRaw = sma(closePrices, period);

  const ma: TimeValue[] = [];
  const rateOfChange: TimeValue[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    if (maRaw[i] === null) continue;
    const t = toUnixSec(timestamps[i]);
    const val = maRaw[i] as number;
    ma.push({ time: t, value: val });

    // Month-over-month rate of change (look back ~30 days)
    if (i >= period - 1 + 30) {
      const prevIdx = i - 30;
      if (maRaw[prevIdx] !== null && (maRaw[prevIdx] as number) > 0) {
        const prevVal = maRaw[prevIdx] as number;
        const roc = ((val - prevVal) / prevVal) * 100;
        rateOfChange.push({ time: t, value: roc });
      }
    }
  }

  return { ma, rateOfChange };
}

function calcStockToFlow(currentPrice: number): StockToFlowData {
  // Current BTC supply — approximation as of early 2026
  // After April 2024 halving: 3.125 BTC/block
  // Blocks per year: ~52,560 (one every ~10 minutes)
  const currentSupply = 19_800_000; // ~19.8M BTC mined by early 2026
  const blockReward = 3.125;
  const blocksPerYear = 52_560;
  const annualFlow = blockReward * blocksPerYear; // ~164,250 BTC/year

  const ratio = currentSupply / annualFlow; // ~120.5

  // PlanB's original S2F model: price = exp(-1.84) * S2F^3.36
  const modelPrice = Math.exp(-1.84) * Math.pow(ratio, 3.36);

  const deviation =
    modelPrice !== 0
      ? ((currentPrice - modelPrice) / modelPrice) * 100
      : 0;

  return {
    ratio: Math.round(ratio * 10) / 10,
    modelPrice: Math.round(modelPrice),
    actualPrice: Math.round(currentPrice),
    deviation: Math.round(deviation * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function GET() {
  // L1: Return cached response if fresh
  if (cachedResponse && Date.now() - cacheTime < CACHE_TTL) {
    return NextResponse.json(cachedResponse);
  }

  try {
    // CoinGecko free API limits historical data to 365 days.
    // We fetch 365 days — enough for 350-day SMA but Pi Cycle (111+350) may be partial.
    const res = await fetch(
      'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=365&interval=daily',
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
      },
    );

    if (!res.ok) {
      // Return stale cache if available
      if (cachedResponse) {
        return NextResponse.json(cachedResponse);
      }
      return NextResponse.json(
        { error: `CoinGecko returned ${res.status}` },
        { status: 502 },
      );
    }

    const json = await res.json();

    if (!json.prices || !Array.isArray(json.prices) || json.prices.length === 0) {
      if (cachedResponse) {
        return NextResponse.json(cachedResponse);
      }
      return NextResponse.json(
        { error: 'Invalid response from CoinGecko — no price data' },
        { status: 502 },
      );
    }

    // CoinGecko returns [[timestamp_ms, price], ...]
    const timestamps: number[] = [];
    const closePrices: number[] = [];

    for (const [ts, price] of json.prices) {
      if (typeof ts === 'number' && typeof price === 'number' && price > 0) {
        timestamps.push(ts);
        closePrices.push(price);
      }
    }

    if (closePrices.length < 200) {
      if (cachedResponse) {
        return NextResponse.json(cachedResponse);
      }
      return NextResponse.json(
        { error: 'Insufficient price data for indicator calculation' },
        { status: 502 },
      );
    }

    // Build price series (Unix seconds for lightweight-charts)
    const prices: TimePrice[] = timestamps.map((ts, i) => ({
      time: toUnixSec(ts),
      price: closePrices[i],
    }));

    // Calculate all indicators
    const piCycle = calcPiCycle(timestamps, closePrices);
    const rainbow = calcRainbow(timestamps, closePrices);
    const weeklyMA200 = calcWeeklyMA200(timestamps, closePrices);
    const stockToFlow = calcStockToFlow(closePrices[closePrices.length - 1]);

    const response: MarketCycleResponse = {
      prices,
      piCycle,
      rainbow,
      weeklyMA200,
      stockToFlow,
      timestamp: Math.floor(Date.now() / 1000),
    };

    // Update L1 cache
    cachedResponse = response;
    cacheTime = Date.now();

    return NextResponse.json(response);
  } catch (e) {
    // Return stale cache on error
    if (cachedResponse) {
      return NextResponse.json(cachedResponse);
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to fetch market cycle data' },
      { status: 500 },
    );
  }
}
