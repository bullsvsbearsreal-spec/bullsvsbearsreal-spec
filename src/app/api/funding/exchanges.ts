import { ExchangeFetcherConfig } from '../_shared/exchange-fetchers';
import { fetchWithTimeout, isCryptoSymbol } from '../_shared/fetch';

type FundingData = {
  symbol: string;
  exchange: string;
  fundingRate: number;
  markPrice: number;
  indexPrice: number;
  nextFundingTime: number;
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
          markPrice: parseFloat(item.markPrice),
          indexPrice: parseFloat(item.indexPrice),
          nextFundingTime: item.nextFundingTime,
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
          markPrice: parseFloat(item.markPrice),
          indexPrice: parseFloat(item.indexPrice),
          nextFundingTime: parseInt(item.nextFundingTime) || Date.now(),
        }))
        .filter((item: any) => !isNaN(item.fundingRate));
    },
  },

  // OKX - Two-step: instruments then individual funding rates
  {
    name: 'OKX',
    fetcher: async (fetchFn) => {
      const instrumentsRes = await fetchFn('https://www.okx.com/api/v5/public/instruments?instType=SWAP');
      if (!instrumentsRes.ok) return [];
      const instrumentsJson = await instrumentsRes.json();
      if (instrumentsJson.code !== '0') return [];

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
              return {
                symbol: inst.instId.replace('-USDT-SWAP', ''),
                exchange: 'OKX',
                fundingRate: parseFloat(fr.fundingRate) * 100,
                markPrice: 0,
                indexPrice: 0,
                nextFundingTime: parseInt(fr.nextFundingTime) || Date.now(),
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
          markPrice: parseFloat(item.markPrice),
          indexPrice: parseFloat(item.indexPrice),
          nextFundingTime: parseInt(item.nextFundingTime) || Date.now(),
        }))
        .filter((item: any) => !isNaN(item.fundingRate));
    },
  },

  // Hyperliquid — funding is HOURLY; normalize to 8h equivalent (* 8)
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
      if (!json || !json[1]) return [];
      return json[1]
        .map((item: any, index: number) => ({
          symbol: json[0].universe[index]?.name || `ASSET${index}`,
          exchange: 'Hyperliquid',
          fundingRate: parseFloat(item.funding) * 8 * 100,
          markPrice: parseFloat(item.markPx),
          indexPrice: parseFloat(item.oraclePx),
          nextFundingTime: Date.now() + 3600000,
        }))
        .filter((item: any) => !isNaN(item.fundingRate) && item.fundingRate !== 0);
    },
  },

  // dYdX — nextFundingRate is HOURLY; normalize to 8h equivalent (* 8)
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
          fundingRate: parseFloat(market.nextFundingRate) * 8 * 100,
          markPrice: parseFloat(market.oraclePrice),
          indexPrice: parseFloat(market.oraclePrice),
          nextFundingTime: Date.now() + 3600000,
        }))
        .filter((item: any) => !isNaN(item.fundingRate));
    },
  },

  // Aster DEX
  {
    name: 'Aster',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://fapi.asterdex.com/fapi/v1/premiumIndex');
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data
        .filter((item: any) => item.symbol && item.lastFundingRate != null)
        .map((item: any) => ({
          symbol: item.symbol.replace('USDT', '').replace('USDC', ''),
          exchange: 'Aster',
          fundingRate: parseFloat(item.lastFundingRate) * 100,
          markPrice: parseFloat(item.markPrice || '0'),
          indexPrice: parseFloat(item.indexPrice || '0'),
          nextFundingTime: parseInt(item.nextFundingTime) || Date.now() + 28800000,
        }))
        .filter((item: any) => !isNaN(item.fundingRate));
    },
  },

  // Lighter
  {
    name: 'Lighter',
    fetcher: async (fetchFn) => {
      const FOREX_SYMBOLS = new Set(['USDCAD', 'GBPUSD', 'NZDUSD', 'USDKRW', 'EURUSD', 'USDCHF', 'USDJPY', 'AUDUSD']);
      const res = await fetchFn('https://mainnet.zklighter.elliot.ai/api/v1/funding-rates');
      if (!res.ok) return [];
      const data = await res.json();
      const fundingRates = data.funding_rates || data;
      if (!Array.isArray(fundingRates)) return [];
      return fundingRates
        .filter((item: any) => item.exchange === 'lighter' && item.symbol && !FOREX_SYMBOLS.has(item.symbol))
        .map((item: any) => ({
          symbol: item.symbol,
          exchange: 'Lighter',
          fundingRate: parseFloat(item.rate || '0') * 100,
          markPrice: 0,
          indexPrice: 0,
          nextFundingTime: Date.now() + 3600000,
        }))
        .filter((item: any) => !isNaN(item.fundingRate) && item.fundingRate !== 0);
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
        .filter((item: any) => item.name.endsWith('_USDT') && (item.funding_rate != null || item.funding_rate_indicative != null))
        .map((item: any) => ({
          symbol: item.name.replace('_USDT', ''),
          exchange: 'Gate.io',
          fundingRate: parseFloat(item.funding_rate || item.funding_rate_indicative) * 100,
          markPrice: parseFloat(item.mark_price) || 0,
          indexPrice: parseFloat(item.index_price) || 0,
          nextFundingTime: (item.funding_next_apply || 0) * 1000,
        }))
        .filter((item: any) => !isNaN(item.fundingRate));
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
          markPrice: parseFloat(item.fairPrice) || 0,
          indexPrice: parseFloat(item.indexPrice) || 0,
          nextFundingTime: item.nextSettlementTime || Date.now() + 28800000,
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
          // Kraken settles every 4h; we normalize to 8h equivalent (* 2)
          const absoluteRate = parseFloat(item.fundingRate);
          const relativeRate = markPrice > 0 ? (absoluteRate / markPrice) * 2 : 0;
          return {
            symbol: sym,
            exchange: 'Kraken',
            fundingRate: relativeRate * 100,
            markPrice,
            indexPrice: parseFloat(item.indexPrice) || 0,
            nextFundingTime: Date.now() + 3600000,
          };
        })
        .filter((item: any) => !isNaN(item.fundingRate) && isCryptoSymbol(item.symbol));
    },
  },

  // BingX
  {
    name: 'BingX',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://open-api.bingx.com/openApi/swap/v2/quote/premiumIndex');
      if (!res.ok) return [];
      const json = await res.json();
      if (json.code !== 0 || !Array.isArray(json.data)) return [];
      return json.data
        .filter((item: any) => item.symbol.endsWith('-USDT') && item.lastFundingRate != null)
        .map((item: any) => ({
          symbol: item.symbol.replace('-USDT', ''),
          exchange: 'BingX',
          fundingRate: parseFloat(item.lastFundingRate) * 100,
          markPrice: parseFloat(item.markPrice) || 0,
          indexPrice: parseFloat(item.indexPrice) || 0,
          nextFundingTime: item.nextFundingTime || Date.now() + 28800000,
        }))
        .filter((item: any) => !isNaN(item.fundingRate) && isCryptoSymbol(item.symbol));
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
        .filter((item: any) => item.symbol && item.symbol.endsWith('USDT') && item.fundingRateRr != null)
        .map((item: any) => ({
          symbol: item.symbol.replace('USDT', ''),
          exchange: 'Phemex',
          fundingRate: parseFloat(item.fundingRateRr) * 100,
          markPrice: parseFloat(item.markPriceRp) || 0,
          indexPrice: parseFloat(item.indexPriceRp) || 0,
          nextFundingTime: Date.now() + 28800000,
        }))
        .filter((item: any) => !isNaN(item.fundingRate));
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
        .filter((item: any) => item.symbol.endsWith('USDT') && item.fundingRate != null)
        .map((item: any) => {
          let sym = item.symbol.replace('USDT', '');
          if (sym === 'XBT') sym = 'BTC';
          return {
            symbol: sym,
            exchange: 'BitMEX',
            fundingRate: parseFloat(item.fundingRate) * 100,
            markPrice: parseFloat(item.markPrice) || 0,
            indexPrice: parseFloat(item.indicativeSettlePrice) || 0,
            nextFundingTime: item.fundingTimestamp ? new Date(item.fundingTimestamp).getTime() : Date.now() + 28800000,
          };
        })
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
            markPrice: parseFloat(item.markPrice) || 0,
            indexPrice: parseFloat(item.indexPrice) || 0,
            nextFundingTime: item.nextFundingRateTime || Date.now() + 28800000,
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
            markPrice: parseFloat(r.mark_price) || 0,
            indexPrice: parseFloat(r.index_price) || 0,
            nextFundingTime: Date.now() + 3600000,
          };
        } catch { return null; }
      });
      return (await Promise.all(promises)).filter((item): item is FundingData => item !== null && !isNaN(item.fundingRate));
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
          markPrice: 0,
          indexPrice: 0,
          nextFundingTime: item.next_funding_time || Date.now() + 28800000,
        }))
        .filter((item: any) => !isNaN(item.fundingRate));
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
          fundingRate: (parseFloat(item[9]) || 0) * 100,
          markPrice: parseFloat(item[15]) || 0,
          indexPrice: parseFloat(item[4]) || 0,
          nextFundingTime: item[8] || Date.now() + 28800000,
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
          markPrice: parseFloat(item.last_price) || 0,
          indexPrice: parseFloat(item.index_price) || 0,
          nextFundingTime: item.next_funding_rate_timestamp ? item.next_funding_rate_timestamp * 1000 : Date.now() + 28800000,
        }))
        .filter((item: any) => !isNaN(item.fundingRate));
    },
  },

  // Coinbase International — predicted_funding is HOURLY; normalize to 8h equivalent (* 8)
  {
    name: 'Coinbase',
    fetcher: async (fetchFn) => {
      const res = await fetchFn('https://api.international.coinbase.com/api/v1/instruments');
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data
        .filter((item: any) => item.instrument_type === 'PERP' && item.quote?.predicted_funding != null)
        .map((item: any) => ({
          symbol: item.symbol.replace('-PERP', ''),
          exchange: 'Coinbase',
          fundingRate: parseFloat(item.quote.predicted_funding) * 8 * 100,
          markPrice: parseFloat(item.quote?.mark_price) || 0,
          indexPrice: parseFloat(item.quote?.index_price) || 0,
          nextFundingTime: Date.now() + 3600000,
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
          const rate = parseFloat(json.data.latest_funding_rate || json.data.next_funding_rate || '0');
          return {
            symbol: t.market.replace('USDT', ''),
            exchange: 'CoinEx',
            fundingRate: rate * 100,
            markPrice: parseFloat(json.data.mark_price || t.mark_price) || 0,
            indexPrice: parseFloat(t.index_price) || 0,
            nextFundingTime: json.data.next_funding_time ? parseInt(json.data.next_funding_time) : Date.now() + 28800000,
          };
        } catch { return null; }
      });
      return (await Promise.all(promises)).filter((item): item is FundingData => item !== null && !isNaN(item.fundingRate));
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
      // Get perp tickers for prices/OI, then fetch funding for top symbols
      const perps = items.filter((t: any) => t.i && t.i.endsWith('USD-PERP'));
      const topPerps = perps
        .sort((a: any, b: any) => parseFloat(b.vv || '0') - parseFloat(a.vv || '0'))
        .slice(0, 40);
      const promises = topPerps.map(async (t: any) => {
        try {
          const frRes = await fetchFn(
            `https://api.crypto.com/exchange/v1/public/get-valuations?instrument_name=${encodeURIComponent(t.i)}&valuation_type=funding_rate`,
            {},
            5000
          );
          if (!frRes.ok) return null;
          const frJson = await frRes.json();
          const frData = frJson.result?.data;
          if (!Array.isArray(frData) || frData.length === 0) return null;
          const latest = frData[frData.length - 1];
          return {
            symbol: t.i.replace('USD-PERP', ''),
            exchange: 'Crypto.com',
            fundingRate: parseFloat(latest.v) * 100,
            markPrice: parseFloat(t.a) || 0,
            indexPrice: 0,
            nextFundingTime: Date.now() + 3600000,
          };
        } catch { return null; }
      });
      return (await Promise.all(promises)).filter((item): item is FundingData => item !== null && !isNaN(item.fundingRate));
    },
  },
];

// Paused exchanges (kept for reference):
// gTrade (Gains Network) - API is reachable (backend-arbitrum.gains.trade/trading-variables)
//   but funding rate is velocity-based (v10 model), computed dynamically from OI skew windows.
//   No pre-calculated rate endpoint; would require on-the-fly calculation from oiWindows data.
// GMX v2 (Arbitrum) - No REST funding rate endpoint; requires on-chain contract queries
// Bitunix - No public funding rate endpoint found
// LBank - Futures domain (fapi.lbank.com) unreachable
