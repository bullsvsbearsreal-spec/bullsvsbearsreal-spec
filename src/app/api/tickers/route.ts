import { NextResponse } from 'next/server';
import { fetchWithTimeout, normalizeSymbol } from '../_shared/fetch';
import { fetchAllExchangesWithHealth } from '../_shared/exchange-fetchers';
import { dedupedFetch } from '../_shared/inflight';
import { tickerFetchers } from './exchanges';

export const runtime = 'nodejs';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// ---------------------------------------------------------------------------
// L1: In-memory cache (30-second TTL — prices need to be reasonably fresh)
// ---------------------------------------------------------------------------
let l1Cache: { body: any; timestamp: number } | null = null;
const L1_TTL = 30 * 1000; // 30 seconds

// Filter response to only include requested symbols (e.g. ?symbols=BTC,ETH)
function filterBySymbols(body: any, symbols: Set<string>) {
  return {
    ...body,
    data: body.data.filter((entry: any) => symbols.has(entry.symbol?.toUpperCase())),
    meta: { ...body.meta, filtered: true, requestedSymbols: symbols.size },
  };
}

export async function GET(request: Request) {
  // Parse optional symbol filter: ?symbols=BTC,ETH,SOL
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get('symbols');
  const symbolFilter = symbolsParam
    ? new Set(symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean))
    : null;

  // L1: Return cached data if fresh
  if (l1Cache && Date.now() - l1Cache.timestamp < L1_TTL) {
    const body = symbolFilter ? filterBySymbols(l1Cache.body, symbolFilter) : l1Cache.body;
    return NextResponse.json(body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' },
    });
  }

  try {
    const { data, health } = await dedupedFetch('tickers', () =>
      fetchAllExchangesWithHealth(tickerFetchers, fetchWithTimeout),
    );

    // Normalize symbols for token rebrands (RNDR→RENDER, MATIC→POL)
    data.forEach((entry: any) => { entry.symbol = normalizeSymbol(entry.symbol); });

    // Calculate total volume across ALL exchanges before client-side dedup.
    // Per-symbol: sum volumes across exchanges (each exchange contributes once per symbol).
    // Cap individual entries at $100B to filter exchanges with inflated data (e.g. Gate.io).
    const MAX_SANE_VOL = 100_000_000_000;
    const volBySymbol = new Map<string, Map<string, number>>();
    for (const t of data) {
      const vol = t.quoteVolume24h || 0;
      if (vol <= 0 || vol > MAX_SANE_VOL) continue;
      let symMap = volBySymbol.get(t.symbol);
      if (!symMap) { symMap = new Map(); volBySymbol.set(t.symbol, symMap); }
      const existing = symMap.get(t.exchange) || 0;
      if (vol > existing) symMap.set(t.exchange, vol); // Best entry per exchange+symbol
    }
    let totalVolume = 0;
    volBySymbol.forEach((symMap) => {
      symMap.forEach((vol) => { totalVolume += vol; });
    });

    const activeExchanges = health.filter(h => h.status === 'ok').length;
    const responseBody = {
      data,
      health,
      meta: {
        totalExchanges: health.length,
        activeExchanges,
        totalEntries: data.length,
        totalVolume,
        timestamp: Date.now(),
      },
    };

    // Update L1 cache
    l1Cache = { body: responseBody, timestamp: Date.now() };

    const finalBody = symbolFilter ? filterBySymbols(responseBody, symbolFilter) : responseBody;
    return NextResponse.json(finalBody, {
      headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Tickers API error:', msg);

    // Return stale cache if available
    if (l1Cache) {
      const body = symbolFilter ? filterBySymbols(l1Cache.body, symbolFilter) : l1Cache.body;
      return NextResponse.json(body, {
        headers: { 'X-Cache': 'STALE', 'Cache-Control': 'public, s-maxage=10' },
      });
    }

    return NextResponse.json({ data: [], health: [], meta: { totalExchanges: 0, activeExchanges: 0, totalEntries: 0, timestamp: Date.now() } }, { status: 500 });
  }
}
