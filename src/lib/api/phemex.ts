import axios from 'axios';
import { TickerData, FundingRateData, OpenInterestData } from './types';

const BASE_URL = 'https://api.phemex.com';

// Phemex v2 API returns real precision strings (Rp/Rr/Rv suffixes)
// No scaled integers - all values are human-readable strings

// Phemex Perpetual API client
export const phemexAPI = {
  async getTickers(): Promise<TickerData[]> {
    try {
      const response = await axios.get(`${BASE_URL}/md/v2/ticker/24hr/all`);
      const tickers = Array.isArray(response.data.result) ? response.data.result : [];
      return tickers
        .filter((t: any) => t.symbol && t.symbol.endsWith('USDT'))
        .map((ticker: any) => {
          const lastPrice = parseFloat(ticker.closeRp) || parseFloat(ticker.markPriceRp) || 0;
          const openPrice = parseFloat(ticker.openRp) || lastPrice;
          const change24h = lastPrice - openPrice;
          const changePercent = openPrice > 0 ? (change24h / openPrice) * 100 : 0;
          return {
            symbol: ticker.symbol.replace('USDT', ''),
            lastPrice,
            price: lastPrice,
            change24h,
            priceChangePercent24h: changePercent,
            changePercent24h: changePercent,
            high24h: parseFloat(ticker.highRp) || 0,
            low24h: parseFloat(ticker.lowRp) || 0,
            volume24h: parseFloat(ticker.volumeRq) || 0,
            quoteVolume24h: parseFloat(ticker.turnoverRv) || 0,
            timestamp: Date.now(),
            exchange: 'Phemex',
          };
        });
    } catch (error) {
      console.error('Phemex getTickers error:', error);
      return [];
    }
  },

  async getFundingRates(): Promise<FundingRateData[]> {
    try {
      const response = await axios.get(`${BASE_URL}/md/v2/ticker/24hr/all`);
      const tickers = Array.isArray(response.data.result) ? response.data.result : [];
      return tickers
        .filter((t: any) => t.symbol && t.symbol.endsWith('USDT') && t.fundingRateRr != null)
        .map((item: any) => {
          const fundingRate = parseFloat(item.fundingRateRr) * 100;
          return {
            symbol: item.symbol.replace('USDT', ''),
            exchange: 'Phemex',
            fundingRate: isNaN(fundingRate) ? 0 : fundingRate,
            fundingTime: Date.now(),
            nextFundingTime: Date.now() + 28800000,
            markPrice: parseFloat(item.markPriceRp) || 0,
            indexPrice: parseFloat(item.indexPriceRp) || 0,
          };
        })
        .filter((item: FundingRateData) => !isNaN(item.fundingRate));
    } catch (error) {
      console.error('Phemex getFundingRates error:', error);
      return [];
    }
  },

  async getOpenInterest(symbol?: string): Promise<OpenInterestData[]> {
    try {
      const response = await axios.get(`${BASE_URL}/md/v2/ticker/24hr/all`);
      const tickers = Array.isArray(response.data.result) ? response.data.result : [];
      return tickers
        .filter((t: any) => {
          if (!t.symbol || !t.symbol.endsWith('USDT')) return false;
          if (symbol) return t.symbol === `${symbol}USDT`;
          return true;
        })
        .slice(0, 30)
        .map((item: any) => {
          const oi = parseFloat(item.openInterestRv) || 0;
          const price = parseFloat(item.closeRp || item.markPriceRp) || 0;
          return {
            symbol: item.symbol.replace('USDT', ''),
            exchange: 'Phemex',
            openInterest: oi,
            openInterestValue: oi * price,
            timestamp: Date.now(),
          };
        });
    } catch (error) {
      console.error('Phemex getOpenInterest error:', error);
      return [];
    }
  },
};

export default phemexAPI;
