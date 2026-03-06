import type { ArbitrageItem, FeasibilityGrade } from './types';

export interface GradeInput {
  spreadPct8h: number;
  minSideOI: number;
  stability: 'stable' | 'volatile' | 'new' | null;
  roundTripFee: number;
  highOI?: number;
  lowOI?: number;
  highInterval?: string;
  lowInterval?: string;
  netAnnualized?: number;
}

export function computeGrade(
  spreadPct8h: number,
  minSideOI: number,
  stability: 'stable' | 'volatile' | 'new' | null,
  roundTripFee: number = 0,
  extra?: Partial<GradeInput>,
): { grade: FeasibilityGrade; score: number; flags: string[] } {
  const flags: string[] = [];

  // If spread doesn't cover fees, it's not a real opportunity
  if (spreadPct8h - roundTripFee <= 0) {
    flags.push('fees exceed spread');
    return { grade: 'D', score: 0, flags };
  }

  // Net spread profitability ratio (how much of spread survives fees)
  const netRatio = (spreadPct8h - roundTripFee) / spreadPct8h;

  // OI Score (0-3): higher min-side OI = better
  const oiScore = minSideOI >= 10_000_000 ? 3 : minSideOI >= 1_000_000 ? 2 : minSideOI >= 100_000 ? 1 : 0;
  if (minSideOI < 50_000 && minSideOI > 0) flags.push('very low OI');

  // OI Balance Score (0-1): penalize if OI is heavily one-sided
  let oiBalanceScore = 1;
  if (extra?.highOI && extra?.lowOI && extra.highOI > 0 && extra.lowOI > 0) {
    const ratio = Math.min(extra.highOI, extra.lowOI) / Math.max(extra.highOI, extra.lowOI);
    if (ratio < 0.05) { oiBalanceScore = 0; flags.push('OI imbalanced >20:1'); }
    else if (ratio < 0.1) { oiBalanceScore = 0; flags.push('OI imbalanced >10:1'); }
  }

  // Spread Score (0-3): realistic spreads are better (too high = likely to vanish)
  const spreadScore = spreadPct8h < 0.5 ? 3 : spreadPct8h < 2 ? 2 : spreadPct8h < 10 ? 1 : 0;
  if (spreadPct8h > 5) flags.push('unusually high spread');

  // Net Profitability Score (0-1): does net profit survive fees well?
  const netScore = netRatio >= 0.5 ? 1 : 0;
  if (netRatio < 0.3) flags.push('fees eat >70% of spread');

  // Stability Score (0-2)
  const stabScore = stability === 'stable' ? 2 : stability === 'volatile' ? 1 : 0;
  if (stability === 'new') flags.push('new/untracked pair');

  // Interval Mismatch Penalty (0 or -1): different funding intervals = timing risk
  let intervalPenalty = 0;
  if (extra?.highInterval && extra?.lowInterval && extra.highInterval !== extra.lowInterval) {
    intervalPenalty = -1;
    flags.push(`interval mismatch (${extra.highInterval}/${extra.lowInterval})`);
  }

  const total = Math.max(0, oiScore + oiBalanceScore + spreadScore + netScore + stabScore + intervalPenalty);
  // Max possible: 3 + 1 + 3 + 1 + 2 = 10 (minus potential -1 penalty = 9)
  const grade: FeasibilityGrade = total >= 8 ? 'A' : total >= 5 ? 'B' : total >= 3 ? 'C' : 'D';
  return { grade, score: total, flags };
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
