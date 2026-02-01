// API Response Types for Exchange Data

// Utility type for API responses
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  timestamp: number;
}

// Safe number type that handles undefined/null
export type SafeNumber = number | null | undefined;

export interface TickerData {
  symbol: string;
  lastPrice: number;
  price?: number; // Alias for compatibility
  priceChangePercent24h: number;
  change24h?: number;
  changePercent24h?: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  quoteVolume24h: number;
  timestamp: number;
  exchange?: string;
}

export interface FundingRateData {
  symbol: string;
  exchange: string;
  fundingRate: number;
  fundingTime: number;
  nextFundingTime: number;
  predictedRate?: number;
  markPrice?: number;
  indexPrice?: number;
}

export interface OpenInterestData {
  symbol: string;
  exchange: string;
  openInterest: number;
  openInterestValue: number;
  timestamp: number;
}

export interface LiquidationData {
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  price: number;
  value: number;
  timestamp: number;
  exchange: string;
}

export interface AggregatedLiquidations {
  symbol: string;
  longLiquidations: number;
  shortLiquidations: number;
  totalLiquidations: number;
  count: number;
  timeframe: string;
}

export interface MarketData {
  tickers: TickerData[];
  fundingRates: FundingRateData[];
  openInterest: OpenInterestData[];
  liquidations: AggregatedLiquidations[];
  lastUpdate: number;
}

export interface ExchangeAPIConfig {
  name: string;
  baseUrl: string;
  wsUrl?: string;
  rateLimit: number; // requests per minute
  requiresAuth: boolean;
}

export type SupportedExchange = 'binance' | 'bybit' | 'okx' | 'bitget';

export const EXCHANGE_CONFIGS: Record<SupportedExchange, ExchangeAPIConfig> = {
  binance: {
    name: 'Binance',
    baseUrl: 'https://fapi.binance.com',
    wsUrl: 'wss://fstream.binance.com',
    rateLimit: 1200,
    requiresAuth: false,
  },
  bybit: {
    name: 'Bybit',
    baseUrl: 'https://api.bybit.com',
    wsUrl: 'wss://stream.bybit.com',
    rateLimit: 600,
    requiresAuth: false,
  },
  okx: {
    name: 'OKX',
    baseUrl: 'https://www.okx.com',
    wsUrl: 'wss://ws.okx.com:8443',
    rateLimit: 600,
    requiresAuth: false,
  },
  bitget: {
    name: 'Bitget',
    baseUrl: 'https://api.bitget.com',
    wsUrl: 'wss://ws.bitget.com',
    rateLimit: 600,
    requiresAuth: false,
  },
};