// BingX Futures API
// Docs: https://bingx-api.github.io/docs/

import { TickerData, FundingRateData, OpenInterestData } from './types';

const BINGX_API = 'https://open-api.bingx.com/openApi/swap/v2';

interface BingXTicker {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  lastPrice: string;
  lastQty: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openPrice: string;
  closeTime: number;
}

interface BingXFunding {
  symbol: string;
  lastFundingRate: string;
  fundingRate: string;
  nextFundingTime: number;
  markPrice: string;
}

interface BingXOpenInterest {
  symbol: string;
  openInterest: string;
  time: number;
}

// Normalize symbol (e.g., BTC-USDT -> BTC)
function normalizeSymbol(symbol: string): string {
  return symbol.replace(/-USDT|-USD/, '');
}

export const bingxAPI = {
  async getTickers(): Promise<TickerData[]> {
    try {
      const response = await fetch(`${BINGX_API}/quote/ticker`);
      if (!response.ok) throw new Error('BingX API error');

      const data = await response.json();
      if (data.code !== 0 || !data.data) return [];

      const tickers: BingXTicker[] = data.data;

      return tickers.map(ticker => ({
        symbol: normalizeSymbol(ticker.symbol),
        price: parseFloat(ticker.lastPrice),
        priceChangePercent24h: parseFloat(ticker.priceChangePercent),
        high24h: parseFloat(ticker.highPrice),
        low24h: parseFloat(ticker.lowPrice),
        volume24h: parseFloat(ticker.volume),
        quoteVolume24h: parseFloat(ticker.quoteVolume),
        exchange: 'BingX',
      }));
    } catch (error) {
      console.error('BingX getTickers error:', error);
      return [];
    }
  },

  async getFundingRates(): Promise<FundingRateData[]> {
    try {
      const response = await fetch(`${BINGX_API}/quote/premiumIndex`);
      if (!response.ok) throw new Error('BingX API error');

      const data = await response.json();
      if (data.code !== 0 || !data.data) return [];

      const rates: BingXFunding[] = Array.isArray(data.data) ? data.data : [data.data];

      return rates
        .filter(r => r.fundingRate || r.lastFundingRate)
        .map(rate => ({
          symbol: normalizeSymbol(rate.symbol),
          fundingRate: parseFloat(rate.fundingRate || rate.lastFundingRate),
          nextFundingTime: rate.nextFundingTime,
          exchange: 'BingX',
        }));
    } catch (error) {
      console.error('BingX getFundingRates error:', error);
      return [];
    }
  },

  async getOpenInterest(): Promise<OpenInterestData[]> {
    try {
      const response = await fetch(`${BINGX_API}/quote/openInterest`);
      if (!response.ok) throw new Error('BingX API error');

      const data = await response.json();
      if (data.code !== 0 || !data.data) return [];

      const oiData: BingXOpenInterest[] = Array.isArray(data.data) ? data.data : [data.data];

      // Get prices for value calculation
      const tickersRes = await fetch(`${BINGX_API}/quote/ticker`);
      const tickersData = await tickersRes.json();
      const priceMap = new Map<string, number>();
      if (tickersData.code === 0 && tickersData.data) {
        tickersData.data.forEach((t: BingXTicker) => {
          priceMap.set(t.symbol, parseFloat(t.lastPrice));
        });
      }

      return oiData
        .filter(oi => parseFloat(oi.openInterest) > 0)
        .map(oi => {
          const openInterest = parseFloat(oi.openInterest);
          const price = priceMap.get(oi.symbol) || 0;
          return {
            symbol: normalizeSymbol(oi.symbol),
            openInterest,
            openInterestValue: openInterest * price,
            exchange: 'BingX',
          };
        });
    } catch (error) {
      console.error('BingX getOpenInterest error:', error);
      return [];
    }
  },
};
