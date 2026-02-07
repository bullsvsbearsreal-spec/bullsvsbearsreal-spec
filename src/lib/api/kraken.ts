// Kraken Futures API
// Docs: https://docs.futures.kraken.com/

import { TickerData, FundingRateData, OpenInterestData } from './types';

const KRAKEN_FUTURES_API = 'https://futures.kraken.com/derivatives/api/v3';

interface KrakenTicker {
  symbol: string;
  markPrice: number;
  bid: number;
  ask: number;
  vol24h: number;
  openInterest: number;
  last: number;
  lastTime: string;
  indexPrice: number;
  fundingRate: number;
  fundingRatePrediction: number;
  suspended: boolean;
  tag: string;
  pair: string;
  change24h: number;
}

// Normalize symbol (e.g., PF_XBTUSD -> BTC)
function normalizeSymbol(symbol: string): string {
  // Remove prefix (PF_, PI_, etc) and suffix (USD, USDT)
  let normalized = symbol
    .replace(/^(PF_|PI_|FI_)/, '')
    .replace(/(USD|USDT|PERP)$/, '');

  // Handle XBT -> BTC
  if (normalized === 'XBT') normalized = 'BTC';

  return normalized;
}

export const krakenAPI = {
  async getTickers(): Promise<TickerData[]> {
    try {
      const response = await fetch(`${KRAKEN_FUTURES_API}/tickers`);
      if (!response.ok) throw new Error('Kraken API error');

      const data = await response.json();
      const tickers: KrakenTicker[] = data.tickers || [];

      // Filter for perpetual futures only (PF_ prefix)
      return tickers
        .filter(t => t.symbol.startsWith('PF_') && !t.suspended)
        .map(ticker => ({
          symbol: normalizeSymbol(ticker.symbol),
          lastPrice: ticker.last,
          price: ticker.last,
          priceChangePercent24h: ticker.change24h * 100,
          high24h: 0, // Not provided directly
          low24h: 0,
          volume24h: ticker.vol24h,
          quoteVolume24h: ticker.vol24h * ticker.last,
          timestamp: Date.now(),
          exchange: 'Kraken',
        }));
    } catch (error) {
      console.error('Kraken getTickers error:', error);
      return [];
    }
  },

  async getFundingRates(): Promise<FundingRateData[]> {
    try {
      const response = await fetch(`${KRAKEN_FUTURES_API}/tickers`);
      if (!response.ok) throw new Error('Kraken API error');

      const data = await response.json();
      const tickers: KrakenTicker[] = data.tickers || [];

      return tickers
        .filter(t => t.symbol.startsWith('PF_') && !t.suspended && t.fundingRate !== undefined)
        .map(ticker => ({
          symbol: normalizeSymbol(ticker.symbol),
          fundingRate: ticker.fundingRate,
          fundingTime: Date.now(),
          nextFundingTime: Date.now() + 8 * 60 * 60 * 1000, // Approximate
          exchange: 'Kraken',
        }));
    } catch (error) {
      console.error('Kraken getFundingRates error:', error);
      return [];
    }
  },

  async getOpenInterest(): Promise<OpenInterestData[]> {
    try {
      const response = await fetch(`${KRAKEN_FUTURES_API}/tickers`);
      if (!response.ok) throw new Error('Kraken API error');

      const data = await response.json();
      const tickers: KrakenTicker[] = data.tickers || [];

      return tickers
        .filter(t => t.symbol.startsWith('PF_') && !t.suspended && t.openInterest > 0)
        .map(ticker => ({
          symbol: normalizeSymbol(ticker.symbol),
          openInterest: ticker.openInterest,
          openInterestValue: ticker.openInterest * ticker.last,
          timestamp: Date.now(),
          exchange: 'Kraken',
        }));
    } catch (error) {
      console.error('Kraken getOpenInterest error:', error);
      return [];
    }
  },
};
