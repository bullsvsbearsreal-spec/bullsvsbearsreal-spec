import { ExchangeFetcherConfig } from '../_shared/exchange-fetchers';
import { fetchWithTimeout, isCryptoSymbol } from '../_shared/fetch';
import { normalizeSymbol, GTRADE_GROUP_ASSET_CLASS, type AssetClass } from './normalize';

type FundingData = {
  symbol: string;
  exchange: string;
  fundingRate: number;
  fundingRateLong?: number;  // Separate long-side rate (skew-based DEXes: gTrade, GMX)
  fundingRateShort?: number; // Separate short-side rate (skew-based DEXes: gTrade, GMX)
  predictedRate?: number; // Predicted/next funding rate (where available)
  markPrice: number;
  indexPrice: number;
  nextFundingTime: number;
  fundingInterval?: '1h' | '4h' | '8h'; // Settlement interval (default: 8h)
  type?: 'cex' | 'dex'; // CEX vs DEX classification
  assetClass?: 'crypto' | 'stocks' | 'forex' | 'commodities';
};

export const fundingFetchers: ExchangeFetcherConfig<FundingData>[] = [
  // Binance
  {
    name: 'Binance',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://fapi.binance.com/fapi/v1/premiumIndex');
      if (!res.ok) return [];
      const data = await res.json();
      return data
        .filter((item: any) => item.symbol.endsWith('USDT') && item.lastFundingRate != null)
        .map((item: any) => ({
          symbol: item.symbol.replace('USDT', ''),
          exchange: 'Binance',
          fundingRate: parseFloat(item.lastFundingRate) * 100,
          fundingInterval: '8h' as const,
          markPrice: parseFloat(item.markPrice),
          indexPrice: parseFloat(item.indexPrice),
          nextFundingTime: item.nextFundingTime,
          type: 'cex' as const,
        }))
        .filter((item: any) => !isNaN(item.fundingRate));
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
        .filter((t: any) => t.symbol.endsWith('USDT') && t.fundingRate != null)
        .map((item: any) => ({
          symbol: item.symbol.replace('USDT', ''),
          exchange: 'Bybit',
          fundingRate: parseFloat(item.fundingRate) * 100,
          fundingInterval: '8h' as const,
          markPrice: parseFloat(item.markPrice),
          indexPrice: parseFloat(item.indexPrice),
          nextFundingTime: parseInt(item.nextFundingTime) || Date.now(),
          type: 'cex' as const,
        }))
        .filter((item: any) => !isNaN(item.fundingRate));
    },
  },

  // OKX - Two-step: instruments + batch mark prices, then individual funding rates
  {
    name: 'OKX',
    fetcher: async (fetchFn) => {
      // Batch-fetch instruments and mark prices in parallel
      const [instrumentsRes, markPriceRes] = await Promise.all([
        fetchFn('https://www.okx.com/api/v5/public/instruments?instType=SWAP'),
        fetchFn('https://www.okx.com/api/v5/public/mark-price?instType=SWAP'),
      ]);
      if (!instrumentsRes.ok) return [];
      const instrumentsJson = await instrumentsRes.json();
      if (instrumentsJson.code !== '0') return [];

      // Build mark price lookup from batch endpoint
      const markPriceMap = new Map<string, number>();
      if (markPriceRes.ok) {
        const markJson = await markPriceRes.json();
        if (markJson.code === '0' && markJson.data) {
          for (const mp of markJson.data) {
            markPriceMap.set(mp.instId, parseFloat(mp.markPx) || 0);
          }
        }
      }

      const usdtSwaps = instrumentsJson.data
        .filter((inst: any) => inst.instId.endsWith('-USDT-SWAP'))
        .slice(0, 50);

      const fundingPromises = usdtSwaps.map(async (inst: any) => {
        try {
          const frRes = await fetchFn(
            `https://www.okx.com/api/v5/public/funding-rate?instId=${encodeURIComponent(inst.instId)}`,
            {},
            5000
          );
          if (frRes.ok) {
            const frJson = await frRes.json();
            if (frJson.code === '0' && frJson.data.length > 0) {
              const fr = frJson.data[0];
              const markPrice = markPriceMap.get(inst.instId) || 0;
              const predictedRate = fr.nextFundingRate
                ? parseFloat(fr.nextFundingRate) * 100
                : undefined;
              return {
                symbol: inst.instId.replace('-USDT-SWAP', ''),
                exchange: 'OKX',
                fundingRate: parseFloat(fr.fundingRate) * 100,
                fundingInterval: '8h' as const,
                predictedRate,
                markPrice,
                indexPrice: markPrice, // OKX mark ≈ index for USDT-margined swaps
                nextFundingTime: parseInt(fr.nextFundingTime) || Date.now(),
                type: 'cex' as const,
              };
            }
          }
        } catch {
          return null;
        }
        return null;
      });
      return (await Promise.all(fundingPromises)).filter(
        (item: any) => item && !isNaN(item.fundingRate)
      );
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
        .filter((item: any) => item.symbol.endsWith('USDT'))
        .map((item: any) => ({
          symbol: item.symbol.replace('USDT', ''),
          exchange: 'Bitget',
          fundingRate: parseFloat(item.fundingRate) * 100,
          fundingInterval: '8h' as const,
          markPrice: parseFloat(item.markPrice),
          indexPrice: parseFloat(item.indexPrice),
          nextFundingTime: parseInt(item.nextFundingTime) || Date.now(),
          type: 'cex' as const,
        }))
        .filter((item: any) => !isNaN(item.fundingRate));
    },
  },

  // Hyperliquid (DEX) — funding settles HOURLY; return native 1h rate
  {
    name: 'Hyperliquid',
    fetcher: async (_fetchFn) => {
      // Direct fetch for POST — Edge Runtime handles POST better without fetchWithTimeout wrapper
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        // Cache-busting: Hyperliquid's CDN can serve stale data to datacenter IPs.
        // Use unique nonce in body + no-cache headers + Next.js no-store to force fresh response.
        const res = await fetch(`https://api.hyperliquid.xyz/info?_t=${Date.now()}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
          body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
          signal: controller.signal,
          cache: 'no-store' as RequestCache,
        });
        clearTimeout(timeout);
        if (!res.ok) return [];
        const json = await res.json();
        if (!json || !Array.isArray(json) || !json[1]) return [];
        const universe = json[0]?.universe || [];
        return json[1]
          .map((item: any, index: number) => {
            const fundingRaw = parseFloat(item.funding);
            if (isNaN(fundingRaw)) return null;
            return {
              symbol: universe[index]?.name || `ASSET${index}`,
              exchange: 'Hyperliquid',
              fundingRate: fundingRaw * 100, // native 1h fraction → %
              fundingInterval: '1h' as const,
              markPrice: parseFloat(item.markPx) || 0,
              indexPrice: parseFloat(item.oraclePx) || 0,
              nextFundingTime: Date.now() + 3600000,
              type: 'dex' as const,
            };
          })
          .filter(Boolean);
      } catch {
        clearTimeout(timeout);
        return [];
      }
    },
  },

  // dYdX v4 (DEX) — funding settles HOURLY; return native 1h rate
  {
    name: 'dYdX',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://indexer.dydx.trade/v4/perpetualMarkets', {}, 12000);
      if (!res.ok) return [];
      const json = await res.json();
      if (!json.markets) return [];
      return Object.entries(json.markets)
        .filter(([key, market]: [string, any]) =>
          key.endsWith('-USD') && market.status === 'ACTIVE'
        )
        .map(([key, market]: [string, any]) => {
          const rate = parseFloat(market.nextFundingRate);
          if (isNaN(rate)) return null;
          const normalized = normalizeSymbol(key, 'dydx');
          return {
            symbol: normalized.symbol,
            exchange: 'dYdX',
            fundingRate: rate * 100, // native 1h fraction → %
            fundingInterval: '1h' as const,
            markPrice: parseFloat(market.oraclePrice) || 0,
            indexPrice: parseFloat(market.oraclePrice) || 0,
            nextFundingTime: Date.now() + 3600000,
            type: 'dex' as const,
            assetClass: normalized.assetClass,
          };
        })
        .filter(Boolean)
        // Keep 0% rates — a zero funding rate is valid data (balanced market)
        .filter((item: any) => item.assetClass !== 'forex'); // dYdX forex pairs are illiquid — exclude
    },
  },

  // Aster DEX — stocks, forex, commodities + crypto
  {
    name: 'Aster',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://fapi.asterdex.com/fapi/v1/premiumIndex');
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data
        .filter((item: any) => item.symbol && item.lastFundingRate != null)
        .map((item: any) => {
          const normalized = normalizeSymbol(item.symbol, 'aster');
          return {
            symbol: normalized.symbol,
            exchange: 'Aster',
            fundingRate: parseFloat(item.lastFundingRate) * 100,
            fundingInterval: '8h' as const,
            markPrice: parseFloat(item.markPrice || '0'),
            indexPrice: parseFloat(item.indexPrice || '0'),
            nextFundingTime: parseInt(item.nextFundingTime) || Date.now() + 28800000,
            type: 'dex' as const,
            assetClass: normalized.assetClass,
          };
        })
        .filter((item: any) => !isNaN(item.fundingRate));
    },
  },

  // Lighter — stocks, forex, commodities + crypto
  // Lighter settles hourly but their API returns 8h-normalized rates
  // (confirmed: UI shows rate/8 as "1h", and rate*3*365 matches UI annualized)
  {
    name: 'Lighter',
    fetcher: async (fetchFn) => {
      // Fetch funding rates + orderBookDetails (for prices & OI) in parallel
      const [ratesRes, detailsRes] = await Promise.all([
        fetchFn('https://mainnet.zklighter.elliot.ai/api/v1/funding-rates'),
        fetchFn('https://mainnet.zklighter.elliot.ai/api/v1/orderBookDetails').catch(() => null),
      ]);
      if (!ratesRes.ok) return [];
      const data = await ratesRes.json();
      const fundingRates = data.funding_rates || data;
      if (!Array.isArray(fundingRates)) return [];

      // Build price/OI lookup from orderBookDetails
      const priceMap: Record<string, { price: number; oi: number }> = {};
      if (detailsRes && detailsRes.ok) {
        try {
          const details = await detailsRes.json();
          const books = details.order_book_details || [];
          for (const b of books) {
            if (b.symbol && b.last_trade_price) {
              priceMap[b.symbol] = {
                price: parseFloat(b.last_trade_price) || 0,
                oi: parseFloat(b.open_interest) || 0,
              };
            }
          }
        } catch { /* ignore */ }
      }

      return fundingRates
        .filter((item: any) => item.exchange === 'lighter' && item.symbol)
        .map((item: any) => {
          const normalized = normalizeSymbol(item.symbol, 'lighter');
          const market = priceMap[item.symbol] || { price: 0, oi: 0 };
          return {
            symbol: normalized.symbol,
            exchange: 'Lighter',
            fundingRate: (parseFloat(item.rate || '0') * 100) / 8, // API returns 8h-normalized; divide by 8 for native 1h rate
            fundingInterval: '1h' as const,
            markPrice: market.price,
            indexPrice: market.price,
            nextFundingTime: Date.now() + 3600000,
            type: 'dex' as const,
            assetClass: normalized.assetClass,
          };
        })
        .filter((item: any) => !isNaN(item.fundingRate));
    },
  },

  // Aevo (DEX) — funding settles HOURLY; return native 1h rate
  {
    name: 'Aevo',
    fetcher: async (fetchFn) => {
      // Top symbols to query — Aevo requires per-instrument calls
      const AEVO_SYMBOLS = [
        'BTC', 'ETH', 'SOL', 'DOGE', 'XRP', 'AVAX', 'LINK', 'ARB',
        'OP', 'SUI', 'NEAR', 'PEPE', 'WIF', 'TIA', 'SEI', 'JUP',
        'W', 'ONDO', 'TON', 'ADA', 'DOT', 'MATIC',
      ];
      const results = await Promise.all(
        AEVO_SYMBOLS.map(async (sym) => {
          try {
            const res = await fetchFn(
              `https://api.aevo.xyz/funding?instrument_name=${sym}-PERP`,
              {},
              6000
            );
            if (!res.ok) return null;
            const data = await res.json();
            const rate = parseFloat(data.funding_rate);
            if (isNaN(rate)) return null;
            return {
              symbol: sym,
              exchange: 'Aevo',
              fundingRate: rate * 100, // native 1h fraction → %
              fundingInterval: '1h' as const,
              markPrice: 0,
              indexPrice: 0,
              nextFundingTime: parseInt(data.next_epoch) / 1e6 || Date.now() + 3600000,
              type: 'dex' as const,
            };
          } catch {
            return null;
          }
        })
      );
      return results.filter(Boolean) as FundingData[];
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
        .filter((item: any) => item.symbol.endsWith('_USDT') && item.fundingRate != null)
        .map((item: any) => ({
          symbol: item.symbol.replace('_USDT', ''),
          exchange: 'MEXC',
          fundingRate: parseFloat(item.fundingRate) * 100,
          fundingInterval: '8h' as const,
          markPrice: parseFloat(item.fairPrice) || 0,
          indexPrice: parseFloat(item.indexPrice) || 0,
          nextFundingTime: item.nextSettlementTime || Date.now() + 28800000,
          type: 'cex' as const,
        }))
        .filter((item: any) => !isNaN(item.fundingRate));
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
        .filter((item: any) => item.symbol.startsWith('PF_') && item.symbol.endsWith('USD') && item.fundingRate != null && item.markPrice > 0)
        .map((item: any) => {
          let sym = item.symbol.replace('PF_', '').replace('USD', '');
          if (sym === 'XBT') sym = 'BTC';
          const markPrice = parseFloat(item.markPrice) || 0;
          // Kraken fundingRate is ABSOLUTE (per contract unit), not relative
          // Convert to relative rate: fundingRate / markPrice, then * 100 for percentage
          // Kraken settles every 4h; keep native 4h rate (no normalization)
          const absoluteRate = parseFloat(item.fundingRate);
          const relativeRate = markPrice > 0 ? (absoluteRate / markPrice) : 0;
          return {
            symbol: sym,
            exchange: 'Kraken',
            fundingRate: relativeRate * 100,
            fundingInterval: '4h' as const,
            markPrice,
            indexPrice: parseFloat(item.indexPrice) || 0,
            nextFundingTime: Date.now() + 14400000,
            type: 'cex' as const,
          };
        })
        .filter((item: any) => !isNaN(item.fundingRate) && isCryptoSymbol(item.symbol));
    },
  },

  // BingX — includes tokenized stocks (NCSK*)
  {
    name: 'BingX',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://open-api.bingx.com/openApi/swap/v2/quote/premiumIndex');
      if (!res.ok) return [];
      const json = await res.json();
      if (json.code !== 0 || !Array.isArray(json.data)) return [];
      return json.data
        .filter((item: any) => item.symbol.endsWith('-USDT') && item.lastFundingRate != null)
        .map((item: any) => {
          const rawSymbol = item.symbol.replace('-USDT', '');
          const normalized = normalizeSymbol(rawSymbol, 'bingx');
          return {
            symbol: normalized.symbol,
            exchange: 'BingX',
            fundingRate: parseFloat(item.lastFundingRate) * 100,
            fundingInterval: '8h' as const,
            markPrice: parseFloat(item.markPrice) || 0,
            indexPrice: parseFloat(item.indexPrice) || 0,
            nextFundingTime: item.nextFundingTime || Date.now() + 28800000,
            type: 'cex' as const,
            assetClass: normalized.assetClass,
          };
        })
        .filter((item: any) => !isNaN(item.fundingRate));
    },
  },

  // Phemex — includes stock perps (TSLA, AAPL, NVDA, etc.) and commodities (XAU, XAG)
  {
    name: 'Phemex',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://api.phemex.com/md/v2/ticker/24hr/all');
      if (!res.ok) return [];
      const json = await res.json();
      const phemexResult = Array.isArray(json.result) ? json.result : [];
      if (phemexResult.length === 0) return [];
      return phemexResult
        .filter((item: any) => item.symbol && item.symbol.endsWith('USDT') && item.fundingRateRr != null)
        .map((item: any) => {
          const normalized = normalizeSymbol(item.symbol, 'phemex');
          return {
            symbol: normalized.symbol,
            exchange: 'Phemex',
            fundingRate: parseFloat(item.fundingRateRr) * 100,
            fundingInterval: '8h' as const,
            markPrice: parseFloat(item.markPriceRp) || 0,
            indexPrice: parseFloat(item.indexPriceRp) || 0,
            nextFundingTime: Date.now() + 28800000,
            type: 'cex' as const,
            assetClass: normalized.assetClass,
          };
        })
        .filter((item: any) => !isNaN(item.fundingRate));
    },
  },


  // Bitunix
  {
    name: 'Bitunix',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://fapi.bitunix.com/api/v1/futures/market/funding_rate/batch');
      if (!res.ok) return [];
      const json = await res.json();
      const items = Array.isArray(json.data) ? json.data : [];
      if (items.length === 0) return [];
      return items
        .filter((item: any) => item.symbol?.endsWith('USDT') && item.fundingRate != null)
        .map((item: any) => ({
          symbol: item.symbol.replace('USDT', ''),
          exchange: 'Bitunix',
          fundingRate: parseFloat(item.fundingRate) * 100,
          fundingInterval: '8h' as const,
          markPrice: parseFloat(item.markPrice) || 0,
          indexPrice: parseFloat(item.lastPrice) || 0,
          nextFundingTime: parseInt(item.nextFundingTime) || Date.now() + 28800000,
          type: 'cex' as const,
        }))
        .filter((item: any) => !isNaN(item.fundingRate));
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
      const items = json.data || [];
      return items
        .filter((item: any) => item.symbol.endsWith('USDTM') && item.fundingFeeRate != null)
        .map((item: any) => {
          let sym = item.symbol.replace('USDTM', '');
          if (sym === 'XBT') sym = 'BTC';
          return {
            symbol: sym,
            exchange: 'KuCoin',
            fundingRate: parseFloat(item.fundingFeeRate) * 100,
            fundingInterval: '8h' as const,
            markPrice: parseFloat(item.markPrice) || 0,
            indexPrice: parseFloat(item.indexPrice) || 0,
            nextFundingTime: item.nextFundingRateTime || Date.now() + 28800000,
            type: 'cex' as const,
          };
        })
        .filter((item: any) => !isNaN(item.fundingRate));
    },
  },

  // Deribit (BTC + ETH perpetuals only)
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
          return {
            symbol: inst.replace('-PERPETUAL', ''),
            exchange: 'Deribit',
            fundingRate: (parseFloat(r.funding_8h) || 0) * 100,
            fundingInterval: '8h' as const,
            markPrice: parseFloat(r.mark_price) || 0,
            indexPrice: parseFloat(r.index_price) || 0,
            nextFundingTime: Date.now() + 3600000,
            type: 'cex' as const,
          };
        } catch { return null; }
      });
      return (await Promise.all(promises)).filter((item): item is NonNullable<typeof item> => item !== null && !isNaN(item.fundingRate)) as FundingData[];
    },
  },

  // HTX (Huobi)
  {
    name: 'HTX',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://api.hbdm.com/linear-swap-api/v1/swap_batch_funding_rate');
      if (!res.ok) return [];
      const json = await res.json();
      if (json.status !== 'ok' || !Array.isArray(json.data)) return [];
      return json.data
        .filter((item: any) => {
          const code = item.contract_code || '';
          // Only perpetual swaps (e.g. BTC-USDT), exclude dated futures (e.g. ETH-USDT-260220)
          return code.endsWith('-USDT') && !/-\d{6}$/.test(code) && item.funding_rate != null;
        })
        .map((item: any) => ({
          symbol: item.contract_code.replace('-USDT', ''),
          exchange: 'HTX',
          fundingRate: parseFloat(item.funding_rate) * 100,
          fundingInterval: '8h' as const,
          markPrice: 0,
          indexPrice: 0,
          nextFundingTime: item.next_funding_time || Date.now() + 28800000,
          type: 'cex' as const,
        }))
        .filter((item: any) => !isNaN(item.fundingRate));
    },
  },

  // Bitfinex — REST /v2/status/deriv returns flat arrays per instrument
  // Official field mapping (docs.bitfinex.com/reference/rest-public-derivatives-status):
  //   [0]=KEY, [1]=MTS, [3]=DERIV_PRICE, [4]=SPOT_PRICE, [6]=INSURANCE_FUND_BALANCE,
  //   [8]=NEXT_FUNDING_EVT_MTS, [9]=NEXT_FUNDING_ACCRUED, [10]=NEXT_FUNDING_STEP,
  //   [12]=CURRENT_FUNDING (8h rate as fraction), [15]=MARK_PRICE, [18]=OPEN_INTEREST,
  //   [22]=CLAMP_MIN, [23]=CLAMP_MAX
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
          fundingRate: (parseFloat(item[12]) || 0) * 100, // [12] = CURRENT_FUNDING (8h rate)
          fundingInterval: '8h' as const,
          markPrice: parseFloat(item[15]) || 0,
          indexPrice: parseFloat(item[4]) || 0,
          nextFundingTime: item[8] || Date.now() + 28800000,
          type: 'cex' as const,
        }))
        .filter((item: any) => !isNaN(item.fundingRate) && item.symbol.length > 0);
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
        .filter((item: any) => item.ticker_id && item.ticker_id.endsWith('_PERP') && item.funding_rate != null)
        .map((item: any) => ({
          symbol: item.ticker_id.replace('_PERP', ''),
          exchange: 'WhiteBIT',
          fundingRate: parseFloat(item.funding_rate) * 100,
          fundingInterval: '8h' as const,
          markPrice: parseFloat(item.last_price) || 0,
          indexPrice: parseFloat(item.index_price) || 0,
          nextFundingTime: item.next_funding_rate_timestamp ? item.next_funding_rate_timestamp * 1000 : Date.now() + 28800000,
          type: 'cex' as const,
        }))
        .filter((item: any) => !isNaN(item.fundingRate));
    },
  },

  // Coinbase International — funding settles HOURLY; return native 1h rate
  {
    name: 'Coinbase',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://api.international.coinbase.com/api/v1/instruments');
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data
        .filter((item: any) => (item.type === 'PERP' || item.instrument_type === 'PERP') && item.quote?.predicted_funding != null)
        .map((item: any) => ({
          symbol: item.symbol.replace('-PERP', ''),
          exchange: 'Coinbase',
          fundingRate: parseFloat(item.quote.predicted_funding) * 100, // native 1h fraction → %
          fundingInterval: '1h' as const,
          markPrice: parseFloat(item.quote?.mark_price) || 0,
          indexPrice: parseFloat(item.quote?.index_price) || 0,
          nextFundingTime: Date.now() + 3600000,
          type: 'cex' as const,
        }))
        .filter((item: any) => !isNaN(item.fundingRate));
    },
  },

  // CoinEx (ticker has OI but no funding; funding needs per-symbol calls — fetch top symbols only)
  {
    name: 'CoinEx',
    fetcher: async (fetchFn) => {
      // Get ticker data for top symbols by volume
      const tickerRes = await fetchFn('https://api.coinex.com/v2/futures/ticker?market=');
      if (!tickerRes.ok) return [];
      const tickerJson = await tickerRes.json();
      if (tickerJson.code !== 0 || !Array.isArray(tickerJson.data)) return [];
      const usdtMarkets = tickerJson.data
        .filter((t: any) => t.market.endsWith('USDT'))
        .sort((a: any, b: any) => parseFloat(b.value || '0') - parseFloat(a.value || '0'))
        .slice(0, 40);
      const promises = usdtMarkets.map(async (t: any) => {
        try {
          const res = await fetchFn(`https://api.coinex.com/v2/futures/funding-rate?market=${t.market}`, {}, 5000);
          if (!res.ok) return null;
          const json = await res.json();
          if (json.code !== 0 || !json.data) return null;
          // CoinEx returns data as array: [{latest_funding_rate, next_funding_rate, ...}]
          const frData = Array.isArray(json.data) ? json.data[0] : json.data;
          if (!frData) return null;
          const rate = parseFloat(frData.latest_funding_rate || frData.next_funding_rate || '0');
          const predictedRate = frData.next_funding_rate
            ? parseFloat(frData.next_funding_rate) * 100
            : undefined;
          return {
            symbol: t.market.replace('USDT', ''),
            exchange: 'CoinEx',
            fundingRate: rate * 100,
            fundingInterval: '8h' as const,
            predictedRate,
            markPrice: parseFloat(frData.mark_price || t.mark_price) || 0,
            indexPrice: parseFloat(t.index_price) || 0,
            nextFundingTime: frData.next_funding_time ? parseInt(frData.next_funding_time) : Date.now() + 28800000,
            type: 'cex' as const,
          };
        } catch { return null; }
      });
      return (await Promise.all(promises)).filter((item): item is NonNullable<typeof item> => item !== null && !isNaN(item.fundingRate)) as FundingData[];
    },
  },

  // gTrade (Gains Network) - velocity-based funding model, calculated from raw trading variables
  {
    name: 'gTrade',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://backend-arbitrum.gains.trade/trading-variables', {}, 8000);
      if (!res.ok) return [];
      const raw = await res.json();

      // Precision constants from gTrade smart contracts
      const PRECISION = {
        SKEW_COEFF_PER_YEAR: 1e26,
        ABS_VELOCITY_PER_YEAR_CAP: 1e7,
        ABS_RATE_PER_SECOND_CAP: 1e10,
        FUNDING_RATE_PER_SECOND_P: 1e18,
        OI_TOKEN: 1e18,
        COLLATERAL_PRECISION: 1e6, // USDC default
      };
      const ONE_YEAR = 365 * 24 * 60 * 60;

      const pairs: { from: string; to: string; groupIndex: string }[] = raw.pairs || [];
      const results: FundingData[] = [];

      // Use USDC collateral (most active for crypto trading)
      const collateral = (raw.collaterals || []).find((c: any) => c.symbol === 'USDC' && c.isActive);
      if (!collateral) return [];

      const fundingParams = collateral.fundingFees?.pairParams || [];
      const fundingData = collateral.fundingFees?.pairData || [];
      const pairOis = collateral.pairOis || [];
      const collateralPrecision = collateral.collateralConfig?.precision
        ? parseInt(collateral.collateralConfig.precision) : PRECISION.COLLATERAL_PRECISION;
      const collateralPriceUsd = collateral.prices?.collateralPriceUsd || 1;

      const currentTimestamp = Math.floor(Date.now() / 1000);

      for (let i = 0; i < Math.min(pairs.length, fundingParams.length, fundingData.length); i++) {
        try {
          const pair = pairs[i];
          if (!pair || !pair.from) continue;

          // Determine asset class from group index
          const groupIdx = parseInt(pair.groupIndex);
          const assetClass: AssetClass = GTRADE_GROUP_ASSET_CLASS[groupIdx] || 'crypto';

          const params = fundingParams[i];
          const data = fundingData[i];
          if (!params || !data) continue;

          // Check if funding fees are enabled for this pair
          if (!params.fundingFeesEnabled) continue;

          // Parse OI in tokens — skip pairs with no activity
          const oi = pairOis[i];
          const oiLongToken = oi?.token ? Number(oi.token.oiLongToken) / PRECISION.OI_TOKEN : 0;
          const oiShortToken = oi?.token ? Number(oi.token.oiShortToken) / PRECISION.OI_TOKEN : 0;
          if (oiLongToken === 0 && oiShortToken === 0) continue;

          // Parse params with contract precision
          const skewCoefficientPerYear = Number(params.skewCoefficientPerYear) / PRECISION.SKEW_COEFF_PER_YEAR;
          const absoluteVelocityPerYearCap = Number(params.absoluteVelocityPerYearCap) / PRECISION.ABS_VELOCITY_PER_YEAR_CAP;
          const absoluteRatePerSecondCap = Number(params.absoluteRatePerSecondCap) / PRECISION.ABS_RATE_PER_SECOND_CAP;
          const thetaThresholdUsd = Number(params.thetaThresholdUsd);

          // Parse pair data
          const lastFundingRatePerSecondP = Number(data.lastFundingRatePerSecondP) / PRECISION.FUNDING_RATE_PER_SECOND_P;
          const lastFundingUpdateTs = Number(data.lastFundingUpdateTs);

          // Calculate net exposure
          const netExposureToken = oiLongToken - oiShortToken;
          // Derive token price from collateral OI / token OI ratio
          const oiLongCollateral = oi?.collateral ? Number(oi.collateral.oiLongCollateral) / collateralPrecision : 0;
          const oiShortCollateral = oi?.collateral ? Number(oi.collateral.oiShortCollateral) / collateralPrecision : 0;
          const tokenPrice = ((oiLongCollateral + oiShortCollateral) * collateralPriceUsd) / (oiLongToken + oiShortToken);
          const netExposureUsd = netExposureToken * tokenPrice;

          // --- Core velocity-based funding rate calculation (from gTrade v10 SDK) ---

          // Step 1: Calculate current funding velocity per year
          let currentVelocityPerYear = 0;
          if (netExposureToken !== 0 && skewCoefficientPerYear !== 0 && absoluteVelocityPerYearCap !== 0) {
            if (Math.abs(netExposureUsd) >= thetaThresholdUsd) {
              const absVelocity = Math.abs(netExposureToken) * skewCoefficientPerYear;
              const cappedVelocity = Math.min(absVelocity, absoluteVelocityPerYearCap);
              currentVelocityPerYear = netExposureToken < 0 ? -cappedVelocity : cappedVelocity;
            }
          }

          // Step 2: Calculate current funding rate per second
          const secondsSinceLastUpdate = currentTimestamp - lastFundingUpdateTs;
          let currentFundingRatePerSecondP = lastFundingRatePerSecondP;

          if (absoluteRatePerSecondCap !== 0 && currentVelocityPerYear !== 0 && secondsSinceLastUpdate > 0) {
            const ratePerSecondCap = absoluteRatePerSecondCap * (currentVelocityPerYear < 0 ? -1 : 1);

            if (ratePerSecondCap !== lastFundingRatePerSecondP) {
              const secondsToReachCap = ((ratePerSecondCap - lastFundingRatePerSecondP) * ONE_YEAR) / currentVelocityPerYear;

              if (secondsSinceLastUpdate > secondsToReachCap) {
                currentFundingRatePerSecondP = ratePerSecondCap;
              } else {
                currentFundingRatePerSecondP = lastFundingRatePerSecondP +
                  (secondsSinceLastUpdate * currentVelocityPerYear) / ONE_YEAR;
              }
            } else {
              currentFundingRatePerSecondP = ratePerSecondCap;
            }
          }

          // Step 3: Convert per-second rate to 8h percentage
          // The "P" suffix means the rate is already a percentage fraction,
          // so we only multiply by seconds (no extra *100)
          let fundingRate8h = currentFundingRatePerSecondP * 8 * 3600;

          // gTrade's skew model: the earning side gets amplified by OI ratio.
          // Paying side rate = base rate. Earning side rate = base × (payingOI / earningOI).
          // Convention: negative rate = longs earn (shorts pay), positive = longs pay (shorts earn).
          let fundingRateLong = fundingRate8h;
          let fundingRateShort = -fundingRate8h; // short side is opposite sign
          if (fundingRate8h < 0 && oiLongToken > 0 && oiShortToken > 0) {
            // Longs earn: amplified by short/long OI ratio
            fundingRateLong = fundingRate8h * (oiShortToken / oiLongToken);
            fundingRateShort = -fundingRate8h; // shorts pay base rate (positive = cost)
          } else if (fundingRate8h > 0 && oiLongToken > 0 && oiShortToken > 0) {
            // Shorts earn: amplified by long/short OI ratio
            fundingRateLong = fundingRate8h; // longs pay base rate (positive = cost)
            fundingRateShort = -fundingRate8h * (oiLongToken / oiShortToken);
          }

          // Skip pairs with essentially zero rate
          if (Math.abs(fundingRate8h) < 0.00001) continue;

          // Build symbol — gTrade pairs are like "BTC/USD", we want "BTC"
          // For forex, construct pair symbol: EUR + USD → EURUSD
          let symbol = pair.from;
          if (assetClass === 'forex') {
            symbol = pair.from + (pair.to || 'USD');
          }

          results.push({
            symbol,
            exchange: 'gTrade',
            fundingRate: fundingRate8h,
            fundingRateLong,   // What longs pay/earn (negative = earn)
            fundingRateShort,  // What shorts pay/earn (positive = cost)
            fundingInterval: '8h' as const, // continuous model, normalized to 8h for display
            markPrice: tokenPrice,
            indexPrice: 0,
            nextFundingTime: 0, // gTrade funding is continuous, no discrete funding time
            type: 'dex' as const,
            assetClass,
          });
        } catch {
          continue;
        }
      }

      return results;
    },
  },

  // Drift Protocol (Solana DEX) — funding settles HOURLY
  // Uses the Data API which returns pre-parsed human-readable values
  {
    name: 'Drift',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://data.api.drift.trade/stats/markets', {}, 12000);
      if (!res.ok) return [];
      const json = await res.json();
      const markets: any[] = json?.markets || [];

      const results: FundingData[] = [];
      for (const m of markets) {
        try {
          if (m.marketType !== 'perp') continue;

          let symbol = (m.symbol || '').replace('-PERP', '');
          if (!symbol) continue;
          if (symbol.startsWith('1M')) symbol = symbol.slice(2);

          const price = parseFloat(m.oraclePrice) || 0;
          if (price <= 0) continue;

          // OI filter — skip tiny markets
          const oiL = Math.abs(parseFloat(m.openInterest?.long) || 0);
          const oiS = Math.abs(parseFloat(m.openInterest?.short) || 0);
          if ((oiL + oiS) * price < 1000) continue;

          // fundingRate values are already hourly percentages
          // frLong positive = longs receive; our convention: positive = longs pay
          // So negate frLong for standard convention
          const frLong = parseFloat(m.fundingRate?.long) || 0;
          if (isNaN(frLong)) continue;

          results.push({
            symbol,
            exchange: 'Drift',
            fundingRate: -frLong, // negate: Data API positive = longs receive → our positive = longs pay
            fundingInterval: '1h' as const,
            markPrice: price,
            indexPrice: price,
            nextFundingTime: Date.now() + 3600000,
            type: 'dex' as const,
          });
        } catch {
          continue;
        }
      }
      return results;
    },
  },

  // GMX V2 (Arbitrum DEX) — continuous funding; report as 1h interval
  // All numeric values are BigInt strings at 1e30 precision
  {
    name: 'GMX',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://arbitrum-api.gmxinfra.io/markets/info', {}, 12000);
      if (!res.ok) return [];
      const json = await res.json();
      const markets = json.markets || [];

      // Filter valid perp markets
      const perpMarkets = markets.filter((m: any) =>
        m.name &&
        !m.name.includes('SWAP') &&
        !m.name.includes('(deprecated)') &&
        m.isListed &&
        m.fundingRateLong
      );

      // Deduplicate: keep highest OI per symbol
      const bestBySymbol = new Map<string, { market: any; totalOi: number }>();
      for (const m of perpMarkets) {
        const symbol = m.name.split('/')[0].replace(/\.v\d+$/i, ''); // XAUT.v2 → XAUT
        const totalOi = Number(BigInt(m.openInterestLong || '0')) + Number(BigInt(m.openInterestShort || '0'));
        const existing = bestBySymbol.get(symbol);
        if (!existing || totalOi > existing.totalOi) {
          bestBySymbol.set(symbol, { market: m, totalOi });
        }
      }

      return Array.from(bestBySymbol.values())
        .map(({ market: m }) => {
          const symbol = m.name.split('/')[0].replace(/\.v\d+$/i, ''); // XAUT.v2 → XAUT
          // Annual rate at 1e30 precision -> hourly percentage
          const rateLong = Number(BigInt(m.fundingRateLong)) / 1e30 / 8760 * 100;
          const rateShort = Number(BigInt(m.fundingRateShort || '0')) / 1e30 / 8760 * 100;
          // fundingRate = long side rate (standard convention: positive = longs pay)
          const fundingRate = rateLong;
          return {
            symbol,
            exchange: 'GMX',
            fundingRate,
            fundingRateLong: rateLong,   // What longs pay/earn per hour
            fundingRateShort: rateShort,  // What shorts pay/earn per hour
            markPrice: 0, // GMX markets/info doesn't provide mark price
            indexPrice: 0,
            nextFundingTime: Date.now() + 3600000, // continuous, next "hour"
            type: 'dex' as const,
            fundingInterval: '1h' as const,
          };
        })
        .filter((item: any) => !isNaN(item.fundingRate) && item.fundingRate !== 0);
    },
  },
  // Extended (Starknet DEX) — funding settles HOURLY; return native 1h rate
  // Single /markets call returns funding + OI + prices for all 105 markets
  {
    name: 'Extended',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://api.starknet.extended.exchange/api/v1/info/markets', {}, 12000);
      if (!res.ok) return [];
      const json = await res.json();
      const data = json?.data || json; // Response is {status, data: [...]}
      if (!Array.isArray(data)) return [];
      return data
        .filter((m: any) => m.active && m.status === 'ACTIVE' && m.marketStats?.fundingRate != null)
        .map((m: any) => {
          const stats = m.marketStats;
          let symbol = m.assetName || m.name?.split('-')[0] || '';
          // Handle 1000-prefix symbols (e.g., 1000PEPE → PEPE)
          if (symbol.startsWith('1000')) symbol = symbol.slice(4);

          const norm = normalizeSymbol(symbol, 'Extended');
          const fundingRate = parseFloat(stats.fundingRate) * 100; // decimal → %

          return {
            symbol: norm.symbol,
            exchange: 'Extended',
            fundingRate,
            fundingInterval: '1h' as const,
            markPrice: parseFloat(stats.markPrice) || 0,
            indexPrice: parseFloat(stats.indexPrice) || 0,
            nextFundingTime: parseInt(stats.nextFundingRate) || Date.now() + 3600000,
            type: 'dex' as const,
            assetClass: norm.assetClass !== 'crypto' ? norm.assetClass : undefined,
          };
        })
        .filter((item: any) => !isNaN(item.fundingRate) && item.fundingRate !== 0);
    },
  },

  // edgeX (StarkEx DEX) — funding settles every 4 hours
  // Per-contract ticker calls required; fetch metadata for contract list, then batch top symbols
  {
    name: 'edgeX',
    fetcher: async (fetchFn) => {
      // Step 1: Get metadata for active contract list
      const metaRes = await fetchFn('https://pro.edgex.exchange/api/v1/public/meta/getMetaData', {}, 12000);
      if (!metaRes.ok) return [];
      const meta = await metaRes.json();
      if (meta.code !== 'SUCCESS') return [];
      const contracts = (meta.data?.contractList || []).filter(
        (c: any) => c.enableTrade && c.enableDisplay && !c.contractName.startsWith('TEMP')
      );
      if (contracts.length === 0) return [];

      // Step 2: Fire ALL ticker requests in parallel (no batching — much faster on edge)
      // Each request has a 4s timeout; we collect whatever completes in time
      const results: FundingData[] = [];
      const allResults = await Promise.all(
        contracts.map(async (c: any) => {
          try {
            const tickerRes = await fetchFn(
              `https://pro.edgex.exchange/api/v1/public/quote/getTicker?contractId=${c.contractId}`,
              {},
              4000
            );
            if (!tickerRes.ok) return null;
            const tickerJson = await tickerRes.json();
            if (tickerJson.code !== 'SUCCESS' || !tickerJson.data?.[0]) return null;
            const t = tickerJson.data[0];

            let symbol = c.contractName.replace(/USD$/, '');
            // Strip "2" suffix duplicates (e.g., BNB2 → BNB)
            if (symbol.endsWith('2') && symbol.length > 2) {
              const base = symbol.slice(0, -1);
              if (contracts.some((other: any) => other.contractName === base + 'USD' && other.contractId !== c.contractId)) {
                return null; // Skip duplicate, keep the original
              }
              symbol = base;
            }
            // Handle 1000/1000000 prefixes
            if (symbol.startsWith('1000000')) symbol = symbol.slice(7);
            else if (symbol.startsWith('1000')) symbol = symbol.slice(4);

            const isStock = c.isStock === true;
            const norm = normalizeSymbol(symbol, 'edgeX');

            return {
              symbol: norm.symbol,
              exchange: 'edgeX',
              fundingRate: parseFloat(t.fundingRate) * 100, // decimal → %
              fundingInterval: '4h' as const,
              markPrice: parseFloat(t.markPrice) || 0,
              indexPrice: parseFloat(t.indexPrice) || 0,
              nextFundingTime: parseInt(t.nextFundingTime) || Date.now() + 14400000,
              type: 'dex' as const,
              assetClass: isStock ? ('stocks' as AssetClass) : (norm.assetClass !== 'crypto' ? norm.assetClass : undefined),
            };
          } catch {
            return null;
            }
          })
        );
        results.push(...allResults.filter(Boolean) as FundingData[]);
      return results.filter(item => !isNaN(item.fundingRate));
    },
  },

  // Variational (Arbitrum DEX) — single /metadata/stats endpoint has everything
  // Funding intervals vary per market (1h, 2h, 4h, 8h)
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
        .filter((m: any) => m.ticker && m.funding_rate != null && m.mark_price)
        .map((m: any) => {
          let symbol = m.ticker;
          // Handle 1000-prefix symbols
          if (symbol.startsWith('1000')) symbol = symbol.slice(4);

          const intervalS = m.funding_interval_s || 28800;
          // Map seconds to interval label
          // 2h interval → bucket as '1h' for display (closest standard interval)
          const intervalMap: Record<number, '1h' | '4h' | '8h'> = { 3600: '1h', 7200: '1h', 14400: '4h', 28800: '8h' };
          const fundingInterval = intervalMap[intervalS] || '8h';

          // funding_rate from API is already a percentage (e.g., -0.012 means -0.012%)
          // Docs say "decimal (multiply by 100 for %)" but actual values are already %
          // Verified: BTC ≈ -0.01% per 8h matches CEX range; ×100 would be absurd
          const fundingRate = parseFloat(m.funding_rate);

          const norm = normalizeSymbol(symbol, 'Variational');

          return {
            symbol: norm.symbol,
            exchange: 'Variational',
            fundingRate,
            fundingInterval, // Keep native interval (1h, 4h, 8h)
            markPrice: parseFloat(m.mark_price) || 0,
            indexPrice: 0, // Not provided
            nextFundingTime: Date.now() + intervalS * 1000,
            type: 'dex' as const,
            assetClass: norm.assetClass !== 'crypto' ? norm.assetClass : undefined,
          };
        })
        .filter((item: any) => item && !isNaN(item.fundingRate) && item.fundingRate !== 0 && item.markPrice > 0);
    },
  },
];

// Paused exchanges (kept for reference):
// LBank - Futures domain (fapi.lbank.com) unreachable
