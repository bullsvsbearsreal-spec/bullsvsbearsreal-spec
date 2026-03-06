import type { FundingPeriod } from '../../utils';

export interface ArbitrageItem {
  symbol: string;
  spread: number;
  exchanges: { exchange: string; rate: number }[];
  markPrices?: { exchange: string; price: number }[];
  intervals?: Record<string, string>;
  nextFundingTimes?: Record<string, number>;  // exchange → unix ms
}

export interface HistoricalSpreadData {
  avg7d: number;       // 7-day average spread
  avg24h: number;      // last 24h average spread
  avg6d: number;       // prior 6d average spread (for trend)
}

export interface FundingArbitrageViewProps {
  arbitrageData: ArbitrageItem[];
  oiMap?: Map<string, number>;
  markPrices?: Map<string, number>;
  indexPrices?: Map<string, number>;
  intervalMap?: Map<string, string>;
  fundingPeriod: FundingPeriod;
  historicalSpreads?: Map<string, HistoricalSpreadData>;
}

export type SortKey = 'spread' | 'annualized' | 'dailyPnl' | 'symbol' | 'oi' | 'grade';
export type VenueFilterType = 'all' | 'cex-dex' | 'cex-cex';
export type FeasibilityGrade = 'A' | 'B' | 'C' | 'D';

export interface EnrichedArb extends ArbitrageItem {
  sorted: { exchange: string; rate: number }[];
  high: { exchange: string; rate: number };
  low: { exchange: string; rate: number };
  grossSpread: number;
  grossSpread8h: number;
  netSpread: number;
  roundTripFee: number;
  annualized: number;
  netAnnualized: number;
  dailyPnl: number;
  monthlyPnl: number;
  totalOI: number;
  highOI: number;
  lowOI: number;
  minSideOI: number;
  price: number;
  highIsDex: boolean;
  lowIsDex: boolean;
  isCexDex: boolean;
  isOutlier: boolean;
  isLowLiq: boolean;
  basis: number | null;
  stability: 'stable' | 'volatile' | 'new' | null;
  trend: 'widening' | 'narrowing' | 'flat' | null;
  grade: FeasibilityGrade;
  gradeScore: number;
  gradeFlags: string[];
  maxPractical: number;
  // Per-side PnL breakdown
  shortDailyRate: number;   // daily % earned from short side
  longDailyRate: number;    // daily % paid on long side (negative = earn)
  highInterval: string;
  lowInterval: string;
  intervalMismatch: boolean;
  feeImpactPct: number;     // how much fees eat as % of gross spread
}
