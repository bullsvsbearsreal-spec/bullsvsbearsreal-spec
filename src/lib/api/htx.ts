// HTX (Huobi) Futures API
// Docs: https://www.htx.com/en-us/opend/newApiPages/

import { TickerData, FundingRateData, OpenInterestData } from './types';

const HTX_API = 'https://api.hbdm.com';

interface HTXTicker {
  symbol: string;
  contract_code: string;
  close: string;
  open: string;
  high: string;
  low: string;
  vol: string;
  amount: string;
  trade_turnover: string;
}

// Normalize symbol (e.g., BTC-USDT -> BTC)
function normalizeSymbol(contractCode: string): string {
  return contractCode.replace(/-USDT|-USD/, '');
}

export const htxAPI = {
  async getTickers(): Promise<TickerData[]> {
    try {
      const response = await fetch(`${HTX_API}/linear-swap-ex/market/detail/batch_merged`);
      if (!response.ok) throw new Error('HTX API error');

      const data = await response.json();
      if (data.status !== 'ok' || !data.ticks) return [];

      return data.ticks
        .filter((t: any) => t.contract_code?.includes('-USDT'))
        .map((ticker: any) => {
          const price = parseFloat(ticker.close);
          const open = parseFloat(ticker.open);
          const changePercent = open > 0 ? ((price - open) / open) * 100 : 0;
          return {
            symbol: normalizeSymbol(ticker.contract_code),
            lastPrice: price,
            price,
            priceChangePercent24h: changePercent,
            high24h: parseFloat(ticker.high),
            low24h: parseFloat(ticker.low),
            volume24h: parseFloat(ticker.vol),
            quoteVolume24h: parseFloat(ticker.trade_turnover),
            timestamp: Date.now(),
            exchange: 'HTX',
          };
        });
    } catch (error) {
      console.error('HTX getTickers error:', error);
      return [];
    }
  },

  async getFundingRates(): Promise<FundingRateData[]> {
    try {
      const response = await fetch(`${HTX_API}/linear-swap-api/v1/swap_batch_funding_rate`);
      if (!response.ok) throw new Error('HTX API error');

      const data = await response.json();
      if (data.status !== 'ok' || !data.data) return [];

      return data.data
        .filter((item: any) => item.contract_code?.includes('-USDT'))
        .map((item: any) => ({
          symbol: normalizeSymbol(item.contract_code),
          fundingRate: parseFloat(item.funding_rate) * 100,
          fundingTime: Date.now(),
          nextFundingTime: item.next_funding_time,
          exchange: 'HTX',
        }));
    } catch (error) {
      console.error('HTX getFundingRates error:', error);
      return [];
    }
  },

  async getOpenInterest(): Promise<OpenInterestData[]> {
    try {
      const response = await fetch(`${HTX_API}/linear-swap-api/v1/swap_open_interest`);
      if (!response.ok) throw new Error('HTX API error');

      const data = await response.json();
      if (data.status !== 'ok' || !data.data) return [];

      return data.data
        .filter((item: any) => item.contract_code?.includes('-USDT') && parseFloat(item.volume) > 0)
        .map((item: any) => ({
          symbol: normalizeSymbol(item.contract_code),
          openInterest: parseFloat(item.volume),
          openInterestValue: parseFloat(item.value),
          timestamp: Date.now(),
          exchange: 'HTX',
        }));
    } catch (error) {
      console.error('HTX getOpenInterest error:', error);
      return [];
    }
  },
};
