import { ExchangeFetcherConfig } from '../_shared/exchange-fetchers';
import { isCryptoSymbol } from '../_shared/fetch';

export type SpotPrice = {
  symbol: string;
  exchange: string;
  price: number;
  volume24h: number;
};

export const spotPriceFetchers: ExchangeFetcherConfig<SpotPrice>[] = [
  // Binance Spot — geo-blocked, route through PROXY_URL
  {
    name: 'Binance',
    fetcher: async (fetchFn) => {
      const proxyUrl = process.env.PROXY_URL;
      const targetUrl = 'https://api.binance.com/api/v3/ticker/24hr';
      const url = proxyUrl
        ? `${proxyUrl.replace(/\/$/, '')}/?url=${encodeURIComponent(targetUrl)}`
        : targetUrl;
      const res = await fetchFn(url, {}, 12000);
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data
        .filter((t: any) => t.symbol?.endsWith('USDT') && parseFloat(t.lastPrice) > 0)
        .map((t: any) => ({
          symbol: t.symbol.replace('USDT', ''),
          exchange: 'Binance',
          price: parseFloat(t.lastPrice),
          volume24h: parseFloat(t.quoteVolume) || 0,
        }))
        .filter((t: SpotPrice) => isCryptoSymbol(t.symbol));
    },
  },

  // Bybit Spot — geo-blocked, route through PROXY_URL
  {
    name: 'Bybit',
    fetcher: async (fetchFn) => {
      const proxyUrl = process.env.PROXY_URL;
      const targetUrl = 'https://api.bybit.com/v5/market/tickers?category=spot';
      const url = proxyUrl
        ? `${proxyUrl.replace(/\/$/, '')}/?url=${encodeURIComponent(targetUrl)}`
        : targetUrl;
      const res = await fetchFn(url, {}, 12000);
      if (!res.ok) return [];
      const json = await res.json();
      if (json.retCode !== 0) return [];
      return (json.result?.list || [])
        .filter((t: any) => t.symbol?.endsWith('USDT') && parseFloat(t.lastPrice) > 0)
        .map((t: any) => ({
          symbol: t.symbol.replace('USDT', ''),
          exchange: 'Bybit',
          price: parseFloat(t.lastPrice),
          volume24h: parseFloat(t.turnover24h) || 0,
        }))
        .filter((t: SpotPrice) => isCryptoSymbol(t.symbol));
    },
  },

  // OKX Spot
  {
    name: 'OKX',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://www.okx.com/api/v5/market/tickers?instType=SPOT');
      if (!res.ok) return [];
      const json = await res.json();
      if (json.code !== '0') return [];
      return (json.data || [])
        .filter((t: any) => t.instId?.endsWith('-USDT') && parseFloat(t.last) > 0)
        .map((t: any) => {
          const price = parseFloat(t.last);
          // For spot, volCcy24h is in QUOTE currency (USDT), not base
          const quoteVol = parseFloat(t.volCcy24h) || 0;
          return {
            symbol: t.instId.replace('-USDT', ''),
            exchange: 'OKX',
            price,
            volume24h: quoteVol,
          };
        })
        .filter((t: SpotPrice) => isCryptoSymbol(t.symbol));
    },
  },

  // Bitget Spot
  {
    name: 'Bitget',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://api.bitget.com/api/v2/spot/market/tickers');
      if (!res.ok) return [];
      const json = await res.json();
      if (json.code !== '00000') return [];
      return (json.data || [])
        .filter((t: any) => t.symbol?.endsWith('USDT') && parseFloat(t.lastPr) > 0)
        .map((t: any) => ({
          symbol: t.symbol.replace('USDT', ''),
          exchange: 'Bitget',
          price: parseFloat(t.lastPr),
          volume24h: parseFloat(t.quoteVolume) || 0,
        }))
        .filter((t: SpotPrice) => isCryptoSymbol(t.symbol));
    },
  },

  // KuCoin Spot
  {
    name: 'KuCoin',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://api.kucoin.com/api/v1/market/allTickers');
      if (!res.ok) return [];
      const json = await res.json();
      if (json.code !== '200000') return [];
      const tickers = json.data?.ticker || [];
      return tickers
        .filter((t: any) => t.symbol?.endsWith('-USDT') && parseFloat(t.last) > 0)
        .map((t: any) => ({
          symbol: t.symbol.replace('-USDT', ''),
          exchange: 'KuCoin',
          price: parseFloat(t.last),
          volume24h: parseFloat(t.volValue) || 0,
        }))
        .filter((t: SpotPrice) => isCryptoSymbol(t.symbol));
    },
  },

  // Kraken Spot — uses different symbol format, fetch asset pairs first
  {
    name: 'Kraken',
    fetcher: async (fetchFn) => {
      // Kraken spot ticker endpoint — get all tickers at once
      const res = await fetchFn('https://api.kraken.com/0/public/Ticker', {}, 10000);
      if (!res.ok) return [];
      const json = await res.json();
      if (!json.result) return [];

      // Kraken uses weird names: XXBTZUSD, XETHZUSD, SOLUSDT, etc.
      const results: SpotPrice[] = [];
      for (const [pair, data] of Object.entries(json.result) as [string, any][]) {
        // Match USD or USDT pairs
        let symbol = '';
        if (pair.endsWith('ZUSD')) {
          symbol = pair.replace('ZUSD', '');
          // Strip Kraken's X prefix (crypto) and Z prefix (fiat) — XXBT→XBT, ZGBP→GBP
          if (symbol.startsWith('X') || symbol.startsWith('Z')) symbol = symbol.slice(1);
          if (symbol.startsWith('X')) symbol = symbol.slice(1); // double X prefix (XXBT)
        } else if (pair.endsWith('USD')) {
          symbol = pair.replace('USD', '');
        } else if (pair.endsWith('USDT')) {
          symbol = pair.replace('USDT', '');
        } else {
          continue;
        }
        if (symbol === 'XBT') symbol = 'BTC';
        if (symbol === 'XDG') symbol = 'DOGE';
        // Filter out fiat currencies that Kraken lists as ZUSD pairs
        const FIAT = new Set(['GBP', 'EUR', 'CAD', 'AUD', 'JPY', 'CHF']);
        if (FIAT.has(symbol)) continue;
        if (!symbol || symbol.length > 10 || !isCryptoSymbol(symbol)) continue;

        const price = parseFloat(data.c?.[0]) || 0;
        if (price <= 0) continue;
        const vol = parseFloat(data.v?.[1]) || 0; // 24h volume in base
        results.push({ symbol, exchange: 'Kraken', price, volume24h: vol * price });
      }
      return results;
    },
  },

  // MEXC Spot
  {
    name: 'MEXC',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://api.mexc.com/api/v3/ticker/24hr');
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data
        .filter((t: any) => t.symbol?.endsWith('USDT') && parseFloat(t.lastPrice) > 0)
        .map((t: any) => ({
          symbol: t.symbol.replace('USDT', ''),
          exchange: 'MEXC',
          price: parseFloat(t.lastPrice),
          volume24h: parseFloat(t.quoteVolume) || 0,
        }))
        .filter((t: SpotPrice) => isCryptoSymbol(t.symbol));
    },
  },

  // Coinbase Spot (Advanced Trade public API — bulk product data)
  {
    name: 'Coinbase',
    fetcher: async (fetchFn) => {
      const res = await fetchFn(
        'https://api.coinbase.com/api/v3/brokerage/market/products?product_type=SPOT&limit=500',
        {},
        10000
      );
      if (!res.ok) return [];
      const json = await res.json();
      const products = json.products || json;
      if (!Array.isArray(products)) return [];

      return products
        .filter((p: any) => {
          const id = p.product_id || '';
          return (id.endsWith('-USD') || id.endsWith('-USDT')) && parseFloat(p.price) > 0;
        })
        .map((p: any) => {
          const id = p.product_id || '';
          const symbol = id.replace(/-USD[T]?$/, '');
          if (!isCryptoSymbol(symbol)) return null;
          const price = parseFloat(p.price) || 0;
          const vol = parseFloat(p.volume_24h) || 0;
          return { symbol, exchange: 'Coinbase', price, volume24h: vol * price };
        })
        .filter((t: any): t is SpotPrice => t !== null);
    },
  },

  // HTX (Huobi) Spot
  {
    name: 'HTX',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://api.huobi.pro/market/tickers');
      if (!res.ok) return [];
      const json = await res.json();
      if (json.status !== 'ok' || !Array.isArray(json.data)) return [];
      return json.data
        .filter((t: any) => t.symbol?.endsWith('usdt') && t.close > 0)
        .map((t: any) => ({
          symbol: t.symbol.replace('usdt', '').toUpperCase(),
          exchange: 'HTX',
          price: parseFloat(t.close),
          volume24h: parseFloat(t.vol) || 0, // vol is already in quote currency (USDT)
        }))
        .filter((t: SpotPrice) => isCryptoSymbol(t.symbol));
    },
  },

  // Gate.io Spot — CloudFlare-blocked, route through PROXY_URL
  {
    name: 'Gate.io',
    fetcher: async (fetchFn) => {
      const proxyUrl = process.env.PROXY_URL;
      if (!proxyUrl) return [];
      const targetUrl = 'https://api.gateio.ws/api/v4/spot/tickers';
      const res = await fetchFn(
        `${proxyUrl.replace(/\/$/, '')}/?url=${encodeURIComponent(targetUrl)}`,
        {},
        12000
      );
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data
        .filter((t: any) => t.currency_pair?.endsWith('_USDT') && parseFloat(t.last) > 0)
        .map((t: any) => ({
          symbol: t.currency_pair.replace('_USDT', ''),
          exchange: 'Gate.io',
          price: parseFloat(t.last),
          volume24h: parseFloat(t.quote_volume) || 0,
        }))
        .filter((t: SpotPrice) => isCryptoSymbol(t.symbol));
    },
  },

  // BingX Spot
  {
    name: 'BingX',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://open-api.bingx.com/openApi/spot/v1/ticker/24hr');
      if (!res.ok) return [];
      const json = await res.json();
      if (json.code !== 0 || !Array.isArray(json.data)) return [];
      return json.data
        .filter((t: any) => t.symbol?.endsWith('-USDT') && parseFloat(t.lastPrice) > 0)
        .map((t: any) => ({
          symbol: t.symbol.replace('-USDT', ''),
          exchange: 'BingX',
          price: parseFloat(t.lastPrice),
          volume24h: parseFloat(t.quoteVolume) || 0,
        }))
        .filter((t: SpotPrice) => isCryptoSymbol(t.symbol));
    },
  },

  // CoinEx Spot
  {
    name: 'CoinEx',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://api.coinex.com/v2/spot/ticker?market=');
      if (!res.ok) return [];
      const json = await res.json();
      if (json.code !== 0 || !Array.isArray(json.data)) return [];
      return json.data
        .filter((t: any) => t.market?.endsWith('USDT') && parseFloat(t.last) > 0)
        .map((t: any) => ({
          symbol: t.market.replace('USDT', ''),
          exchange: 'CoinEx',
          price: parseFloat(t.last),
          volume24h: parseFloat(t.value) || 0,
        }))
        .filter((t: SpotPrice) => isCryptoSymbol(t.symbol));
    },
  },

  // Phemex Spot
  {
    name: 'Phemex',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://api.phemex.com/md/v2/ticker/24hr/all');
      if (!res.ok) return [];
      const json = await res.json();
      // Phemex returns both perp and spot — spot symbols use "s" prefix: sBTCUSDT
      const items = Array.isArray(json.result) ? json.result : [];
      return items
        .filter((t: any) => t.symbol?.startsWith('s') && t.symbol.endsWith('USDT'))
        .map((t: any) => {
          const price = parseFloat(t.closeRp) || 0;
          if (price <= 0) return null;
          const symbol = t.symbol.slice(1).replace('USDT', ''); // sBTCUSDT → BTC
          if (!isCryptoSymbol(symbol)) return null;
          return {
            symbol,
            exchange: 'Phemex',
            price,
            volume24h: parseFloat(t.turnoverRv) || 0,
          };
        })
        .filter((t: any): t is SpotPrice => t !== null);
    },
  },

  // WhiteBIT Spot
  {
    name: 'WhiteBIT',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://whitebit.com/api/v4/public/ticker');
      if (!res.ok) return [];
      const json = await res.json();
      if (typeof json !== 'object' || Array.isArray(json)) return [];

      const results: SpotPrice[] = [];
      for (const [pair, data] of Object.entries(json) as [string, any][]) {
        if (!pair.endsWith('_USDT')) continue;
        const price = parseFloat(data.last_price) || 0;
        if (price <= 0) continue;
        const symbol = pair.replace('_USDT', '');
        if (!isCryptoSymbol(symbol)) continue;
        results.push({
          symbol,
          exchange: 'WhiteBIT',
          price,
          volume24h: parseFloat(data.quote_volume) || 0,
        });
      }
      return results;
    },
  },

  // Bitfinex Spot
  {
    name: 'Bitfinex',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://api-pub.bitfinex.com/v2/tickers?symbols=ALL');
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data
        .filter((t: any) => {
          if (!Array.isArray(t) || typeof t[0] !== 'string') return false;
          // Spot pairs start with 't' and end with 'USD' or 'UST' (USDT)
          // Exclude funding (f*) and perp (*F0:*)
          const sym = t[0];
          return sym.startsWith('t') && !sym.includes('F0:') && !sym.includes(':')
            && (sym.endsWith('USD') || sym.endsWith('UST'));
        })
        .map((t: any) => {
          const lastPrice = parseFloat(t[7]) || 0;
          if (lastPrice <= 0) return null;
          let sym = t[0].slice(1); // Remove 't' prefix
          if (sym.endsWith('UST')) sym = sym.replace('UST', '');
          else if (sym.endsWith('USD')) sym = sym.replace('USD', '');
          if (sym === 'XBT') sym = 'BTC';
          if (!sym || sym.length > 10 || !isCryptoSymbol(sym)) return null;
          const vol = parseFloat(t[8]) || 0;
          return { symbol: sym, exchange: 'Bitfinex', price: lastPrice, volume24h: Math.abs(vol) * lastPrice };
        })
        .filter((t: any): t is SpotPrice => t !== null);
    },
  },
];
