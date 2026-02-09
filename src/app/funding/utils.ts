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
  if (rate > 0.05) return 'text-success';
  if (rate < -0.05) return 'text-danger';
  return 'text-hub-gray-text';
};

export const getHeatmapColor = (rate: number | undefined) => {
  if (rate === undefined) return 'bg-hub-gray/20';
  if (rate > 0.1) return 'bg-green-500';
  if (rate > 0.05) return 'bg-green-600';
  if (rate > 0.01) return 'bg-green-700';
  if (rate > 0) return 'bg-green-800';
  if (rate < -0.1) return 'bg-red-500';
  if (rate < -0.05) return 'bg-red-600';
  if (rate < -0.01) return 'bg-red-700';
  if (rate < 0) return 'bg-red-800';
  return 'bg-hub-gray/30';
};

export { getExchangeBadgeColor as getExchangeColor };
