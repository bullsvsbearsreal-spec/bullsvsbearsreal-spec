import axios from 'axios';
import { TickerData, FundingRateData, OpenInterestData } from './types';

const BASE_URL = 'https://open-api.bingx.com';

// BingX Perpetual Swap API client
export const bingxAPI = {
  async getTickers(): Promise<TickerData[]> {
    try {
      const response = await axios.get(`${BASE_URL}/openApi/swap/v2/quote/ticker`);
      if (response.data.code !== 0) return [];
      return response.data.data
        .filter((t: any) => t.symbol.endsWith('-USDT'))
        .map((ticker: any) => {
          const lastPrice = parseFloat(ticker.lastPrice);
          return {
            symbol: ticker.symbol.replace('-USDT', ''),
            lastPrice,
            price: lastPrice,
            change24h: parseFloat(ticker.priceChange) || 0,
            priceChangePercent24h: parseFloat(ticker.priceChangePercent) || 0,
            changePercent24h: parseFloat(ticker.priceChangePercent) || 0,
            high24h: parseFloat(ticker.highPrice) || 0,
            low24h: parseFloat(ticker.lowPrice) || 0,
            volume24h: parseFloat(ticker.volume) || 0,
            quoteVolume24h: parseFloat(ticker.quoteVolume) || 0,
            timestamp: Date.now(),
            exchange: 'BingX',
          };
        });
    } catch (error) {
      console.error('BingX getTickers error:', error);
      return [];
    }
  },

  async getFundingRates(): Promise<FundingRateData[]> {
    try {
      const response = await axios.get(`${BASE_URL}/openApi/swap/v2/quote/premiumIndex`);
      if (response.data.code !== 0) return [];
      return response.data.data
        .filter((t: any) => t.symbol.endsWith('-USDT') && t.lastFundingRate != null)
        .map((item: any) => {
          const fundingRate = parseFloat(item.lastFundingRate) * 100;
          return {
            symbol: item.symbol.replace('-USDT', ''),
            exchange: 'BingX',
            fundingRate: isNaN(fundingRate) ? 0 : fundingRate,
            fundingTime: item.time || Date.now(),
            nextFundingTime: item.nextFundingTime || Date.now() + 28800000,
            markPrice: parseFloat(item.markPrice) || 0,
            indexPrice: parseFloat(item.indexPrice) || 0,
          };
        })
        .filter((item: FundingRateData) => !isNaN(item.fundingRate));
    } catch (error) {
      console.error('BingX getFundingRates error:', error);
      return [];
    }
  },

  async getOpenInterest(symbol?: string): Promise<OpenInterestData[]> {
    try {
      const response = await axios.get(`${BASE_URL}/openApi/swap/v2/quote/ticker`);
      if (response.data.code !== 0) return [];
      return response.data.data
        .filter((t: any) => {
          if (!t.symbol.endsWith('-USDT')) return false;
          if (symbol) return t.symbol === `${symbol}-USDT`;
          return true;
        })
        .slice(0, 30)
        .map((item: any) => {
          const oi = parseFloat(item.openInterest) || 0;
          const price = parseFloat(item.lastPrice) || 0;
          return {
            symbol: item.symbol.replace('-USDT', ''),
            exchange: 'BingX',
            openInterest: oi,
            openInterestValue: oi * price,
            timestamp: Date.now(),
          };
        });
    } catch (error) {
      console.error('BingX getOpenInterest error:', error);
      return [];
    }
  },
};

export default bingxAPI;
