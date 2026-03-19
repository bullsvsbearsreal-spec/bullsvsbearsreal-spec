/**
 * Fetches live data from InfoHub APIs to populate the market recap video.
 * Used by the Remotion CLI at render time (runs in Node.js).
 */

import type { MarketRecapData, FundingEntry, TopMover, OIEntry } from './types';

const BASE = process.env.INFOHUB_API_BASE || 'https://info-hub.io';

async function fetchJSON<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'User-Agent': 'InfoHub-Remotion/1.0' },
    });
    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    return null;
  }
}

export async function fetchMarketRecapData(): Promise<MarketRecapData> {
  const [fundingRes, tickerRes, oiRes] = await Promise.all([
    fetchJSON<{ data: any[] }>('/api/funding'),
    fetchJSON<{ data: any[] }>('/api/tickers'),
    fetchJSON<{ data: any[] }>('/api/openinterest'),
  ]);

  const funding = fundingRes?.data || [];
  const tickers = tickerRes?.data || [];
  const oi = oiRes?.data || [];

  // BTC/ETH prices from tickers
  const btcTicker = tickers.find((t: any) => t.symbol === 'BTC' && t.exchange === 'Binance');
  const ethTicker = tickers.find((t: any) => t.symbol === 'ETH' && t.exchange === 'Binance');

  // Funding extremes (exclude tiny coins, non-ASCII symbols, only USDT perps)
  const majorFunding = funding.filter((f: any) =>
    f.fundingRate != null && !isNaN(f.fundingRate) &&
    f.symbol && /^[A-Za-z0-9]+$/.test(f.symbol) && // ASCII only
    Math.abs(f.fundingRate) < 50 // filter extreme outliers
  );
  const sortedByRate = [...majorFunding].sort((a: any, b: any) => b.fundingRate - a.fundingRate);
  const topFunding: FundingEntry[] = sortedByRate.slice(0, 6).map((f: any) => ({
    symbol: f.symbol,
    exchange: f.exchange,
    fundingRate: f.fundingRate,
    fundingInterval: f.fundingInterval || '8h',
    type: f.type || 'cex',
  }));
  const bottomFunding: FundingEntry[] = sortedByRate.slice(-6).reverse().map((f: any) => ({
    symbol: f.symbol,
    exchange: f.exchange,
    fundingRate: f.fundingRate,
    fundingInterval: f.fundingInterval || '8h',
    type: f.type || 'cex',
  }));

  // Top movers from tickers (ASCII symbols only, no stocks/forex/commodities)
  const NON_CRYPTO = new Set(['XAU','XAG','EUR','GBP','JPY','AAPL','GOOG','MSFT','TSLA','NVDA','ALPACA','USOIL','UKOIL','CL','SPY','QQQ']);
  const validTickers = tickers.filter((t: any) =>
    t.changePercent24h != null && t.lastPrice > 0 && t.exchange === 'Binance' &&
    t.symbol && /^[A-Za-z0-9]+$/.test(t.symbol) && !NON_CRYPTO.has(t.symbol.toUpperCase())
  );
  const sortedByChange = [...validTickers].sort((a: any, b: any) =>
    b.changePercent24h - a.changePercent24h
  );
  const topGainers: TopMover[] = sortedByChange.slice(0, 5).map((t: any) => ({
    symbol: t.symbol,
    price: t.lastPrice,
    change24h: t.changePercent24h,
  }));
  const topLosers: TopMover[] = sortedByChange.slice(-5).reverse().map((t: any) => ({
    symbol: t.symbol,
    price: t.lastPrice,
    change24h: t.changePercent24h,
  }));

  // OI aggregation by symbol
  const oiBySymbol: Record<string, number> = {};
  let totalOIValue = 0;
  for (const item of oi) {
    const val = item.openInterestValue || 0;
    totalOIValue += val;
    oiBySymbol[item.symbol] = (oiBySymbol[item.symbol] || 0) + val;
  }
  const topOI: OIEntry[] = Object.entries(oiBySymbol)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([symbol, totalOI]) => ({ symbol, totalOI }));

  // Avg funding rate
  const allRates = majorFunding.map((f: any) => f.fundingRate).filter((r: number) => !isNaN(r));
  const avgRate = allRates.length > 0
    ? allRates.reduce((s: number, r: number) => s + r, 0) / allRates.length
    : 0;

  // Use canonical count (some exchanges may have empty data on any given fetch)
  const CANONICAL_EXCHANGE_COUNT = 33;
  const exchanges = new Set(funding.map((f: any) => f.exchange));

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return {
    date: dateStr,
    btcPrice: btcTicker?.lastPrice || 0,
    btcChange: btcTicker?.changePercent24h || 0,
    ethPrice: ethTicker?.lastPrice || 0,
    ethChange: ethTicker?.changePercent24h || 0,
    totalExchanges: Math.max(exchanges.size, CANONICAL_EXCHANGE_COUNT),
    topFunding,
    bottomFunding,
    topGainers,
    topLosers,
    totalOI: formatLargeNumber(totalOIValue),
    topOI,
    totalPairs: funding.length,
    avgFundingRate: avgRate,
  };
}

function formatLargeNumber(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}
