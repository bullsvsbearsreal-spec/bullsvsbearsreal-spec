import { NextResponse } from 'next/server';
import axios from 'axios';

// Common headers to help with API requests
const commonHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Fetch funding rates from all exchanges server-side to avoid CORS
export async function GET() {
  const results: any[] = [];

  // Binance
  try {
    const binanceRes = await axios.get('https://fapi.binance.com/fapi/v1/premiumIndex', {
      timeout: 10000,
      headers: commonHeaders,
    });
    const binanceData = binanceRes.data
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
  } catch (error) {
    console.error('Binance funding error:', error);
  }

  // Bybit
  try {
    const bybitRes = await axios.get('https://api.bybit.com/v5/market/tickers', {
      params: { category: 'linear' },
      timeout: 10000,
      headers: commonHeaders,
    });
    if (bybitRes.data.retCode === 0) {
      const bybitData = bybitRes.data.result.list
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
  } catch (error) {
    console.error('Bybit funding error:', error);
  }

  // OKX - First get instruments, then fetch funding rates individually
  try {
    // Get list of USDT perpetual swaps
    const instrumentsRes = await axios.get('https://www.okx.com/api/v5/public/instruments', {
      params: { instType: 'SWAP' },
      timeout: 10000,
      headers: commonHeaders,
    });
    if (instrumentsRes.data.code === '0') {
      const usdtSwaps = instrumentsRes.data.data
        .filter((inst: any) => inst.instId.endsWith('-USDT-SWAP'))
        .slice(0, 50); // Limit to top 50 for performance

      // Fetch funding rates for each instrument
      const fundingPromises = usdtSwaps.map(async (inst: any) => {
        try {
          const frRes = await axios.get('https://www.okx.com/api/v5/public/funding-rate', {
            params: { instId: inst.instId },
            timeout: 5000,
            headers: commonHeaders,
          });
          if (frRes.data.code === '0' && frRes.data.data.length > 0) {
            const fr = frRes.data.data[0];
            return {
              symbol: inst.instId.replace('-USDT-SWAP', ''),
              exchange: 'OKX',
              fundingRate: parseFloat(fr.fundingRate) * 100,
              markPrice: 0,
              indexPrice: 0,
              nextFundingTime: parseInt(fr.nextFundingTime) || Date.now(),
            };
          }
        } catch {
          return null;
        }
        return null;
      });
      const okxData = (await Promise.all(fundingPromises)).filter((item: any) => item && !isNaN(item.fundingRate));
      results.push(...okxData);
    }
  } catch (error) {
    console.error('OKX funding error:', error);
  }

  // Bitget
  try {
    const bitgetRes = await axios.get('https://api.bitget.com/api/v2/mix/market/tickers', {
      params: { productType: 'USDT-FUTURES' },
      timeout: 10000,
      headers: commonHeaders,
    });
    if (bitgetRes.data.code === '00000') {
      const bitgetData = bitgetRes.data.data
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
  } catch (error) {
    console.error('Bitget funding error:', error);
  }

  // Hyperliquid
  try {
    const hlRes = await axios.post('https://api.hyperliquid.xyz/info', {
      type: 'metaAndAssetCtxs',
    }, {
      timeout: 10000,
      headers: commonHeaders,
    });
    if (hlRes.data && hlRes.data[1]) {
      const hlData = hlRes.data[1]
        .map((item: any, index: number) => ({
          symbol: hlRes.data[0].universe[index]?.name || `ASSET${index}`,
          exchange: 'Hyperliquid',
          fundingRate: parseFloat(item.funding) * 100,
          markPrice: parseFloat(item.markPx),
          indexPrice: parseFloat(item.oraclePx),
          nextFundingTime: Date.now() + 3600000,
        }))
        .filter((item: any) => !isNaN(item.fundingRate) && item.fundingRate !== 0);
      results.push(...hlData);
    }
  } catch (error) {
    console.error('Hyperliquid funding error:', error);
  }

  // dYdX
  try {
    const dydxRes = await axios.get('https://indexer.dydx.trade/v4/perpetualMarkets', {
      timeout: 10000,
      headers: commonHeaders,
    });
    if (dydxRes.data.markets) {
      const dydxData = Object.entries(dydxRes.data.markets)
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
  } catch (error) {
    console.error('dYdX funding error:', error);
  }

  return NextResponse.json(results);
}
