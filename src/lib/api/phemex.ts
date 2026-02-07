// Phemex Futures API
// Docs: https://phemex-docs.github.io/

import { TickerData, FundingRateData, OpenInterestData } from './types';

const PHEMEX_API = 'https://api.phemex.com';

interface PhemexTicker {
  symbol: string;
  lastPriceEp: number;
  highPriceEp: number;
  lowPriceEp: number;
  turnoverEv: number;
  volumeEv: number;
  openInterestEv: number;
  indexPriceEp: number;
  markPriceEp: number;
  fundingRateEr: number;
  predFundingRateEr: number;
}

// Normalize symbol (e.g., BTCUSD -> BTC)
function normalizeSymbol(symbol: string): string {
  return symbol.replace(/USD$|USDT$/, '');
}

// Phemex uses scaled values (Ep = 10^4, Ev = 10^8, Er = 10^8)
function scalePrice(ep: number): number {
  return ep / 10000;
}

function scaleVolume(ev: number): number {
  return ev / 100000000;
}

function scaleFundingRate(er: number): number {
  return er / 100000000;
}

export const phemexAPI = {
  async getTickers(): Promise<TickerData[]> {
    try {
      const response = await fetch(`${PHEMEX_API}/md/v2/ticker/24hr/all`);
      if (!response.ok) throw new Error('Phemex API error');

      const data = await response.json();
      if (data.code !== 0 || !data.result) return [];

      const tickers: PhemexTicker[] = data.result || [];

      return tickers
        .filter(t => t.symbol.endsWith('USD') || t.symbol.endsWith('USDT'))
        .map(ticker => {
          const price = scalePrice(ticker.lastPriceEp);
          const high = scalePrice(ticker.highPriceEp);
          const low = scalePrice(ticker.lowPriceEp);
          const prevPrice = high - (high - low) / 2; // Approximate
          const changePercent = prevPrice > 0 ? ((price - prevPrice) / prevPrice) * 100 : 0;

          return {
            symbol: normalizeSymbol(ticker.symbol),
            lastPrice: price,
            price,
            priceChangePercent24h: changePercent,
            high24h: high,
            low24h: low,
            volume24h: scaleVolume(ticker.volumeEv),
            quoteVolume24h: scaleVolume(ticker.turnoverEv),
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
      const response = await fetch(`${PHEMEX_API}/md/v2/ticker/24hr/all`);
      if (!response.ok) throw new Error('Phemex API error');

      const data = await response.json();
      if (data.code !== 0 || !data.result) return [];

      const tickers: PhemexTicker[] = data.result || [];

      return tickers
        .filter(t => (t.symbol.endsWith('USD') || t.symbol.endsWith('USDT')) && t.fundingRateEr)
        .map(ticker => ({
          symbol: normalizeSymbol(ticker.symbol),
          fundingRate: scaleFundingRate(ticker.fundingRateEr),
          fundingTime: Date.now(),
          nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
          exchange: 'Phemex',
        }));
    } catch (error) {
      console.error('Phemex getFundingRates error:', error);
      return [];
    }
  },

  async getOpenInterest(): Promise<OpenInterestData[]> {
    try {
      const response = await fetch(`${PHEMEX_API}/md/v2/ticker/24hr/all`);
      if (!response.ok) throw new Error('Phemex API error');

      const data = await response.json();
      if (data.code !== 0 || !data.result) return [];

      const tickers: PhemexTicker[] = data.result || [];

      return tickers
        .filter(t => (t.symbol.endsWith('USD') || t.symbol.endsWith('USDT')) && t.openInterestEv > 0)
        .map(ticker => {
          const price = scalePrice(ticker.lastPriceEp);
          const oi = scaleVolume(ticker.openInterestEv);
          return {
            symbol: normalizeSymbol(ticker.symbol),
            openInterest: oi,
            openInterestValue: oi * price,
            timestamp: Date.now(),
            exchange: 'Phemex',
          };
        });
    } catch (error) {
      console.error('Phemex getOpenInterest error:', error);
      return [];
    }
  },
};
