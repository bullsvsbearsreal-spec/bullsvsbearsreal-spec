import axios from 'axios';
import { TickerData, FundingRateData, OpenInterestData } from './types';

// Kraken Futures API (formerly Cryptofacilities)
const BASE_URL = 'https://futures.kraken.com/derivatives/api/v3';

// Kraken Futures API client
export const krakenAPI = {
  async getTickers(): Promise<TickerData[]> {
    try {
      const response = await axios.get(`${BASE_URL}/tickers`);
      if (response.data.result !== 'success') return [];
      return response.data.tickers
        .filter((t: any) => t.symbol.startsWith('PF_') && t.symbol.endsWith('USD'))
        .map((ticker: any) => {
          const lastPrice = ticker.last || ticker.markPrice || 0;
          const open = ticker.open24h || lastPrice;
          const change24h = lastPrice - open;
          const changePercent = open > 0 ? (change24h / open) * 100 : 0;
          // PF_XBTUSD -> BTC, PF_ETHUSD -> ETH
          let sym = ticker.symbol.replace('PF_', '').replace('USD', '');
          if (sym === 'XBT') sym = 'BTC';
          return {
            symbol: sym,
            lastPrice,
            price: lastPrice,
            change24h,
            priceChangePercent24h: changePercent,
            changePercent24h: changePercent,
            high24h: ticker.high24h || 0,
            low24h: ticker.low24h || 0,
            volume24h: ticker.vol24h || 0,
            quoteVolume24h: (ticker.vol24h || 0) * lastPrice,
            timestamp: Date.now(),
            exchange: 'Kraken',
          };
        });
    } catch (error) {
      console.error('Kraken getTickers error:', error);
      return [];
    }
  },

  async getFundingRates(): Promise<FundingRateData[]> {
    try {
      const response = await axios.get(`${BASE_URL}/tickers`);
      if (response.data.result !== 'success') return [];
      return response.data.tickers
        .filter((t: any) => t.symbol.startsWith('PF_') && t.symbol.endsWith('USD') && t.fundingRate != null)
        .map((item: any) => {
          // Kraken funding rates are already in decimal form (e.g., 0.0001)
          const fundingRate = parseFloat(item.fundingRate) * 100;
          let sym = item.symbol.replace('PF_', '').replace('USD', '');
          if (sym === 'XBT') sym = 'BTC';
          return {
            symbol: sym,
            exchange: 'Kraken',
            fundingRate: isNaN(fundingRate) ? 0 : fundingRate,
            fundingTime: Date.now(),
            nextFundingTime: Date.now() + 3600000,
            markPrice: item.markPrice || 0,
            indexPrice: item.indexPrice || 0,
          };
        })
        .filter((item: FundingRateData) => !isNaN(item.fundingRate));
    } catch (error) {
      console.error('Kraken getFundingRates error:', error);
      return [];
    }
  },

  async getOpenInterest(symbol?: string): Promise<OpenInterestData[]> {
    try {
      const response = await axios.get(`${BASE_URL}/tickers`);
      if (response.data.result !== 'success') return [];
      return response.data.tickers
        .filter((t: any) => {
          if (!t.symbol.startsWith('PF_') || !t.symbol.endsWith('USD')) return false;
          if (symbol) {
            let sym = t.symbol.replace('PF_', '').replace('USD', '');
            if (sym === 'XBT') sym = 'BTC';
            return sym === symbol;
          }
          return true;
        })
        .slice(0, 30)
        .map((item: any) => {
          let sym = item.symbol.replace('PF_', '').replace('USD', '');
          if (sym === 'XBT') sym = 'BTC';
          const oi = item.openInterest || 0;
          const price = item.last || item.markPrice || 0;
          return {
            symbol: sym,
            exchange: 'Kraken',
            openInterest: oi,
            openInterestValue: oi * price,
            timestamp: Date.now(),
          };
        });
    } catch (error) {
      console.error('Kraken getOpenInterest error:', error);
      return [];
    }
  },
};

export default krakenAPI;
