import axios from 'axios';
import { TickerData, FundingRateData, OpenInterestData } from './types';

const BASE_URL = 'https://api.phemex.com';

// Phemex uses scaled integers: prices are in 1e4 (rEv) or 1e8 (rEp) format
const PRICE_SCALE = 1e4;
const RATIO_SCALE = 1e8;

// Phemex Perpetual API client
export const phemexAPI = {
  async getTickers(): Promise<TickerData[]> {
    try {
      const response = await axios.get(`${BASE_URL}/md/v2/ticker/24hr/all`);
      if (response.data.code !== 0) return [];
      const tickers = response.data.result || [];
      return tickers
        .filter((t: any) => t.symbol && t.symbol.endsWith('USDT'))
        .map((ticker: any) => {
          const lastPrice = (ticker.lastEp || 0) / PRICE_SCALE;
          const openPrice = (ticker.openEp || 0) / PRICE_SCALE;
          const change24h = lastPrice - openPrice;
          const changePercent = openPrice > 0 ? (change24h / openPrice) * 100 : 0;
          return {
            symbol: ticker.symbol.replace('USDT', ''),
            lastPrice,
            price: lastPrice,
            change24h,
            priceChangePercent24h: changePercent,
            changePercent24h: changePercent,
            high24h: (ticker.highEp || 0) / PRICE_SCALE,
            low24h: (ticker.lowEp || 0) / PRICE_SCALE,
            volume24h: (ticker.volumeEv || 0) / PRICE_SCALE,
            quoteVolume24h: (ticker.turnoverEv || 0) / PRICE_SCALE,
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
      // Phemex ticker endpoint includes funding rate data
      const response = await axios.get(`${BASE_URL}/md/v2/ticker/24hr/all`);
      if (response.data.code !== 0) return [];
      const tickers = response.data.result || [];
      return tickers
        .filter((t: any) => t.symbol && t.symbol.endsWith('USDT') && t.fundingRateEr != null)
        .map((item: any) => {
          const fundingRate = (item.fundingRateEr || 0) / RATIO_SCALE * 100;
          return {
            symbol: item.symbol.replace('USDT', ''),
            exchange: 'Phemex',
            fundingRate: isNaN(fundingRate) ? 0 : fundingRate,
            fundingTime: Date.now(),
            nextFundingTime: Date.now() + 28800000,
            markPrice: (item.markEp || 0) / PRICE_SCALE,
            indexPrice: (item.indexEp || 0) / PRICE_SCALE,
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
      if (response.data.code !== 0) return [];
      const tickers = response.data.result || [];
      return tickers
        .filter((t: any) => {
          if (!t.symbol || !t.symbol.endsWith('USDT')) return false;
          if (symbol) return t.symbol === `${symbol}USDT`;
          return true;
        })
        .slice(0, 30)
        .map((item: any) => {
          const oi = (item.openInterestEv || 0) / PRICE_SCALE;
          const price = (item.lastEp || 0) / PRICE_SCALE;
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
