// KuCoin Futures API
// Docs: https://docs.kucoin.com/futures

import { TickerData, FundingRateData, OpenInterestData } from './types';

const KUCOIN_FUTURES_API = 'https://api-futures.kucoin.com/api/v1';

interface KucoinTicker {
  symbol: string;
  price: string;
  changeRate24h: string;
  high24h: string;
  low24h: string;
  vol24h: number;
  turnover24h: number;
}

interface KucoinContract {
  symbol: string;
  fundingFeeRate: number;
  predictedFundingFeeRate: number;
  nextFundingRateTime: number;
  openInterest: string;
  markPrice: number;
  indexPrice: number;
}

// Normalize symbol (e.g., XBTUSDTM -> BTC)
function normalizeSymbol(symbol: string): string {
  let normalized = symbol
    .replace(/USDTM$|USDM$|USDCM$/, '')
    .replace(/XBT/, 'BTC');
  return normalized;
}

export const kucoinAPI = {
  async getTickers(): Promise<TickerData[]> {
    try {
      const response = await fetch(`${KUCOIN_FUTURES_API}/contracts/active`);
      if (!response.ok) throw new Error('KuCoin API error');

      const data = await response.json();
      if (data.code !== '200000' || !data.data) return [];

      return data.data
        .filter((c: any) => c.symbol.endsWith('USDTM'))
        .map((contract: any) => ({
          symbol: normalizeSymbol(contract.symbol),
          lastPrice: contract.markPrice,
          price: contract.markPrice,
          priceChangePercent24h: 0, // Need separate endpoint
          high24h: 0,
          low24h: 0,
          volume24h: parseFloat(contract.turnoverOf24h) || 0,
          quoteVolume24h: parseFloat(contract.turnoverOf24h) || 0,
          timestamp: Date.now(),
          exchange: 'KuCoin',
        }));
    } catch (error) {
      console.error('KuCoin getTickers error:', error);
      return [];
    }
  },

  async getFundingRates(): Promise<FundingRateData[]> {
    try {
      const response = await fetch(`${KUCOIN_FUTURES_API}/contracts/active`);
      if (!response.ok) throw new Error('KuCoin API error');

      const data = await response.json();
      if (data.code !== '200000' || !data.data) return [];

      return data.data
        .filter((c: any) => c.symbol.endsWith('USDTM') && c.fundingFeeRate !== undefined)
        .map((contract: any) => ({
          symbol: normalizeSymbol(contract.symbol),
          fundingRate: contract.fundingFeeRate,
          fundingTime: Date.now(),
          nextFundingTime: contract.nextFundingRateTime,
          exchange: 'KuCoin',
        }));
    } catch (error) {
      console.error('KuCoin getFundingRates error:', error);
      return [];
    }
  },

  async getOpenInterest(): Promise<OpenInterestData[]> {
    try {
      const response = await fetch(`${KUCOIN_FUTURES_API}/contracts/active`);
      if (!response.ok) throw new Error('KuCoin API error');

      const data = await response.json();
      if (data.code !== '200000' || !data.data) return [];

      return data.data
        .filter((c: any) => c.symbol.endsWith('USDTM') && parseFloat(c.openInterest) > 0)
        .map((contract: any) => ({
          symbol: normalizeSymbol(contract.symbol),
          openInterest: parseFloat(contract.openInterest),
          openInterestValue: parseFloat(contract.openInterest) * contract.markPrice,
          timestamp: Date.now(),
          exchange: 'KuCoin',
        }));
    } catch (error) {
      console.error('KuCoin getOpenInterest error:', error);
      return [];
    }
  },
};
