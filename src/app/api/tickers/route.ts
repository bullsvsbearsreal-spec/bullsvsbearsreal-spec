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

// Fetch tickers from all exchanges server-side to avoid CORS
export async function GET() {
  const results: any[] = [];

  // Binance
  try {
    const res = await fetchWithTimeout('https://fapi.binance.com/fapi/v1/ticker/24hr');
    if (res.ok) {
      const data = await res.json();
      const binanceData = data
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
      results.push(...binanceData);
    }
  } catch (error) {
    console.error('Binance tickers error:', error);
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
            lastPrice: parseFloat(ticker.lastPrice),
            price: parseFloat(ticker.lastPrice),
            priceChangePercent24h: parseFloat(ticker.price24hPcnt) * 100,
            changePercent24h: parseFloat(ticker.price24hPcnt) * 100,
            high24h: parseFloat(ticker.highPrice24h),
            low24h: parseFloat(ticker.lowPrice24h),
            volume24h: parseFloat(ticker.volume24h),
            quoteVolume24h: parseFloat(ticker.turnover24h),
          }));
        results.push(...bybitData);
      }
    }
  } catch (error) {
    console.error('Bybit tickers error:', error);
  }

  // OKX
  try {
    const res = await fetchWithTimeout('https://www.okx.com/api/v5/market/tickers?instType=SWAP');
    if (res.ok) {
      const json = await res.json();
      if (json.code === '0') {
        const okxData = json.data
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
        results.push(...okxData);
      }
    }
  } catch (error) {
    console.error('OKX tickers error:', error);
  }

  // Bitget
  try {
    const res = await fetchWithTimeout('https://api.bitget.com/api/v2/mix/market/tickers?productType=USDT-FUTURES');
    if (res.ok) {
      const json = await res.json();
      if (json.code === '00000') {
        const bitgetData = json.data
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
        results.push(...bitgetData);
      }
    }
  } catch (error) {
    console.error('Bitget tickers error:', error);
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
          lastPrice: parseFloat(item.markPx),
          price: parseFloat(item.markPx),
          priceChangePercent24h: parseFloat(item.dayNtlVlm) > 0 ? ((parseFloat(item.markPx) - parseFloat(item.prevDayPx)) / parseFloat(item.prevDayPx)) * 100 : 0,
          changePercent24h: parseFloat(item.dayNtlVlm) > 0 ? ((parseFloat(item.markPx) - parseFloat(item.prevDayPx)) / parseFloat(item.prevDayPx)) * 100 : 0,
          high24h: 0,
          low24h: 0,
          volume24h: parseFloat(item.dayNtlVlm),
          quoteVolume24h: parseFloat(item.dayNtlVlm),
        })).filter((item: any) => !isNaN(item.lastPrice) && item.lastPrice > 0);
        results.push(...hlData);
      }
    }
  } catch (error) {
    console.error('Hyperliquid tickers error:', error);
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
            lastPrice: parseFloat(market.oraclePrice),
            price: parseFloat(market.oraclePrice),
            priceChangePercent24h: parseFloat(market.priceChange24H) || 0,
            changePercent24h: parseFloat(market.priceChange24H) || 0,
            high24h: 0,
            low24h: 0,
            volume24h: parseFloat(market.volume24H),
            quoteVolume24h: parseFloat(market.volume24H),
          }));
        results.push(...dydxData);
      }
    }
  } catch (error) {
    console.error('dYdX tickers error:', error);
  }

  return NextResponse.json(results);
}
