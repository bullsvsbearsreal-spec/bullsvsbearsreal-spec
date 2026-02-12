import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout, getTop500Symbols, isTop500Symbol } from '../_shared/fetch';
import { fetchAllExchangesWithHealth } from '../_shared/exchange-fetchers';
import { fundingFetchers } from './exchanges';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';

type AssetClassFilter = 'crypto' | 'stocks' | 'forex' | 'commodities' | 'all';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const assetClass = (searchParams.get('assetClass') || 'crypto') as AssetClassFilter;

  const [{ data, health }, top500] = await Promise.all([
    fetchAllExchangesWithHealth(fundingFetchers, fetchWithTimeout),
    getTop500Symbols(),
  ]);

  let filtered;
  if (assetClass === 'all') {
    // Return everything — apply top-500 only to crypto entries
    filtered = data.filter(r => {
      if (!r.assetClass || r.assetClass === 'crypto') {
        return isTop500Symbol(r.symbol, top500);
      }
      return true; // Non-crypto passes without top-500 filter
    });
  } else if (assetClass === 'crypto') {
    // Default: crypto only, filtered by top-500
    filtered = data.filter(r => {
      const ac = r.assetClass || 'crypto';
      return ac === 'crypto' && isTop500Symbol(r.symbol, top500);
    });
  } else {
    // Specific non-crypto asset class — no top-500 filter needed
    filtered = data.filter(r => r.assetClass === assetClass);
  }

  return NextResponse.json({
    data: filtered,
    health,
    meta: {
      totalExchanges: fundingFetchers.length,
      activeExchanges: health.filter(h => h.status === 'ok').length,
      totalEntries: filtered.length,
      assetClass,
      timestamp: Date.now(),
    },
  });
}
