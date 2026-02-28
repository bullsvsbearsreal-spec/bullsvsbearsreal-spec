export type Direction = 'long' | 'short';

export interface OrderbookLevel {
  price: number;
  size: number;  // in base asset units
}

export interface RawBookData {
  exchange: string;
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  midPrice: number;
  symbol: string;
  method: 'clob' | 'amm_formula' | 'amm_rpc' | 'quote';
}

export interface VenueCost {
  exchange: string;
  available: boolean;
  fee: number;              // %
  spread: number;           // %
  priceImpact: number;      // %
  totalCost: number;        // fee + spread + priceImpact
  executionPrice: number;
  midPrice: number;
  maxFillableSize: number;  // USD
  depthLevels?: number;
  method: 'clob' | 'amm_formula' | 'amm_rpc' | 'quote';
  error?: string;
}

export interface ExecutionCostResponse {
  asset: string;
  size: number;
  direction: Direction;
  timestamp: number;
  venues: VenueCost[];
}

export interface BookWalkResult {
  vwap: number;
  filledUsd: number;
  levelsConsumed: number;
}

export interface DepthPoint {
  exchange: string;
  priceOffset: number;  // % from mid
  cumulativeUsd: number;
}
