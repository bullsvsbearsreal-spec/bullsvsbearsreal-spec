import axios from 'axios';
import { TickerData, FundingRateData, OpenInterestData } from './types';

const BASE_URL = 'https://indexer.dydx.trade/v4';

// dYdX V4 API client
class DydxAPI {
  private client = axios.create({
    baseURL: BASE_URL,
    timeout: 10000,
  });

  async getTickers(): Promise<TickerData[]> {
    try {
      const response = await this.client.get('/perpetualMarkets');
      const markets = response.data?.markets || {};

      return Object.values(markets).map((market: any) => ({
        symbol: market.ticker?.replace('-', '') || 'UNKNOWN',
        lastPrice: parseFloat(market.oraclePrice) || 0,
        priceChangePercent24h: parseFloat(market.priceChange24H) || 0,
        high24h: 0,
        low24h: 0,
        volume24h: parseFloat(market.volume24H) || 0,
        quoteVolume24h: parseFloat(market.volume24H) || 0,
        timestamp: Date.now(),
        exchange: 'dYdX',
      }));
    } catch (error) {
      console.error('dYdX getTickers error:', error);
      return [];
    }
  }

  async getFundingRates(): Promise<FundingRateData[]> {
    try {
      const response = await this.client.get('/perpetualMarkets');
      const markets = response.data?.markets || {};

      return Object.values(markets).map((market: any) => ({
        symbol: market.ticker?.replace('-', '') || 'UNKNOWN',
        exchange: 'dYdX',
        fundingRate: (parseFloat(market.nextFundingRate) || 0) * 100,
        fundingTime: Date.now(),
        nextFundingTime: Date.now() + 3600000,
      }));
    } catch (error) {
      console.error('dYdX getFundingRates error:', error);
      return [];
    }
  }

  async getOpenInterest(): Promise<OpenInterestData[]> {
    try {
      const response = await this.client.get('/perpetualMarkets');
      const markets = response.data?.markets || {};

      return Object.values(markets).map((market: any) => ({
        symbol: market.ticker?.replace('-', '') || 'UNKNOWN',
        exchange: 'dYdX',
        openInterest: parseFloat(market.openInterest) || 0,
        openInterestValue: parseFloat(market.openInterestUSDC) || 0,
        timestamp: Date.now(),
      }));
    } catch (error) {
      console.error('dYdX getOpenInterest error:', error);
      return [];
    }
  }
}

export const dydxAPI = new DydxAPI();
