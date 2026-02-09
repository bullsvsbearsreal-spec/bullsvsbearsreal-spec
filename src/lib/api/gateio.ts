import axios from 'axios';
import { TickerData, FundingRateData, OpenInterestData } from './types';

const BASE_URL = 'https://api.gateio.ws/api/v4';

// Gate.io Futures API client
export const gateioAPI = {
  async getTickers(): Promise<TickerData[]> {
    try {
      const response = await axios.get(`${BASE_URL}/futures/usdt/contracts`);
      return response.data
        .filter((t: any) => t.name.endsWith('_USDT'))
        .map((ticker: any) => {
          const lastPrice = parseFloat(ticker.last_price);
          const markPrice = parseFloat(ticker.mark_price);
          const changePercent = parseFloat(ticker.change_percentage) || 0;
          return {
            symbol: ticker.name.replace('_USDT', ''),
            lastPrice: lastPrice || markPrice,
            price: lastPrice || markPrice,
            change24h: 0,
            priceChangePercent24h: changePercent,
            changePercent24h: changePercent,
            high24h: parseFloat(ticker.high_24h) || 0,
            low24h: parseFloat(ticker.low_24h) || 0,
            volume24h: parseFloat(ticker.volume_24h) || 0,
            quoteVolume24h: parseFloat(ticker.volume_24h_usd) || 0,
            timestamp: Date.now(),
            exchange: 'Gate.io',
          };
        });
    } catch (error) {
      console.error('Gate.io getTickers error:', error);
      return [];
    }
  },

  async getFundingRates(): Promise<FundingRateData[]> {
    try {
      const response = await axios.get(`${BASE_URL}/futures/usdt/contracts`);
      return response.data
        .filter((t: any) => t.name.endsWith('_USDT') && (t.funding_rate != null || t.funding_rate_indicative != null))
        .map((item: any) => {
          const fundingRate = parseFloat(item.funding_rate || item.funding_rate_indicative) * 100;
          return {
            symbol: item.name.replace('_USDT', ''),
            exchange: 'Gate.io',
            fundingRate: isNaN(fundingRate) ? 0 : fundingRate,
            fundingTime: Date.now(),
            nextFundingTime: (item.funding_next_apply || 0) * 1000,
            markPrice: parseFloat(item.mark_price) || 0,
            indexPrice: parseFloat(item.index_price) || 0,
          };
        })
        .filter((item: FundingRateData) => !isNaN(item.fundingRate));
    } catch (error) {
      console.error('Gate.io getFundingRates error:', error);
      return [];
    }
  },

  async getOpenInterest(symbol?: string): Promise<OpenInterestData[]> {
    try {
      const response = await axios.get(`${BASE_URL}/futures/usdt/contracts`);
      return response.data
        .filter((t: any) => {
          if (!t.name.endsWith('_USDT')) return false;
          if (symbol) return t.name === `${symbol}_USDT`;
          return true;
        })
        .slice(0, 30)
        .map((item: any) => {
          const oi = parseFloat(item.position_size) || 0;
          const price = parseFloat(item.last_price) || parseFloat(item.mark_price) || 0;
          const quantoMultiplier = parseFloat(item.quanto_multiplier) || 1;
          return {
            symbol: item.name.replace('_USDT', ''),
            exchange: 'Gate.io',
            openInterest: oi,
            openInterestValue: oi * price * quantoMultiplier,
            timestamp: Date.now(),
          };
        });
    } catch (error) {
      console.error('Gate.io getOpenInterest error:', error);
      return [];
    }
  },
};

export default gateioAPI;
