// ─── Spread Page Types ────────────────────────────────────────────────────────

export type Candle = { t: number; o: number; h: number; l: number; c: number };

export type Pt = {
  time: number;
  label: string;
  _spread?: number;
  _spreadPct?: number;
  _spreadAB?: number;
  [k: string]: any;
};

export type ViewMode = 'price' | 'pct';
export type SpreadUnit = 'usd' | 'pct' | 'bps';
export type CalcMode = 'usd' | 'coin';

// Re-export from the canonical source to avoid type divergence
export type { WSPrice as WsPrice } from '@/hooks/useMultiExchangeWS';

export interface SpreadInfo {
  spread: number;
  pct: number;
  high: { exchange: string; price: number };
  low: { exchange: string; price: number };
  prices: { exchange: string; price: number }[];
}

export interface SpreadStats {
  cur: number;
  pct: number;
  avg: number;
  max: number;
  min: number;
  maxT: number;
  minT: number;
  maxHi: string;
  maxLo: string;
  minHi: string;
  minLo: string;
  prices: { e: string; p: number }[];
  hi: { e: string; p: number } | undefined;
  lo: { e: string; p: number } | undefined;
  avgPct: number;
  maxPct: number;
  minPct: number;
  percentile: number | null;
}

export interface TickerEntry {
  symbol: string;
  exchange: string;
  lastPrice: number;
  change24h: number;
  quoteVolume24h: number;
}

export interface FundingEntry {
  symbol: string;
  exchange: string;
  fundingRate: number;
  markPrice: number;
}

export interface OIEntry {
  symbol: string;
  exchange: string;
  openInterestValue: number;
}

export const TFS = [
  { key: 'live', label: 'Live', source: 'ws' as const },
  { key: '1d', label: '1D', source: 'db' as const, days: 1, interval: '1h', limit: 24 },
  { key: '7d', label: '7D', source: 'db' as const, days: 7, interval: '1h', limit: 168 },
  { key: '30d', label: '30D', source: 'db' as const, days: 30, interval: '4h', limit: 180 },
] as const;

export type TfKey = typeof TFS[number]['key'];
