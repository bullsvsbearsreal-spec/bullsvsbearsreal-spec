import { Direction } from '../types';

export interface GMXMarketInfo {
  marketToken: string;
  midPrice: number;
  longOiUsd: number;
  shortOiUsd: number;
  positionImpactFactorPositive: number;
  positionImpactFactorNegative: number;
  positionImpactExponentFactor: number;
}

export async function fetchGMXParams(asset: string, fetchFn: typeof fetch): Promise<GMXMarketInfo | null> {
  try {
    const res = await fetchFn('https://arbitrum-api.gmxinfra.io/markets/info', { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();

    interface RawGMXMarket {
      name?: string; marketToken?: string;
      // Current API field names (2026+)
      openInterestLong?: string; openInterestShort?: string;
      // Legacy field names
      longOpenInterest?: string; shortOpenInterest?: string;
      // Price fields (current API no longer provides indexTokenPrice)
      indexTokenPrice?: { max?: string; min?: string };
      // Impact factors (may be absent in newer API versions)
      positionImpactExponentFactor?: string;
      positionImpactFactorPositive?: string; positionImpactFactorNegative?: string;
      positionImpactPositiveFactor?: string; positionImpactNegativeFactor?: string;
    }

    const rawMarkets = Array.isArray(data.markets) ? data.markets : Object.values(data);
    const markets = rawMarkets as RawGMXMarket[];

    // Find all markets matching the asset, pick the one with highest OI
    const matching = markets.filter((m) => {
      const sym = (m.name || '').split('/')[0].replace(/\.v\d+$/i, '').toUpperCase();
      return sym === asset;
    });
    if (matching.length === 0) return null;

    const parse30 = (v: string | undefined) => v ? Number(BigInt(v)) / 1e30 : 0;

    // Pick market with highest total OI (multiple collateral pools exist)
    const market = matching.reduce((best, m) => {
      const oi = parse30(m.openInterestLong || m.longOpenInterest) + parse30(m.openInterestShort || m.shortOpenInterest);
      const bestOi = parse30(best.openInterestLong || best.longOpenInterest) + parse30(best.openInterestShort || best.shortOpenInterest);
      return oi > bestOi ? m : best;
    });

    const longOiUsd = parse30(market.openInterestLong || market.longOpenInterest);
    const shortOiUsd = parse30(market.openInterestShort || market.shortOpenInterest);

    // Price: try indexTokenPrice (legacy), fallback to 0 (caller should use external price)
    let midPrice = parse30(market.indexTokenPrice?.max || market.indexTokenPrice?.min);

    // If no price from GMX, fetch from CoinGecko as fallback
    if (midPrice <= 0) {
      try {
        const cgId = asset === 'BTC' ? 'bitcoin' : asset === 'ETH' ? 'ethereum' : asset === 'SOL' ? 'solana' : asset.toLowerCase();
        const priceRes = await fetchFn(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd`, { signal: AbortSignal.timeout(4000) });
        if (priceRes.ok) {
          const priceData = await priceRes.json();
          midPrice = priceData[cgId]?.usd || 0;
        }
      } catch { /* fallback price stays 0 */ }
    }

    return {
      marketToken: market.marketToken || '',
      midPrice,
      longOiUsd,
      shortOiUsd,
      positionImpactFactorPositive: parse30(market.positionImpactFactorPositive || market.positionImpactPositiveFactor),
      positionImpactFactorNegative: parse30(market.positionImpactFactorNegative || market.positionImpactNegativeFactor),
      positionImpactExponentFactor: parse30(market.positionImpactExponentFactor),
    };
  } catch { return null; }
}

export function computeGMXCost(
  market: GMXMarketInfo,
  orderSizeUsd: number,
  direction: Direction,
): { priceImpact: number; executionPrice: number; midPrice: number } {
  const currentDiff = Math.abs(market.longOiUsd - market.shortOiUsd);
  const newLong = market.longOiUsd + (direction === 'long' ? orderSizeUsd : 0);
  const newShort = market.shortOiUsd + (direction === 'short' ? orderSizeUsd : 0);
  const nextDiff = Math.abs(newLong - newShort);

  const improves = nextDiff < currentDiff;
  const factor = improves ? market.positionImpactFactorPositive : market.positionImpactFactorNegative;
  const exponent = market.positionImpactExponentFactor || 2;

  let impactUsd = 0;
  if (factor > 0) {
    impactUsd = factor * (Math.pow(nextDiff, exponent) - Math.pow(currentDiff, exponent));
  }

  const rawImpact = market.midPrice > 0 && orderSizeUsd > 0
    ? Math.abs(impactUsd) / orderSizeUsd * 100
    : 0;
  // Cap at 50% to guard against formula edge cases producing absurd values
  const priceImpact = isFinite(rawImpact) ? Math.min(rawImpact, 50) : 0;

  const sign = direction === 'long' ? 1 : -1;
  const executionPrice = market.midPrice * (1 + sign * priceImpact / 100);
  return { priceImpact, executionPrice, midPrice: market.midPrice };
}
