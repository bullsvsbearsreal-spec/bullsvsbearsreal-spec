import { NextResponse } from 'next/server';
import axios from 'axios';

// Common headers to help with API requests
const commonHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Fetch tickers from all exchanges server-side to avoid CORS
export async function GET() {
  const results: any[] = [];

  // Binance
  try {
    const res = await axios.get('https://fapi.binance.com/fapi/v1/ticker/24hr', {
      timeout: 10000,
      headers: commonHeaders,
    });
    const data = res.data
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
    results.push(...data);
  } catch (error) {
    console.error('Binance tickers error:', error);
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
          lastPrice: parseFloat(ticker.lastPrice),
          price: parseFloat(ticker.lastPrice),
          priceChangePercent24h: parseFloat(ticker.price24hPcnt) * 100,
          changePercent24h: parseFloat(ticker.price24hPcnt) * 100,
          high24h: parseFloat(ticker.highPrice24h),
          low24h: parseFloat(ticker.lowPrice24h),
          volume24h: parseFloat(ticker.volume24h),
          quoteVolume24h: parseFloat(ticker.turnover24h),
        }));
      results.push(...data);
    }
  } catch (error) {
    console.error('Bybit tickers error:', error);
  }

  // OKX
  try {
    const res = await axios.get('https://www.okx.com/api/v5/market/tickers', {
      params: { instType: 'SWAP' },
      timeout: 10000,
      headers: commonHeaders,
    });
    if (res.data.code === '0') {
      const data = res.data.data
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
      results.push(...data);
    }
  } catch (error) {
    console.error('OKX tickers error:', error);
  }

  // Bitget
  try {
    const res = await axios.get('https://api.bitget.com/api/v2/mix/market/tickers', {
      params: { productType: 'USDT-FUTURES' },
      timeout: 10000,
      headers: commonHeaders,
    });
    if (res.data.code === '00000') {
      const data = res.data.data
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
      results.push(...data);
    }
  } catch (error) {
    console.error('Bitget tickers error:', error);
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
        lastPrice: parseFloat(item.markPx),
        price: parseFloat(item.markPx),
        priceChangePercent24h: parseFloat(item.dayNtlVlm) > 0 ? ((parseFloat(item.markPx) - parseFloat(item.prevDayPx)) / parseFloat(item.prevDayPx)) * 100 : 0,
        changePercent24h: parseFloat(item.dayNtlVlm) > 0 ? ((parseFloat(item.markPx) - parseFloat(item.prevDayPx)) / parseFloat(item.prevDayPx)) * 100 : 0,
        high24h: 0,
        low24h: 0,
        volume24h: parseFloat(item.dayNtlVlm),
        quoteVolume24h: parseFloat(item.dayNtlVlm),
      })).filter((item: any) => !isNaN(item.lastPrice) && item.lastPrice > 0);
      results.push(...data);
    }
  } catch (error) {
    console.error('Hyperliquid tickers error:', error);
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
          lastPrice: parseFloat(market.oraclePrice),
          price: parseFloat(market.oraclePrice),
          priceChangePercent24h: parseFloat(market.priceChange24H) || 0,
          changePercent24h: parseFloat(market.priceChange24H) || 0,
          high24h: 0,
          low24h: 0,
          volume24h: parseFloat(market.volume24H),
          quoteVolume24h: parseFloat(market.volume24H),
        }));
      results.push(...data);
    }
  } catch (error) {
    console.error('dYdX tickers error:', error);
  }

  return NextResponse.json(results);
}
