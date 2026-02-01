import axios from 'axios';
import { TickerData, FundingRateData, OpenInterestData } from './types';

const BASE_URL = 'https://api.hyperliquid.xyz';

// Hyperliquid API client
class HyperliquidAPI {
  private client = axios.create({
    baseURL: BASE_URL,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  async getTickers(): Promise<TickerData[]> {
    try {
      const response = await this.client.post('/info', {
        type: 'allMids',
      });

      const mids = response.data;
      const tickers: TickerData[] = [];

      // Also get market data for volume
      const metaResponse = await this.client.post('/info', {
        type: 'meta',
      });

      const meta = metaResponse.data;
      const assetContexts = meta?.universe || [];

      for (const [symbol, price] of Object.entries(mids)) {
        const assetInfo = assetContexts.find((a: any) => a.name === symbol);

        tickers.push({
          symbol: `${symbol}USDT`,
          lastPrice: parseFloat(price as string) || 0,
          priceChangePercent24h: 0, // Would need additional API call
          high24h: 0,
          low24h: 0,
          volume24h: 0,
          quoteVolume24h: assetInfo?.dayNtlVlm || 0,
          timestamp: Date.now(),
          exchange: 'Hyperliquid',
        });
      }

      return tickers;
    } catch (error) {
      console.error('Hyperliquid getTickers error:', error);
      return [];
    }
  }

  async getFundingRates(): Promise<FundingRateData[]> {
    try {
      const response = await this.client.post('/info', {
        type: 'meta',
      });

      const meta = response.data;
      const universe = meta?.universe || [];
      const fundingRates: FundingRateData[] = [];

      for (const asset of universe) {
        if (asset.funding) {
          fundingRates.push({
            symbol: `${asset.name}USDT`,
            exchange: 'Hyperliquid',
            fundingRate: parseFloat(asset.funding) * 100 || 0,
            fundingTime: Date.now(),
            nextFundingTime: Date.now() + 3600000, // 1 hour
          });
        }
      }

      return fundingRates;
    } catch (error) {
      console.error('Hyperliquid getFundingRates error:', error);
      return [];
    }
  }

  async getOpenInterest(): Promise<OpenInterestData[]> {
    try {
      const response = await this.client.post('/info', {
        type: 'meta',
      });

      const meta = response.data;
      const universe = meta?.universe || [];
      const openInterest: OpenInterestData[] = [];

      for (const asset of universe) {
        if (asset.openInterest) {
          openInterest.push({
            symbol: `${asset.name}USDT`,
            exchange: 'Hyperliquid',
            openInterest: parseFloat(asset.openInterest) || 0,
            openInterestValue: parseFloat(asset.openInterest) * (parseFloat(asset.markPx) || 0),
            timestamp: Date.now(),
          });
        }
      }

      return openInterest;
    } catch (error) {
      console.error('Hyperliquid getOpenInterest error:', error);
      return [];
    }
  }
}

export const hyperliquidAPI = new HyperliquidAPI();
