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

  // BitMEX
  {
    name: 'BitMEX',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://www.bitmex.com/api/v1/instrument/active');
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data
        .filter((t: any) => t.symbol.endsWith('USDT') && t.openInterest)
        .map((item: any) => ({
          symbol: item.symbol.replace('USDT', ''),
          exchange: 'BitMEX',
          openInterest: parseFloat(item.openInterest) || 0,
          openInterestValue: parseFloat(item.openValue) || (parseFloat(item.openInterest) * parseFloat(item.lastPrice)) || 0,
        }));
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
        .filter((t: any) => t.symbol.endsWith('USDTM') && t.openInterest)
        .map((item: any) => {
          const oi = parseFloat(item.openInterest) || 0;
          const price = parseFloat(item.lastTradePrice) || 0;
          return {
            symbol: item.symbol.replace('USDTM', ''),
            exchange: 'KuCoin',
            openInterest: oi,
            openInterestValue: oi * price,
          };
        });
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
          const oi = parseFloat(r.open_interest) || 0;
          const price = parseFloat(r.mark_price) || 0;
          return {
            symbol: inst.replace('-PERPETUAL', ''),
            exchange: 'Deribit',
            openInterest: oi,
            openInterestValue: oi * price,
          };
        } catch { return null; }
      });
      return (await Promise.all(promises)).filter((item): item is OIData => item !== null);
    },
  },

  // HTX (Huobi)
  {
    name: 'HTX',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://api.hbdm.com/linear-swap-api/v1/swap_open_interest?contract_type=swap&business_type=all');
      if (!res.ok) return [];
      const json = await res.json();
      if (json.status !== 'ok' || !Array.isArray(json.data)) return [];
      return json.data
        .filter((t: any) => {
          const code = t.contract_code || '';
          return code.endsWith('-USDT') && !/-\d{6}$/.test(code);
        })
        .map((item: any) => ({
          symbol: item.contract_code.replace('-USDT', ''),
          exchange: 'HTX',
          openInterest: parseFloat(item.amount) || 0,
          openInterestValue: parseFloat(item.value) || 0,
        }));
    },
  },

  // Bitfinex
  {
    name: 'Bitfinex',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://api-pub.bitfinex.com/v2/status/deriv?keys=ALL');
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data
        .filter((item: any) => Array.isArray(item) && typeof item[0] === 'string' && item[0].endsWith('F0:USTF0'))
        .map((item: any) => ({
          symbol: item[0].replace('t', '').replace('F0:USTF0', ''),
          exchange: 'Bitfinex',
          openInterest: parseFloat(item[18]) || 0,
          openInterestValue: parseFloat(item[6]) || 0,
        }))
        .filter((item: any) => item.openInterestValue > 0 && item.symbol.length > 0);
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
        .filter((t: any) => t.ticker_id && t.ticker_id.endsWith('_PERP') && t.open_interest)
        .map((item: any) => {
          const oi = parseFloat(item.open_interest) || 0;
          const price = parseFloat(item.last_price) || 0;
          return {
            symbol: item.ticker_id.replace('_PERP', ''),
            exchange: 'WhiteBIT',
            openInterest: oi,
            openInterestValue: oi * price,
          };
        });
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
        .filter((t: any) => t.instrument_type === 'PERP' && t.base_open_interest)
        .map((item: any) => {
          const oi = parseFloat(item.base_open_interest) || 0;
          const price = parseFloat(item.quote?.mark_price) || 0;
          return {
            symbol: item.symbol.replace('-PERP', ''),
            exchange: 'Coinbase',
            openInterest: oi,
            openInterestValue: oi * price,
          };
        });
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
        .filter((t: any) => t.market.endsWith('USDT') && t.open_interest_volume)
        .map((item: any) => {
          const oi = parseFloat(item.open_interest_volume) || 0;
          const price = parseFloat(item.last) || 0;
          return {
            symbol: item.market.replace('USDT', ''),
            exchange: 'CoinEx',
            openInterest: oi,
            openInterestValue: oi * price,
          };
        });
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
        .filter((t: any) => t.i && t.i.endsWith('USD-PERP') && t.oi)
        .map((item: any) => {
          const oi = parseFloat(item.oi) || 0;
          const price = parseFloat(item.a) || 0;
          return {
            symbol: item.i.replace('USD-PERP', ''),
            exchange: 'Crypto.com',
            openInterest: oi,
            openInterestValue: oi * price,
          };
        });
    },
  },
];
