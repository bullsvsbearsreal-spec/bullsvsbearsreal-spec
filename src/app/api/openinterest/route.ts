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

// Fetch open interest from all exchanges server-side to avoid CORS
export async function GET() {
  const results: any[] = [];

  // Binance - Get ticker for prices, then fetch OI for top symbols
  try {
    const tickerRes = await fetchWithTimeout('https://fapi.binance.com/fapi/v1/ticker/24hr');
    if (tickerRes.ok) {
      const tickerData = await tickerRes.json();
      const topSymbols = tickerData
        .filter((t: any) => t.symbol.endsWith('USDT'))
        .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
        .slice(0, 30);

      const oiPromises = topSymbols.map(async (ticker: any) => {
        try {
          const oiRes = await fetchWithTimeout(
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
      const binanceOI = (await Promise.all(oiPromises)).filter(Boolean);
      results.push(...binanceOI);
    }
  } catch (error) {
    console.error('Binance OI error:', error);
  }

  // Bybit
  try {
    const res = await fetchWithTimeout('https://api.bybit.com/v5/market/tickers?category=linear');
    if (res.ok) {
      const json = await res.json();
      if (json.retCode === 0) {
        const bybitData = json.result.list
          .filter((t: any) => t.symbol.endsWith('USDT'))
          .map((ticker: any) => ({
            symbol: ticker.symbol.replace('USDT', ''),
            exchange: 'Bybit',
            openInterest: parseFloat(ticker.openInterest),
            openInterestValue: parseFloat(ticker.openInterestValue),
          }));
        results.push(...bybitData);
      }
    }
  } catch (error) {
    console.error('Bybit OI error:', error);
  }

  // OKX
  try {
    const res = await fetchWithTimeout('https://www.okx.com/api/v5/public/open-interest?instType=SWAP');
    if (res.ok) {
      const json = await res.json();
      if (json.code === '0') {
        // Get prices
        const tickerRes = await fetchWithTimeout('https://www.okx.com/api/v5/market/tickers?instType=SWAP');
        const priceMap = new Map();
        if (tickerRes.ok) {
          const tickerJson = await tickerRes.json();
          if (tickerJson.code === '0') {
            tickerJson.data.forEach((t: any) => {
              priceMap.set(t.instId, parseFloat(t.last));
            });
          }
        }
        const okxData = json.data
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
        results.push(...okxData);
      }
    }
  } catch (error) {
    console.error('OKX OI error:', error);
  }

  // Bitget
  try {
    const res = await fetchWithTimeout('https://api.bitget.com/api/v2/mix/market/open-interest?productType=USDT-FUTURES');
    if (res.ok) {
      const json = await res.json();
      if (json.code === '00000') {
        // Get prices
        const tickerRes = await fetchWithTimeout('https://api.bitget.com/api/v2/mix/market/tickers?productType=USDT-FUTURES');
        const priceMap = new Map();
        if (tickerRes.ok) {
          const tickerJson = await tickerRes.json();
          if (tickerJson.code === '00000') {
            tickerJson.data.forEach((t: any) => {
              priceMap.set(t.symbol, parseFloat(t.lastPr));
            });
          }
        }
        const bitgetData = json.data
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
        results.push(...bitgetData);
      }
    }
  } catch (error) {
    console.error('Bitget OI error:', error);
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
      if (json && json[0] && json[1]) {
        const hlData = json[1].map((item: any, index: number) => ({
          symbol: json[0].universe[index]?.name || `ASSET${index}`,
          exchange: 'Hyperliquid',
          openInterest: parseFloat(item.openInterest),
          openInterestValue: parseFloat(item.openInterest) * parseFloat(item.markPx),
        })).filter((item: any) => !isNaN(item.openInterestValue) && item.openInterestValue > 0);
        results.push(...hlData);
      }
    }
  } catch (error) {
    console.error('Hyperliquid OI error:', error);
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
            openInterest: parseFloat(market.openInterest),
            openInterestValue: parseFloat(market.openInterest) * parseFloat(market.oraclePrice),
          }));
        results.push(...dydxData);
      }
    }
  } catch (error) {
    console.error('dYdX OI error:', error);
  }

  // Gate.io
  try {
    const res = await fetchWithTimeout('https://api.gateio.ws/api/v4/futures/usdt/contracts');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        const gateData = data
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
        results.push(...gateData);
      }
    }
  } catch (error) {
    console.error('Gate.io OI error:', error);
  }

  // MEXC
  try {
    const res = await fetchWithTimeout('https://contract.mexc.com/api/v1/contract/ticker');
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const mexcData = json.data
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
        results.push(...mexcData);
      }
    }
  } catch (error) {
    console.error('MEXC OI error:', error);
  }

  // Kraken Futures
  try {
    const res = await fetchWithTimeout('https://futures.kraken.com/derivatives/api/v3/tickers');
    if (res.ok) {
      const json = await res.json();
      if (json.result === 'success' && Array.isArray(json.tickers)) {
        const krakenData = json.tickers
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
          });
        results.push(...krakenData);
      }
    }
  } catch (error) {
    console.error('Kraken OI error:', error);
  }

  // BingX
  try {
    const res = await fetchWithTimeout('https://open-api.bingx.com/openApi/swap/v2/quote/ticker');
    if (res.ok) {
      const json = await res.json();
      if (json.code === 0 && Array.isArray(json.data)) {
        const bingxData = json.data
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
          });
        results.push(...bingxData);
      }
    }
  } catch (error) {
    console.error('BingX OI error:', error);
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
          // Fields use Rp/Rv suffixes (real precision strings)
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
        results.push(...phemexData);
      }
    }
  } catch (error) {
    console.error('Phemex OI error:', error);
  }

  return NextResponse.json(results);
}
