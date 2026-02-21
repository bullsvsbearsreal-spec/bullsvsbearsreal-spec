// Supported prediction market platforms
export type PredictionPlatform = 'polymarket' | 'kalshi';

// Normalized prediction market from any platform
export interface PredictionMarket {
  id: string;
  platform: PredictionPlatform;
  question: string;
  slug: string;
  yesPrice: number;    // 0–1 probability
  noPrice: number;     // 0–1 probability
  volume24h: number;   // USD
  totalVolume: number; // USD lifetime
  liquidity: number;
  openInterest: number;
  endDate: string;     // ISO date
  category: string;
  active: boolean;
  url: string;         // direct link to market
}

// A matched pair of markets across any two platforms
export interface PredictionArbitrage {
  id: string;
  matchType: 'curated' | 'auto';
  question: string;
  category: string;
  platformA: PredictionMarket;
  platformB: PredictionMarket;
  spread: number;        // absolute price diff (0–1)
  spreadPercent: number; // spread × 100
  direction: string;     // e.g. 'buy-polymarket-yes' or 'buy-kalshi-yes'
  urlA: string;
  urlB: string;
}

// API response shape
export interface PredictionMarketsResponse {
  arbitrage: PredictionArbitrage[];
  markets: Record<PredictionPlatform, PredictionMarket[]>;
  meta: {
    counts: Record<PredictionPlatform, number>;
    matchedCount: number;
    timestamp: number;
    errors?: string[];
  };
}
