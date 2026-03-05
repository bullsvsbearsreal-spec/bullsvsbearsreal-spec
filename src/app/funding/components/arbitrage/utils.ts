import type { ArbitrageItem, FeasibilityGrade } from './types';

export function computeGrade(spreadPct8h: number, minSideOI: number, stability: 'stable' | 'volatile' | 'new' | null, roundTripFee: number = 0): { grade: FeasibilityGrade; score: number } {
  // If spread doesn't cover fees, it's not a real opportunity
  if (spreadPct8h - roundTripFee <= 0) return { grade: 'D', score: 0 };
  // OI Score (0-3)
  const oiScore = minSideOI >= 10_000_000 ? 3 : minSideOI >= 1_000_000 ? 2 : minSideOI >= 100_000 ? 1 : 0;
  // Spread Score (0-3): lower = more realistic
  const spreadScore = spreadPct8h < 1 ? 3 : spreadPct8h < 5 ? 2 : spreadPct8h < 20 ? 1 : 0;
  // Stability Score (0-2)
  const stabScore = stability === 'stable' ? 2 : stability === 'volatile' ? 1 : 0;
  const total = oiScore + spreadScore + stabScore;
  const grade: FeasibilityGrade = total >= 7 ? 'A' : total >= 5 ? 'B' : total >= 3 ? 'C' : 'D';
  return { grade, score: total };
}

export const GRADE_COLORS: Record<FeasibilityGrade, string> = {
  A: 'text-green-400 bg-green-500/15 border-green-500/20',
  B: 'text-blue-400 bg-blue-500/15 border-blue-500/20',
  C: 'text-amber-400 bg-amber-500/15 border-amber-500/20',
  D: 'text-red-400 bg-red-500/15 border-red-500/20',
};

export const ROWS_PER_PAGE = 30;

export function formatUSD(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toFixed(2)}`;
}

export function formatPnl(value: number): string {
  const prefix = value >= 0 ? '+' : '';
  if (Math.abs(value) >= 1000) return `${prefix}$${(value / 1000).toFixed(1)}K`;
  return `${prefix}$${value.toFixed(2)}`;
}

export function formatPrice(price: number): string {
  if (price >= 10000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(6)}`;
}

export function getIntervalForExchange(item: ArbitrageItem, exchange: string, intervalMap?: Map<string, string>): string | undefined {
  return item.intervals?.[exchange] || intervalMap?.get(`${item.symbol}|${exchange}`);
}
