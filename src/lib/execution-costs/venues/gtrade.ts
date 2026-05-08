import { Direction } from '../types';

export interface GTradeParams {
  pairIndex: number;
  midPrice: number;
  depthAbove: number;
  depthBelow: number;
  longOi: number;
  shortOi: number;
  baseFeeP: number; // base fee percentage (e.g. 0.06 = 0.06%)
}

// CoinGecko ID mapping for common assets
const CG_IDS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin',
  XRP: 'ripple', DOGE: 'dogecoin', ADA: 'cardano', AVAX: 'avalanche-2',
  LINK: 'chainlink', DOT: 'polkadot', MATIC: 'matic-network', UNI: 'uniswap',
  NEAR: 'near', ARB: 'arbitrum', OP: 'optimism', SUI: 'sui', APT: 'aptos',
};

export async function fetchGTradeParams(asset: string, fetchFn: typeof fetch): Promise<GTradeParams | null> {
  try {
    const res = await fetchFn('https://backend-arbitrum.gains.trade/trading-variables', { signal: AbortSignal.timeout(8000), cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();

    const pairs = data.pairs || [];
    const pairIndex = pairs.findIndex((p: any) => {
      const from = (p.from || '').split('_')[0].toUpperCase();
      return from === asset && (p.to || '').toUpperCase() === 'USD';
    });
    if (pairIndex === -1) return null;

    const pair = pairs[pairIndex];

    // Extract base fee from fees array (precision 1e10)
    const feeIndex = parseInt(pair.feeIndex || '0', 10);
    const fees = data.fees || [];
    const feeEntry = fees[feeIndex];
    const baseFeeP = feeEntry ? parseInt(feeEntry.totalPositionSizeFeeP || '0', 10) / 1e10 : 0.06;

    // Try legacy depth fields first, then new pairInfos.pairDepthBands
    let depthAbove = 0;
    let depthBelow = 0;
    let longOi = 0;
    let shortOi = 0;

    // Legacy format (pre-2026)
    const depths = data.pairDepths?.[pairIndex] || data.pairSkewDepths?.[pairIndex];
    if (depths) {
      depthAbove = parseFloat(depths.onePercentDepthAboveUsd || depths[0] || '0');
      depthBelow = parseFloat(depths.onePercentDepthBelowUsd || depths[1] || '0');
    }

    const ois = data.pairOis?.[pairIndex];
    if (ois) {
      longOi = parseFloat(ois.longOiUsd || ois.long || '0');
      shortOi = parseFloat(ois.shortOiUsd || ois.short || '0');
    }

    // Try to sum OI from oiWindows if legacy pairOis is missing
    if (longOi === 0 && shortOi === 0 && data.oiWindows) {
      for (const windowKey of Object.keys(data.oiWindows)) {
        const windowData = data.oiWindows[windowKey];
        const pairOiEntry = windowData?.[String(pairIndex)];
        if (pairOiEntry) {
          longOi += parseFloat(pairOiEntry.oiLongUsd || '0') / 1e18;
          shortOi += parseFloat(pairOiEntry.oiShortUsd || '0') / 1e18;
        }
      }
    }

    // Get price: try legacy prices array, then CoinGecko fallback
    let midPrice = 0;
    const prices = data.prices || [];
    midPrice = parseFloat(prices[pairIndex] || '0');

    if (midPrice <= 0) {
      try {
        const cgId = CG_IDS[asset] || asset.toLowerCase();
        const priceRes = await fetchFn(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd`, { signal: AbortSignal.timeout(4000) });
        if (priceRes.ok) {
          const priceData = await priceRes.json();
          midPrice = priceData[cgId]?.usd || 0;
        }
      } catch { /* price stays 0 */ }
    }

    return { pairIndex, midPrice, depthAbove, depthBelow, longOi, shortOi, baseFeeP };
  } catch { return null; }
}

export function computeGTradeCost(
  params: GTradeParams,
  orderSizeUsd: number,
  direction: Direction,
): { priceImpact: number; executionPrice: number; midPrice: number } {
  const depth = direction === 'long' ? params.depthAbove : params.depthBelow;
  const currentOi = direction === 'long' ? params.longOi : params.shortOi;

  // If depth data is available, compute OI-based price impact
  // Otherwise, use base fee as a minimum impact estimate
  let priceImpact = 0;
  if (depth > 0) {
    priceImpact = (currentOi + orderSizeUsd / 2) / depth;
  } else if (currentOi > 0 && params.midPrice > 0) {
    // Fallback: estimate impact from OI skew (simplified)
    const totalOi = params.longOi + params.shortOi;
    if (totalOi > 0) {
      priceImpact = (orderSizeUsd / totalOi) * 0.5; // conservative estimate
    }
  }

  const sign = direction === 'long' ? 1 : -1;
  const executionPrice = params.midPrice * (1 + sign * priceImpact / 100);
  return { priceImpact, executionPrice, midPrice: params.midPrice };
}
