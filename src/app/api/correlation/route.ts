import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';
import { fetchAllExchanges } from '../_shared/exchange-fetchers';
import { tickerFetchers } from '../tickers/exchanges';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface TickerRaw {
  symbol: string;
  exchange: string;
  lastPrice: number;
  price: number;
  priceChangePercent24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  quoteVolume24h: number;
}

interface SymbolEntry {
  symbol: string;
  changes: { exchange: string; change24h: number }[];
  avgChange: number;
  avgPrice: number;
  totalVolume: number;
  exchangeCount: number;
}

interface CorrelationResponse {
  symbols: SymbolEntry[];
  totalExchanges: number;
  timestamp: number;
}

// L1 in-memory cache, keyed by `count`. Fanning out to every exchange's
// ticker endpoint takes ~3-4s cold; with this cache, repeat hits are instant
// and the CF edge can serve the rest of the world from cache too.
const l1Cache = new Map<number, { body: CorrelationResponse; ts: number }>();
const L1_TTL = 60 * 1000; // 1 min — 24h-change data is slow-moving
const PUBLIC_CACHE = 'public, s-maxage=60, stale-while-revalidate=300';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const count = Math.min(Math.max(parseInt(searchParams.get('count') || '20', 10) || 20, 5), 50);

  const cached = l1Cache.get(count);
  if (cached && Date.now() - cached.ts < L1_TTL) {
    return NextResponse.json(cached.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': PUBLIC_CACHE },
    });
  }

  try {
    const allTickers = await fetchAllExchanges(tickerFetchers, fetchWithTimeout) as TickerRaw[];

    // Group by symbol
    const symbolMap = new Map<string, {
      changes: { exchange: string; change24h: number }[];
      prices: number[];
      volumes: number[];
    }>();

    for (const t of allTickers) {
      const price = t.price || t.lastPrice || 0;
      if (!t.symbol || !isFinite(t.priceChangePercent24h) || !isFinite(price) || price <= 0) continue;

      const existing = symbolMap.get(t.symbol);
      if (existing) {
        existing.changes.push({ exchange: t.exchange, change24h: t.priceChangePercent24h });
        existing.prices.push(price);
        existing.volumes.push(t.quoteVolume24h || 0);
      } else {
        symbolMap.set(t.symbol, {
          changes: [{ exchange: t.exchange, change24h: t.priceChangePercent24h }],
          prices: [price],
          volumes: [t.quoteVolume24h || 0],
        });
      }
    }

    // Only include symbols listed on 3+ exchanges for meaningful cross-exchange correlation
    const symbols: SymbolEntry[] = [];
    for (const [symbol, data] of Array.from(symbolMap.entries())) {
      if (data.changes.length < 3) continue;

      const avgChange = data.changes.reduce((s, c) => s + c.change24h, 0) / data.changes.length;
      const avgPrice = data.prices.reduce((s, p) => s + p, 0) / data.prices.length;
      const totalVolume = data.volumes.reduce((s, v) => s + v, 0);

      symbols.push({
        symbol,
        changes: data.changes,
        avgChange: parseFloat(avgChange.toFixed(4)),
        avgPrice: parseFloat(avgPrice.toFixed(6)),
        totalVolume: Math.round(totalVolume),
        exchangeCount: data.changes.length,
      });
    }

    // Sort by total volume, take top N
    symbols.sort((a, b) => b.totalVolume - a.totalVolume);
    const topSymbols = symbols.slice(0, count);

    const body: CorrelationResponse = {
      symbols: topSymbols,
      totalExchanges: new Set(allTickers.map(t => t.exchange)).size,
      timestamp: Date.now(),
    };

    // Only cache when at least one exchange responded with usable data —
    // never pin an empty response.
    if (topSymbols.length > 0) {
      l1Cache.set(count, { body, ts: Date.now() });
      // Keep the map bounded — there are at most ~50 distinct count values.
      if (l1Cache.size > 60) {
        const firstKey = l1Cache.keys().next().value;
        if (firstKey !== undefined) l1Cache.delete(firstKey);
      }
    }

    return NextResponse.json(body, {
      headers: { 'X-Cache': 'MISS', 'Cache-Control': PUBLIC_CACHE },
    });
  } catch (error) {
    console.error('[Correlation]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to compute correlation', symbols: [] }, { status: 500 });
  }
}
