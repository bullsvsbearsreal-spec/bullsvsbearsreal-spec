import { TickerData, FundingRateData, OpenInterestData } from './types';

const BASE_URL = 'https://indexer.dydx.trade/v4';

// dYdX V4 API client (using native fetch — no axios dependency)
class DydxAPI {
  private async get(path: string): Promise<any> {
    const res = await fetch(`${BASE_URL}${path}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`dYdX API ${res.status}`);
    return res.json();
  }

  async getTickers(): Promise<TickerData[]> {
    try {
      const data = await this.get('/perpetualMarkets');
      const markets = data?.markets || {};

      return Object.values(markets).map((market: any) => ({
        symbol: market.ticker?.split('-')[0] || 'UNKNOWN',
        lastPrice: parseFloat(market.oraclePrice) || 0,
        priceChangePercent24h: (parseFloat(market.priceChange24H) || 0) * 100, // dYdX returns decimal ratio
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
      const data = await this.get('/perpetualMarkets');
      const markets = data?.markets || {};

      return Object.values(markets).map((market: any) => ({
        symbol: market.ticker?.split('-')[0] || 'UNKNOWN',
        exchange: 'dYdX',
        fundingRate: (parseFloat(market.nextFundingRate) || 0) * 100,
        fundingInterval: '1h' as const, // dYdX settles funding hourly
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
      const data = await this.get('/perpetualMarkets');
      const markets = data?.markets || {};

      return Object.values(markets).map((market: any) => ({
        symbol: market.ticker?.split('-')[0] || 'UNKNOWN',
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
