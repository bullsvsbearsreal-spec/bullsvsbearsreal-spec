import { NextResponse } from 'next/server';

// Force Edge Runtime to run from Singapore (bypass US geo-restrictions)
export const runtime = 'edge';
export const preferredRegion = 'sin1';

// Common headers to help with API requests
const commonHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Helper function for fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 10000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { ...commonHeaders, ...options.headers },
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// Fetch funding rates from all exchanges server-side to avoid CORS
export async function GET() {
  const results: any[] = [];

  // Binance
  try {
    const res = await fetchWithTimeout('https://fapi.binance.com/fapi/v1/premiumIndex');
    if (res.ok) {
      const data = await res.json();
      const binanceData = data
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
      results.push(...binanceData);
    }
  } catch (error) {
    console.error('Binance funding error:', error);
  }

  // Bybit
  try {
    const res = await fetchWithTimeout('https://api.bybit.com/v5/market/tickers?category=linear');
    if (res.ok) {
      const json = await res.json();
      if (json.retCode === 0) {
        const bybitData = json.result.list
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
        results.push(...bybitData);
      }
    }
  } catch (error) {
    console.error('Bybit funding error:', error);
  }

  // OKX - First get instruments, then fetch funding rates individually
  try {
    const instrumentsRes = await fetchWithTimeout('https://www.okx.com/api/v5/public/instruments?instType=SWAP');
    if (instrumentsRes.ok) {
      const instrumentsJson = await instrumentsRes.json();
      if (instrumentsJson.code === '0') {
        const usdtSwaps = instrumentsJson.data
          .filter((inst: any) => inst.instId.endsWith('-USDT-SWAP'))
          .slice(0, 50);

        const fundingPromises = usdtSwaps.map(async (inst: any) => {
          try {
            const frRes = await fetchWithTimeout(
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
        const okxData = (await Promise.all(fundingPromises)).filter((item: any) => item && !isNaN(item.fundingRate));
        results.push(...okxData);
      }
    }
  } catch (error) {
    console.error('OKX funding error:', error);
  }

  // Bitget
  try {
    const res = await fetchWithTimeout('https://api.bitget.com/api/v2/mix/market/tickers?productType=USDT-FUTURES');
    if (res.ok) {
      const json = await res.json();
      if (json.code === '00000') {
        const bitgetData = json.data
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
        results.push(...bitgetData);
      }
    }
  } catch (error) {
    console.error('Bitget funding error:', error);
  }

  // Hyperliquid
  try {
    const res = await fetchWithTimeout('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json[1]) {
        const hlData = json[1]
          .map((item: any, index: number) => ({
            symbol: json[0].universe[index]?.name || `ASSET${index}`,
            exchange: 'Hyperliquid',
            fundingRate: parseFloat(item.funding) * 100,
            markPrice: parseFloat(item.markPx),
            indexPrice: parseFloat(item.oraclePx),
            nextFundingTime: Date.now() + 3600000,
          }))
          .filter((item: any) => !isNaN(item.fundingRate) && item.fundingRate !== 0);
        results.push(...hlData);
      }
    }
  } catch (error) {
    console.error('Hyperliquid funding error:', error);
  }

  // dYdX
  try {
    const res = await fetchWithTimeout('https://indexer.dydx.trade/v4/perpetualMarkets');
    if (res.ok) {
      const json = await res.json();
      if (json.markets) {
        const dydxData = Object.entries(json.markets)
          .filter(([key]: [string, any]) => key.endsWith('-USD'))
          .map(([key, market]: [string, any]) => ({
            symbol: key.replace('-USD', ''),
            exchange: 'dYdX',
            fundingRate: parseFloat(market.nextFundingRate) * 100,
            markPrice: parseFloat(market.oraclePrice),
            indexPrice: parseFloat(market.oraclePrice),
            nextFundingTime: Date.now() + 3600000,
          }))
          .filter((item: any) => !isNaN(item.fundingRate));
        results.push(...dydxData);
      }
    }
  } catch (error) {
    console.error('dYdX funding error:', error);
  }

  // gTrade (Gains Network) - PAUSED
  // Reason: Funding rate model differs significantly from CEXes, causing misleading arbitrage comparisons
  // TODO: Re-enable with proper rate normalization

  // GMX v2 (Arbitrum) - PAUSED
  // Reason: GMX uses continuous per-second funding rates with 1e30 precision
  // These rates don't translate directly to 8h funding rates used by CEXes
  // Need proper SDK integration for accurate rate conversion
  // TODO: Re-enable with GMX SDK for proper rate calculation

  // Aster DEX
  try {
    const res = await fetchWithTimeout('https://fapi.asterdex.com/fapi/v1/premiumIndex');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        const asterData = data
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
        results.push(...asterData);
      }
    }
  } catch (error) {
    console.error('Aster funding error:', error);
  }

  // Lighter
  try {
    const res = await fetchWithTimeout('https://mainnet.zklighter.elliot.ai/api/v1/funding-rates');
    if (res.ok) {
      const data = await res.json();
      // Lighter returns { funding_rates: [...] } with 'rate' field (not 'fundingRate')
      const fundingRates = data.funding_rates || data;
      if (Array.isArray(fundingRates)) {
        const lighterData = fundingRates
          .filter((item: any) => item.exchange === 'lighter' && item.symbol)
          .map((item: any) => ({
            symbol: item.symbol.replace('-PERP', '').replace('USDT', '').replace('USDC', '').replace('1000', ''),
            exchange: 'Lighter',
            fundingRate: parseFloat(item.rate || '0') * 100, // 'rate' not 'fundingRate'
            markPrice: 0,
            indexPrice: 0,
            nextFundingTime: Date.now() + 3600000,
          }))
          .filter((item: any) => !isNaN(item.fundingRate) && item.fundingRate !== 0);
        results.push(...lighterData);
      }
    }
  } catch (error) {
    console.error('Lighter funding error:', error);
  }

  // Gate.io
  try {
    const res = await fetchWithTimeout('https://api.gateio.ws/api/v4/futures/usdt/contracts');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        const gateData = data
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
        results.push(...gateData);
      }
    }
  } catch (error) {
    console.error('Gate.io funding error:', error);
  }

  // MEXC
  try {
    const res = await fetchWithTimeout('https://contract.mexc.com/api/v1/contract/ticker');
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const mexcData = json.data
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
        results.push(...mexcData);
      }
    }
  } catch (error) {
    console.error('MEXC funding error:', error);
  }

  // Kraken Futures
  try {
    const res = await fetchWithTimeout('https://futures.kraken.com/derivatives/api/v3/tickers');
    if (res.ok) {
      const json = await res.json();
      if (json.result === 'success' && Array.isArray(json.tickers)) {
        const krakenData = json.tickers
          .filter((item: any) => item.symbol.startsWith('PF_') && item.symbol.endsWith('USD') && item.fundingRate != null)
          .map((item: any) => {
            let sym = item.symbol.replace('PF_', '').replace('USD', '');
            if (sym === 'XBT') sym = 'BTC';
            return {
              symbol: sym,
              exchange: 'Kraken',
              // Kraken returns funding rate already as a percentage decimal (e.g., 0.0186 = 0.0186%)
              fundingRate: parseFloat(item.fundingRate),
              markPrice: item.markPrice || 0,
              indexPrice: item.indexPrice || 0,
              nextFundingTime: Date.now() + 3600000,
            };
          })
          .filter((item: any) => !isNaN(item.fundingRate));
        results.push(...krakenData);
      }
    }
  } catch (error) {
    console.error('Kraken funding error:', error);
  }

  // BingX
  try {
    const res = await fetchWithTimeout('https://open-api.bingx.com/openApi/swap/v2/quote/premiumIndex');
    if (res.ok) {
      const json = await res.json();
      if (json.code === 0 && Array.isArray(json.data)) {
        const bingxData = json.data
          .filter((item: any) => item.symbol.endsWith('-USDT') && item.lastFundingRate != null)
          .map((item: any) => ({
            symbol: item.symbol.replace('-USDT', ''),
            exchange: 'BingX',
            fundingRate: parseFloat(item.lastFundingRate) * 100,
            markPrice: parseFloat(item.markPrice) || 0,
            indexPrice: parseFloat(item.indexPrice) || 0,
            nextFundingTime: item.nextFundingTime || Date.now() + 28800000,
          }))
          .filter((item: any) => !isNaN(item.fundingRate));
        results.push(...bingxData);
      }
    }
  } catch (error) {
    console.error('BingX funding error:', error);
  }

  // Phemex
  try {
    const res = await fetchWithTimeout('https://api.phemex.com/md/v2/ticker/24hr/all');
    if (res.ok) {
      const json = await res.json();
      // Phemex v2 API returns { result: [...] } with no code field
      const phemexResult = Array.isArray(json.result) ? json.result : [];
      if (phemexResult.length > 0) {
        const phemexData = phemexResult
          // Fields use Rp/Rr/Rv suffixes (real precision strings), not Ep/Er/Ev (scaled ints)
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
        results.push(...phemexData);
      }
    }
  } catch (error) {
    console.error('Phemex funding error:', error);
  }

  return NextResponse.json(results);
}
