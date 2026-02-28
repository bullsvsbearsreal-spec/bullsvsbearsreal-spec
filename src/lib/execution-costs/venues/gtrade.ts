import { Direction } from '../types';

interface GTradeParams {
  pairIndex: number;
  midPrice: number;
  depthAbove: number;
  depthBelow: number;
  longOi: number;
  shortOi: number;
}

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

    const depths = data.pairDepths?.[pairIndex] || data.pairSkewDepths?.[pairIndex];
    if (!depths) return null;

    const ois = data.pairOis?.[pairIndex];
    const depthAbove = parseFloat(depths.onePercentDepthAboveUsd || depths[0] || '0');
    const depthBelow = parseFloat(depths.onePercentDepthBelowUsd || depths[1] || '0');
    const longOi = parseFloat(ois?.longOiUsd || ois?.long || '0');
    const shortOi = parseFloat(ois?.shortOiUsd || ois?.short || '0');

    const prices = data.prices || [];
    const midPrice = parseFloat(prices[pairIndex] || '0');

    return { pairIndex, midPrice, depthAbove, depthBelow, longOi, shortOi };
  } catch { return null; }
}

export function computeGTradeCost(
  params: GTradeParams,
  orderSizeUsd: number,
  direction: Direction,
): { priceImpact: number; executionPrice: number; midPrice: number } {
  const depth = direction === 'long' ? params.depthAbove : params.depthBelow;
  const currentOi = direction === 'long' ? params.longOi : params.shortOi;
  const priceImpact = depth > 0 ? (currentOi + orderSizeUsd / 2) / depth : 0;
  const sign = direction === 'long' ? 1 : -1;
  const executionPrice = params.midPrice * (1 + sign * priceImpact / 100);
  return { priceImpact, executionPrice, midPrice: params.midPrice };
}
