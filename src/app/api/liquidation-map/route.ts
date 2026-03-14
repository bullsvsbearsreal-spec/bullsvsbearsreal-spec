import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// ---------------------------------------------------------------------------
// L1: In-memory cache (60s TTL)
// ---------------------------------------------------------------------------
let l1Cache: { body: LiquidationMapResponse; timestamp: number } | null = null;
const L1_TTL = 60 * 1000; // 60 seconds

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface LiquidationLevel {
  price: number;
  type: 'long' | 'short';
  leverage: number;
  estimatedVolume: number;
  distancePercent: number;
}

interface LiquidationMapResponse {
  symbol: string;
  currentPrice: number;
  levels: LiquidationLevel[];
  totalLongLiq: number;
  totalShortLiq: number;
  timestamp: number;
}

interface OIEntry {
  symbol: string;
  exchange: string;
  openInterest?: number;
  openInterestValue?: number;
}

// ---------------------------------------------------------------------------
// Supported symbols & leverage tiers
// ---------------------------------------------------------------------------
const SUPPORTED_SYMBOLS = ['BTC', 'ETH', 'SOL'] as const;
type SupportedSymbol = typeof SUPPORTED_SYMBOLS[number];

const LEVERAGE_TIERS = [2, 3, 5, 10, 20, 25, 50, 75, 100] as const;

// Estimated distribution of positions across leverage tiers (sums to ~1.0)
// Higher leverage = fewer traders, but they get liquidated more easily
const LEVERAGE_WEIGHT: Record<number, number> = {
  2: 0.05,
  3: 0.08,
  5: 0.15,
  10: 0.22,
  20: 0.18,
  25: 0.12,
  50: 0.10,
  75: 0.06,
  100: 0.04,
};

// ---------------------------------------------------------------------------
// Fetch current price from Binance
// ---------------------------------------------------------------------------
async function fetchCurrentPrice(symbol: SupportedSymbol): Promise<number> {
  const pair = `${symbol}USDT`;
  // Try multiple sources for resilience (Binance fapi blocks some IPs with 451)
  const sources = [
    { name: 'Binance', url: `https://fapi.binance.com/fapi/v1/ticker/price?symbol=${pair}`, parse: (d: any) => parseFloat(d.price) },
    { name: 'Bybit', url: `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${pair}`, parse: (d: any) => parseFloat(d?.result?.list?.[0]?.lastPrice) },
    { name: 'OKX', url: `https://www.okx.com/api/v5/market/ticker?instId=${symbol}-USDT-SWAP`, parse: (d: any) => parseFloat(d?.data?.[0]?.last) },
  ];

  for (const src of sources) {
    try {
      const res = await fetch(src.url, {
        signal: AbortSignal.timeout(5000),
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const price = src.parse(data);
      if (price && isFinite(price) && price > 0) return price;
    } catch {
      // Try next source
    }
  }
  throw new Error(`All price sources failed for ${symbol}`);
}

// ---------------------------------------------------------------------------
// Fetch OI data for the symbol from our own API
// ---------------------------------------------------------------------------
async function fetchSymbolOI(symbol: string): Promise<{ totalOI: number; exchangeCount: number }> {
  try {
    const baseUrl = process.env.NEXTAUTH_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

    if (!baseUrl) {
      return { totalOI: 0, exchangeCount: 0 };
    }

    const res = await fetch(`${baseUrl}/api/openinterest`, {
      signal: AbortSignal.timeout(10000),
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return { totalOI: 0, exchangeCount: 0 };

    const json = await res.json();
    const entries: OIEntry[] = json.data || [];

    const symUpper = symbol.toUpperCase();
    const matching = entries.filter(
      (e) => e.symbol?.toUpperCase() === symUpper
    );

    const totalOI = matching.reduce((sum, e) => {
      const val = e.openInterestValue ?? (e.openInterest ?? 0);
      return sum + (typeof val === 'number' && isFinite(val) ? val : 0);
    }, 0);

    const exchangeCount = new Set(matching.map((e) => e.exchange)).size;

    return { totalOI, exchangeCount };
  } catch (err) {
    console.error(`Failed to fetch OI for ${symbol}:`, err);
    return { totalOI: 0, exchangeCount: 0 };
  }
}

// ---------------------------------------------------------------------------
// Calculate liquidation levels
// ---------------------------------------------------------------------------
function calculateLevels(
  currentPrice: number,
  totalOI: number,
  exchangeCount: number,
): LiquidationLevel[] {
  const levels: LiquidationLevel[] = [];

  // If we have no OI data, use a reasonable fallback based on the asset
  // This prevents empty charts when OI API is slow
  const effectiveOI = totalOI > 0 ? totalOI : 1_000_000;

  // Exchange multiplier: more exchanges listing = more diverse positions = heavier clusters
  const exchangeMultiplier = Math.max(1, Math.log2(Math.max(exchangeCount, 1) + 1));

  for (const leverage of LEVERAGE_TIERS) {
    const weight = LEVERAGE_WEIGHT[leverage];

    // Approximate liquidation prices (ignoring maintenance margin for simplicity)
    // Long liquidation: price drops by (1/leverage) from entry
    const longLiqPrice = currentPrice * (1 - 1 / leverage);
    // Short liquidation: price rises by (1/leverage) from entry
    const shortLiqPrice = currentPrice * (1 + 1 / leverage);

    // Estimated volume at this level = total OI * weight * exchange factor
    // We also add a decay factor: higher leverage = proportionally less total value
    const baseVolume = effectiveOI * weight * exchangeMultiplier;

    // Long liquidation cluster (below current price)
    const longDistance = ((currentPrice - longLiqPrice) / currentPrice) * 100;
    levels.push({
      price: Math.round(longLiqPrice * 100) / 100,
      type: 'long',
      leverage,
      estimatedVolume: Math.round(baseVolume),
      distancePercent: Math.round(longDistance * 100) / 100,
    });

    // Short liquidation cluster (above current price)
    const shortDistance = ((shortLiqPrice - currentPrice) / currentPrice) * 100;
    levels.push({
      price: Math.round(shortLiqPrice * 100) / 100,
      type: 'short',
      leverage,
      estimatedVolume: Math.round(baseVolume),
      distancePercent: Math.round(shortDistance * 100) / 100,
    });
  }

  // Sort by price ascending
  levels.sort((a, b) => a.price - b.price);

  return levels;
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const rawSymbol = (searchParams.get('symbol') || 'BTC').toUpperCase();

  // Validate symbol
  const symbol = SUPPORTED_SYMBOLS.includes(rawSymbol as SupportedSymbol)
    ? (rawSymbol as SupportedSymbol)
    : 'BTC';

  // L1: Return cached data if fresh and same symbol
  if (l1Cache && Date.now() - l1Cache.timestamp < L1_TTL && l1Cache.body.symbol === symbol) {
    return NextResponse.json(l1Cache.body, {
      headers: {
        'X-Cache': 'HIT',
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  }

  try {
    // Fetch price and OI in parallel
    const [currentPrice, { totalOI, exchangeCount }] = await Promise.all([
      fetchCurrentPrice(symbol),
      fetchSymbolOI(symbol),
    ]);

    // Calculate liquidation levels
    const levels = calculateLevels(currentPrice, totalOI, exchangeCount);

    // Aggregate totals
    const totalLongLiq = levels
      .filter((l) => l.type === 'long')
      .reduce((sum, l) => sum + l.estimatedVolume, 0);
    const totalShortLiq = levels
      .filter((l) => l.type === 'short')
      .reduce((sum, l) => sum + l.estimatedVolume, 0);

    const responseBody: LiquidationMapResponse = {
      symbol,
      currentPrice,
      levels,
      totalLongLiq,
      totalShortLiq,
      timestamp: Date.now(),
    };

    // Update L1 cache
    l1Cache = { body: responseBody, timestamp: Date.now() };

    return NextResponse.json(responseBody, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Liquidation map API error:', msg);

    // Return stale cache if available
    if (l1Cache && l1Cache.body.symbol === symbol) {
      return NextResponse.json(l1Cache.body, {
        headers: {
          'X-Cache': 'STALE',
          'Cache-Control': 'public, s-maxage=15',
        },
      });
    }

    return NextResponse.json(
      { error: msg, symbol, currentPrice: 0, levels: [], totalLongLiq: 0, totalShortLiq: 0, timestamp: Date.now() },
      { status: 500 },
    );
  }
}
