import { NextRequest, NextResponse } from 'next/server';
import { getFundingHistoryMulti } from '@/lib/db';

const KRONOS_URL = process.env.KRONOS_SERVICE_URL || 'http://localhost:8400';
const KRONOS_API_KEY = process.env.KRONOS_API_KEY || '';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min cache

// In-memory cache for predictions
const predictionCache = new Map<string, { data: any; ts: number }>();

function getCacheKey(symbol: string, exchanges: string[]): string {
  return `${symbol}|${exchanges.sort().join(',')}`;
}

interface FundingPrediction {
  timestamp: string;
  predicted_rate: number;
  confidence: number;
}

interface SpreadPrediction {
  symbol: string;
  high_exchange: string;
  low_exchange: string;
  current_spread: number;
  predicted_spread: number;
  spread_direction: 'widening' | 'narrowing' | 'stable';
  spread_change_pct: number;
  confidence: number;
  high_predictions: FundingPrediction[];
  low_predictions: FundingPrediction[];
  model: string;
  inference_ms: number;
}

/**
 * GET /api/predictions/funding?symbol=BTC&high=Binance&low=Bybit
 *
 * Fetches historical funding data from DB, sends to Kronos service,
 * returns spread prediction for the arbitrage pair.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const highExchange = searchParams.get('high');
    const lowExchange = searchParams.get('low');
    const predSteps = parseInt(searchParams.get('steps') || '12');

    if (!symbol || !highExchange || !lowExchange) {
      return NextResponse.json(
        { error: 'Missing required params: symbol, high, low' },
        { status: 400 }
      );
    }

    // Check cache
    const cacheKey = getCacheKey(symbol, [highExchange, lowExchange]);
    const cached = predictionCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return NextResponse.json(cached.data, {
        headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, max-age=1800' },
      });
    }

    // Fetch historical funding data from DB (7 days of per-exchange data)
    const historyMulti = await getFundingHistoryMulti(symbol, 7);
    const highHistory = historyMulti[highExchange] || [];
    const lowHistory = historyMulti[lowExchange] || [];

    if (highHistory.length < 24 || lowHistory.length < 24) {
      return NextResponse.json(
        { error: `Insufficient history for ${symbol}: ${highExchange}=${highHistory.length}, ${lowExchange}=${lowHistory.length} (need 24+)` },
        { status: 422 }
      );
    }

    // Align histories to same length (take the shorter one)
    const minLen = Math.min(highHistory.length, lowHistory.length, 400);
    const highSlice = highHistory.slice(-minLen);
    const lowSlice = lowHistory.slice(-minLen);

    // Check if Kronos service is available
    const healthRes = await fetch(`${KRONOS_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    }).catch(() => null);

    if (!healthRes || !healthRes.ok) {
      // Kronos service not available — return heuristic-only prediction
      return NextResponse.json(
        buildHeuristicPrediction(symbol, highExchange, lowExchange, highSlice, lowSlice),
        { headers: { 'X-Prediction-Source': 'heuristic' } }
      );
    }

    // Call Kronos spread prediction
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (KRONOS_API_KEY) headers['Authorization'] = `Bearer ${KRONOS_API_KEY}`;

    const kronosRes = await fetch(`${KRONOS_URL}/predict/spread`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        symbol,
        high_exchange: highExchange,
        low_exchange: lowExchange,
        high_history: highSlice.map(p => ({
          timestamp: new Date(p.t).toISOString(),
          rate: p.rate,
        })),
        low_history: lowSlice.map(p => ({
          timestamp: new Date(p.t).toISOString(),
          rate: p.rate,
        })),
        pred_steps: predSteps,
        interval_hours: detectInterval(highSlice),
        temperature: 0.8,
        sample_count: 3,
      }),
      signal: AbortSignal.timeout(30000), // 30s timeout for ML inference
    });

    if (!kronosRes.ok) {
      const err = await kronosRes.text();
      console.error(`Kronos predict/spread failed: ${kronosRes.status} ${err}`);
      return NextResponse.json(
        buildHeuristicPrediction(symbol, highExchange, lowExchange, highSlice, lowSlice),
        { headers: { 'X-Prediction-Source': 'heuristic-fallback' } }
      );
    }

    const prediction: SpreadPrediction = await kronosRes.json();

    // Merge Kronos prediction with heuristic for robustness
    const result = {
      ...prediction,
      source: 'kronos' as const,
      cached_at: new Date().toISOString(),
    };

    // Cache the result
    predictionCache.set(cacheKey, { data: result, ts: Date.now() });

    // Evict old cache entries
    if (predictionCache.size > 500) {
      const oldest = Array.from(predictionCache.entries())
        .sort((a, b) => a[1].ts - b[1].ts)
        .slice(0, 100);
      for (const entry of oldest) predictionCache.delete(entry[0]);
    }

    return NextResponse.json(result, {
      headers: {
        'X-Cache': 'MISS',
        'X-Prediction-Source': 'kronos',
        'Cache-Control': 'public, max-age=1800',
      },
    });

  } catch (e) {
    console.error('Prediction API error:', e);
    return NextResponse.json(
      { error: 'Prediction service unavailable' },
      { status: 503 }
    );
  }
}

/**
 * Batch prediction endpoint.
 * POST /api/predictions/funding
 * Body: { pairs: [{ symbol, high, low }], steps?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const pairs: { symbol: string; high: string; low: string }[] = body.pairs || [];
    const steps = body.steps || 12;

    if (pairs.length === 0 || pairs.length > 20) {
      return NextResponse.json(
        { error: 'Provide 1-20 pairs' },
        { status: 400 }
      );
    }

    // Fetch predictions for each pair (check cache first)
    const results = await Promise.allSettled(
      pairs.map(async (pair) => {
        const cacheKey = getCacheKey(pair.symbol, [pair.high, pair.low]);
        const cached = predictionCache.get(cacheKey);
        if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
          return cached.data;
        }

        // Fetch history
        const historyMulti = await getFundingHistoryMulti(pair.symbol, 7);
        const highHistory = historyMulti[pair.high] || [];
        const lowHistory = historyMulti[pair.low] || [];

        if (highHistory.length < 24 || lowHistory.length < 24) {
          return buildHeuristicPrediction(
            pair.symbol, pair.high, pair.low,
            highHistory, lowHistory
          );
        }

        const minLen = Math.min(highHistory.length, lowHistory.length, 400);
        return buildHeuristicPrediction(
          pair.symbol, pair.high, pair.low,
          highHistory.slice(-minLen), lowHistory.slice(-minLen)
        );
      })
    );

    const predictions = results.map((r, i) => ({
      symbol: pairs[i].symbol,
      high: pairs[i].high,
      low: pairs[i].low,
      prediction: r.status === 'fulfilled' ? r.value : null,
      error: r.status === 'rejected' ? (r.reason?.message || 'Failed') : undefined,
    }));

    return NextResponse.json({ predictions });

  } catch (e) {
    console.error('Batch prediction error:', e);
    return NextResponse.json({ error: 'Prediction failed' }, { status: 500 });
  }
}


// ---------------------------------------------------------------------------
// Heuristic fallback (no Kronos service needed)
// ---------------------------------------------------------------------------

function detectInterval(history: { t: number; rate: number }[]): number {
  if (history.length < 2) return 8;
  const diffs: number[] = [];
  for (let i = 1; i < Math.min(history.length, 20); i++) {
    diffs.push(history[i].t - history[i - 1].t);
  }
  const avgMs = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const hours = avgMs / (1000 * 60 * 60);
  if (hours < 2) return 1;
  if (hours < 6) return 4;
  return 8;
}

function buildHeuristicPrediction(
  symbol: string,
  highExchange: string,
  lowExchange: string,
  highHistory: { t: number; rate: number }[],
  lowHistory: { t: number; rate: number }[],
) {
  // Simple linear regression + mean reversion heuristic
  const currentHigh = highHistory[highHistory.length - 1]?.rate || 0;
  const currentLow = lowHistory[lowHistory.length - 1]?.rate || 0;
  const currentSpread = currentHigh - currentLow;

  // Calculate moving averages
  const recentN = Math.min(12, highHistory.length);
  const recentHighAvg = highHistory.slice(-recentN).reduce((s, p) => s + p.rate, 0) / recentN;
  const recentLowAvg = lowHistory.slice(-recentN).reduce((s, p) => s + p.rate, 0) / recentN;
  const recentSpreadAvg = recentHighAvg - recentLowAvg;

  // Longer-term mean
  const longN = Math.min(48, highHistory.length);
  const longHighAvg = highHistory.slice(-longN).reduce((s, p) => s + p.rate, 0) / longN;
  const longLowAvg = lowHistory.slice(-longN).reduce((s, p) => s + p.rate, 0) / longN;
  const longSpreadAvg = longHighAvg - longLowAvg;

  // Mean-reversion: predict spread moves toward longer-term average
  const predictedSpread = currentSpread * 0.6 + longSpreadAvg * 0.4;
  const spreadChange = predictedSpread - currentSpread;
  const spreadChangePct = currentSpread !== 0 ? (spreadChange / Math.abs(currentSpread)) * 100 : 0;

  let direction: 'widening' | 'narrowing' | 'stable' = 'stable';
  if (spreadChangePct > 10) direction = 'widening';
  else if (spreadChangePct < -10) direction = 'narrowing';

  // Trend from recent rate changes
  const highTrend = currentHigh - recentHighAvg;
  const lowTrend = currentLow - recentLowAvg;

  return {
    symbol,
    high_exchange: highExchange,
    low_exchange: lowExchange,
    current_spread: Math.round(currentSpread * 1e6) / 1e6,
    predicted_spread: Math.round(predictedSpread * 1e6) / 1e6,
    spread_direction: direction,
    spread_change_pct: Math.round(spreadChangePct * 100) / 100,
    confidence: 0.45, // heuristic = lower confidence
    high_trend: highTrend > 0.001 ? 'rising' : highTrend < -0.001 ? 'falling' : 'stable',
    low_trend: lowTrend > 0.001 ? 'rising' : lowTrend < -0.001 ? 'falling' : 'stable',
    source: 'heuristic' as const,
    model: 'heuristic-mean-reversion',
    inference_ms: 0,
  };
}
