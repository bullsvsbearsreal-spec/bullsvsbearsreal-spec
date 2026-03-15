import { ExchangeFetcherConfig } from '../_shared/exchange-fetchers';
import { fetchWithTimeout, isCryptoSymbol } from '../_shared/fetch';
import { normalizeSymbol, GTRADE_GROUP_ASSET_CLASS, type AssetClass } from './normalize';

const PROXY_BASE = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://info-hub.io';

type FundingData = {
  symbol: string;
  exchange: string;
  fundingRate: number;
  fundingRateLong?: number;  // Separate long-side rate (skew-based DEXes: gTrade, GMX)
  fundingRateShort?: number; // Separate short-side rate (skew-based DEXes: gTrade, GMX)
  borrowingRate?: number;    // Symmetric borrowing fee (gTrade) — both sides pay equally
  predictedRate?: number; // Predicted/next funding rate (where available)
  markPrice: number;
  indexPrice: number;
  nextFundingTime: number;
  fundingInterval?: '1h' | '4h' | '8h'; // Settlement interval (default: 8h)
  type?: 'cex' | 'dex'; // CEX vs DEX classification
  assetClass?: 'crypto' | 'stocks' | 'forex' | 'commodities';
  marginType?: 'linear' | 'inverse'; // USDT-margined vs coin-margined
};

export const fundingFetchers: ExchangeFetcherConfig<FundingData>[] = [
  // Binance — geo-blocked from some Vercel regions. Try direct → fallback domain → proxy.
  {
    name: 'Binance',
    fetcher: async (fetchFn) => {
      const proxyUrl = process.env.PROXY_URL;
      const urls = [
        'https://fapi.binance.com/fapi/v1/premiumIndex',
        'https://fapi.binance.me/fapi/v1/premiumIndex',
        ...(proxyUrl ? [`${proxyUrl.replace(/\/$/, '')}/?url=${encodeURIComponent('https://fapi.binance.com/fapi/v1/premiumIndex')}`] : []),
      ];
      let res: Response | null = null;
      for (const url of urls) {
        try {
          res = await fetchFn(url, {}, 8000);
          if (res.ok) break;
          res = null;
        } catch { res = null; }
      }
      if (!res || !res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data
        .filter((item: any) => item.symbol?.endsWith('USDT') && item.lastFundingRate != null)
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

  // Binance COIN-M (inverse/token-margined perps) — separate from USDT-M
  {
    name: 'Binance',
    fetcher: async (fetchFn) => {
      const proxyUrl = process.env.PROXY_URL;
      const urls = [
        'https://dapi.binance.com/dapi/v1/premiumIndex',
        'https://dapi.binance.me/dapi/v1/premiumIndex',
        ...(proxyUrl ? [`${proxyUrl.replace(/\/$/, '')}/?url=${encodeURIComponent('https://dapi.binance.com/dapi/v1/premiumIndex')}`] : []),
      ];
      try {
        let res: Response | null = null;
        for (const url of urls) {
          try {
            res = await fetchFn(url, {}, 8000);
            if (res.ok) break;
            res = null;
          } catch { res = null; }
        }
        if (!res || !res.ok) return [];
        const data = await res.json();
        if (!Array.isArray(data)) return [];
        return data
          .filter((item: any) => item.symbol?.endsWith('USD_PERP') && item.lastFundingRate != null)
          .map((item: any) => ({
            symbol: item.symbol.replace('USD_PERP', ''),
            exchange: 'Binance',
            fundingRate: parseFloat(item.lastFundingRate) * 100,
            fundingInterval: '8h' as const,
            markPrice: parseFloat(item.markPrice),
            indexPrice: parseFloat(item.indexPrice),
            nextFundingTime: item.nextFundingTime,
            type: 'cex' as const,
            marginType: 'inverse' as const,
          }))
          .filter((item: any) => !isNaN(item.fundingRate));
      } catch {
        return [];
      }
    },
  },

  // Bybit — geo-blocked from some Vercel regions. Try direct → fallback domain → proxy.
  {
    name: 'Bybit',
    fetcher: async (fetchFn) => {
      const proxyUrl = process.env.PROXY_URL;
      const urls = [
        'https://api.bybit.com/v5/market/tickers?category=linear',
        'https://api.bytick.com/v5/market/tickers?category=linear',
        ...(proxyUrl ? [`${proxyUrl.replace(/\/$/, '')}/?url=${encodeURIComponent('https://api.bybit.com/v5/market/tickers?category=linear')}`] : []),
      ];
      let res: Response | null = null;
      for (const url of urls) {
        try {
          res = await fetchFn(url, {}, 8000);
          if (res.ok) break;
          res = null;
        } catch { res = null; }
      }
      if (!res || !res.ok) return [];
      const json = await res.json();
      if (json.retCode !== 0) return [];
      return json.result.list
        .filter((t: any) => t.symbol?.endsWith('USDT') && t.fundingRate != null)
        .map((item: any) => ({
          symbol: item.symbol.replace('USDT', ''),
          exchange: 'Bybit',
          fundingRate: parseFloat(item.fundingRate) * 100,
          fundingInterval: '8h' as const,
          markPrice: parseFloat(item.markPrice),
          indexPrice: parseFloat(item.indexPrice),
          nextFundingTime: Number(item.nextFundingTime) || Date.now(),
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
        .filter((inst: any) => inst.instId.endsWith('-USDT-SWAP'));

      // Batch requests in groups of 20 to avoid overwhelming OKX API
      const BATCH_SIZE = 20;
      const results: any[] = [];
      for (let i = 0; i < usdtSwaps.length; i += BATCH_SIZE) {
        const batch = usdtSwaps.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (inst: any) => {
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
                    indexPrice: markPrice,
                    nextFundingTime: Number(fr.nextFundingTime) || Date.now(),
                    type: 'cex' as const,
                  };
                }
              }
            } catch {
              return null;
            }
            return null;
          })
        );
        results.push(...batchResults);
      }
      return results.filter(
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
          nextFundingTime: Number(item.nextFundingTime) || Date.now(),
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
        const hlHeaders = {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        };
        const hlCache = 'no-store' as RequestCache;
        // Fetch meta+asset contexts and predicted fundings in parallel
        const [metaRes, predRes] = await Promise.all([
          fetch(`https://api.hyperliquid.xyz/info?_t=${Date.now()}`, {
            method: 'POST', headers: hlHeaders,
            body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
            signal: controller.signal, cache: hlCache,
          }),
          fetch(`https://api.hyperliquid.xyz/info?_t=${Date.now()}_p`, {
            method: 'POST', headers: hlHeaders,
            body: JSON.stringify({ type: 'predictedFundings' }),
            signal: controller.signal, cache: hlCache,
          }).catch(() => null),
        ]);
        clearTimeout(timeout);
        if (!metaRes.ok) return [];
        const json = await metaRes.json();
        if (!json || !Array.isArray(json) || !json[1]) return [];
        const universe = json[0]?.universe || [];

        // Build predicted rate map: coin → rate (HlPerp venue)
        const predictedMap = new Map<string, number>();
        if (predRes && predRes.ok) {
          try {
            const predJson = await predRes.json();
            if (Array.isArray(predJson)) {
              for (const entry of predJson) {
                // Format: [coin, [[venue, {fundingRate}], ...]]
                const coin = entry[0];
                const venues = entry[1];
                if (Array.isArray(venues)) {
                  for (const [venue, data] of venues) {
                    if (venue === 'HlPerp' && data?.fundingRate) {
                      predictedMap.set(coin, parseFloat(data.fundingRate) * 100);
                      break;
                    }
                  }
                }
              }
            }
          } catch { /* ignore predicted parse errors */ }
        }

        return json[1]
          .map((item: any, index: number) => {
            const fundingRaw = parseFloat(item.funding);
            if (isNaN(fundingRaw)) return null;
            const sym = universe[index]?.name || `ASSET${index}`;
            return {
              symbol: sym,
              exchange: 'Hyperliquid',
              fundingRate: fundingRaw * 100, // native 1h fraction → %
              fundingInterval: '1h' as const,
              predictedRate: predictedMap.get(sym),
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
      const seen = new Set<string>();
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
            nextFundingTime: Number(item.nextFundingTime) || Date.now() + 28800000,
            type: 'dex' as const,
            assetClass: normalized.assetClass,
          };
        })
        .filter((item: any) => {
          if (isNaN(item.fundingRate)) return false;
          if (seen.has(item.symbol)) return false;
          seen.add(item.symbol);
          return true;
        });
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
  // Step 1: fetch /markets for all active perps (symbol discovery + mark/index prices)
  // Step 2: fire per-instrument /funding calls in batches (Aevo rate-limits concurrent requests)
  {
    name: 'Aevo',
    fetcher: async (fetchFn) => {
      // Get all active perpetual markets (single call — includes prices)
      const marketsRes = await fetchFn('https://api.aevo.xyz/markets?instrument_type=PERPETUAL', {}, 8000);
      if (!marketsRes.ok) return [];
      const markets: any[] = await marketsRes.json();
      const activeMarkets = markets.filter((m: any) => m.is_active);
      if (activeMarkets.length === 0) return [];

      // Build price map from markets response
      const priceMap = new Map<string, { mark: number; index: number }>();
      activeMarkets.forEach((m: any) => {
        priceMap.set(m.underlying_asset, {
          mark: parseFloat(m.mark_price) || 0,
          index: parseFloat(m.index_price) || 0,
        });
      });

      // Sort markets: priority symbols first, then alphabetically
      const PRIORITY = new Set(['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'AVAX', 'LINK', 'ARB', 'OP', 'SUI', 'BNB', 'ADA', 'TON', 'NEAR', 'PEPE', 'WIF', 'ONDO', 'TIA', 'SEI', 'HYPE']);
      const sorted = [...activeMarkets].sort((a, b) => {
        const ap = PRIORITY.has(a.underlying_asset) ? 0 : 1;
        const bp = PRIORITY.has(b.underlying_asset) ? 0 : 1;
        return ap - bp;
      });

      // Batch funding calls: 20 per batch with 1.2s delay between batches
      // Aevo rate-limits at ~20 concurrent requests per ~1s window
      // Cap at 80 markets (4 batches ≈ 6s) to stay within route timeout
      const BATCH_SIZE = 20;
      const MAX_MARKETS = 80;
      const capped = sorted.slice(0, MAX_MARKETS);
      const allResults: (FundingData | null)[] = [];

      for (let i = 0; i < capped.length; i += BATCH_SIZE) {
        const batch = capped.slice(i, i + BATCH_SIZE);
        if (i > 0) await new Promise(r => setTimeout(r, 1200));
        const batchResults = await Promise.all(
          batch.map(async (m: any) => {
            try {
              const res = await fetchFn(
                `https://api.aevo.xyz/funding?instrument_name=${m.instrument_name}`,
                {},
                5000
              );
              if (!res.ok) return null;
              const data = await res.json();
              const rate = parseFloat(data.funding_rate);
              if (isNaN(rate)) return null;

              let symbol = m.underlying_asset;
              // Handle 1000/10000 prefix tokens
              if (symbol.startsWith('1000000')) symbol = symbol.slice(7);
              else if (symbol.startsWith('10000')) symbol = symbol.slice(5);
              else if (symbol.startsWith('1000')) symbol = symbol.slice(4);

              const prices = priceMap.get(m.underlying_asset);
              const isStock = m.market_type === 'stock' || m.market_type === 'rwa';
              const norm = normalizeSymbol(symbol, 'Aevo');

              return {
                symbol: norm.symbol,
                exchange: 'Aevo',
                fundingRate: rate * 100, // native 1h fraction → %
                fundingInterval: '1h' as const,
                markPrice: prices?.mark || 0,
                indexPrice: prices?.index || 0,
                nextFundingTime: parseInt(data.next_epoch) / 1e6 || Date.now() + 3600000,
                type: 'dex' as const,
                assetClass: isStock ? ('stocks' as AssetClass) : (norm.assetClass !== 'crypto' ? norm.assetClass : undefined),
              };
            } catch {
              return null;
            }
          })
        );
        allResults.push(...batchResults);
      }

      return allResults.filter(Boolean) as FundingData[];
    },
  },


  // MEXC
  // MEXC — cross-references with /contract/detail to exclude non-active pairs (state !== 0)
  {
    name: 'MEXC',
    fetcher: async (fetchFn) => {
      const [tickerRes, detailRes] = await Promise.all([
        fetchFn('https://contract.mexc.com/api/v1/contract/ticker'),
        fetchFn('https://contract.mexc.com/api/v1/contract/detail', {}, 8000).catch(() => null),
      ]);
      if (!tickerRes.ok) return [];
      const json = await tickerRes.json();
      if (!json.success || !Array.isArray(json.data)) return [];

      // Build set of active contract symbols (state=0) to filter out delisted/suspended pairs
      let activeSymbols: Set<string> | null = null;
      if (detailRes?.ok) {
        try {
          const detailJson = await detailRes.json();
          if (Array.isArray(detailJson.data)) {
            activeSymbols = new Set(
              detailJson.data
                .filter((c: any) => c.state === 0)
                .map((c: any) => c.symbol as string)
            );
          }
        } catch {}
      }

      return json.data
        .filter((item: any) => {
          if (!item.symbol.endsWith('_USDT') || item.fundingRate == null) return false;
          if (activeSymbols && activeSymbols.size > 0 && !activeSymbols.has(item.symbol)) return false;
          return true;
        })
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
          const absolutePredicted = item.fundingRatePrediction != null ? parseFloat(item.fundingRatePrediction) : undefined;
          const predictedRate = absolutePredicted !== undefined && markPrice > 0
            ? (absolutePredicted / markPrice) * 100
            : undefined;
          return {
            symbol: sym,
            exchange: 'Kraken',
            fundingRate: relativeRate * 100,
            fundingInterval: '4h' as const,
            predictedRate,
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
  // BingX — cross-references with /contracts to exclude suspended/delisted pairs (status !== 1)
  {
    name: 'BingX',
    fetcher: async (fetchFn) => {
      const [premiumRes, contractsRes] = await Promise.all([
        fetchFn('https://open-api.bingx.com/openApi/swap/v2/quote/premiumIndex'),
        fetchFn('https://open-api.bingx.com/openApi/swap/v2/quote/contracts', {}, 8000).catch(() => null),
      ]);
      if (!premiumRes.ok) return [];
      const json = await premiumRes.json();
      if (json.code !== 0 || !Array.isArray(json.data)) return [];

      // Build set of active contract symbols (status=1) to filter out suspended (status=25) pairs
      let activeSymbols: Set<string> | null = null;
      if (contractsRes?.ok) {
        try {
          const contractsJson = await contractsRes.json();
          if (Array.isArray(contractsJson.data)) {
            activeSymbols = new Set(
              contractsJson.data
                .filter((c: any) => c.status === 1)
                .map((c: any) => c.symbol as string)
            );
          }
        } catch {}
      }

      return json.data
        .filter((item: any) => {
          if (!item.symbol.endsWith('-USDT') || item.lastFundingRate == null) return false;
          if (activeSymbols && activeSymbols.size > 0 && !activeSymbols.has(item.symbol)) return false;
          return true;
        })
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
  // Cross-references with /public/products to exclude delisted pairs (ticker API returns stale data for delisted pairs)
  {
    name: 'Phemex',
    fetcher: async (fetchFn) => {
      const [tickerRes, productsRes] = await Promise.all([
        fetchFn('https://api.phemex.com/md/v2/ticker/24hr/all'),
        fetchFn('https://api.phemex.com/public/products', {}, 8000).catch(() => null),
      ]);
      if (!tickerRes.ok) return [];
      const json = await tickerRes.json();
      const phemexResult = Array.isArray(json.result) ? json.result : [];
      if (phemexResult.length === 0) return [];

      // Build set of active perp symbols from perpProductsV2 (filters out 219+ delisted ghost pairs)
      let activeSymbols: Set<string> | null = null;
      if (productsRes?.ok) {
        try {
          const productsJson = await productsRes.json();
          const perpProducts = productsJson?.data?.perpProductsV2;
          if (Array.isArray(perpProducts)) {
            activeSymbols = new Set(
              perpProducts
                .filter((p: any) => p.status === 'Listed')
                .map((p: any) => p.symbol as string)
            );
          }
        } catch {}
      }

      return phemexResult
        .filter((item: any) => {
          if (!item.symbol || !item.symbol.endsWith('USDT') || item.fundingRateRr == null) return false;
          // If we have the active products list, filter out delisted pairs
          if (activeSymbols && activeSymbols.size > 0 && !activeSymbols.has(item.symbol)) return false;
          return true;
        })
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


  // Bitunix — fapi.bitunix.com blocks Vercel Edge IPs (returns empty data).
  // Falls back to internal Node.js proxy (/api/proxy/bitunix) which uses AWS Lambda IPs.
  {
    name: 'Bitunix',
    fetcher: async (fetchFn) => {
      // Try direct first
      let items: any[] = [];
      try {
        const res = await fetchFn('https://fapi.bitunix.com/api/v1/futures/market/funding_rate/batch');
        if (res.ok) {
          const json = await res.json();
          items = Array.isArray(json.data) ? json.data : [];
        }
      } catch {}

      // If direct returns empty, try Node.js proxy (different IP pool)
      if (items.length === 0) {
        try {
          const proxyRes = await fetchFn(`${PROXY_BASE}/api/proxy/bitunix?endpoint=funding`, {}, 10000);
          if (proxyRes.ok) {
            const proxyJson = await proxyRes.json();
            items = Array.isArray(proxyJson.data) ? proxyJson.data : [];
          }
        } catch {}
      }

      if (items.length === 0) return [];
      return items
        .filter((item: any) => item.symbol?.endsWith('USDT') && item.fundingRate != null)
        .map((item: any) => {
          // Bitunix fundingRate is already a percentage (e.g. 0.0023 = 0.0023%, NOT 0.23%)
          const rate = parseFloat(item.fundingRate);
          // fundingInterval is a number (1, 4, 8) representing hours
          const intervalNum = parseInt(item.fundingInterval) || 8;
          const interval = intervalNum === 1 ? '1h' : intervalNum === 4 ? '4h' : '8h';
          return {
            symbol: item.symbol.replace('USDT', ''),
            exchange: 'Bitunix',
            fundingRate: rate,
            fundingInterval: interval as '1h' | '4h' | '8h',
            markPrice: parseFloat(item.markPrice) || 0,
            indexPrice: parseFloat(item.lastPrice) || 0,
            nextFundingTime: Number(item.nextFundingTime) || Date.now() + 28800000,
            type: 'cex' as const,
          };
        })
        .filter((item: any) => !isNaN(item.fundingRate));
    },
  },

  // KuCoin — /contracts/active returns fundingFeeRate which can equal the cap/floor for some coins.
  // For those coins, fetch the actual settled rate from /contract/funding-rates history.
  {
    name: 'KuCoin',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://api-futures.kucoin.com/api/v1/contracts/active');
      if (!res.ok) return [];
      const json = await res.json();
      if (json.code !== '200000' && json.code !== 200000) return [];
      const items = json.data || [];

      // Identify contracts where fundingFeeRate is stuck at cap/floor (unreliable)
      const atCapOrFloor = items.filter((item: any) =>
        item.symbol.endsWith('USDTM') && item.fundingFeeRate != null &&
        (item.fundingFeeRate === item.fundingRateCap || item.fundingFeeRate === item.fundingRateFloor)
      );

      // Fetch actual settled rates for those contracts from history
      const overrides = new Map<string, number>();
      if (atCapOrFloor.length > 0 && atCapOrFloor.length <= 10) {
        const now = Date.now();
        await Promise.all(atCapOrFloor.map(async (item: any) => {
          try {
            const histRes = await fetchFn(
              `https://api-futures.kucoin.com/api/v1/contract/funding-rates?symbol=${item.symbol}&from=${now - 100000000}&to=${now}`,
              {}, 5000
            );
            if (histRes.ok) {
              const histJson = await histRes.json();
              const rates = histJson.data || [];
              if (rates.length > 0) {
                // Sort by timepoint descending and take the most recent settled rate
                rates.sort((a: any, b: any) => (b.timepoint || 0) - (a.timepoint || 0));
                overrides.set(item.symbol, parseFloat(rates[0].fundingRate));
              }
            }
          } catch {}
        }));
      }

      return items
        .filter((item: any) => item.symbol.endsWith('USDTM') && item.fundingFeeRate != null)
        .map((item: any) => {
          let sym = item.symbol.replace('USDTM', '');
          if (sym === 'XBT') sym = 'BTC';
          const actualRate = overrides.has(item.symbol)
            ? (overrides.get(item.symbol) ?? 0) * 100
            : parseFloat(item.fundingFeeRate) * 100;
          return {
            symbol: sym,
            exchange: 'KuCoin',
            fundingRate: actualRate,
            fundingInterval: '8h' as const,
            markPrice: parseFloat(item.markPrice) || 0,
            indexPrice: parseFloat(item.indexPrice) || 0,
            nextFundingTime: Number(item.nextFundingRateTime) || (Date.now() + 28800000),
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
  // HTX — cross-references with /swap_contract_info to exclude delisted pairs (contract_status !== 1)
  {
    name: 'HTX',
    fetcher: async (fetchFn) => {
      const [fundingRes, contractsRes] = await Promise.all([
        fetchFn('https://api.hbdm.com/linear-swap-api/v1/swap_batch_funding_rate'),
        fetchFn('https://api.hbdm.com/linear-swap-api/v1/swap_contract_info', {}, 8000).catch(() => null),
      ]);
      if (!fundingRes.ok) return [];
      const json = await fundingRes.json();
      if (json.status !== 'ok' || !Array.isArray(json.data)) return [];

      // Build set of active contract codes (contract_status=1) to filter out delisted (status=3) pairs
      let activeContracts: Set<string> | null = null;
      if (contractsRes?.ok) {
        try {
          const contractsJson = await contractsRes.json();
          if (Array.isArray(contractsJson.data)) {
            activeContracts = new Set(
              contractsJson.data
                .filter((c: any) => c.contract_status === 1)
                .map((c: any) => c.contract_code as string)
            );
          }
        } catch {}
      }

      return json.data
        .filter((item: any) => {
          const code = item.contract_code || '';
          // Only perpetual swaps (e.g. BTC-USDT), exclude dated futures (e.g. ETH-USDT-260220)
          if (!code.endsWith('-USDT') || /-\d{6}$/.test(code) || item.funding_rate == null) return false;
          // If we have the active contracts list, filter out delisted pairs
          if (activeContracts && activeContracts.size > 0 && !activeContracts.has(code)) return false;
          return true;
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
        .map((item: any) => {
          let sym = item[0].replace('t', '').replace('F0:USTF0', '');
          if (sym === 'XBT') sym = 'BTC';
          return {
          symbol: sym,
          exchange: 'Bitfinex',
          fundingRate: (parseFloat(item[12]) || 0) * 100, // [12] = CURRENT_FUNDING (8h rate)
          fundingInterval: '8h' as const,
          markPrice: parseFloat(item[15]) || 0,
          indexPrice: parseFloat(item[4]) || 0,
          nextFundingTime: item[8] || Date.now() + 28800000,
          type: 'cex' as const,
          };
        })
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
            nextFundingTime: frData.next_funding_time ? parseInt(frData.next_funding_time) * 1000 : Date.now() + 28800000,
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
      const res = await fetchFn('https://backend-arbitrum.gains.trade/trading-variables', {}, 20000);
      if (!res.ok) return [];
      const raw = await res.json();

      // Delisted pair indices from @gainsnetwork/sdk v1.8.6 (pairs kept in API for technical reasons)
      // Source: https://github.com/GainsNetwork-org/sdk/blob/main/src/constants.ts
      const DELISTED_PAIR_IXS = new Set([
        4, 6, 12, 15, 24, 25, 27, 28, 30, 31, 36, 41, 52, 53, 54, 59, 60, 61, 63, 66,
        67, 68, 69, 70, 71, 72, 73, 75, 76, 77, 78, 79, 95, 96, 97, 98, 99, 101, 106,
        111, 113, 114, 116, 118, 120, 122, 123, 125, 127, 130, 147, 152, 160, 163,
        170, 179, 182, 183, 186, 198, 208, 209, 221, 224, 225, 227, 229, 230, 231,
        234, 238, 239, 241, 247, 250, 253, 254, 255, 258, 261, 268, 270, 272, 273,
        275, 276, 278, 279, 280, 281, 284, 285, 290, 291, 292, 294, 296, 303, 305,
        306, 311, 312, 322, 323, 330, 333, 335, 336, 337, 342, 343, 344, 346, 347,
        349, 350, 351, 352, 353, 354, 355, 357, 362, 365, 366, 372, 379, 380, 387,
        395, 396, 400, 401, 408, 423, 427, 428, 430, 435, 436, 437, 438, 441,
      ]);

      // Pairs hidden in gTrade's production UI (soft-delisted/rebranded tokens)
      const HIDDEN_PAIR_NAMES = new Set([
        'MATIC/USD', 'FTM/USD', 'KLAY/USD', 'BNX/USD', 'DAR/USD', 'REEF/USD',
        'LUMIA/USD', 'ACX/USD', 'BITCOIN/USD', 'DAX/USD', 'REKT/USD', 'CAMP/USD', 'L3/USD',
      ]);

      // Per-pair max leverage from pairInfos — pairs with pairMaxLev < groupMinLev are disabled
      // SDK converts raw values: pairMaxLev = rawValue / 1000, group leverages = rawValue / 1000
      const groups: any[] = raw.groups || [];
      const rawMaxLeverages: any[] = raw.pairInfos?.maxLeverages || [];

      // Precision constants from gTrade smart contracts (@gainsnetwork/sdk v1.8.6)
      const PRECISION = {
        SKEW_COEFF_PER_YEAR: 1e26,
        ABS_VELOCITY_PER_YEAR_CAP: 1e7,
        ABS_RATE_PER_SECOND_CAP: 1e10,
        FUNDING_RATE_PER_SECOND_P: 1e18,
        OI_TOKEN: 1e18,
        COLLATERAL_PRECISION: 1e6, // USDC default
        BORROWING_RATE_PER_SECOND: 1e10, // borrowingV2 precision
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
      const borrowingV2Params = collateral.borrowingFees?.v2?.pairParams || [];
      const collateralPrecision = collateral.collateralConfig?.precision
        ? parseInt(collateral.collateralConfig.precision) : PRECISION.COLLATERAL_PRECISION;
      const collateralPriceUsd = collateral.prices?.collateralPriceUsd || 1;

      const currentTimestamp = Math.floor(Date.now() / 1000);

      // V1 borrowing fee data — used for non-funding pairs (group-level utilization-based fees)
      const v1BorrowPairs = collateral.borrowingFees?.v1?.pairs || [];
      const v1BorrowGroups = collateral.borrowingFees?.v1?.groups || [];
      const V1_FEE_PRECISION = 1e10;
      const ARB_BLOCKS_PER_8H = 115200; // Arbitrum ~0.25s blocks

      // Pre-calculate V1 group borrowing rates (utilization-dependent)
      // SDK converter divides all raw values by 1e10 before calculation.
      // Formula: activeFeePerBlock = (feePerBlock/1e10) * (netOi/maxOi)^exp
      // Rate 8h = activeFeePerBlock * ARB_BLOCKS_PER_8H (no extra /1e10 at calc time)
      const v1GroupRates: number[] = v1BorrowGroups.map((group: any) => {
        const feePerBlock = Number(group?.feePerBlock || 0) / V1_FEE_PRECISION;
        if (feePerBlock <= 0) return 0;
        const oiLong = Number(group?.oi?.long || 0) / V1_FEE_PRECISION;
        const oiShort = Number(group?.oi?.short || 0) / V1_FEE_PRECISION;
        const maxOi = Number(group?.oi?.max || 0) / V1_FEE_PRECISION;
        if (maxOi <= 0) return 0;
        const exponent = Number(group?.feeExponent || 1);
        // Groups have no fee caps — just use raw net OI
        const effectiveOi = Math.abs(oiLong - oiShort);
        const utilization = Math.min(effectiveOi / maxOi, 1);
        return feePerBlock * Math.pow(utilization, exponent) * ARB_BLOCKS_PER_8H;
      });

      for (let i = 0; i < Math.min(pairs.length, fundingParams.length, fundingData.length); i++) {
        try {
          const pair = pairs[i];
          if (!pair || !pair.from) continue;

          // Skip delisted/inactive pairs — gTrade keeps ~200 dead pairs in the API
          // 1) SDK's known delisted list  2) beforeV10.max = 0 means no OI capacity
          if (DELISTED_PAIR_IXS.has(i)) continue;
          const pairOiEntry = pairOis[i];
          if (!pairOiEntry || Number(pairOiEntry.beforeV10?.max || 0) === 0) continue;

          // 3) Hidden pair names (rebranded/soft-delisted in gTrade UI)
          const pairName = pair.from.split('_')[0] + '/' + pair.to;
          if (HIDDEN_PAIR_NAMES.has(pairName)) continue;

          // 4) Disabled markets: pair's effective max leverage < group's min leverage
          const groupIdx = parseInt(pair.groupIndex);
          const group = groups[groupIdx];
          if (group) {
            const groupMaxLev = parseInt(group.maxLeverage) / 1e3;
            const groupMinLev = parseInt(group.minLeverage) / 1e3;
            const pairMaxLev = Number(rawMaxLeverages[i] || 0) / 1e3;
            const effectiveMaxLev = pairMaxLev === 0 ? groupMaxLev : pairMaxLev;
            if (effectiveMaxLev < groupMinLev) continue;
          }

          // Determine asset class from group index
          const assetClass: AssetClass = GTRADE_GROUP_ASSET_CLASS[groupIdx] || 'crypto';

          const params = fundingParams[i];
          const data = fundingData[i];
          if (!params || !data) continue;

          const hasFunding = !!params.fundingFeesEnabled;

          // Parse OI in tokens (may be zero for some pairs — still show funding rate)
          const oi = pairOiEntry;
          const oiLongToken = oi?.token ? Number(oi.token.oiLongToken) / PRECISION.OI_TOKEN : 0;
          const oiShortToken = oi?.token ? Number(oi.token.oiShortToken) / PRECISION.OI_TOKEN : 0;

          let fundingRate8h = 0;
          let fundingRateLong = 0;
          let fundingRateShort = 0;
          let tokenPrice = 0;

          if (hasFunding) {
            // --- Full velocity-based funding for pairs with funding enabled ---

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
            const oiLongCollateral = oi?.collateral ? Number(oi.collateral.oiLongCollateral) / collateralPrecision : 0;
            const oiShortCollateral = oi?.collateral ? Number(oi.collateral.oiShortCollateral) / collateralPrecision : 0;
            const totalTokenOi = oiLongToken + oiShortToken;
            tokenPrice = totalTokenOi > 0
              ? ((oiLongCollateral + oiShortCollateral) * collateralPriceUsd) / totalTokenOi
              : 0;
            const netExposureUsd = netExposureToken * tokenPrice;

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
                const secondsToReachCap = Math.max(0, ((ratePerSecondCap - lastFundingRatePerSecondP) * ONE_YEAR) / currentVelocityPerYear);

                if (secondsSinceLastUpdate >= secondsToReachCap) {
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
            fundingRate8h = currentFundingRatePerSecondP * 8 * 3600;

            // gTrade's skew model (from @gainsnetwork/sdk getLongShortAprMultiplier):
            // The minority side pays an amplified rate proportional to the OI imbalance.
            // SDK allows up to 100x but we cap at 10x since extreme ratios produce absurd
            // holding fees that don't reflect practical trading costs.
            fundingRateLong = fundingRate8h;
            fundingRateShort = -fundingRate8h;
            const APR_MULT_CAP = 10;
            if (params.aprMultiplierEnabled && oiLongToken > 0 && oiShortToken > 0) {
              if (fundingRate8h < 0) {
                fundingRateLong = fundingRate8h * Math.min(oiShortToken / oiLongToken, APR_MULT_CAP);
                fundingRateShort = -fundingRate8h;
              } else if (fundingRate8h > 0) {
                fundingRateLong = fundingRate8h;
                fundingRateShort = -fundingRate8h * Math.min(oiLongToken / oiShortToken, APR_MULT_CAP);
              }
            }
          }

          // Add borrowing fees — gTrade "Holding Fee" = funding + borrowing
          // V2 borrowing: per-second rate (used by funded pairs, 0 for borrow-only)
          const borrowParams = borrowingV2Params[i];
          const borrowV2Rate8h = borrowParams?.borrowingRatePerSecondP
            ? (Number(borrowParams.borrowingRatePerSecondP) / PRECISION.BORROWING_RATE_PER_SECOND) * 8 * 3600
            : 0;

          // V1 borrowing: block-based, utilization fee (used by borrow-only pairs)
          // SDK uses Math.max(pairRate, groupRate) via getActiveFeePerBlock
          let borrowV1Rate8h = 0;
          if (!hasFunding && borrowV2Rate8h === 0) {
            const v1Pair = v1BorrowPairs[i];
            if (v1Pair) {
              // Group-level fee (based on group OI utilization)
              let groupRate8h = 0;
              const pairGroupEntry = v1Pair.groups?.[0];
              const v1GroupIdx = pairGroupEntry ? Number(pairGroupEntry.groupIndex) : -1;
              if (v1GroupIdx >= 0 && v1GroupIdx < v1GroupRates.length) {
                groupRate8h = v1GroupRates[v1GroupIdx];
              }
              // Pair-level fee — SDK converter pre-divides ALL values by 1e10
              // beforeV10 OI fields are raw 1e10 scale, feePerBlock is raw 1e10 scale
              // feePerBlockCap: minP = raw / 1e3 / 100, maxP = raw / 1e3 / 100
              let pairRate8h = 0;
              const pairFeePerBlock = Number(v1Pair.feePerBlock || 0) / V1_FEE_PRECISION;
              if (pairFeePerBlock > 0) {
                const pairOiL = Number(v1Pair.oi?.beforeV10?.long || 0) / V1_FEE_PRECISION;
                const pairOiS = Number(v1Pair.oi?.beforeV10?.short || 0) / V1_FEE_PRECISION;
                const pairMaxOi = Number(v1Pair.oi?.beforeV10?.max || 0) / V1_FEE_PRECISION;
                if (pairMaxOi > 0) {
                  const pairExp = Number(v1Pair.feeExponent || 1);
                  const rawMinP = Number(v1Pair.feePerBlockCap?.minP || 0);
                  const rawMaxP = Number(v1Pair.feePerBlockCap?.maxP || 0);
                  const minP = rawMinP ? rawMinP / 1e3 / 100 : 0;
                  const maxP = rawMaxP && rawMaxP > 0 ? rawMaxP / 1e3 / 100 : 1;
                  const netOi = Math.abs(pairOiL - pairOiS);
                  const effectiveOi = Math.min(Math.max(netOi, pairMaxOi * minP), pairMaxOi * maxP);
                  pairRate8h = pairFeePerBlock * Math.pow(effectiveOi / pairMaxOi, pairExp) * ARB_BLOCKS_PER_8H;
                }
              }
              // SDK: getActiveFeePerBlock returns Math.max(pairRate, groupRate)
              borrowV1Rate8h = Math.max(groupRate8h, pairRate8h);
            }
          }

          const totalBorrowRate8h = borrowV2Rate8h + borrowV1Rate8h;

          // gTrade "Holding Fee" = Funding + Borrowing combined per side.
          // SDK convention: positive = cost (paid by trader), negative = earning.
          // Funding signs: when currentRate < 0, longs earn (fundingRateLong < 0),
          // shorts pay (fundingRateShort > 0). When > 0, vice versa.
          // Borrowing is ALWAYS a cost (positive), applied symmetrically to both sides.
          fundingRateLong = fundingRateLong + totalBorrowRate8h;
          fundingRateShort = fundingRateShort + totalBorrowRate8h;

          // Build symbol — gTrade pairs may have expiry suffixes like "INTC_24_5"
          // Strip anything after first underscore to get base symbol (INTC)
          const baseFrom = pair.from.split('_')[0];
          let symbol = baseFrom;
          if (assetClass === 'forex') {
            symbol = baseFrom + (pair.to || 'USD');
          }

          // gTrade "Holding Fee" = combined funding + borrowing per side.
          // fundingRate8h is the directional funding component (positive = longs pay shorts).
          // fundingRateLong / fundingRateShort are the TOTAL holding fees per side
          // (positive = cost for that side, negative = earning).
          // Negate per-side rates: SDK uses positive=cost convention,
          // but display/gTrade UI uses positive=earning (green) convention.
          // Only show separate L/S when there's meaningful directional funding —
          // if both sides are equal (pure borrowing), L/S display is redundant and confusing.
          const hasDirectionalFunding = Math.abs(fundingRate8h) > 0.00001;
          results.push({
            symbol,
            exchange: 'gTrade',
            fundingRate: fundingRate8h,
            fundingRateLong: hasDirectionalFunding ? -fundingRateLong : undefined,
            fundingRateShort: hasDirectionalFunding ? -fundingRateShort : undefined,
            borrowingRate: totalBorrowRate8h > 0.00001 ? totalBorrowRate8h : undefined,
            fundingInterval: '8h' as const, // velocity model, normalized to 8h for display
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
      // Safe BigInt parser — returns 0 on invalid strings instead of throwing
      const safeBigInt = (v: string | null | undefined): number => {
        if (!v) return 0;
        try { return Number(BigInt(v)); } catch { return 0; }
      };

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
        m.fundingRateLong != null  // explicit null check — "0" string is valid (balanced market)
      );

      // Deduplicate: keep highest OI per symbol
      const bestBySymbol = new Map<string, { market: any; totalOi: number }>();
      for (const m of perpMarkets) {
        const symbol = m.name.split('/')[0].replace(/\.v\d+$/i, ''); // XAUT.v2 → XAUT
        const totalOi = safeBigInt(m.openInterestLong) + safeBigInt(m.openInterestShort);
        const existing = bestBySymbol.get(symbol);
        if (!existing || totalOi > existing.totalOi) {
          bestBySymbol.set(symbol, { market: m, totalOi });
        }
      }

      return Array.from(bestBySymbol.values())
        .map(({ market: m }) => {
          const symbol = m.name.split('/')[0].replace(/\.v\d+$/i, ''); // XAUT.v2 → XAUT
          // GMX V2: annual rate at 1e30 precision -> hourly percentage
          // GMX convention: negative fundingRateLong = longs pay (cost).
          // Negate to match our convention: positive = longs pay.
          const rawFundingL = safeBigInt(m.fundingRateLong) / 1e30 / 8760 * 100;
          const rawFundingS = safeBigInt(m.fundingRateShort) / 1e30 / 8760 * 100;
          // Negate: GMX API negative=cost, our output positive=cost
          const fundingL = -rawFundingL; // positive = longs pay
          const fundingS = -rawFundingS; // positive = shorts pay, negative = shorts earn
          // Add borrowing rates (always a cost, positive)
          const borrowL = safeBigInt(m.borrowingRateLong) / 1e30 / 8760 * 100;
          const borrowS = safeBigInt(m.borrowingRateShort) / 1e30 / 8760 * 100;
          const rateLong = fundingL + borrowL;
          const rateShort = fundingS + borrowS;
          return {
            symbol,
            exchange: 'GMX',
            fundingRate: fundingL,        // Base funding component (positive = longs pay)
            fundingRateLong: -rateLong,    // Earning convention: positive = earning for longs
            fundingRateShort: -rateShort,  // Earning convention: positive = earning for shorts
            borrowingRate: borrowL + borrowS > 0.00001 ? borrowL : undefined,
            markPrice: 0, // GMX markets/info doesn't provide mark price
            indexPrice: 0,
            nextFundingTime: Date.now() + 3600000, // continuous, next "hour"
            type: 'dex' as const,
            fundingInterval: '1h' as const,
          };
        })
        .filter((item: any) => !isNaN(item.fundingRate)); // Keep 0% rates — valid data (balanced market)
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
            nextFundingTime: Date.now() + 3600000, // Extended uses continuous funding (1h), no discrete settlement time
            type: 'dex' as const,
            assetClass: norm.assetClass !== 'crypto' ? norm.assetClass : undefined,
          };
        })
        .filter((item: any) => !isNaN(item.fundingRate)); // Keep 0% rates — valid data
    },
  },

  // edgeX — tries direct fetch first, falls back to PROXY_URL. Hourly funding settlement.
  {
    name: 'edgeX',
    fetcher: async (fetchFn) => {
      const proxyUrl = process.env.PROXY_URL;
      const proxy = proxyUrl ? proxyUrl.replace(/\/$/, '') : '';

      // Helper: try direct first, fall back to proxy
      const edgeFetch = async (url: string, timeout = 8000): Promise<Response | null> => {
        try {
          const direct = await fetchFn(url, {}, timeout);
          if (direct.ok) return direct;
        } catch { /* direct failed, try proxy */ }
        if (!proxy) return null;
        try {
          const proxied = await fetchFn(`${proxy}/?url=${encodeURIComponent(url)}`, {}, timeout);
          if (proxied.ok) return proxied;
        } catch { /* proxy also failed */ }
        return null;
      };

      // Step 1: Fetch contract metadata to get contractIds
      const metaTarget = 'https://pro.edgex.exchange/api/v1/public/meta/getMetaData';
      const metaRes = await edgeFetch(metaTarget, 10000);
      if (!metaRes) return [];
      const metaData = await metaRes.json();
      const contracts = metaData?.data?.contractList || [];
      const active = contracts.filter((c: any) => c.enableTrade);
      if (active.length === 0) return [];

      // Step 2: Fetch tickers in parallel batches (each has funding rate + mark price)
      const batchSize = 10;
      const results: FundingData[] = [];
      for (let i = 0; i < active.length; i += batchSize) {
        const batch = active.slice(i, i + batchSize);
        const tickerPromises = batch.map((c: any) => {
          const tickerTarget = `https://pro.edgex.exchange/api/v1/public/quote/getTicker?contractId=${c.contractId}`;
          return edgeFetch(tickerTarget)
            .then(r => r ? r.json() : null)
            .catch(() => null);
        });
        const tickerResults = await Promise.all(tickerPromises);

        for (let j = 0; j < batch.length; j++) {
          const contract = batch[j];
          const ticker = tickerResults[j]?.data?.[0] || tickerResults[j]?.data;
          if (!ticker) continue;

          const symbol = (contract.contractName || '').replace(/USD.*/, '').toUpperCase();
          if (!symbol || !isCryptoSymbol(symbol)) continue;

          const fundingRate = parseFloat(ticker.fundingRate || ticker.funding_rate || '0') * 100;
          const markPrice = parseFloat(ticker.oraclePrice || ticker.markPrice || ticker.mark_price || '0');
          if (!markPrice || markPrice <= 0) continue;

          results.push({
            symbol,
            exchange: 'edgeX',
            fundingRate,
            markPrice,
            indexPrice: parseFloat(ticker.indexPrice || ticker.index_price || '0') || markPrice,
            nextFundingTime: parseInt(ticker.nextFundingTime || '0') || (Date.now() + 3600000),
            fundingInterval: '1h',
            type: 'dex',
          });
        }
      }
      return results;
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

          // funding_rate is an ANNUALIZED decimal rate
          // Convert: per_interval_pct = raw_decimal * 100 / periods_per_year
          // Verified: DUSK raw=-4.67 → -0.4262%/8h matches Variational UI (-0.4275%)
          //           ADA raw=0.1095 → 0.0100%/8h, LINK 0.0100%/8h — match CEX benchmarks
          const rawDecimal = parseFloat(m.funding_rate);
          const periodsPerYear = (365 * 24 * 3600) / intervalS;
          const fundingRate = (rawDecimal * 100) / periodsPerYear;

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
        .filter((item: any) => item && !isNaN(item.fundingRate) && item.markPrice > 0); // Keep 0% rates — valid data
    },
  },
  // Synthetix V3 Perps — DEPRECATED as of July 2025
  // Base chain deployment was sunset; migrated to Ethereum Mainnet CLOB (private beta Dec 2025)
  // Contract 0x0A2AF931eFFd34b81ebcc57E3d3c9B1E1dE1C9Ce returns FeatureUnavailable for all calls
  // Re-enable when mainnet CLOB has a public data API

  // ─── CloudFlare-blocked exchanges (require PROXY_URL env var) ───

  // BitMEX (~$158M OI)
  {
    name: 'BitMEX',
    fetcher: async (fetchFn) => {
      const proxyUrl = process.env.PROXY_URL;
      if (!proxyUrl) return [];
      const targetUrl = 'https://www.bitmex.com/api/v1/instrument?columns=symbol,fundingRate,fundingInterval,lastPrice,volume24h&filter=%7B%22state%22%3A%22Open%22%2C%22typ%22%3A%22FFWCSX%22%7D&count=500';
      const res = await fetchFn(`${proxyUrl.replace(/\/$/, '')}/?url=${encodeURIComponent(targetUrl)}`, {}, 12000);
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data
        .filter((i: any) => i.fundingRate != null && i.symbol)
        .map((i: any) => {
          let sym = i.symbol.replace(/USD$/, '').replace(/USDT$/, '').replace(/_.*/, '');
          if (sym === 'XBT') sym = 'BTC';
          return {
            symbol: sym,
            exchange: 'BitMEX',
            fundingRate: parseFloat(i.fundingRate) * 100,
            fundingInterval: '8h' as const,
            markPrice: parseFloat(i.lastPrice) || 0,
            indexPrice: 0,
            nextFundingTime: 0,
            type: 'cex' as const,
          };
        })
        .filter((i: any) => !isNaN(i.fundingRate) && i.symbol.length > 0);
    },
  },

  // Gate.io (~$1.5B OI)
  {
    name: 'Gate.io',
    fetcher: async (fetchFn) => {
      const proxyUrl = process.env.PROXY_URL;
      if (!proxyUrl) return [];
      const targetUrl = 'https://api.gateio.ws/api/v4/futures/usdt/contracts';
      const res = await fetchFn(`${proxyUrl.replace(/\/$/, '')}/?url=${encodeURIComponent(targetUrl)}`, {}, 12000);
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data
        .filter((c: any) => c.funding_rate != null && c.name?.endsWith('_USDT'))
        .map((c: any) => ({
          symbol: c.name.replace('_USDT', ''),
          exchange: 'Gate.io',
          fundingRate: parseFloat(c.funding_rate) * 100,
          fundingInterval: '8h' as const,
          markPrice: parseFloat(c.mark_price) || 0,
          indexPrice: parseFloat(c.index_price) || 0,
          nextFundingTime: (c.funding_next_apply || 0) * 1000,
          type: 'cex' as const,
        }))
        .filter((i: any) => !isNaN(i.fundingRate));
    },
  },

  // ─── Nado (Ink L2 CLOB DEX) ───
  // Two endpoints: gateway/all_products for prices+OI, archive/funding_rates for rates
  // funding_rate_x18 = 24h rate at 1e18 precision; divide by 24 for hourly %
  // Hourly settlement
  {
    name: 'Nado',
    fetcher: async (fetchFn) => {
      const headers = { 'Accept-Encoding': 'gzip' };
      // 1. Get all products (prices + product IDs)
      const productsRes = await fetchFn(
        'https://gateway.prod.nado.xyz/v1/query?type=all_products',
        { headers },
        12000
      );
      if (!productsRes.ok) return [];
      const productsJson = await productsRes.json();
      const perps: any[] = productsJson?.data?.perp_products || [];
      if (!perps.length) return [];

      // 2. Get tickers for symbol mapping (product_id → symbol)
      const tickersRes = await fetchFn(
        'https://archive.prod.nado.xyz/v2/tickers?market=perp',
        { headers },
        12000
      );
      if (!tickersRes.ok) return [];
      const tickersJson = await tickersRes.json();
      const symbolMap: Record<number, string> = {};
      for (const [, v] of Object.entries(tickersJson) as [string, any][]) {
        let sym = (v.base_currency || '').replace('-PERP', '');
        // Normalize: kPEPE → PEPE, kBONK → BONK
        if (sym.startsWith('k') && sym.length > 1 && sym[1] === sym[1].toUpperCase()) {
          sym = sym.slice(1);
        }
        symbolMap[v.product_id] = sym;
      }

      // 3. Get funding rates for all perp product IDs
      const productIds = perps.map((p: any) => p.product_id);
      const fundingRes = await fetchFn(
        'https://archive.prod.nado.xyz/v1',
        {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ funding_rates: { product_ids: productIds } }),
        },
        12000
      );
      if (!fundingRes.ok) return [];
      const fundingJson = await fundingRes.json();

      const results: FundingData[] = [];
      for (const p of perps) {
        try {
          const pid = p.product_id;
          const symbol = symbolMap[pid];
          if (!symbol) continue;

          const price = Number(BigInt(p.oracle_price_x18)) / 1e18;
          if (price <= 0) continue;

          // OI filter: skip tiny markets
          const oi = Number(BigInt(p.state?.open_interest || '0')) / 1e18;
          if (oi * price < 1000) continue;

          // Funding rate: 24h rate at x18, convert to hourly %
          const frData = fundingJson[String(pid)];
          if (!frData) continue;
          const dailyRate = Number(BigInt(frData.funding_rate_x18)) / 1e18;
          const hourlyRate = dailyRate / 24;
          // Convert to percentage
          const fundingRate = hourlyRate * 100;

          results.push({
            symbol,
            exchange: 'Nado',
            fundingRate,
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

  // BloFin — CEX with OKX-style API
  {
    name: 'BloFin',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://openapi.blofin.com/api/v1/market/funding-rate', {}, 10000);
      if (!res.ok) return [];
      const json = await res.json();
      const data = json?.data;
      if (!Array.isArray(data)) return [];
      return data
        .filter((item: any) => item.instId?.endsWith('-USDT') && item.fundingRate != null)
        .map((item: any) => ({
          symbol: item.instId.replace('-USDT', ''),
          exchange: 'BloFin',
          fundingRate: parseFloat(item.fundingRate) * 100,
          fundingInterval: '8h' as const,
          markPrice: 0,
          indexPrice: 0,
          nextFundingTime: parseInt(item.fundingTime) || Date.now() + 28800000,
          type: 'cex' as const,
        }))
        .filter((item: any) => !isNaN(item.fundingRate));
    },
  },

  // Backpack — Solana-based DEX, markPrices endpoint has funding for all perps
  {
    name: 'Backpack',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://api.backpack.exchange/api/v1/markPrices', {}, 10000);
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data
        .filter((item: any) => item.symbol?.endsWith('_USDC_PERP') && item.fundingRate != null)
        .map((item: any) => {
          const symbol = item.symbol.replace('_USDC_PERP', '');
          return {
            symbol,
            exchange: 'Backpack',
            fundingRate: parseFloat(item.fundingRate) * 100,
            fundingInterval: '1h' as const,
            markPrice: parseFloat(item.markPrice) || 0,
            indexPrice: parseFloat(item.indexPrice) || 0,
            nextFundingTime: parseInt(item.nextFundingTimestamp) || Date.now() + 3600000,
            type: 'dex' as const,
          };
        })
        .filter((item: any) => !isNaN(item.fundingRate));
    },
  },

  // Orderly Network — multi-chain DEX, single endpoint has everything
  {
    name: 'Orderly',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://api-evm.orderly.org/v1/public/futures', {}, 10000);
      if (!res.ok) return [];
      const json = await res.json();
      const rows = json?.data?.rows;
      if (!Array.isArray(rows)) return [];
      return rows
        .filter((item: any) => item.symbol?.startsWith('PERP_') && item.last_funding_rate != null)
        .map((item: any) => {
          // PERP_BTC_USDC → BTC
          let symbol = item.symbol.replace('PERP_', '').replace('_USDC', '');
          // Normalize: 1000BONK → BONK, 1000PEPE → PEPE
          if (symbol.startsWith('1000')) symbol = symbol.slice(4);
          if (symbol.startsWith('1000000')) symbol = symbol.slice(7);
          const fundingPeriod = 8; // default 8h
          return {
            symbol,
            exchange: 'Orderly',
            fundingRate: parseFloat(item.last_funding_rate) * 100,
            predictedRate: item.est_funding_rate != null ? parseFloat(item.est_funding_rate) * 100 : undefined,
            fundingInterval: `${fundingPeriod}h` as '8h',
            markPrice: parseFloat(item.mark_price) || 0,
            indexPrice: parseFloat(item.index_price) || 0,
            nextFundingTime: parseInt(item.next_funding_time) || Date.now() + 28800000,
            type: 'dex' as const,
          };
        })
        .filter((item: any) => !isNaN(item.fundingRate));
    },
  },

  // Paradex — StarkNet DEX, single endpoint has funding + OI + tickers
  {
    name: 'Paradex',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://api.prod.paradex.trade/v1/markets/summary?market=ALL', {}, 10000);
      if (!res.ok) return [];
      const json = await res.json();
      const results = json?.results;
      if (!Array.isArray(results)) return [];
      return results
        .filter((item: any) => item.symbol?.endsWith('-USD-PERP') && item.funding_rate != null)
        .map((item: any) => {
          const symbol = item.symbol.replace('-USD-PERP', '');
          return {
            symbol,
            exchange: 'Paradex',
            fundingRate: parseFloat(item.funding_rate) * 100,
            fundingInterval: '1h' as const,
            markPrice: parseFloat(item.mark_price) || 0,
            indexPrice: parseFloat(item.underlying_price) || 0,
            nextFundingTime: Date.now() + 3600000,
            type: 'dex' as const,
          };
        })
        .filter((item: any) => !isNaN(item.fundingRate));
    },
  },

];

// Paused exchanges (kept for reference):
// LBank - Futures domain (fapi.lbank.com) unreachable
