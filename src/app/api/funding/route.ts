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
    filtered = data.filter(r => {
      if (!r.assetClass || r.assetClass === 'crypto') {
        return isTop500Symbol(r.symbol, top500);
      }
      return true;
    });
  } else if (assetClass === 'crypto') {
    filtered = data.filter(r => {
      const ac = r.assetClass || 'crypto';
      return ac === 'crypto' && isTop500Symbol(r.symbol, top500);
    });
  } else {
    filtered = data.filter(r => r.assetClass === assetClass);
  }

  // Anomaly detection: flag rates > 5% per 8h (1,825% annualized)
  // This catches API format changes where an exchange returns pre-formatted values
  const ANOMALY_THRESHOLD = 5; // 5% per 8h
  const anomalies: { symbol: string; exchange: string; rate: number; action: string }[] = [];
  filtered = filtered.map(r => {
    if (Math.abs(r.fundingRate) > ANOMALY_THRESHOLD) {
      anomalies.push({
        symbol: r.symbol,
        exchange: r.exchange,
        rate: r.fundingRate,
        action: 'capped',
      });
      // Cap to threshold rather than exclude — preserves directional signal
      return { ...r, fundingRate: Math.sign(r.fundingRate) * ANOMALY_THRESHOLD };
    }
    return r;
  });

  return NextResponse.json({
    data: filtered,
    health,
    meta: {
      totalExchanges: fundingFetchers.length,
      activeExchanges: health.filter(h => h.status === 'ok').length,
      totalEntries: filtered.length,
      assetClass,
      timestamp: Date.now(),
      anomalies: anomalies.length > 0 ? anomalies : undefined,
      normalization: {
        basis: '8h',
        note: 'All rates normalized to 8-hour percentage. Hourly exchanges (Hyperliquid, dYdX, Aevo, Coinbase) ×8. 4h exchanges (Kraken) ×2. Per-second (gTrade) ×28800. OKX and CoinEx include predictedRate when available. Coinbase and dYdX report predicted/next funding as their primary rate.',
      },
    },
  });
}
