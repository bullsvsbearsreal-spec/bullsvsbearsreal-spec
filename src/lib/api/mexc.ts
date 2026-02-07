// MEXC Futures API
// Docs: https://mexcdevelop.github.io/apidocs/contract_v1_en/

import { TickerData, FundingRateData, OpenInterestData } from './types';

const MEXC_API = 'https://contract.mexc.com/api/v1/contract';

interface MexcTicker {
  symbol: string;
  lastPrice: number;
  riseFallRate: number;
  fairPrice: number;
  indexPrice: number;
  volume24: number;
  amount24: number;
  holdVol: number;
  lower24Price: number;
  high24Price: number;
  riseFallValue: number;
  fundingRate: number;
  maxBidPrice: number;
  minAskPrice: number;
  timestamp: number;
}

// Normalize symbol (e.g., BTC_USDT -> BTC)
function normalizeSymbol(symbol: string): string {
  return symbol.replace(/_USDT|_USD/, '');
}

export const mexcAPI = {
  async getTickers(): Promise<TickerData[]> {
    try {
      const response = await fetch(`${MEXC_API}/ticker`);
      if (!response.ok) throw new Error('MEXC API error');

      const data = await response.json();
      if (!data.success || !data.data) return [];

      const tickers: MexcTicker[] = data.data;

      return tickers.map(ticker => ({
        symbol: normalizeSymbol(ticker.symbol),
        lastPrice: ticker.lastPrice,
        price: ticker.lastPrice,
        priceChangePercent24h: ticker.riseFallRate * 100,
        high24h: ticker.high24Price,
        low24h: ticker.lower24Price,
        volume24h: ticker.volume24,
        quoteVolume24h: ticker.amount24,
        timestamp: Date.now(),
        exchange: 'MEXC',
      }));
    } catch (error) {
      console.error('MEXC getTickers error:', error);
      return [];
    }
  },

  async getFundingRates(): Promise<FundingRateData[]> {
    try {
      const response = await fetch(`${MEXC_API}/ticker`);
      if (!response.ok) throw new Error('MEXC API error');

      const data = await response.json();
      if (!data.success || !data.data) return [];

      const tickers: MexcTicker[] = data.data;

      return tickers
        .filter(t => t.fundingRate !== undefined)
        .map(ticker => ({
          symbol: normalizeSymbol(ticker.symbol),
          fundingRate: ticker.fundingRate,
          fundingTime: Date.now(),
          nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
          exchange: 'MEXC',
        }));
    } catch (error) {
      console.error('MEXC getFundingRates error:', error);
      return [];
    }
  },

  async getOpenInterest(): Promise<OpenInterestData[]> {
    try {
      const response = await fetch(`${MEXC_API}/ticker`);
      if (!response.ok) throw new Error('MEXC API error');

      const data = await response.json();
      if (!data.success || !data.data) return [];

      const tickers: MexcTicker[] = data.data;

      return tickers
        .filter(t => t.holdVol > 0)
        .map(ticker => ({
          symbol: normalizeSymbol(ticker.symbol),
          openInterest: ticker.holdVol,
          openInterestValue: ticker.holdVol * ticker.lastPrice,
          timestamp: Date.now(),
          exchange: 'MEXC',
        }));
    } catch (error) {
      console.error('MEXC getOpenInterest error:', error);
      return [];
    }
  },
};
