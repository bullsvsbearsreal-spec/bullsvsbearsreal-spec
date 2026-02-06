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

  // gTrade (Gains Network) - Arbitrum
  try {
    const res = await fetchWithTimeout('https://backend-arbitrum.gains.trade/trading-variables');
    if (res.ok) {
      const json = await res.json();
      if (json && json.pairs && json.collaterals) {
        // Get USDC collateral data (usually index 2 or 3)
        const usdcCollateral = json.collaterals.find((c: any) =>
          c.symbol === 'USDC' || c.symbol === 'USDT'
        );

        if (usdcCollateral && usdcCollateral.fundingFees) {
          const gtradeData: any[] = [];

          // Process each pair
          json.pairs.forEach((pair: any, index: number) => {
            try {
              const fundingFee = usdcCollateral.fundingFees[index];
              if (fundingFee && pair.from) {
                // Calculate funding rate from accPerOiLong/Short delta or use fundingRate if available
                // gTrade uses different funding model - approximating hourly rate
                const fundingRateLong = parseFloat(fundingFee.accPerOiLong || '0');
                const fundingRateShort = parseFloat(fundingFee.accPerOiShort || '0');

                // Use the average or the dominant side's rate
                // Convert from per-second to 8-hour funding rate percentage
                const avgFundingRate = (fundingRateLong - fundingRateShort) / 2;
                const hourlyRate = avgFundingRate * 3600; // per hour
                const fundingRate8h = hourlyRate * 8 * 100; // 8-hour in percentage

                // Get price from pairOis if available
                let markPrice = 0;
                if (usdcCollateral.pairOis && usdcCollateral.pairOis[index]) {
                  markPrice = parseFloat(usdcCollateral.pairOis[index].price || '0');
                }

                // Only add if we have a valid symbol (crypto pairs only)
                const symbol = pair.from.toUpperCase();
                if (symbol && pair.to === 'USD' && pair.groupIndex <= 1) { // groupIndex 0-1 are crypto
                  gtradeData.push({
                    symbol: symbol,
                    exchange: 'gTrade',
                    fundingRate: isFinite(fundingRate8h) ? fundingRate8h : 0,
                    markPrice: markPrice,
                    indexPrice: markPrice,
                    nextFundingTime: Date.now() + 3600000,
                  });
                }
              }
            } catch {
              // Skip invalid pairs
            }
          });

          results.push(...gtradeData.filter((item: any) => !isNaN(item.fundingRate)));
        }
      }
    }
  } catch (error) {
    console.error('gTrade funding error:', error);
  }

  return NextResponse.json(results);
}
