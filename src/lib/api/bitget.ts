import axios from 'axios';
import { TickerData, FundingRateData, OpenInterestData } from './types';

const BASE_URL = 'https://api.bitget.com';

// Bitget API client
export const bitgetAPI = {
  // Get all USDT-M futures tickers
  async getTickers(): Promise<TickerData[]> {
    try {
      const response = await axios.get(`${BASE_URL}/api/v2/mix/market/tickers`, {
        params: { productType: 'USDT-FUTURES' },
      });

      if (response.data.code !== '00000') {
        throw new Error(response.data.msg);
      }

      return response.data.data.map((ticker: any) => {
        const lastPrice = parseFloat(ticker.lastPr);
        const open24h = parseFloat(ticker.open24h) || lastPrice;
        const change24h = lastPrice - open24h;
        const changePercent = open24h > 0 ? (change24h / open24h) * 100 : 0;

        return {
          symbol: ticker.symbol.replace('USDT', ''),
          price: lastPrice,
          change24h,
          changePercent24h: changePercent,
          high24h: parseFloat(ticker.high24h),
          low24h: parseFloat(ticker.low24h),
          volume24h: parseFloat(ticker.baseVolume),
          quoteVolume24h: parseFloat(ticker.quoteVolume),
          timestamp: parseInt(ticker.ts),
        };
      });
    } catch (error) {
      console.error('Bitget getTickers error:', error);
      throw error;
    }
  },

  // Get funding rates
  async getFundingRates(): Promise<FundingRateData[]> {
    try {
      // Get all symbols first
      const tickersResponse = await axios.get(`${BASE_URL}/api/v2/mix/market/tickers`, {
        params: { productType: 'USDT-FUTURES' },
      });

      if (tickersResponse.data.code !== '00000') {
        throw new Error(tickersResponse.data.msg);
      }

      const symbols = tickersResponse.data.data
        .slice(0, 20)
        .map((t: any) => t.symbol);

      const fundingRates: FundingRateData[] = [];

      for (const symbol of symbols) {
        try {
          const response = await axios.get(`${BASE_URL}/api/v2/mix/market/current-fund-rate`, {
            params: { symbol, productType: 'USDT-FUTURES' },
          });

          if (response.data.code === '00000' && response.data.data) {
            const fr = response.data.data;
            const fundingRate = parseFloat(fr.fundingRate) * 100;
            if (!isNaN(fundingRate) && isFinite(fundingRate)) {
              fundingRates.push({
                symbol: symbol.replace('USDT', ''),
                exchange: 'Bitget',
                fundingRate,
                fundingTime: Date.now(),
                nextFundingTime: parseInt(fr.fundingTime) || Date.now() + 28800000,
              });
            }
          }
        } catch (e) {
          // Skip failed requests
        }
      }

      return fundingRates;
    } catch (error) {
      console.error('Bitget getFundingRates error:', error);
      return [];
    }
  },

  // Get open interest
  async getOpenInterest(symbol?: string): Promise<OpenInterestData[]> {
    try {
      if (symbol) {
        const response = await axios.get(`${BASE_URL}/api/v2/mix/market/open-interest`, {
          params: { symbol: `${symbol}USDT`, productType: 'USDT-FUTURES' },
        });

        if (response.data.code !== '00000') {
          throw new Error(response.data.msg);
        }

        if (response.data.data) {
          const item = response.data.data;
          return [{
            symbol,
            exchange: 'Bitget',
            openInterest: parseFloat(item.openInterestList?.[0]?.openInterest || '0'),
            openInterestValue: 0,
            timestamp: Date.now(),
          }];
        }
        return [];
      }

      // Get tickers to get symbols
      const tickersResponse = await axios.get(`${BASE_URL}/api/v2/mix/market/tickers`, {
        params: { productType: 'USDT-FUTURES' },
      });

      if (tickersResponse.data.code !== '00000') {
        throw new Error(tickersResponse.data.msg);
      }

      // Bitget includes openInterest in ticker data
      return tickersResponse.data.data
        .slice(0, 20)
        .map((item: any) => ({
          symbol: item.symbol.replace('USDT', ''),
          exchange: 'Bitget',
          openInterest: parseFloat(item.openInterest || '0'),
          openInterestValue: parseFloat(item.openInterestUsd || '0'),
          timestamp: parseInt(item.ts),
        }));
    } catch (error) {
      console.error('Bitget getOpenInterest error:', error);
      throw error;
    }
  },
};

export default bitgetAPI;