// Vertex Protocol API (Arbitrum DEX)
// Docs: https://vertex-protocol.gitbook.io/docs

import { TickerData, FundingRateData, OpenInterestData } from './types';

const VERTEX_API = 'https://archive.prod.vertexprotocol.com/v1';
const VERTEX_GATEWAY = 'https://gateway.prod.vertexprotocol.com/v1';

// Product ID to symbol mapping
const PRODUCT_SYMBOLS: Record<number, string> = {
  1: 'BTC',
  2: 'ETH',
  3: 'ARB',
  4: 'BNB',
  5: 'XRP',
  6: 'SOL',
  7: 'MATIC',
  8: 'SUI',
  9: 'OP',
  10: 'APT',
  11: 'LTC',
  12: 'BCH',
  13: 'COMP',
  14: 'MKR',
  15: 'PEPE',
  16: 'DOGE',
  17: 'LINK',
  18: 'DYDX',
  19: 'CRV',
  20: 'AVAX',
};

export const vertexAPI = {
  async getTickers(): Promise<TickerData[]> {
    try {
      const response = await fetch(VERTEX_GATEWAY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'all_products',
        }),
      });

      if (!response.ok) throw new Error('Vertex API error');

      const data = await response.json();
      if (!data.data?.perp_products) return [];

      return data.data.perp_products
        .filter((p: any) => p.product_id && PRODUCT_SYMBOLS[p.product_id])
        .map((product: any) => {
          const price = parseFloat(product.oracle_price_x18) / 1e18;
          return {
            symbol: PRODUCT_SYMBOLS[product.product_id] || `PERP${product.product_id}`,
            price,
            priceChangePercent24h: 0,
            high24h: 0,
            low24h: 0,
            volume24h: 0,
            quoteVolume24h: 0,
            exchange: 'Vertex',
          };
        });
    } catch (error) {
      console.error('Vertex getTickers error:', error);
      return [];
    }
  },

  async getFundingRates(): Promise<FundingRateData[]> {
    try {
      const response = await fetch(VERTEX_GATEWAY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'all_products',
        }),
      });

      if (!response.ok) throw new Error('Vertex API error');

      const data = await response.json();
      if (!data.data?.perp_products) return [];

      return data.data.perp_products
        .filter((p: any) => p.product_id && PRODUCT_SYMBOLS[p.product_id])
        .map((product: any) => ({
          symbol: PRODUCT_SYMBOLS[product.product_id] || `PERP${product.product_id}`,
          // Vertex uses hourly funding, convert to 8h equivalent
          fundingRate: (parseFloat(product.funding_rate_x18 || '0') / 1e18) * 100 * 8,
          nextFundingTime: Date.now() + 3600000, // Hourly funding
          exchange: 'Vertex',
        }));
    } catch (error) {
      console.error('Vertex getFundingRates error:', error);
      return [];
    }
  },

  async getOpenInterest(): Promise<OpenInterestData[]> {
    try {
      const response = await fetch(VERTEX_GATEWAY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'all_products',
        }),
      });

      if (!response.ok) throw new Error('Vertex API error');

      const data = await response.json();
      if (!data.data?.perp_products) return [];

      return data.data.perp_products
        .filter((p: any) => p.product_id && PRODUCT_SYMBOLS[p.product_id])
        .map((product: any) => {
          const price = parseFloat(product.oracle_price_x18 || '0') / 1e18;
          const oi = parseFloat(product.open_interest_x18 || '0') / 1e18;
          return {
            symbol: PRODUCT_SYMBOLS[product.product_id] || `PERP${product.product_id}`,
            openInterest: oi,
            openInterestValue: oi * price,
            exchange: 'Vertex',
          };
        });
    } catch (error) {
      console.error('Vertex getOpenInterest error:', error);
      return [];
    }
  },
};
