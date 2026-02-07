// WOO X Futures API
// Docs: https://docs.woo.org/

import { TickerData, FundingRateData, OpenInterestData } from './types';

const WOOX_API = 'https://api.woo.org/v1';

interface WooXTicker {
  symbol: string;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
}

// Normalize symbol (e.g., PERP_BTC_USDT -> BTC)
function normalizeSymbol(symbol: string): string {
  return symbol
    .replace(/^PERP_/, '')
    .replace(/_USDT$|_USD$/, '');
}

export const wooxAPI = {
  async getTickers(): Promise<TickerData[]> {
    try {
      const response = await fetch(`${WOOX_API}/public/futures`);
      if (!response.ok) throw new Error('WOO X API error');

      const data = await response.json();
      if (!data.success || !data.rows) return [];

      return data.rows
        .filter((t: any) => t.symbol?.startsWith('PERP_'))
        .map((ticker: any) => {
          const price = ticker.mark_price || ticker.index_price;
          return {
            symbol: normalizeSymbol(ticker.symbol),
            price,
            priceChangePercent24h: 0, // Calculate from 24h data if available
            high24h: 0,
            low24h: 0,
            volume24h: ticker.volume || 0,
            quoteVolume24h: (ticker.volume || 0) * price,
            exchange: 'WOO X',
          };
        });
    } catch (error) {
      console.error('WOO X getTickers error:', error);
      return [];
    }
  },

  async getFundingRates(): Promise<FundingRateData[]> {
    try {
      const response = await fetch(`${WOOX_API}/public/funding_rates`);
      if (!response.ok) throw new Error('WOO X API error');

      const data = await response.json();
      if (!data.success || !data.rows) return [];

      return data.rows
        .filter((item: any) => item.symbol?.startsWith('PERP_'))
        .map((item: any) => ({
          symbol: normalizeSymbol(item.symbol),
          fundingRate: (item.last_funding_rate || 0) * 100,
          nextFundingTime: item.next_funding_time || Date.now() + 8 * 60 * 60 * 1000,
          exchange: 'WOO X',
        }));
    } catch (error) {
      console.error('WOO X getFundingRates error:', error);
      return [];
    }
  },

  async getOpenInterest(): Promise<OpenInterestData[]> {
    try {
      const response = await fetch(`${WOOX_API}/public/futures`);
      if (!response.ok) throw new Error('WOO X API error');

      const data = await response.json();
      if (!data.success || !data.rows) return [];

      return data.rows
        .filter((item: any) => item.symbol?.startsWith('PERP_') && item.open_interest > 0)
        .map((item: any) => ({
          symbol: normalizeSymbol(item.symbol),
          openInterest: item.open_interest,
          openInterestValue: item.open_interest * (item.mark_price || item.index_price),
          exchange: 'WOO X',
        }));
    } catch (error) {
      console.error('WOO X getOpenInterest error:', error);
      return [];
    }
  },
};
