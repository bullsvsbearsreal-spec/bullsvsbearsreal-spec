import axios from 'axios';
import { TickerData, FundingRateData, OpenInterestData } from './types';

const BASE_URL = 'https://contract.mexc.com/api/v1';

// MEXC Futures API client
export const mexcAPI = {
  async getTickers(): Promise<TickerData[]> {
    try {
      const response = await axios.get(`${BASE_URL}/contract/ticker`);
      if (!response.data.success) return [];
      return response.data.data
        .filter((t: any) => t.symbol.endsWith('_USDT'))
        .map((ticker: any) => {
          const lastPrice = parseFloat(ticker.lastPrice);
          const open24h = parseFloat(ticker.open24Price) || lastPrice;
          const change24h = lastPrice - open24h;
          const changePercent = open24h > 0 ? (change24h / open24h) * 100 : 0;
          return {
            symbol: ticker.symbol.replace('_USDT', ''),
            lastPrice,
            price: lastPrice,
            change24h,
            priceChangePercent24h: parseFloat(ticker.riseFallRate) * 100 || changePercent,
            changePercent24h: parseFloat(ticker.riseFallRate) * 100 || changePercent,
            high24h: parseFloat(ticker.high24Price) || 0,
            low24h: parseFloat(ticker.low24Price) || 0,
            volume24h: parseFloat(ticker.volume24) || 0,
            quoteVolume24h: parseFloat(ticker.amount24) || 0,
            timestamp: Date.now(),
            exchange: 'MEXC',
          };
        });
    } catch (error) {
      console.error('MEXC getTickers error:', error);
      return [];
    }
  },

  async getFundingRates(): Promise<FundingRateData[]> {
    try {
      const response = await axios.get(`${BASE_URL}/contract/ticker`);
      if (!response.data.success) return [];
      return response.data.data
        .filter((t: any) => t.symbol.endsWith('_USDT') && t.fundingRate != null)
        .map((item: any) => {
          const fundingRate = parseFloat(item.fundingRate) * 100;
          return {
            symbol: item.symbol.replace('_USDT', ''),
            exchange: 'MEXC',
            fundingRate: isNaN(fundingRate) ? 0 : fundingRate,
            fundingTime: Date.now(),
            nextFundingTime: item.nextSettlementTime || Date.now() + 28800000,
            markPrice: parseFloat(item.fairPrice) || 0,
            indexPrice: parseFloat(item.indexPrice) || 0,
          };
        })
        .filter((item: FundingRateData) => !isNaN(item.fundingRate));
    } catch (error) {
      console.error('MEXC getFundingRates error:', error);
      return [];
    }
  },

  async getOpenInterest(symbol?: string): Promise<OpenInterestData[]> {
    try {
      const response = await axios.get(`${BASE_URL}/contract/ticker`);
      if (!response.data.success) return [];
      return response.data.data
        .filter((t: any) => {
          if (!t.symbol.endsWith('_USDT')) return false;
          if (symbol) return t.symbol === `${symbol}_USDT`;
          return true;
        })
        .slice(0, 30)
        .map((item: any) => {
          const oi = parseFloat(item.holdVol) || 0;
          const price = parseFloat(item.lastPrice) || 0;
          return {
            symbol: item.symbol.replace('_USDT', ''),
            exchange: 'MEXC',
            openInterest: oi,
            openInterestValue: oi * price,
            timestamp: Date.now(),
          };
        });
    } catch (error) {
      console.error('MEXC getOpenInterest error:', error);
      return [];
    }
  },
};

export default mexcAPI;
