import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// ---------------------------------------------------------------------------
// L1: Per-symbol in-memory cache (5-min TTL).
//
// Was a single-slot cache with 60s TTL — every BTC↔ETH↔SOL switch trashed it
// and triggered an 8s+ rebuild (the rebuild fetches the entire 600KB OI feed
// over HTTP just to filter to one symbol). Per-symbol storage + longer TTL
// keeps switching between symbols cheap.
//
// Multi-symbol fetches share the same OI feed lookup so adding more symbols
// doesn't multiply upstream load proportionally — the OI fetch is shared
// across all calls via the openinterest route's own cache.
// ---------------------------------------------------------------------------
const l1Cache = new Map<string, { body: LiquidationMapResponse; timestamp: number }>();
const L1_TTL = 5 * 60 * 1000; // 5 minutes

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
  exchangeCount?: number;
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
//
// Top-10 perp markets by OI — these are reliably available in our openinterest
// feed across multiple venues, so the OI multiplier doesn't degenerate to the
// hardcoded fallback. Adding a symbol here is cheap (per-symbol cache slot)
// but the chart math assumes USD-quoted OI, which is what our feed returns.
// ---------------------------------------------------------------------------
const SUPPORTED_SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'AVAX', 'ADA', 'LINK', 'SUI'] as const;
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
    // Stale `process.env.VERCEL_URL` removed — we're on DO now and the public
    // origin is always info-hub.io (or whatever NEXT_PUBLIC_BASE_URL says).
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
      || process.env.NEXTAUTH_URL
      || 'https://info-hub.io';

    const res = await fetch(`${baseUrl}/api/openinterest`, {
      signal: AbortSignal.timeout(8000),
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

  // L1: Per-symbol cache lookup
  const cached = l1Cache.get(symbol);
  if (cached && Date.now() - cached.timestamp < L1_TTL) {
    return NextResponse.json(cached.body, {
      headers: {
        'X-Cache': 'HIT',
        // CF edge cache: 2 min fresh, 5 min stale-while-revalidate.
        // Liquidation-map is computed/estimated, not real-time — long cache OK.
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
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
      exchangeCount,
      timestamp: Date.now(),
    };

    // Update L1 cache (per-symbol)
    l1Cache.set(symbol, { body: responseBody, timestamp: Date.now() });

    return NextResponse.json(responseBody, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('[Liq-map]', error instanceof Error ? error.message : error);

    // Return stale cache if available
    const stale = l1Cache.get(symbol);
    if (stale) {
      return NextResponse.json(stale.body, {
        headers: {
          'X-Cache': 'STALE',
          'Cache-Control': 'public, s-maxage=30',
        },
      });
    }

    return NextResponse.json(
      { error: 'Failed to compute liquidation map', symbol, currentPrice: 0, levels: [], totalLongLiq: 0, totalShortLiq: 0, timestamp: Date.now() },
      { status: 500 },
    );
  }
}
