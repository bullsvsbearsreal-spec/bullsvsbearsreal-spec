import { NextResponse } from 'next/server';
import { fetchAllExchangesWithHealth } from '../../_shared/exchange-fetchers';
import { fetchWithTimeout } from '../../_shared/fetch';
import { tickerFetchers } from '../../tickers/exchanges';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cache in memory for 30s
let cache: { data: any; ts: number } | null = null;
const CACHE_MS = 30_000;

export async function GET() {
  if (cache && Date.now() - cache.ts < CACHE_MS) {
    return NextResponse.json(cache.data, { headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' } });
  }

  try {
    // Fetch tickers directly (no self-fetch)
    const { data: results } = await fetchAllExchangesWithHealth(tickerFetchers, fetchWithTimeout);
    const tickers: Array<{ symbol: string; exchange: string; lastPrice: number }> = results as any;

    // Group by symbol
    const bySymbol: Record<string, Array<{ exchange: string; price: number }>> = {};
    for (const t of tickers) {
      if (!t.symbol || t.lastPrice <= 0) continue;
      if (!bySymbol[t.symbol]) bySymbol[t.symbol] = [];
      bySymbol[t.symbol].push({ exchange: t.exchange, price: t.lastPrice });
    }

    // Compute spread for each symbol
    const data: Array<{
      symbol: string;
      spreadUsd: number;
      spreadPct: number;
      highExchange: string;
      highPrice: number;
      lowExchange: string;
      lowPrice: number;
      exchangeCount: number;
    }> = [];

    for (const [symbol, exchanges] of Object.entries(bySymbol)) {
      if (exchanges.length < 2) continue;

      // Filter outliers: exclude >5% from median
      const prices = exchanges.map(e => e.price).sort((a, b) => a - b);
      const median = prices[Math.floor(prices.length / 2)];
      const sane = exchanges.filter(e => Math.abs(e.price - median) / median < 0.05);
      if (sane.length < 2) continue;

      sane.sort((a, b) => b.price - a.price);
      const high = sane[0];
      const low = sane[sane.length - 1];
      const spreadUsd = high.price - low.price;
      const spreadPct = (spreadUsd / low.price) * 100;

      data.push({
        symbol, spreadUsd, spreadPct,
        highExchange: high.exchange, highPrice: high.price,
        lowExchange: low.exchange, lowPrice: low.price,
        exchangeCount: sane.length,
      });
    }

    // Sort by spread % descending
    data.sort((a, b) => b.spreadPct - a.spreadPct);

    const resp = { data, count: data.length, ts: Date.now() };
    cache = { data: resp, ts: Date.now() };
    return NextResponse.json(resp, { headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
