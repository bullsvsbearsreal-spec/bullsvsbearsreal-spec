// Gate.io Futures API
// Docs: https://www.gate.io/docs/developers/apiv4/

import { TickerData, FundingRateData, OpenInterestData } from './types';

const GATEIO_API = 'https://api.gateio.ws/api/v4';

interface GateioTicker {
  contract: string;
  last: string;
  change_percentage: string;
  total_size: string;
  volume_24h: string;
  volume_24h_quote: string;
  mark_price: string;
  funding_rate: string;
  funding_rate_indicative: string;
  index_price: string;
  quanto_base_rate: string;
  high_24h: string;
  low_24h: string;
}

// Normalize symbol (e.g., BTC_USDT -> BTC)
function normalizeSymbol(contract: string): string {
  return contract.replace(/_USDT|_USD/, '');
}

export const gateioAPI = {
  async getTickers(): Promise<TickerData[]> {
    try {
      const response = await fetch(`${GATEIO_API}/futures/usdt/tickers`);
      if (!response.ok) throw new Error('Gate.io API error');

      const tickers: GateioTicker[] = await response.json();

      return tickers.map(ticker => ({
        symbol: normalizeSymbol(ticker.contract),
        price: parseFloat(ticker.last),
        priceChangePercent24h: parseFloat(ticker.change_percentage),
        high24h: parseFloat(ticker.high_24h),
        low24h: parseFloat(ticker.low_24h),
        volume24h: parseFloat(ticker.volume_24h),
        quoteVolume24h: parseFloat(ticker.volume_24h_quote),
        exchange: 'Gate.io',
      }));
    } catch (error) {
      console.error('Gate.io getTickers error:', error);
      return [];
    }
  },

  async getFundingRates(): Promise<FundingRateData[]> {
    try {
      const response = await fetch(`${GATEIO_API}/futures/usdt/tickers`);
      if (!response.ok) throw new Error('Gate.io API error');

      const tickers: GateioTicker[] = await response.json();

      return tickers
        .filter(t => t.funding_rate && parseFloat(t.funding_rate) !== 0)
        .map(ticker => ({
          symbol: normalizeSymbol(ticker.contract),
          fundingRate: parseFloat(ticker.funding_rate),
          nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
          exchange: 'Gate.io',
        }));
    } catch (error) {
      console.error('Gate.io getFundingRates error:', error);
      return [];
    }
  },

  async getOpenInterest(): Promise<OpenInterestData[]> {
    try {
      const response = await fetch(`${GATEIO_API}/futures/usdt/tickers`);
      if (!response.ok) throw new Error('Gate.io API error');

      const tickers: GateioTicker[] = await response.json();

      return tickers
        .filter(t => parseFloat(t.total_size) > 0)
        .map(ticker => ({
          symbol: normalizeSymbol(ticker.contract),
          openInterest: parseFloat(ticker.total_size),
          openInterestValue: parseFloat(ticker.total_size) * parseFloat(ticker.last),
          exchange: 'Gate.io',
        }));
    } catch (error) {
      console.error('Gate.io getOpenInterest error:', error);
      return [];
    }
  },
};
