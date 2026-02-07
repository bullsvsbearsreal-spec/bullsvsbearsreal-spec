// Bitfinex Derivatives API
// Docs: https://docs.bitfinex.com/reference

import { TickerData, FundingRateData, OpenInterestData } from './types';

const BITFINEX_API = 'https://api-pub.bitfinex.com/v2';

// Normalize symbol (e.g., tBTCF0:USTF0 -> BTC)
function normalizeSymbol(symbol: string): string {
  return symbol
    .replace(/^t/, '')
    .replace(/F0:USTF0$|F0:USDTF0$|:.*$/, '')
    .replace(/USD$|UST$/, '');
}

export const bitfinexAPI = {
  async getTickers(): Promise<TickerData[]> {
    try {
      // Get all derivative tickers
      const response = await fetch(`${BITFINEX_API}/tickers?symbols=ALL`);
      if (!response.ok) throw new Error('Bitfinex API error');

      const data = await response.json();

      // Filter for perpetual contracts (F0:USTF0 suffix)
      return data
        .filter((t: any) => t[0]?.includes('F0:USTF0') || t[0]?.includes('F0:USDTF0'))
        .map((ticker: any) => {
          const price = ticker[7]; // Last price
          const dailyChange = ticker[5]; // Daily change
          const dailyChangePercent = ticker[6] * 100; // Daily change percent
          const high = ticker[9];
          const low = ticker[10];
          const volume = ticker[8];

          return {
            symbol: normalizeSymbol(ticker[0]),
            lastPrice: price,
            price,
            priceChangePercent24h: dailyChangePercent,
            high24h: high,
            low24h: low,
            volume24h: volume,
            quoteVolume24h: volume * price,
            timestamp: Date.now(),
            exchange: 'Bitfinex',
          };
        });
    } catch (error) {
      console.error('Bitfinex getTickers error:', error);
      return [];
    }
  },

  async getFundingRates(): Promise<FundingRateData[]> {
    try {
      const response = await fetch(`${BITFINEX_API}/status/deriv?keys=ALL`);
      if (!response.ok) throw new Error('Bitfinex API error');

      const data = await response.json();

      return data
        .filter((item: any) => item[0]?.includes('F0'))
        .map((item: any) => ({
          symbol: normalizeSymbol(item[0]),
          fundingRate: (item[10] || 0) * 100, // Current funding rate
          fundingTime: Date.now(),
          nextFundingTime: item[11] || Date.now() + 3600000,
          exchange: 'Bitfinex',
        }))
        .filter((item: any) => !isNaN(item.fundingRate));
    } catch (error) {
      console.error('Bitfinex getFundingRates error:', error);
      return [];
    }
  },

  async getOpenInterest(): Promise<OpenInterestData[]> {
    try {
      const response = await fetch(`${BITFINEX_API}/status/deriv?keys=ALL`);
      if (!response.ok) throw new Error('Bitfinex API error');

      const data = await response.json();

      return data
        .filter((item: any) => item[0]?.includes('F0') && item[18] > 0)
        .map((item: any) => ({
          symbol: normalizeSymbol(item[0]),
          openInterest: item[18], // Open interest
          openInterestValue: item[18] * (item[3] || 0), // OI * mark price
          timestamp: Date.now(),
          exchange: 'Bitfinex',
        }));
    } catch (error) {
      console.error('Bitfinex getOpenInterest error:', error);
      return [];
    }
  },
};
