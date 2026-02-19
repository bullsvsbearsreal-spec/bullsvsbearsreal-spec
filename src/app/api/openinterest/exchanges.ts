import { ExchangeFetcherConfig } from '../_shared/exchange-fetchers';
import { isCryptoSymbol } from '../_shared/fetch';

type OIData = {
  symbol: string;
  exchange: string;
  openInterest: number;
  openInterestValue: number;
};

export const oiFetchers: ExchangeFetcherConfig<OIData>[] = [
  // Binance - Two-step: ticker for prices, then individual OI (batched to avoid rate limits)
  {
    name: 'Binance',
    fetcher: async (fetchFn) => {
      const tickerRes = await fetchFn('https://fapi.binance.com/fapi/v1/ticker/24hr');
      if (!tickerRes.ok) return [];
      const tickerData = await tickerRes.json();
      const topSymbols = tickerData
        .filter((t: any) => t.symbol.endsWith('USDT') && isCryptoSymbol(t.symbol.replace('USDT', '')))
        .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
        .slice(0, 100);

      // Process in batches of 25 to stay well within Binance rate limits (1,200 req/min)
      const BATCH_SIZE = 25;
      const results: OIData[] = [];

      for (let i = 0; i < topSymbols.length; i += BATCH_SIZE) {
        const batch = topSymbols.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (ticker: any) => {
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
          })
        );
        results.push(...batchResults.filter(Boolean) as OIData[]);
      }

      return results;
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
  // oi = contracts, oiCcy = base currency amount — use oiCcy for correct values
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
          const oiBase = parseFloat(item.oiCcy) || 0;
          const price = priceMap.get(item.instId) || 0;
          return {
            symbol: item.instId.replace('-USDT-SWAP', ''),
            exchange: 'OKX',
            openInterest: oiBase,
            openInterestValue: oiBase * price,
          };
        });
    },
  },

  // Bitget — use tickers endpoint which has holdingAmount (base currency OI)
  {
    name: 'Bitget',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://api.bitget.com/api/v2/mix/market/tickers?productType=USDT-FUTURES');
      if (!res.ok) return [];
      const json = await res.json();
      if (json.code !== '00000' || !Array.isArray(json.data)) return [];
      return json.data
        .filter((t: any) => t.symbol.endsWith('USDT') && t.holdingAmount)
        .map((item: any) => {
          const oiCoins = parseFloat(item.holdingAmount) || 0;
          const price = parseFloat(item.lastPr) || parseFloat(item.markPrice) || 0;
          return {
            symbol: item.symbol.replace('USDT', ''),
            exchange: 'Bitget',
            openInterest: oiCoins,
            openInterestValue: oiCoins * price,
          };
        });
    },
  },

  // Hyperliquid
  {
    name: 'Hyperliquid',
    fetcher: async (fetchFn) => {
      const res = await fetchFn(`https://api.hyperliquid.xyz/info?_t=${Date.now()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
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

  // dYdX — exclude forex pairs (EUR-USD, GBP-USD, etc.)
  {
    name: 'dYdX',
    fetcher: async (fetchFn) => {
      const DYDX_FOREX = new Set(['EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD', 'SEK', 'NOK', 'TRY', 'ZAR', 'SGD', 'HKD', 'KRW', 'MXN', 'BRL', 'TWD', 'INR']);
      const res = await fetchFn('https://indexer.dydx.trade/v4/perpetualMarkets');
      if (!res.ok) return [];
      const json = await res.json();
      if (!json.markets) return [];
      return Object.entries(json.markets)
        .filter(([key]: [string, any]) => key.endsWith('-USD'))
        .filter(([key]: [string, any]) => !DYDX_FOREX.has(key.replace('-USD', '')))
        .map(([key, market]: [string, any]) => ({
          symbol: key.replace('-USD', ''),
          exchange: 'dYdX',
          openInterest: parseFloat(market.openInterest),
          openInterestValue: parseFloat(market.openInterest) * parseFloat(market.oraclePrice),
        }))
        .filter((item: any) => item.openInterestValue > 0);
    },
  },


  // Lighter — orderBookDetails has open_interest (in base units) + last_trade_price
  {
    name: 'Lighter',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://mainnet.zklighter.elliot.ai/api/v1/orderBookDetails');
      if (!res.ok) return [];
      const json = await res.json();
      const books = json.order_book_details || [];
      return books
        .filter((b: any) => b.market_type === 'perp' && b.status === 'active' && b.open_interest > 0)
        .map((b: any) => {
          const oi = parseFloat(b.open_interest) || 0;
          const price = parseFloat(b.last_trade_price) || 0;
          return {
            symbol: b.symbol,
            exchange: 'Lighter',
            openInterest: oi,
            openInterestValue: oi * price,
          };
        })
        .filter((item: any) => item.openInterestValue > 0);
    },
  },

  // MEXC — holdVol is in contracts, NOT coins. Need contractSize to convert.
  // Two-step: fetch contract details for multiplier, then ticker for OI + price.
  {
    name: 'MEXC',
    fetcher: async (fetchFn) => {
      const [detailRes, tickerRes] = await Promise.all([
        fetchFn('https://contract.mexc.com/api/v1/contract/detail'),
        fetchFn('https://contract.mexc.com/api/v1/contract/ticker'),
      ]);
      if (!tickerRes.ok) return [];
      const tickerJson = await tickerRes.json();
      if (!tickerJson.success || !Array.isArray(tickerJson.data)) return [];

      // Build contractSize lookup from detail endpoint
      const sizeMap = new Map<string, number>();
      if (detailRes.ok) {
        const detailJson = await detailRes.json();
        if (detailJson.success && Array.isArray(detailJson.data)) {
          detailJson.data.forEach((c: any) => {
            sizeMap.set(c.symbol, parseFloat(c.contractSize) || 1);
          });
        }
      }

      return tickerJson.data
        .filter((t: any) => t.symbol.endsWith('_USDT'))
        .map((item: any) => {
          const contracts = parseFloat(item.holdVol) || 0;
          const price = parseFloat(item.lastPrice) || 0;
          const contractSize = sizeMap.get(item.symbol) || 1;
          const oiCoins = contracts * contractSize;
          return {
            symbol: item.symbol.replace('_USDT', ''),
            exchange: 'MEXC',
            openInterest: oiCoins,
            openInterestValue: oiCoins * price,
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

  // BingX — ticker has no OI field. Use per-symbol OI endpoint.
  // openInterest value from API is already in USDT.
  {
    name: 'BingX',
    fetcher: async (fetchFn) => {
      // Step 1: Get symbol list and prices from ticker
      const tickerRes = await fetchFn('https://open-api.bingx.com/openApi/swap/v2/quote/ticker');
      if (!tickerRes.ok) return [];
      const tickerJson = await tickerRes.json();
      if (tickerJson.code !== 0 || !Array.isArray(tickerJson.data)) return [];

      const topSymbols = tickerJson.data
        .filter((t: any) => t.symbol.endsWith('-USDT') && isCryptoSymbol(t.symbol.replace('-USDT', '')))
        .sort((a: any, b: any) => parseFloat(b.quoteVolume || '0') - parseFloat(a.quoteVolume || '0'))
        .slice(0, 50);

      // Step 2: Fetch OI per symbol
      const oiPromises = topSymbols.map(async (ticker: any) => {
        try {
          const oiRes = await fetchFn(
            `https://open-api.bingx.com/openApi/swap/v2/quote/openInterest?symbol=${ticker.symbol}`,
            {},
            5000
          );
          if (!oiRes.ok) return null;
          const oiJson = await oiRes.json();
          if (oiJson.code !== 0 || !oiJson.data) return null;
          const oiValueUSD = parseFloat(oiJson.data.openInterest) || 0;
          const price = parseFloat(ticker.lastPrice) || 1;
          return {
            symbol: ticker.symbol.replace('-USDT', ''),
            exchange: 'BingX',
            openInterest: oiValueUSD / price,
            openInterestValue: oiValueUSD,
          };
        } catch { return null; }
      });
      return (await Promise.all(oiPromises)).filter((item): item is OIData => item !== null && item.openInterestValue > 0);
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


  // KuCoin — openInterest is in lots, multiply by 'multiplier' to get base currency amount
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
          const lots = parseFloat(item.openInterest) || 0;
          const multiplier = parseFloat(item.multiplier) || 1;
          const price = parseFloat(item.lastTradePrice) || parseFloat(item.markPrice) || 0;
          const oiCoins = lots * multiplier;
          let sym = item.symbol.replace('USDTM', '');
          if (sym === 'XBT') sym = 'BTC';
          return {
            symbol: sym,
            exchange: 'KuCoin',
            openInterest: oiCoins,
            openInterestValue: oiCoins * price,
          };
        });
    },
  },

  // Deribit (BTC + ETH only)
  // open_interest is in USD (each contract = $1), NOT base currency — do NOT multiply by price
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
          const oiUsd = parseFloat(r.open_interest) || 0;
          const price = parseFloat(r.mark_price) || 1;
          return {
            symbol: inst.replace('-PERPETUAL', ''),
            exchange: 'Deribit',
            openInterest: oiUsd / price,  // Convert USD to base currency
            openInterestValue: oiUsd,      // Already in USD
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

  // Bitfinex — deriv status: [18]=OPEN_INTEREST (base currency), [15]=MARK_PRICE, [3]=DERIV_PRICE
  // Note: [6] is INSURANCE_FUND_BALANCE, NOT openInterestValue
  {
    name: 'Bitfinex',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://api-pub.bitfinex.com/v2/status/deriv?keys=ALL');
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data
        .filter((item: any) => Array.isArray(item) && typeof item[0] === 'string' && item[0].endsWith('F0:USTF0'))
        .map((item: any) => {
          const oi = parseFloat(item[18]) || 0;
          const price = parseFloat(item[15]) || parseFloat(item[3]) || 0;
          return {
            symbol: item[0].replace('t', '').replace('F0:USTF0', ''),
            exchange: 'Bitfinex',
            openInterest: oi,
            openInterestValue: oi * price,
          };
        })
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
        .filter((t: any) => (t.type === 'PERP' || t.instrument_type === 'PERP') && (t.open_interest || t.base_open_interest))
        .map((item: any) => {
          const oi = parseFloat(item.open_interest) || parseFloat(item.base_open_interest) || 0;
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

  // CME Group (via CoinGecko derivatives API — institutional BTC/ETH futures)
  {
    name: 'CME',
    fetcher: async (fetchFn) => {
      try {
        const res = await fetchFn(
          'https://api.coingecko.com/api/v3/derivatives/exchanges/cme_group?include_tickers=unexpired',
          {},
          10000,
        );
        if (!res.ok) return [];
        const json = await res.json();
        const tickers = json.tickers || [];
        if (!Array.isArray(tickers) || tickers.length === 0) return [];

        // Aggregate OI by base currency (BTC, ETH)
        const oiMap = new Map<string, { oi: number; price: number }>();
        tickers.forEach((t: any) => {
          const base = (t.base || '').toUpperCase();
          if (!['BTC', 'ETH'].includes(base)) return;
          const oiUsd = parseFloat(t.open_interest_usd) || 0;
          const price = parseFloat(t.last) || parseFloat(t.converted_last?.usd) || 0;
          if (oiUsd <= 0) return;
          const existing = oiMap.get(base);
          if (existing) {
            existing.oi += oiUsd;
            if (price > 0) existing.price = price; // Use latest price
          } else {
            oiMap.set(base, { oi: oiUsd, price });
          }
        });

        const results: OIData[] = [];
        oiMap.forEach(({ oi, price }, symbol) => {
          results.push({
            symbol,
            exchange: 'CME',
            openInterest: price > 0 ? oi / price : 0,
            openInterestValue: oi,
          });
        });
        return results;
      } catch {
        return [];
      }
    },
  },

  // Bitunix — no public OI endpoint available (tickers don't include open interest)

  // Drift Protocol (Solana DEX) — uses Data API with pre-parsed values
  {
    name: 'Drift',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://data.api.drift.trade/stats/markets', {}, 12000);
      if (!res.ok) return [];
      const json = await res.json();
      const markets: any[] = json?.markets || [];

      const results: OIData[] = [];
      for (const m of markets) {
        try {
          if (m.marketType !== 'perp') continue;

          let symbol = (m.symbol || '').replace('-PERP', '');
          if (!symbol) continue;
          if (symbol.startsWith('1M')) symbol = symbol.slice(2);

          const price = parseFloat(m.oraclePrice) || 0;
          if (price <= 0) continue;

          // OI values are in base asset units (e.g., SOL count)
          const oiLong = Math.abs(parseFloat(m.openInterest?.long) || 0);
          const oiShort = Math.abs(parseFloat(m.openInterest?.short) || 0);
          const totalOI = oiLong + oiShort;
          const oiValue = totalOI * price;
          if (oiValue < 1000) continue;

          results.push({
            symbol,
            exchange: 'Drift',
            openInterest: totalOI,
            openInterestValue: oiValue,
          });
        } catch {
          continue;
        }
      }
      return results;
    },
  },

  // GMX V2 (Arbitrum DEX) — OI values are BigInt strings at 1e30 precision, directly in USD
  {
    name: 'GMX',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://arbitrum-api.gmxinfra.io/markets/info', {}, 12000);
      if (!res.ok) return [];
      const json = await res.json();
      const markets = json.markets || [];

      const perpMarkets = markets.filter((m: any) =>
        m.name &&
        !m.name.includes('SWAP') &&
        !m.name.includes('(deprecated)') &&
        m.isListed
      );

      // Deduplicate by symbol, keep highest OI
      const bestBySymbol = new Map<string, { symbol: string; oiLong: number; oiShort: number; totalOi: number }>();
      for (const m of perpMarkets) {
        const symbol = m.name.split('/')[0].replace(/\.v\d+$/i, ''); // XAUT.v2 → XAUT
        const oiLong = Number(BigInt(m.openInterestLong || '0')) / 1e30;
        const oiShort = Number(BigInt(m.openInterestShort || '0')) / 1e30;
        const totalOi = oiLong + oiShort;
        const existing = bestBySymbol.get(symbol);
        if (!existing || totalOi > existing.totalOi) {
          bestBySymbol.set(symbol, { symbol, oiLong, oiShort, totalOi });
        }
      }

      return Array.from(bestBySymbol.values())
        .filter(({ totalOi }) => totalOi > 1000) // Filter tiny markets
        .map(({ symbol, totalOi }) => ({
          symbol,
          exchange: 'GMX',
          openInterest: totalOi, // Already in USD
          openInterestValue: totalOi,
        }));
    },
  },

  // Extended (Starknet DEX) — /markets returns OI in USD and base asset for all markets
  {
    name: 'Extended',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://api.starknet.extended.exchange/api/v1/info/markets', {}, 12000);
      if (!res.ok) return [];
      const json = await res.json();
      const data = json?.data || json;
      if (!Array.isArray(data)) return [];
      return data
        .filter((m: any) => m.active && m.status === 'ACTIVE' && m.marketStats?.openInterest)
        .map((m: any) => {
          let symbol = m.assetName || m.name?.split('-')[0] || '';
          if (symbol.startsWith('1000')) symbol = symbol.slice(4);
          // Filter non-crypto (forex, commodities, equities)
          const category = (m.category || '').toLowerCase();
          if (['forex', 'equities', 'commodities'].some(c => category.includes(c))) return null;
          if (!isCryptoSymbol(symbol)) return null;

          const oiValue = parseFloat(m.marketStats.openInterest) || 0;
          const oiBase = parseFloat(m.marketStats.openInterestBase) || 0;
          return {
            symbol,
            exchange: 'Extended',
            openInterest: oiBase,
            openInterestValue: oiValue, // Already in USD
          };
        })
        .filter((item: any) => item && item.openInterestValue > 0);
    },
  },

  // edgeX (StarkEx DEX) — per-contract ticker calls, OI in base asset units
  {
    name: 'edgeX',
    fetcher: async (fetchFn) => {
      // Step 1: Get metadata for active contract list
      const metaRes = await fetchFn('https://pro.edgex.exchange/api/v1/public/meta/getMetaData', {}, 12000);
      if (!metaRes.ok) return [];
      const meta = await metaRes.json();
      if (meta.code !== 'SUCCESS') return [];
      const contracts = (meta.data?.contractList || []).filter(
        (c: any) => c.enableTrade && c.enableDisplay && !c.contractName.startsWith('TEMP') && !c.isStock
      );
      if (contracts.length === 0) return [];

      // Step 2: Fetch tickers in parallel batches of 20
      const BATCH_SIZE = 20;
      const results: OIData[] = [];
      for (let i = 0; i < contracts.length; i += BATCH_SIZE) {
        const batch = contracts.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (c: any) => {
            try {
              const tickerRes = await fetchFn(
                `https://pro.edgex.exchange/api/v1/public/quote/getTicker?contractId=${c.contractId}`,
                {},
                8000
              );
              if (!tickerRes.ok) return null;
              const tickerJson = await tickerRes.json();
              if (tickerJson.code !== 'SUCCESS' || !tickerJson.data?.[0]) return null;
              const t = tickerJson.data[0];

              let symbol = c.contractName.replace(/USD$/, '');
              // Skip duplicate "2" suffix contracts
              if (symbol.endsWith('2') && symbol.length > 2) {
                const base = symbol.slice(0, -1);
                if (contracts.some((other: any) => other.contractName === base + 'USD' && other.contractId !== c.contractId)) {
                  return null;
                }
                symbol = base;
              }
              if (symbol.startsWith('1000000')) symbol = symbol.slice(7);
              else if (symbol.startsWith('1000')) symbol = symbol.slice(4);

              if (!isCryptoSymbol(symbol)) return null;

              const oiBase = parseFloat(t.openInterest) || 0;
              const price = parseFloat(t.lastPrice) || 0;
              return {
                symbol,
                exchange: 'edgeX',
                openInterest: oiBase,
                openInterestValue: oiBase * price,
              };
            } catch {
              return null;
            }
          })
        );
        results.push(...batchResults.filter(Boolean) as OIData[]);
      }
      return results.filter(item => item.openInterestValue > 0);
    },
  },

  // Variational (Arbitrum DEX) — /metadata/stats has long+short OI in USD
  {
    name: 'Variational',
    fetcher: async (fetchFn) => {
      const res = await fetchFn(
        'https://omni-client-api.prod.ap-northeast-1.variational.io/metadata/stats',
        {},
        12000
      );
      if (!res.ok) return [];
      const data = await res.json();
      const listings = data?.listings;
      if (!Array.isArray(listings)) return [];
      return listings
        .filter((m: any) => m.ticker && m.open_interest && m.mark_price)
        .map((m: any) => {
          let symbol = m.ticker;
          if (symbol.startsWith('1000')) symbol = symbol.slice(4);
          if (!isCryptoSymbol(symbol)) return null;

          const longOi = parseFloat(m.open_interest?.long_open_interest) || 0;
          const shortOi = parseFloat(m.open_interest?.short_open_interest) || 0;
          const totalOi = longOi + shortOi;
          const price = parseFloat(m.mark_price) || 0;
          return {
            symbol,
            exchange: 'Variational',
            openInterest: price > 0 ? totalOi / price : 0, // Convert USD → base units
            openInterestValue: totalOi, // Already in USD
          };
        })
        .filter((item: any) => item && item.openInterestValue > 1000); // Filter tiny markets
    },
  },

];
