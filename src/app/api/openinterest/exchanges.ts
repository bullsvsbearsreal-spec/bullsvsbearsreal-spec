import { ExchangeFetcherConfig } from '../_shared/exchange-fetchers';
import { isCryptoSymbol } from '../_shared/fetch';

type OIData = {
  symbol: string;
  exchange: string;
  openInterest: number;
  openInterestValue: number;
};

export const oiFetchers: ExchangeFetcherConfig<OIData>[] = [
  // Binance - Two-step: ticker for prices, then individual OI
  {
    name: 'Binance',
    fetcher: async (fetchFn) => {
      const tickerRes = await fetchFn('https://fapi.binance.com/fapi/v1/ticker/24hr');
      if (!tickerRes.ok) return [];
      const tickerData = await tickerRes.json();
      const topSymbols = tickerData
        .filter((t: any) => t.symbol.endsWith('USDT'))
        .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
        .slice(0, 30);

      const oiPromises = topSymbols.map(async (ticker: any) => {
        try {
          const oiRes = await fetchFn(
            `https://fapi.binance.com/fapi/v1/openInterest?symbol=${ticker.symbol}`,
            {},
            5000
          );
          if (oiRes.ok) {
            const oiData = await oiRes.json();
            return {
              symbol: ticker.symbol.replace('USDT', ''),
              exchange: 'Binance',
              openInterest: parseFloat(oiData.openInterest),
              openInterestValue: parseFloat(oiData.openInterest) * parseFloat(ticker.lastPrice),
            };
          }
        } catch {
          return null;
        }
        return null;
      });
      return (await Promise.all(oiPromises)).filter(Boolean) as OIData[];
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
          openInterest: parseFloat(ticker.openInterest),
          openInterestValue: parseFloat(ticker.openInterestValue),
        }));
    },
  },

  // OKX - Two-step: OI data + prices
  {
    name: 'OKX',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://www.okx.com/api/v5/public/open-interest?instType=SWAP');
      if (!res.ok) return [];
      const json = await res.json();
      if (json.code !== '0') return [];

      const tickerRes = await fetchFn('https://www.okx.com/api/v5/market/tickers?instType=SWAP');
      const priceMap = new Map();
      if (tickerRes.ok) {
        const tickerJson = await tickerRes.json();
        if (tickerJson.code === '0') {
          tickerJson.data.forEach((t: any) => {
            priceMap.set(t.instId, parseFloat(t.last));
          });
        }
      }
      return json.data
        .filter((t: any) => t.instId.endsWith('-USDT-SWAP'))
        .map((item: any) => {
          const price = priceMap.get(item.instId) || 0;
          return {
            symbol: item.instId.replace('-USDT-SWAP', ''),
            exchange: 'OKX',
            openInterest: parseFloat(item.oi),
            openInterestValue: parseFloat(item.oi) * price,
          };
        });
    },
  },

  // Bitget - Two-step: OI data + prices
  {
    name: 'Bitget',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://api.bitget.com/api/v2/mix/market/open-interest?productType=USDT-FUTURES');
      if (!res.ok) return [];
      const json = await res.json();
      if (json.code !== '00000') return [];

      const tickerRes = await fetchFn('https://api.bitget.com/api/v2/mix/market/tickers?productType=USDT-FUTURES');
      const priceMap = new Map();
      if (tickerRes.ok) {
        const tickerJson = await tickerRes.json();
        if (tickerJson.code === '00000') {
          tickerJson.data.forEach((t: any) => {
            priceMap.set(t.symbol, parseFloat(t.lastPr));
          });
        }
      }
      return json.data
        .filter((t: any) => t.symbol.endsWith('USDT'))
        .map((item: any) => {
          const price = priceMap.get(item.symbol) || 0;
          return {
            symbol: item.symbol.replace('USDT', ''),
            exchange: 'Bitget',
            openInterest: parseFloat(item.openInterestCont),
            openInterestValue: parseFloat(item.openInterestCont) * price,
          };
        });
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
          openInterest: parseFloat(item.openInterest),
          openInterestValue: parseFloat(item.openInterest) * parseFloat(item.markPx),
        }))
        .filter((item: any) => !isNaN(item.openInterestValue) && item.openInterestValue > 0);
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
          openInterest: parseFloat(market.openInterest),
          openInterestValue: parseFloat(market.openInterest) * parseFloat(market.oraclePrice),
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
        .map((item: any) => {
          const oi = parseFloat(item.position_size) || 0;
          const price = parseFloat(item.last_price) || parseFloat(item.mark_price) || 0;
          const quantoMultiplier = parseFloat(item.quanto_multiplier) || 1;
          return {
            symbol: item.name.replace('_USDT', ''),
            exchange: 'Gate.io',
            openInterest: oi,
            openInterestValue: oi * price * quantoMultiplier,
          };
        })
        .filter((item: any) => item.openInterestValue > 0);
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
        .map((item: any) => {
          const oi = parseFloat(item.holdVol) || 0;
          const price = parseFloat(item.lastPrice) || 0;
          return {
            symbol: item.symbol.replace('_USDT', ''),
            exchange: 'MEXC',
            openInterest: oi,
            openInterestValue: oi * price,
          };
        });
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
        .filter((t: any) => t.symbol.startsWith('PF_') && t.symbol.endsWith('USD') && t.openInterest)
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
          };
        })
        .filter((item: any) => isCryptoSymbol(item.symbol));
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
        .filter((t: any) => t.symbol.endsWith('-USDT') && t.openInterest)
        .map((item: any) => {
          const oi = parseFloat(item.openInterest) || 0;
          const price = parseFloat(item.lastPrice) || 0;
          return {
            symbol: item.symbol.replace('-USDT', ''),
            exchange: 'BingX',
            openInterest: oi,
            openInterestValue: oi * price,
          };
        })
        .filter((item: any) => isCryptoSymbol(item.symbol));
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
        .filter((t: any) => t.symbol && t.symbol.endsWith('USDT') && t.openInterestRv)
        .map((item: any) => {
          const oi = parseFloat(item.openInterestRv) || 0;
          const price = parseFloat(item.closeRp || item.markPriceRp) || 0;
          return {
            symbol: item.symbol.replace('USDT', ''),
            exchange: 'Phemex',
            openInterest: oi,
            openInterestValue: oi * price,
          };
        });
    },
  },
];
