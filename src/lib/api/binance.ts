import axios from 'axios';
import { TickerData, FundingRateData, OpenInterestData } from './types';

const BASE_URL = 'https://fapi.binance.com';

// Binance Futures API client
export const binanceAPI = {
  // Get all futures tickers
  async getTickers(): Promise<TickerData[]> {
    try {
      const response = await axios.get(`${BASE_URL}/fapi/v1/ticker/24hr`);
      return response.data
        .filter((t: any) => t.symbol.endsWith('USDT'))
        .map((ticker: any) => ({
          symbol: ticker.symbol.replace('USDT', ''),
          price: parseFloat(ticker.lastPrice),
          change24h: parseFloat(ticker.priceChange),
          changePercent24h: parseFloat(ticker.priceChangePercent),
          high24h: parseFloat(ticker.highPrice),
          low24h: parseFloat(ticker.lowPrice),
          volume24h: parseFloat(ticker.volume),
          quoteVolume24h: parseFloat(ticker.quoteVolume),
          timestamp: ticker.closeTime,
        }));
    } catch (error) {
      console.error('Binance getTickers error:', error);
      throw error;
    }
  },

  // Get funding rates for all perpetual contracts
  async getFundingRates(): Promise<FundingRateData[]> {
    try {
      const response = await axios.get(`${BASE_URL}/fapi/v1/premiumIndex`);
      return response.data
        .filter((item: any) => item.symbol.endsWith('USDT') && item.lastFundingRate != null)
        .map((item: any) => {
          const fundingRate = parseFloat(item.lastFundingRate) * 100;
          const markPrice = parseFloat(item.markPrice);
          const indexPrice = parseFloat(item.indexPrice);
          return {
            symbol: item.symbol.replace('USDT', ''),
            exchange: 'Binance',
            fundingRate: isNaN(fundingRate) ? 0 : fundingRate,
            fundingTime: item.time,
            nextFundingTime: item.nextFundingTime,
            markPrice: isNaN(markPrice) ? 0 : markPrice,
            indexPrice: isNaN(indexPrice) ? 0 : indexPrice,
          };
        })
        .filter((item: FundingRateData) => !isNaN(item.fundingRate));
    } catch (error) {
      console.error('Binance getFundingRates error:', error);
      return [];
    }
  },

  // Get open interest for a specific symbol or all
  async getOpenInterest(symbol?: string): Promise<OpenInterestData[]> {
    try {
      if (symbol) {
        const response = await axios.get(`${BASE_URL}/fapi/v1/openInterest`, {
          params: { symbol: `${symbol}USDT` },
        });
        return [{
          symbol,
          exchange: 'Binance',
          openInterest: parseFloat(response.data.openInterest),
          openInterestValue: 0,
          timestamp: response.data.time,
        }];
      }

      // Get exchange info first to get all symbols
      const exchangeInfo = await axios.get(`${BASE_URL}/fapi/v1/exchangeInfo`);
      const symbols = exchangeInfo.data.symbols
        .filter((s: any) => s.contractType === 'PERPETUAL' && s.symbol.endsWith('USDT'))
        .slice(0, 20) // Limit to top 20 to avoid rate limits
        .map((s: any) => s.symbol);

      const results: OpenInterestData[] = [];
      for (const sym of symbols) {
        try {
          const response = await axios.get(`${BASE_URL}/fapi/v1/openInterest`, {
            params: { symbol: sym },
          });
          const ticker = await axios.get(`${BASE_URL}/fapi/v1/ticker/price`, {
            params: { symbol: sym },
          });
          const price = parseFloat(ticker.data.price);
          const oi = parseFloat(response.data.openInterest);

          results.push({
            symbol: sym.replace('USDT', ''),
            exchange: 'Binance',
            openInterest: oi,
            openInterestValue: oi * price,
            timestamp: Date.now(),
          });
        } catch (e) {
          // Skip symbols that fail
        }
      }
      return results;
    } catch (error) {
      console.error('Binance getOpenInterest error:', error);
      throw error;
    }
  },

  // Get top long/short ratio
  async getLongShortRatio(symbol: string = 'BTCUSDT', period: string = '5m'): Promise<{ longRatio: number; shortRatio: number }> {
    try {
      const response = await axios.get(`${BASE_URL}/futures/data/globalLongShortAccountRatio`, {
        params: { symbol, period, limit: 1 },
      });
      if (response.data && response.data.length > 0) {
        return {
          longRatio: parseFloat(response.data[0].longAccount) * 100,
          shortRatio: parseFloat(response.data[0].shortAccount) * 100,
        };
      }
      return { longRatio: 50, shortRatio: 50 };
    } catch (error) {
      console.error('Binance getLongShortRatio error:', error);
      return { longRatio: 50, shortRatio: 50 };
    }
  },
};

export default binanceAPI;