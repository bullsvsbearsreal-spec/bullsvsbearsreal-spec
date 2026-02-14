import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';
import { fetchAllExchanges } from '../_shared/exchange-fetchers';
import { tickerFetchers } from '../tickers/exchanges';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const count = Math.min(Math.max(parseInt(searchParams.get('count') || '20', 10) || 20, 5), 50);

  try {
    const allTickers = await fetchAllExchanges(tickerFetchers, fetchWithTimeout) as TickerRaw[];

    // Group by symbol
    const symbolMap = new Map<string, {
      changes: { exchange: string; change24h: number }[];
      prices: number[];
      volumes: number[];
    }>();

    for (const t of allTickers) {
      if (!t.symbol || !isFinite(t.priceChangePercent24h) || !isFinite(t.price) || t.price <= 0) continue;

      const existing = symbolMap.get(t.symbol);
      if (existing) {
        existing.changes.push({ exchange: t.exchange, change24h: t.priceChangePercent24h });
        existing.prices.push(t.price);
        existing.volumes.push(t.quoteVolume24h || 0);
      } else {
        symbolMap.set(t.symbol, {
          changes: [{ exchange: t.exchange, change24h: t.priceChangePercent24h }],
          prices: [t.price],
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

    return NextResponse.json({
      symbols: topSymbols,
      totalExchanges: new Set(allTickers.map(t => t.exchange)).size,
      timestamp: Date.now(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Correlation API error:', msg);
    return NextResponse.json({ error: msg, symbols: [] }, { status: 500 });
  }
}
