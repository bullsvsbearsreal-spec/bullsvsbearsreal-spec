import { isValidNumber } from '@/lib/utils/format';
import { getExchangeBadgeColor } from '@/lib/constants';

export const formatRate = (rate: number | undefined | null) => {
  if (!isValidNumber(rate)) {
    return '-';
  }
  const formatted = rate.toFixed(4);
  return rate >= 0 ? `+${formatted}%` : `${formatted}%`;
};

export const getRateColor = (rate: number) => {
  if (rate > 0) return 'text-success';
  if (rate < 0) return 'text-danger';
  return 'text-neutral-500';
};

export const getHeatmapColor = (rate: number | undefined) => {
  if (rate === undefined) return 'bg-hub-gray/20';
  if (rate > 0.1) return 'bg-green-500';
  if (rate > 0.01) return 'bg-green-600/80';
  if (rate > 0) return 'bg-green-700/60';
  if (rate < -0.1) return 'bg-red-500';
  if (rate < -0.01) return 'bg-red-600/80';
  if (rate < 0) return 'bg-red-700/60';
  return 'bg-hub-gray/30';
};

// Period normalization types and helpers
export type FundingPeriod = '1h' | '4h' | '8h' | '24h' | '1Y';

export const PERIOD_HOURS: Record<FundingPeriod, number> = {
  '1h': 1, '4h': 4, '8h': 8, '24h': 24, '1Y': 8760,
};

export const PERIOD_LABELS: Record<FundingPeriod, string> = {
  '1h': '1H', '4h': '4H', '8h': '8H', '24h': '24H', '1Y': '1Y',
};

/** Multiplier to convert a native-interval rate to the target display period */
export function periodMultiplier(
  nativeInterval: '1h' | '4h' | '8h' | string | undefined,
  targetPeriod: FundingPeriod
): number {
  const nativeHours = nativeInterval === '1h' ? 1 : nativeInterval === '4h' ? 4 : 8;
  return PERIOD_HOURS[targetPeriod] / nativeHours;
}

/** Adaptive precision: fewer decimals for large absolute values */
export const formatRateAdaptive = (rate: number | undefined | null) => {
  if (!isValidNumber(rate)) return '-';
  const abs = Math.abs(rate);
  const decimals = abs >= 10 ? 2 : abs >= 1 ? 3 : 4;
  const formatted = rate.toFixed(decimals);
  return rate >= 0 ? `+${formatted}%` : `${formatted}%`;
};

export { getExchangeBadgeColor as getExchangeColor };
