import { NextResponse } from 'next/server';
import { fetchWithTimeout, getTop500Symbols, isTop500Symbol } from '../_shared/fetch';
import { fetchAllExchangesWithHealth } from '../_shared/exchange-fetchers';
import { oiFetchers } from './exchanges';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET() {
  const [{ data, health }, top500] = await Promise.all([
    fetchAllExchangesWithHealth(oiFetchers, fetchWithTimeout),
    getTop500Symbols(),
  ]);

  // Allow symbols listed on 2+ exchanges even if not top 500
  const exchangeCountMap = new Map<string, Set<string>>();
  data.forEach(r => {
    const sym = r.symbol.toUpperCase();
    if (!exchangeCountMap.has(sym)) exchangeCountMap.set(sym, new Set());
    exchangeCountMap.get(sym)!.add(r.exchange);
  });
  const multiExchangeSymbols = new Set<string>();
  exchangeCountMap.forEach((exchanges, sym) => {
    if (exchanges.size >= 2) multiExchangeSymbols.add(sym);
  });

  const filtered = data.filter(r =>
    isTop500Symbol(r.symbol, top500) || multiExchangeSymbols.has(r.symbol.toUpperCase())
  );

  return NextResponse.json({
    data: filtered,
    health,
    meta: {
      totalExchanges: oiFetchers.length,
      activeExchanges: health.filter(h => h.status === 'ok').length,
      totalEntries: filtered.length,
      timestamp: Date.now(),
    },
  });
}
