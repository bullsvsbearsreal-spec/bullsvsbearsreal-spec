import axios from 'axios';
import { TickerData, FundingRateData, OpenInterestData } from './types';

const BASE_URL = 'https://www.okx.com';

// OKX API client
export const okxAPI = {
  // Get all swap tickers
  async getTickers(): Promise<TickerData[]> {
    try {
      const response = await axios.get(`${BASE_URL}/api/v5/market/tickers`, {
        params: { instType: 'SWAP' },
      });

      if (response.data.code !== '0') {
        throw new Error(response.data.msg);
      }

      return response.data.data
        .filter((t: any) => t.instId.endsWith('-USDT-SWAP'))
        .map((ticker: any) => {
          const symbol = ticker.instId.replace('-USDT-SWAP', '');
          const lastPrice = parseFloat(ticker.last);
          const open24h = parseFloat(ticker.open24h);
          const change24h = lastPrice - open24h;
          const changePercent = open24h > 0 ? (change24h / open24h) * 100 : 0;

          return {
            symbol,
            price: lastPrice,
            change24h,
            changePercent24h: changePercent,
            high24h: parseFloat(ticker.high24h),
            low24h: parseFloat(ticker.low24h),
            volume24h: parseFloat(ticker.vol24h),
            quoteVolume24h: parseFloat(ticker.volCcy24h),
            timestamp: parseInt(ticker.ts),
          };
        });
    } catch (error) {
      console.error('OKX getTickers error:', error);
      throw error;
    }
  },

  // Get funding rates
  async getFundingRates(): Promise<FundingRateData[]> {
    try {
      const response = await axios.get(`${BASE_URL}/api/v5/public/funding-rate`, {
        params: { instType: 'SWAP' },
      });

      // OKX returns individual instruments, we need to filter USDT swaps
      // For multiple instruments, we'll make separate calls
      const tickersResponse = await axios.get(`${BASE_URL}/api/v5/market/tickers`, {
        params: { instType: 'SWAP' },
      });

      if (tickersResponse.data.code !== '0') {
        throw new Error(tickersResponse.data.msg);
      }

      const usdtSwaps = tickersResponse.data.data
        .filter((t: any) => t.instId.endsWith('-USDT-SWAP'))
        .slice(0, 20);

      const fundingRates: FundingRateData[] = [];

      for (const swap of usdtSwaps) {
        try {
          const frResponse = await axios.get(`${BASE_URL}/api/v5/public/funding-rate`, {
            params: { instId: swap.instId },
          });

          if (frResponse.data.code === '0' && frResponse.data.data.length > 0) {
            const fr = frResponse.data.data[0];
            fundingRates.push({
              symbol: swap.instId.replace('-USDT-SWAP', ''),
              exchange: 'OKX',
              fundingRate: parseFloat(fr.fundingRate) * 100,
              fundingTime: parseInt(fr.fundingTime),
              nextFundingTime: parseInt(fr.nextFundingTime),
              predictedRate: fr.nextFundingRate ? parseFloat(fr.nextFundingRate) * 100 : undefined,
            });
          }
        } catch (e) {
          // Skip failed requests
        }
      }

      return fundingRates;
    } catch (error) {
      console.error('OKX getFundingRates error:', error);
      throw error;
    }
  },

  // Get open interest
  async getOpenInterest(symbol?: string): Promise<OpenInterestData[]> {
    try {
      if (symbol) {
        const response = await axios.get(`${BASE_URL}/api/v5/public/open-interest`, {
          params: { instType: 'SWAP', instId: `${symbol}-USDT-SWAP` },
        });

        if (response.data.code !== '0') {
          throw new Error(response.data.msg);
        }

        if (response.data.data.length > 0) {
          const item = response.data.data[0];
          return [{
            symbol,
            exchange: 'OKX',
            openInterest: parseFloat(item.oi),
            openInterestValue: parseFloat(item.oiCcy),
            timestamp: parseInt(item.ts),
          }];
        }
        return [];
      }

      // Get all USDT swap open interest
      const response = await axios.get(`${BASE_URL}/api/v5/public/open-interest`, {
        params: { instType: 'SWAP' },
      });

      if (response.data.code !== '0') {
        throw new Error(response.data.msg);
      }

      return response.data.data
        .filter((t: any) => t.instId.endsWith('-USDT-SWAP'))
        .slice(0, 20)
        .map((item: any) => ({
          symbol: item.instId.replace('-USDT-SWAP', ''),
          exchange: 'OKX',
          openInterest: parseFloat(item.oi),
          openInterestValue: parseFloat(item.oiCcy),
          timestamp: parseInt(item.ts),
        }));
    } catch (error) {
      console.error('OKX getOpenInterest error:', error);
      throw error;
    }
  },
};

export default okxAPI;