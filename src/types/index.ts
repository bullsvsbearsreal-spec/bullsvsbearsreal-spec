export interface Exchange {
  id: string;
  name: string;
  type: 'CEX' | 'DEX';
  logo?: string;
}

export interface FundingRate {
  symbol: string;
  exchange: string;
  rate: number;
  predictedRate?: number;
  nextFundingTime: number;
  annualizedRate: number;
}

export interface OpenInterest {
  symbol: string;
  exchange: string;
  openInterest: number;
  change24h: number;
}

export interface Liquidation {
  symbol: string;
  exchange: string;
  side: 'long' | 'short';
  amount: number;
  price: number;
  timestamp: number;
}

export interface LiquidationAggregate {
  symbol: string;
  longLiquidations: number;
  shortLiquidations: number;
  totalLiquidations: number;
  change24h: number;
}

export interface MarketOverview {
  totalOpenInterest: number;
  totalVolume24h: number;
  totalLiquidations24h: number;
  longShortRatio: number;
  btcDominance: number;
  fearGreedIndex: number;
}

export interface EconomicEvent {
  id: string;
  date: string;
  time: string;
  country: string;
  event: string;
  impact: 'high' | 'medium' | 'low';
  actual?: string;
  forecast?: string;
  previous?: string;
}

export interface CryptoAsset {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  openInterest: number;
  fundingRate: number;
}
