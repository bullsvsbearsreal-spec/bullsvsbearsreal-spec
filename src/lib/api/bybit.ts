import axios from 'axios';
import { TickerData, FundingRateData, OpenInterestData } from './types';

const BASE_URL = 'https://api.bybit.com';

// Bybit API client
export const bybitAPI = {
  // Get all USDT perpetual tickers
  async getTickers(): Promise<TickerData[]> {
    try {
      const response = await axios.get(`${BASE_URL}/v5/market/tickers`, {
        params: { category: 'linear' },
      });

      if (response.data.retCode !== 0) {
        throw new Error(response.data.retMsg);
      }

      return response.data.result.list
        .filter((t: any) => t.symbol.endsWith('USDT'))
        .map((ticker: any) => ({
          symbol: ticker.symbol.replace('USDT', ''),
          price: parseFloat(ticker.lastPrice),
          change24h: parseFloat(ticker.price24hPcnt) * parseFloat(ticker.prevPrice24h),
          changePercent24h: parseFloat(ticker.price24hPcnt) * 100,
          high24h: parseFloat(ticker.highPrice24h),
          low24h: parseFloat(ticker.lowPrice24h),
          volume24h: parseFloat(ticker.volume24h),
          quoteVolume24h: parseFloat(ticker.turnover24h),
          timestamp: Date.now(),
        }));
    } catch (error) {
      console.error('Bybit getTickers error:', error);
      throw error;
    }
  },

  // Get funding rates
  async getFundingRates(): Promise<FundingRateData[]> {
    try {
      const response = await axios.get(`${BASE_URL}/v5/market/tickers`, {
        params: { category: 'linear' },
      });

      if (response.data.retCode !== 0) {
        throw new Error(response.data.retMsg);
      }

      return response.data.result.list
        .filter((t: any) => t.symbol.endsWith('USDT') && t.fundingRate != null)
        .map((item: any) => {
          const fundingRate = parseFloat(item.fundingRate) * 100;
          const markPrice = parseFloat(item.markPrice);
          const indexPrice = parseFloat(item.indexPrice);
          return {
            symbol: item.symbol.replace('USDT', ''),
            exchange: 'Bybit',
            fundingRate: isNaN(fundingRate) ? 0 : fundingRate,
            fundingTime: Date.now(),
            nextFundingTime: parseInt(item.nextFundingTime) || Date.now(),
            markPrice: isNaN(markPrice) ? 0 : markPrice,
            indexPrice: isNaN(indexPrice) ? 0 : indexPrice,
          };
        })
        .filter((item: FundingRateData) => !isNaN(item.fundingRate));
    } catch (error) {
      console.error('Bybit getFundingRates error:', error);
      return [];
    }
  },

  // Get open interest
  async getOpenInterest(symbol?: string): Promise<OpenInterestData[]> {
    try {
      const params: any = { category: 'linear' };
      if (symbol) {
        params.symbol = `${symbol}USDT`;
      }

      const response = await axios.get(`${BASE_URL}/v5/market/open-interest`, {
        params: { ...params, intervalTime: '5min', limit: 1 },
      });

      if (response.data.retCode !== 0) {
        throw new Error(response.data.retMsg);
      }

      // If specific symbol requested
      if (symbol && response.data.result.list.length > 0) {
        const item = response.data.result.list[0];
        return [{
          symbol,
          exchange: 'Bybit',
          openInterest: parseFloat(item.openInterest),
          openInterestValue: 0,
          timestamp: parseInt(item.timestamp),
        }];
      }

      // Get tickers to get OI for multiple symbols
      const tickersResponse = await axios.get(`${BASE_URL}/v5/market/tickers`, {
        params: { category: 'linear' },
      });

      if (tickersResponse.data.retCode !== 0) {
        throw new Error(tickersResponse.data.retMsg);
      }

      return tickersResponse.data.result.list
        .filter((t: any) => t.symbol.endsWith('USDT') && t.openInterest)
        .slice(0, 20)
        .map((item: any) => ({
          symbol: item.symbol.replace('USDT', ''),
          exchange: 'Bybit',
          openInterest: parseFloat(item.openInterest),
          openInterestValue: parseFloat(item.openInterestValue),
          timestamp: Date.now(),
        }));
    } catch (error) {
      console.error('Bybit getOpenInterest error:', error);
      throw error;
    }
  },
};

export default bybitAPI;