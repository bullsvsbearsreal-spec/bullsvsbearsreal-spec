import { Direction } from '../types';

interface GMXMarketInfo {
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

    interface RawGMXMarket { name?: string; marketToken?: string; indexTokenPrice?: { max?: string; min?: string }; longOpenInterest?: string; shortOpenInterest?: string; openInterestLong?: string; openInterestShort?: string; fundingRateLong?: string; fundingRateShort?: string; borrowRateLong?: string; borrowRateShort?: string; positionImpactExponent?: string; positionImpactExponentFactor?: string; positionImpactPositiveFactor?: string; positionImpactNegativeFactor?: string; positionImpactFactorPositive?: string; positionImpactFactorNegative?: string }
    const markets = Object.values(data) as RawGMXMarket[];
    const market = markets.find((m) => {
      const sym = (m.name || '').split('/')[0].replace(/\.v\d+$/i, '').toUpperCase();
      return sym === asset;
    });
    if (!market) return null;

    const parse30 = (v: string | undefined) => v ? Number(BigInt(v)) / 1e30 : 0;

    return {
      marketToken: market.marketToken || '',
      midPrice: parse30(market.indexTokenPrice?.max || market.indexTokenPrice?.min),
      longOiUsd: parse30(market.longOpenInterest),
      shortOiUsd: parse30(market.shortOpenInterest),
      positionImpactFactorPositive: parse30(market.positionImpactFactorPositive),
      positionImpactFactorNegative: parse30(market.positionImpactFactorNegative),
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
