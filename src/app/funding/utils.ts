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

export { getExchangeBadgeColor as getExchangeColor };
