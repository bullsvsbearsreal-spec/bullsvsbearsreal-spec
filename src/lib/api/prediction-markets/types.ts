// Normalized prediction market from either platform
export interface PredictionMarket {
  id: string;
  platform: 'polymarket' | 'kalshi';
  question: string;
  slug: string;
  yesPrice: number;    // 0–1 probability
  noPrice: number;     // 0–1 probability
  volume24h: number;   // USD
  totalVolume: number; // USD lifetime
  liquidity: number;   // Polymarket only
  openInterest: number; // Kalshi only
  endDate: string;     // ISO date
  category: string;
  active: boolean;
}

// A matched pair of markets across platforms
export interface PredictionArbitrage {
  id: string;
  matchType: 'curated' | 'auto';
  question: string;
  category: string;
  polymarket: PredictionMarket;
  kalshi: PredictionMarket;
  spread: number;        // absolute price diff (0–1)
  spreadPercent: number; // spread × 100
  direction: 'buy-poly-yes' | 'buy-kalshi-yes';
  polymarketUrl: string;
  kalshiUrl: string;
}

// API response shape
export interface PredictionMarketsResponse {
  arbitrage: PredictionArbitrage[];
  polymarketMarkets: PredictionMarket[];
  kalshiMarkets: PredictionMarket[];
  meta: {
    polymarketCount: number;
    kalshiCount: number;
    matchedCount: number;
    timestamp: number;
    errors?: string[];
  };
}
