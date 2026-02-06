import { NextResponse } from 'next/server';
import axios from 'axios';

// Common headers to help with API requests
const commonHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Fetch open interest from all exchanges server-side to avoid CORS
export async function GET() {
  const results: any[] = [];

  // Binance - Use ticker endpoint which includes OI
  try {
    const tickerRes = await axios.get('https://fapi.binance.com/fapi/v1/ticker/24hr', {
      timeout: 10000,
      headers: commonHeaders,
    });
    // Get top symbols by volume for OI data
    const topSymbols = tickerRes.data
      .filter((t: any) => t.symbol.endsWith('USDT'))
      .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .slice(0, 30);

    const oiPromises = topSymbols.map(async (ticker: any) => {
      try {
        const oiRes = await axios.get('https://fapi.binance.com/fapi/v1/openInterest', {
          params: { symbol: ticker.symbol },
          timeout: 5000,
          headers: commonHeaders,
        });
        return {
          symbol: ticker.symbol.replace('USDT', ''),
          exchange: 'Binance',
          openInterest: parseFloat(oiRes.data.openInterest),
          openInterestValue: parseFloat(oiRes.data.openInterest) * parseFloat(ticker.lastPrice),
        };
      } catch {
        return null;
      }
    });
    const binanceOI = (await Promise.all(oiPromises)).filter(Boolean);
    results.push(...binanceOI);
  } catch (error) {
    console.error('Binance OI error:', error);
  }

  // Bybit
  try {
    const res = await axios.get('https://api.bybit.com/v5/market/tickers', {
      params: { category: 'linear' },
      timeout: 10000,
      headers: commonHeaders,
    });
    if (res.data.retCode === 0) {
      const data = res.data.result.list
        .filter((t: any) => t.symbol.endsWith('USDT'))
        .map((ticker: any) => ({
          symbol: ticker.symbol.replace('USDT', ''),
          exchange: 'Bybit',
          openInterest: parseFloat(ticker.openInterest),
          openInterestValue: parseFloat(ticker.openInterestValue),
        }));
      results.push(...data);
    }
  } catch (error) {
    console.error('Bybit OI error:', error);
  }

  // OKX
  try {
    const res = await axios.get('https://www.okx.com/api/v5/public/open-interest', {
      params: { instType: 'SWAP' },
      timeout: 10000,
      headers: commonHeaders,
    });
    if (res.data.code === '0') {
      const tickerRes = await axios.get('https://www.okx.com/api/v5/market/tickers', {
        params: { instType: 'SWAP' },
        timeout: 10000,
        headers: commonHeaders,
      });
      const priceMap = new Map();
      if (tickerRes.data.code === '0') {
        tickerRes.data.data.forEach((t: any) => {
          priceMap.set(t.instId, parseFloat(t.last));
        });
      }
      const data = res.data.data
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
      results.push(...data);
    }
  } catch (error) {
    console.error('OKX OI error:', error);
  }

  // Bitget
  try {
    const res = await axios.get('https://api.bitget.com/api/v2/mix/market/open-interest', {
      params: { productType: 'USDT-FUTURES' },
      timeout: 10000,
      headers: commonHeaders,
    });
    if (res.data.code === '00000') {
      const tickerRes = await axios.get('https://api.bitget.com/api/v2/mix/market/tickers', {
        params: { productType: 'USDT-FUTURES' },
        timeout: 10000,
        headers: commonHeaders,
      });
      const priceMap = new Map();
      if (tickerRes.data.code === '00000') {
        tickerRes.data.data.forEach((t: any) => {
          priceMap.set(t.symbol, parseFloat(t.lastPr));
        });
      }
      const data = res.data.data
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
      results.push(...data);
    }
  } catch (error) {
    console.error('Bitget OI error:', error);
  }

  // Hyperliquid
  try {
    const res = await axios.post('https://api.hyperliquid.xyz/info', {
      type: 'metaAndAssetCtxs',
    }, {
      timeout: 10000,
      headers: commonHeaders,
    });
    if (res.data && res.data[0] && res.data[1]) {
      const data = res.data[1].map((item: any, index: number) => ({
        symbol: res.data[0].universe[index]?.name || `ASSET${index}`,
        exchange: 'Hyperliquid',
        openInterest: parseFloat(item.openInterest),
        openInterestValue: parseFloat(item.openInterest) * parseFloat(item.markPx),
      })).filter((item: any) => !isNaN(item.openInterestValue) && item.openInterestValue > 0);
      results.push(...data);
    }
  } catch (error) {
    console.error('Hyperliquid OI error:', error);
  }

  // dYdX
  try {
    const res = await axios.get('https://indexer.dydx.trade/v4/perpetualMarkets', {
      timeout: 10000,
      headers: commonHeaders,
    });
    if (res.data.markets) {
      const data = Object.entries(res.data.markets)
        .filter(([key]: [string, any]) => key.endsWith('-USD'))
        .map(([key, market]: [string, any]) => ({
          symbol: key.replace('-USD', ''),
          exchange: 'dYdX',
          openInterest: parseFloat(market.openInterest),
          openInterestValue: parseFloat(market.openInterest) * parseFloat(market.oraclePrice),
        }));
      results.push(...data);
    }
  } catch (error) {
    console.error('dYdX OI error:', error);
  }

  return NextResponse.json(results);
}
