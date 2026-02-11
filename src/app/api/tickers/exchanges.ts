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

  // BitMEX
  {
    name: 'BitMEX',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://www.bitmex.com/api/v1/instrument/active');
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data
        .filter((t: any) => t.symbol.endsWith('USDT') && t.lastPrice)
        .map((ticker: any) => ({
          symbol: ticker.symbol.replace('USDT', ''),
          exchange: 'BitMEX',
          lastPrice: parseFloat(ticker.lastPrice),
          price: parseFloat(ticker.lastPrice),
          priceChangePercent24h: (parseFloat(ticker.lastChangePcnt) || 0) * 100,
          changePercent24h: (parseFloat(ticker.lastChangePcnt) || 0) * 100,
          high24h: parseFloat(ticker.highPrice) || 0,
          low24h: parseFloat(ticker.lowPrice) || 0,
          volume24h: parseFloat(ticker.volume24h) || 0,
          quoteVolume24h: parseFloat(ticker.turnover24h) || 0,
        }))
        .filter((item: any) => item.lastPrice > 0);
    },
  },

  // KuCoin
  {
    name: 'KuCoin',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://api-futures.kucoin.com/api/v1/contracts/active');
      if (!res.ok) return [];
      const json = await res.json();
      if (json.code !== '200000' && json.code !== 200000) return [];
      return (json.data || [])
        .filter((t: any) => t.symbol.endsWith('USDTM') && t.lastTradePrice)
        .map((ticker: any) => ({
          symbol: ticker.symbol.replace('USDTM', ''),
          exchange: 'KuCoin',
          lastPrice: parseFloat(ticker.lastTradePrice),
          price: parseFloat(ticker.lastTradePrice),
          priceChangePercent24h: (parseFloat(ticker.priceChgPct) || 0) * 100,
          changePercent24h: (parseFloat(ticker.priceChgPct) || 0) * 100,
          high24h: parseFloat(ticker.highPrice) || 0,
          low24h: parseFloat(ticker.lowPrice) || 0,
          volume24h: parseFloat(ticker.volumeOf24h) || 0,
          quoteVolume24h: parseFloat(ticker.turnoverOf24h) || 0,
        }))
        .filter((item: any) => item.lastPrice > 0);
    },
  },

  // Deribit (BTC + ETH only)
  {
    name: 'Deribit',
    fetcher: async (fetchFn) => {
      const instruments = ['BTC-PERPETUAL', 'ETH-PERPETUAL'];
      const promises = instruments.map(async (inst) => {
        try {
          const res = await fetchFn(`https://www.deribit.com/api/v2/public/ticker?instrument_name=${inst}`, {}, 5000);
          if (!res.ok) return null;
          const json = await res.json();
          const r = json.result;
          if (!r) return null;
          const stats = r.stats || {};
          return {
            symbol: inst.replace('-PERPETUAL', ''),
            exchange: 'Deribit',
            lastPrice: parseFloat(r.last_price) || 0,
            price: parseFloat(r.last_price) || 0,
            priceChangePercent24h: parseFloat(stats.price_change) || 0,
            changePercent24h: parseFloat(stats.price_change) || 0,
            high24h: parseFloat(stats.high) || 0,
            low24h: parseFloat(stats.low) || 0,
            volume24h: parseFloat(stats.volume) || 0,
            quoteVolume24h: parseFloat(stats.volume_usd) || 0,
          };
        } catch { return null; }
      });
      return (await Promise.all(promises)).filter((item): item is TickerData => item !== null && item.lastPrice > 0);
    },
  },

  // HTX (Huobi)
  {
    name: 'HTX',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://api.hbdm.com/linear-swap-ex/market/detail/batch_merged');
      if (!res.ok) return [];
      const json = await res.json();
      if (json.status !== 'ok' || !Array.isArray(json.ticks)) return [];
      return json.ticks
        .filter((t: any) => {
          const code = t.contract_code || '';
          return code.endsWith('-USDT') && !/-\d{6}$/.test(code);
        })
        .map((ticker: any) => {
          const lastPrice = parseFloat(ticker.close) || 0;
          const openPrice = parseFloat(ticker.open) || lastPrice;
          const changePercent = openPrice > 0 ? ((lastPrice - openPrice) / openPrice) * 100 : 0;
          return {
            symbol: ticker.contract_code.replace('-USDT', ''),
            exchange: 'HTX',
            lastPrice,
            price: lastPrice,
            priceChangePercent24h: changePercent,
            changePercent24h: changePercent,
            high24h: parseFloat(ticker.high) || 0,
            low24h: parseFloat(ticker.low) || 0,
            volume24h: parseFloat(ticker.amount) || 0,
            quoteVolume24h: parseFloat(ticker.trade_turnover) || 0,
          };
        })
        .filter((item: any) => item.lastPrice > 0);
    },
  },

  // Bitfinex
  {
    name: 'Bitfinex',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://api-pub.bitfinex.com/v2/tickers?symbols=ALL');
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data
        .filter((t: any) => Array.isArray(t) && typeof t[0] === 'string' && t[0].endsWith('F0:USTF0'))
        .map((ticker: any) => {
          // [symbol, bid, bidSize, ask, askSize, dailyChange, dailyChangePercent, lastPrice, volume, high, low]
          const lastPrice = parseFloat(ticker[7]) || 0;
          return {
            symbol: ticker[0].replace('t', '').replace('F0:USTF0', ''),
            exchange: 'Bitfinex',
            lastPrice,
            price: lastPrice,
            priceChangePercent24h: (parseFloat(ticker[6]) || 0) * 100,
            changePercent24h: (parseFloat(ticker[6]) || 0) * 100,
            high24h: parseFloat(ticker[9]) || 0,
            low24h: parseFloat(ticker[10]) || 0,
            volume24h: parseFloat(ticker[8]) || 0,
            quoteVolume24h: (parseFloat(ticker[8]) || 0) * lastPrice,
          };
        })
        .filter((item: any) => item.lastPrice > 0 && item.symbol.length > 0);
    },
  },

  // WhiteBIT
  {
    name: 'WhiteBIT',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://whitebit.com/api/v4/public/futures');
      if (!res.ok) return [];
      const json = await res.json();
      const items = json.result || json;
      if (!Array.isArray(items)) return [];
      return items
        .filter((t: any) => t.ticker_id && t.ticker_id.endsWith('_PERP') && t.last_price)
        .map((ticker: any) => {
          const lastPrice = parseFloat(ticker.last_price) || 0;
          return {
            symbol: ticker.ticker_id.replace('_PERP', ''),
            exchange: 'WhiteBIT',
            lastPrice,
            price: lastPrice,
            priceChangePercent24h: 0,
            changePercent24h: 0,
            high24h: parseFloat(ticker.high) || 0,
            low24h: parseFloat(ticker.low) || 0,
            volume24h: parseFloat(ticker.stock_volume) || 0,
            quoteVolume24h: parseFloat(ticker.money_volume) || 0,
          };
        })
        .filter((item: any) => item.lastPrice > 0);
    },
  },

  // Coinbase International
  {
    name: 'Coinbase',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://api.international.coinbase.com/api/v1/instruments');
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data
        .filter((t: any) => (t.type === 'PERP' || t.instrument_type === 'PERP') && t.quote)
        .map((ticker: any) => {
          const lastPrice = parseFloat(ticker.quote?.mark_price) || 0;
          return {
            symbol: ticker.symbol.replace('-PERP', ''),
            exchange: 'Coinbase',
            lastPrice,
            price: lastPrice,
            priceChangePercent24h: 0,
            changePercent24h: 0,
            high24h: 0,
            low24h: 0,
            volume24h: parseFloat(ticker.qty_24hr) || parseFloat(ticker.base_volume_24h) || 0,
            quoteVolume24h: parseFloat(ticker.notional_24hr) || parseFloat(ticker.notional_volume_24h) || 0,
          };
        })
        .filter((item: any) => item.lastPrice > 0);
    },
  },

  // CoinEx
  {
    name: 'CoinEx',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://api.coinex.com/v2/futures/ticker?market=');
      if (!res.ok) return [];
      const json = await res.json();
      if (json.code !== 0 || !Array.isArray(json.data)) return [];
      return json.data
        .filter((t: any) => t.market.endsWith('USDT'))
        .map((ticker: any) => {
          const lastPrice = parseFloat(ticker.last) || 0;
          const openPrice = parseFloat(ticker.open) || lastPrice;
          const changePercent = openPrice > 0 ? ((lastPrice - openPrice) / openPrice) * 100 : 0;
          return {
            symbol: ticker.market.replace('USDT', ''),
            exchange: 'CoinEx',
            lastPrice,
            price: lastPrice,
            priceChangePercent24h: changePercent,
            changePercent24h: changePercent,
            high24h: parseFloat(ticker.high) || 0,
            low24h: parseFloat(ticker.low) || 0,
            volume24h: parseFloat(ticker.volume) || 0,
            quoteVolume24h: parseFloat(ticker.value) || 0,
          };
        })
        .filter((item: any) => item.lastPrice > 0);
    },
  },

  // Crypto.com
  {
    name: 'Crypto.com',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://api.crypto.com/exchange/v1/public/get-tickers');
      if (!res.ok) return [];
      const json = await res.json();
      const items = json.result?.data || [];
      return items
        .filter((t: any) => t.i && t.i.endsWith('USD-PERP'))
        .map((ticker: any) => {
          const lastPrice = parseFloat(ticker.a) || 0;
          return {
            symbol: ticker.i.replace('USD-PERP', ''),
            exchange: 'Crypto.com',
            lastPrice,
            price: lastPrice,
            priceChangePercent24h: (parseFloat(ticker.c) || 0) * 100,
            changePercent24h: (parseFloat(ticker.c) || 0) * 100,
            high24h: parseFloat(ticker.h) || 0,
            low24h: parseFloat(ticker.l) || 0,
            volume24h: parseFloat(ticker.v) || 0,
            quoteVolume24h: parseFloat(ticker.vv) || 0,
          };
        })
        .filter((item: any) => item.lastPrice > 0);
    },
  },
];
