/**
 * GET /api/onchain
 *
 * Bitcoin on-chain metrics aggregated from free public APIs.
 * Sources: blockchain.com, mempool.space, CoinGecko
 * Returns hash rate, difficulty, miner revenue, Puell Multiple, MVRV,
 * mempool stats, transaction volume, and supply data.
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'sin1';
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TimeValue {
  time: number; // Unix seconds (for lightweight-charts)
  value: number;
}

interface BlockchainChartResponse {
  values: Array<{ x: number; y: number }>;
}

interface MempoolBlock {
  blockSize: number;
  blockVSize: number;
  nTx: number;
  totalFees: number;
  medianFee: number;
  feeRange: number[];
}

interface MempoolFees {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
}

interface DifficultyAdjustment {
  progressPercent: number;
  difficultyChange: number;
  estimatedRetargetDate: number;
  remainingBlocks: number;
  remainingTime: number;
  previousRetarget: number;
  nextRetargetHeight: number;
  timeAvg: number;
  timeOffset: number;
}

interface CoinGeckoBitcoin {
  market_data: {
    market_cap: { usd: number };
    current_price: { usd: number };
  };
}

interface OnchainResponse {
  hashRate: {
    current: number;
    unit: string;
    change30d: number | null;
    history: TimeValue[];
  };
  difficulty: {
    current: number;
    nextAdjustment: {
      estimatedPercent: number;
      remainingBlocks: number;
      estimatedDate: string;
    } | null;
    history: TimeValue[];
  };
  minerRevenue: {
    current: number;
    unit: string;
    history: TimeValue[];
  };
  puellMultiple: {
    current: number | null;
    signal: string;
    history: TimeValue[];
  };
  mvrv: {
    current: number | null;
    signal: string;
    zScore: number | null;
  };
  mempool: {
    pendingTxCount: number;
    totalFees: number;
    recommendedFees: {
      fastest: number;
      halfHour: number;
      hour: number;
      economy: number;
    } | null;
  };
  transactionVolume: {
    current: number;
    unit: string;
    history: TimeValue[];
  };
  supply: {
    current: number;
    maxSupply: number;
    percentMined: number;
  };
  timestamp: number;
}

// ---------------------------------------------------------------------------
// L1 in-memory cache (10-minute TTL)
// ---------------------------------------------------------------------------

let cachedResponse: OnchainResponse | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

const TIMEOUT = 8000;

async function fetchJSON<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT),
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT),
      headers: { Accept: 'text/plain' },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Convert blockchain.com chart values to lightweight-charts format */
function toHistory(chart: BlockchainChartResponse | null): TimeValue[] {
  if (!chart?.values) return [];
  return chart.values.map((v) => ({
    time: v.x, // already Unix seconds
    value: v.y,
  }));
}

/** Get the last value from a blockchain.com chart */
function lastValue(chart: BlockchainChartResponse | null): number {
  if (!chart?.values?.length) return 0;
  return chart.values[chart.values.length - 1].y;
}

/** Calculate percent change over the last ~30 days from chart data */
function change30d(chart: BlockchainChartResponse | null): number | null {
  if (!chart?.values || chart.values.length < 30) return null;
  const now = chart.values[chart.values.length - 1].y;
  // blockchain.com returns daily data points; go back ~30 entries
  const idx = Math.max(0, chart.values.length - 31);
  const prev = chart.values[idx].y;
  if (prev === 0) return null;
  return ((now - prev) / prev) * 100;
}

// ---------------------------------------------------------------------------
// Puell Multiple calculation
// ---------------------------------------------------------------------------

function computePuellMultiple(
  minerRevenueChart: BlockchainChartResponse | null,
): { current: number | null; signal: string; history: TimeValue[] } {
  if (!minerRevenueChart?.values?.length) {
    return { current: null, signal: 'neutral', history: [] };
  }

  const values = minerRevenueChart.values;
  const history: TimeValue[] = [];

  // We need at least 365 data points for the MA
  for (let i = 0; i < values.length; i++) {
    if (i < 364) continue; // need 365 days of lookback

    // Calculate 365-day simple moving average of miner revenue
    let sum = 0;
    for (let j = i - 364; j <= i; j++) {
      sum += values[j].y;
    }
    const ma365 = sum / 365;

    if (ma365 <= 0) continue;

    const puell = values[i].y / ma365;
    history.push({
      time: values[i].x,
      value: Math.round(puell * 1000) / 1000,
    });
  }

  const current = history.length > 0 ? history[history.length - 1].value : null;

  let signal = 'neutral';
  if (current !== null) {
    if (current < 0.5) signal = 'undervalued';
    else if (current > 1.5) signal = 'overheated';
  }

  return { current, signal, history };
}

// ---------------------------------------------------------------------------
// MVRV approximation
// ---------------------------------------------------------------------------

function computeMVRV(
  marketCapChart: BlockchainChartResponse | null,
  currentMarketCap: number | null,
): { current: number | null; signal: string; zScore: number | null } {
  if (!marketCapChart?.values?.length || !currentMarketCap) {
    return { current: null, signal: 'neutral', zScore: null };
  }

  const values = marketCapChart.values;

  // Use 200-day average market cap as a realized cap proxy
  const lookback = Math.min(200, values.length);
  const recentValues = values.slice(-lookback);
  const avgMarketCap =
    recentValues.reduce((sum, v) => sum + v.y, 0) / recentValues.length;

  if (avgMarketCap <= 0) {
    return { current: null, signal: 'neutral', zScore: null };
  }

  const mvrv = currentMarketCap / avgMarketCap;
  const mvrvRounded = Math.round(mvrv * 100) / 100;

  // Calculate z-score: how many standard deviations from the mean
  const allMcaps = values.map((v) => v.y);
  const mean = allMcaps.reduce((s, v) => s + v, 0) / allMcaps.length;
  const variance =
    allMcaps.reduce((s, v) => s + (v - mean) ** 2, 0) / allMcaps.length;
  const stdDev = Math.sqrt(variance);
  const zScore =
    stdDev > 0
      ? Math.round(((currentMarketCap - mean) / stdDev) * 100) / 100
      : null;

  let signal = 'neutral';
  if (mvrvRounded < 1.0) signal = 'undervalued';
  else if (mvrvRounded > 3.0) signal = 'overheated';

  return { current: mvrvRounded, signal, zScore };
}

// ---------------------------------------------------------------------------
// Mempool processing
// ---------------------------------------------------------------------------

function processMempool(
  mempoolBlocks: MempoolBlock[] | null,
  recommendedFees: MempoolFees | null,
): OnchainResponse['mempool'] {
  let pendingTxCount = 0;
  let totalFees = 0;

  if (mempoolBlocks && Array.isArray(mempoolBlocks)) {
    for (const block of mempoolBlocks) {
      pendingTxCount += block.nTx || 0;
      // totalFees is in satoshis, convert to BTC
      totalFees += (block.totalFees || 0) / 1e8;
    }
  }

  const fees = recommendedFees
    ? {
        fastest: recommendedFees.fastestFee,
        halfHour: recommendedFees.halfHourFee,
        hour: recommendedFees.hourFee,
        economy: recommendedFees.economyFee,
      }
    : null;

  return {
    pendingTxCount,
    totalFees: Math.round(totalFees * 1000) / 1000,
    recommendedFees: fees,
  };
}

// ---------------------------------------------------------------------------
// Main data fetcher
// ---------------------------------------------------------------------------

async function fetchOnchainData(): Promise<OnchainResponse> {
  const [
    hashRateResult,
    difficultyResult,
    minerRevenueResult,
    txVolumeResult,
    totalBtcResult,
    marketCapChartResult,
    mempoolBlocksResult,
    recommendedFeesResult,
    diffAdjustmentResult,
    coinGeckoResult,
  ] = await Promise.allSettled([
    // 0: Hash rate (1 year)
    fetchJSON<BlockchainChartResponse>(
      'https://api.blockchain.info/charts/hash-rate?timespan=1year&format=json',
    ),
    // 1: Difficulty (1 year)
    fetchJSON<BlockchainChartResponse>(
      'https://api.blockchain.info/charts/difficulty?timespan=1year&format=json',
    ),
    // 2: Miners revenue (1 year)
    fetchJSON<BlockchainChartResponse>(
      'https://api.blockchain.info/charts/miners-revenue?timespan=1year&format=json',
    ),
    // 3: Transaction volume USD (1 year)
    fetchJSON<BlockchainChartResponse>(
      'https://api.blockchain.info/charts/estimated-transaction-volume-usd?timespan=1year&format=json',
    ),
    // 4: Total BTC in circulation (returns satoshis as plain text)
    fetchText('https://api.blockchain.info/q/totalbc'),
    // 5: Market cap chart (1 year, for MVRV)
    fetchJSON<BlockchainChartResponse>(
      'https://api.blockchain.info/charts/market-cap?timespan=1year&format=json',
    ),
    // 6: Mempool blocks
    fetchJSON<MempoolBlock[]>(
      'https://mempool.space/api/v1/fees/mempool-blocks',
    ),
    // 7: Recommended fees
    fetchJSON<MempoolFees>(
      'https://mempool.space/api/v1/fees/recommended',
    ),
    // 8: Difficulty adjustment
    fetchJSON<DifficultyAdjustment>(
      'https://mempool.space/api/v1/difficulty-adjustment',
    ),
    // 9: CoinGecko Bitcoin data (for current market cap)
    fetchJSON<CoinGeckoBitcoin>(
      'https://api.coingecko.com/api/v3/coins/bitcoin?localization=false&tickers=false&community_data=false&developer_data=false',
    ),
  ]);

  // Extract settled values (null on rejection)
  const hashRateChart =
    hashRateResult.status === 'fulfilled' ? hashRateResult.value : null;
  const difficultyChart =
    difficultyResult.status === 'fulfilled' ? difficultyResult.value : null;
  const minerRevenueChart =
    minerRevenueResult.status === 'fulfilled'
      ? minerRevenueResult.value
      : null;
  const txVolumeChart =
    txVolumeResult.status === 'fulfilled' ? txVolumeResult.value : null;
  const totalBtcText =
    totalBtcResult.status === 'fulfilled' ? totalBtcResult.value : null;
  const marketCapChart =
    marketCapChartResult.status === 'fulfilled'
      ? marketCapChartResult.value
      : null;
  const mempoolBlocks =
    mempoolBlocksResult.status === 'fulfilled'
      ? mempoolBlocksResult.value
      : null;
  const recommendedFees =
    recommendedFeesResult.status === 'fulfilled'
      ? recommendedFeesResult.value
      : null;
  const diffAdjustment =
    diffAdjustmentResult.status === 'fulfilled'
      ? diffAdjustmentResult.value
      : null;
  const coinGecko =
    coinGeckoResult.status === 'fulfilled' ? coinGeckoResult.value : null;

  // --- Hash Rate ---
  const hashRate = {
    current: lastValue(hashRateChart),
    unit: 'TH/s',
    change30d: change30d(hashRateChart),
    history: toHistory(hashRateChart),
  };

  // --- Difficulty ---
  const nextAdjustment = diffAdjustment
    ? {
        estimatedPercent:
          Math.round(diffAdjustment.difficultyChange * 100) / 100,
        remainingBlocks: diffAdjustment.remainingBlocks,
        estimatedDate: new Date(
          diffAdjustment.estimatedRetargetDate,
        ).toISOString(),
      }
    : null;

  const difficulty = {
    current: lastValue(difficultyChart),
    nextAdjustment,
    history: toHistory(difficultyChart),
  };

  // --- Miner Revenue ---
  const minerRevenue = {
    current: lastValue(minerRevenueChart),
    unit: 'USD',
    history: toHistory(minerRevenueChart),
  };

  // --- Puell Multiple ---
  const puellMultiple = computePuellMultiple(minerRevenueChart);

  // --- MVRV ---
  const currentMarketCap = coinGecko?.market_data?.market_cap?.usd ?? null;
  const mvrv = computeMVRV(marketCapChart, currentMarketCap);

  // --- Mempool ---
  const mempool = processMempool(mempoolBlocks, recommendedFees);

  // --- Transaction Volume ---
  const transactionVolume = {
    current: lastValue(txVolumeChart),
    unit: 'USD',
    history: toHistory(txVolumeChart),
  };

  // --- Supply ---
  const totalBtcSatoshis = totalBtcText ? parseInt(totalBtcText, 10) : 0;
  const currentSupply = totalBtcSatoshis > 0 ? totalBtcSatoshis / 1e8 : 0;
  const maxSupply = 21_000_000;

  const supply = {
    current: Math.round(currentSupply * 100) / 100,
    maxSupply,
    percentMined:
      currentSupply > 0
        ? Math.round((currentSupply / maxSupply) * 10000) / 100
        : 0,
  };

  return {
    hashRate,
    difficulty,
    minerRevenue,
    puellMultiple,
    mvrv,
    mempool,
    transactionVolume,
    supply,
    timestamp: Math.floor(Date.now() / 1000),
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET() {
  // L1: Return cached data if fresh
  if (cachedResponse && Date.now() - cacheTimestamp < CACHE_TTL) {
    return NextResponse.json(cachedResponse);
  }

  try {
    const data = await fetchOnchainData();

    // Update L1 cache
    cachedResponse = data;
    cacheTimestamp = Date.now();

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (err) {
    console.error('Onchain API error:', err);

    // Return stale cache if available
    if (cachedResponse) {
      return NextResponse.json(cachedResponse);
    }

    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Failed to fetch on-chain data',
      },
      { status: 500 },
    );
  }
}
