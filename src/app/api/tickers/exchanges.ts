import { ExchangeFetcherConfig } from '../_shared/exchange-fetchers';
import { isCryptoSymbol } from '../_shared/fetch';

type TickerData = {
  symbol: string;
  exchange: string;
  lastPrice: number;
  price: number;
  priceChangePercent24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  quoteVolume24h: number;
};

export const tickerFetchers: ExchangeFetcherConfig<TickerData>[] = [
  // Binance
  {
    name: 'Binance',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://fapi.binance.com/fapi/v1/ticker/24hr');
      if (!res.ok) return [];
      const data = await res.json();
      return data
        .filter((t: any) => t.symbol.endsWith('USDT'))
        .map((ticker: any) => ({
          symbol: ticker.symbol.replace('USDT', ''),
          exchange: 'Binance',
          lastPrice: parseFloat(ticker.lastPrice),
          price: parseFloat(ticker.lastPrice),
          priceChangePercent24h: parseFloat(ticker.priceChangePercent),
          changePercent24h: parseFloat(ticker.priceChangePercent),
          high24h: parseFloat(ticker.highPrice),
          low24h: parseFloat(ticker.lowPrice),
          volume24h: parseFloat(ticker.volume),
          quoteVolume24h: parseFloat(ticker.quoteVolume),
        }));
    },
  },

  // Bybit
  {
    name: 'Bybit',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://api.bybit.com/v5/market/tickers?category=linear');
      if (!res.ok) return [];
      const json = await res.json();
      if (json.retCode !== 0) return [];
      return json.result.list
        .filter((t: any) => t.symbol.endsWith('USDT'))
        .map((ticker: any) => ({
          symbol: ticker.symbol.replace('USDT', ''),
          exchange: 'Bybit',
          lastPrice: parseFloat(ticker.lastPrice),
          price: parseFloat(ticker.lastPrice),
          priceChangePercent24h: parseFloat(ticker.price24hPcnt) * 100,
          changePercent24h: parseFloat(ticker.price24hPcnt) * 100,
          high24h: parseFloat(ticker.highPrice24h),
          low24h: parseFloat(ticker.lowPrice24h),
          volume24h: parseFloat(ticker.volume24h),
          quoteVolume24h: parseFloat(ticker.turnover24h),
        }));
    },
  },

  // OKX
  {
    name: 'OKX',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://www.okx.com/api/v5/market/tickers?instType=SWAP');
      if (!res.ok) return [];
      const json = await res.json();
      if (json.code !== '0') return [];
      return json.data
        .filter((t: any) => t.instId.endsWith('-USDT-SWAP'))
        .map((ticker: any) => ({
          symbol: ticker.instId.replace('-USDT-SWAP', ''),
          exchange: 'OKX',
          lastPrice: parseFloat(ticker.last),
          price: parseFloat(ticker.last),
          priceChangePercent24h: ((parseFloat(ticker.last) - parseFloat(ticker.open24h)) / parseFloat(ticker.open24h)) * 100,
          changePercent24h: ((parseFloat(ticker.last) - parseFloat(ticker.open24h)) / parseFloat(ticker.open24h)) * 100,
          high24h: parseFloat(ticker.high24h),
          low24h: parseFloat(ticker.low24h),
          volume24h: parseFloat(ticker.vol24h),
          quoteVolume24h: parseFloat(ticker.volCcy24h),
        }));
    },
  },

  // Bitget
  {
    name: 'Bitget',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://api.bitget.com/api/v2/mix/market/tickers?productType=USDT-FUTURES');
      if (!res.ok) return [];
      const json = await res.json();
      if (json.code !== '00000') return [];
      return json.data
        .filter((t: any) => t.symbol.endsWith('USDT'))
        .map((ticker: any) => ({
          symbol: ticker.symbol.replace('USDT', ''),
          exchange: 'Bitget',
          lastPrice: parseFloat(ticker.lastPr),
          price: parseFloat(ticker.lastPr),
          priceChangePercent24h: parseFloat(ticker.change24h) * 100,
          changePercent24h: parseFloat(ticker.change24h) * 100,
          high24h: parseFloat(ticker.high24h),
          low24h: parseFloat(ticker.low24h),
          volume24h: parseFloat(ticker.baseVolume),
          quoteVolume24h: parseFloat(ticker.quoteVolume),
        }));
    },
  },

  // Hyperliquid
  {
    name: 'Hyperliquid',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
      });
      if (!res.ok) return [];
      const json = await res.json();
      if (!json || !json[0] || !json[1]) return [];
      return json[1]
        .map((item: any, index: number) => ({
          symbol: json[0].universe[index]?.name || `ASSET${index}`,
          exchange: 'Hyperliquid',
          lastPrice: parseFloat(item.markPx),
          price: parseFloat(item.markPx),
          priceChangePercent24h: parseFloat(item.dayNtlVlm) > 0 ? ((parseFloat(item.markPx) - parseFloat(item.prevDayPx)) / parseFloat(item.prevDayPx)) * 100 : 0,
          changePercent24h: parseFloat(item.dayNtlVlm) > 0 ? ((parseFloat(item.markPx) - parseFloat(item.prevDayPx)) / parseFloat(item.prevDayPx)) * 100 : 0,
          high24h: 0,
          low24h: 0,
          volume24h: parseFloat(item.dayNtlVlm),
          quoteVolume24h: parseFloat(item.dayNtlVlm),
        }))
        .filter((item: any) => !isNaN(item.lastPrice) && item.lastPrice > 0);
    },
  },

  // dYdX
  {
    name: 'dYdX',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://indexer.dydx.trade/v4/perpetualMarkets');
      if (!res.ok) return [];
      const json = await res.json();
      if (!json.markets) return [];
      return Object.entries(json.markets)
        .filter(([key]: [string, any]) => key.endsWith('-USD'))
        .map(([key, market]: [string, any]) => ({
          symbol: key.replace('-USD', ''),
          exchange: 'dYdX',
          lastPrice: parseFloat(market.oraclePrice),
          price: parseFloat(market.oraclePrice),
          priceChangePercent24h: parseFloat(market.priceChange24H) || 0,
          changePercent24h: parseFloat(market.priceChange24H) || 0,
          high24h: 0,
          low24h: 0,
          volume24h: parseFloat(market.volume24H),
          quoteVolume24h: parseFloat(market.volume24H),
        }));
    },
  },

  // Gate.io
  {
    name: 'Gate.io',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://api.gateio.ws/api/v4/futures/usdt/contracts');
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data
        .filter((t: any) => t.name.endsWith('_USDT'))
        .map((ticker: any) => {
          const lastPrice = parseFloat(ticker.last_price) || parseFloat(ticker.mark_price) || 0;
          return {
            symbol: ticker.name.replace('_USDT', ''),
            exchange: 'Gate.io',
            lastPrice,
            price: lastPrice,
            priceChangePercent24h: parseFloat(ticker.change_percentage) || 0,
            changePercent24h: parseFloat(ticker.change_percentage) || 0,
            high24h: parseFloat(ticker.high_24h) || 0,
            low24h: parseFloat(ticker.low_24h) || 0,
            volume24h: parseFloat(ticker.volume_24h) || 0,
            quoteVolume24h: parseFloat(ticker.volume_24h_usd) || 0,
          };
        })
        .filter((item: any) => item.lastPrice > 0);
    },
  },

  // MEXC
  {
    name: 'MEXC',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://contract.mexc.com/api/v1/contract/ticker');
      if (!res.ok) return [];
      const json = await res.json();
      if (!json.success || !Array.isArray(json.data)) return [];
      return json.data
        .filter((t: any) => t.symbol.endsWith('_USDT'))
        .map((ticker: any) => {
          const lastPrice = parseFloat(ticker.lastPrice);
          return {
            symbol: ticker.symbol.replace('_USDT', ''),
            exchange: 'MEXC',
            lastPrice,
            price: lastPrice,
            priceChangePercent24h: parseFloat(ticker.riseFallRate) * 100 || 0,
            changePercent24h: parseFloat(ticker.riseFallRate) * 100 || 0,
            high24h: parseFloat(ticker.high24Price) || 0,
            low24h: parseFloat(ticker.low24Price) || 0,
            volume24h: parseFloat(ticker.volume24) || 0,
            quoteVolume24h: parseFloat(ticker.amount24) || 0,
          };
        })
        .filter((item: any) => item.lastPrice > 0);
    },
  },

  // Kraken Futures
  {
    name: 'Kraken',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://futures.kraken.com/derivatives/api/v3/tickers');
      if (!res.ok) return [];
      const json = await res.json();
      if (json.result !== 'success' || !Array.isArray(json.tickers)) return [];
      return json.tickers
        .filter((t: any) => t.symbol.startsWith('PF_') && t.symbol.endsWith('USD'))
        .map((ticker: any) => {
          let sym = ticker.symbol.replace('PF_', '').replace('USD', '');
          if (sym === 'XBT') sym = 'BTC';
          const lastPrice = ticker.last || ticker.markPrice || 0;
          const open = ticker.open24h || lastPrice;
          const changePercent = open > 0 ? ((lastPrice - open) / open) * 100 : 0;
          return {
            symbol: sym,
            exchange: 'Kraken',
            lastPrice,
            price: lastPrice,
            priceChangePercent24h: changePercent,
            changePercent24h: changePercent,
            high24h: ticker.high24h || 0,
            low24h: ticker.low24h || 0,
            volume24h: ticker.vol24h || 0,
            quoteVolume24h: (ticker.vol24h || 0) * lastPrice,
          };
        })
        .filter((item: any) => item.lastPrice > 0 && isCryptoSymbol(item.symbol));
    },
  },

  // BingX
  {
    name: 'BingX',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://open-api.bingx.com/openApi/swap/v2/quote/ticker');
      if (!res.ok) return [];
      const json = await res.json();
      if (json.code !== 0 || !Array.isArray(json.data)) return [];
      return json.data
        .filter((t: any) => t.symbol.endsWith('-USDT'))
        .map((ticker: any) => {
          const lastPrice = parseFloat(ticker.lastPrice);
          return {
            symbol: ticker.symbol.replace('-USDT', ''),
            exchange: 'BingX',
            lastPrice,
            price: lastPrice,
            priceChangePercent24h: parseFloat(ticker.priceChangePercent) || 0,
            changePercent24h: parseFloat(ticker.priceChangePercent) || 0,
            high24h: parseFloat(ticker.highPrice) || 0,
            low24h: parseFloat(ticker.lowPrice) || 0,
            volume24h: parseFloat(ticker.volume) || 0,
            quoteVolume24h: parseFloat(ticker.quoteVolume) || 0,
          };
        })
        .filter((item: any) => item.lastPrice > 0 && isCryptoSymbol(item.symbol));
    },
  },

  // Phemex
  {
    name: 'Phemex',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://api.phemex.com/md/v2/ticker/24hr/all');
      if (!res.ok) return [];
      const json = await res.json();
      const phemexResult = Array.isArray(json.result) ? json.result : [];
      if (phemexResult.length === 0) return [];
      return phemexResult
        .filter((t: any) => t.symbol && t.symbol.endsWith('USDT'))
        .map((ticker: any) => {
          const lastPrice = parseFloat(ticker.closeRp) || parseFloat(ticker.markPriceRp) || 0;
          const openPrice = parseFloat(ticker.openRp) || lastPrice;
          const changePercent = openPrice > 0 ? ((lastPrice - openPrice) / openPrice) * 100 : 0;
          return {
            symbol: ticker.symbol.replace('USDT', ''),
            exchange: 'Phemex',
            lastPrice,
            price: lastPrice,
            priceChangePercent24h: changePercent,
            changePercent24h: changePercent,
            high24h: parseFloat(ticker.highRp) || 0,
            low24h: parseFloat(ticker.lowRp) || 0,
            volume24h: parseFloat(ticker.volumeRq) || 0,
            quoteVolume24h: parseFloat(ticker.turnoverRv) || 0,
          };
        })
        .filter((item: any) => item.lastPrice > 0);
    },
  },
];
