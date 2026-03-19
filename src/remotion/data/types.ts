/** Data shape for the market recap video */

export interface FundingEntry {
  symbol: string;
  exchange: string;
  fundingRate: number;
  fundingInterval: string;
  type: 'cex' | 'dex';
}

export interface TopMover {
  symbol: string;
  price: number;
  change24h: number;
}

export interface OIEntry {
  symbol: string;
  totalOI: number;
  change24h?: number;
}

export interface MarketRecapData {
  // Header
  date: string;
  btcPrice: number;
  btcChange: number;
  ethPrice: number;
  ethChange: number;
  totalExchanges: number;

  // Funding extremes
  topFunding: FundingEntry[];    // highest positive rates
  bottomFunding: FundingEntry[]; // most negative rates

  // Top movers
  topGainers: TopMover[];
  topLosers: TopMover[];

  // OI
  totalOI: string;  // formatted like "$65.2B"
  topOI: OIEntry[];

  // Stats
  totalPairs: number;
  avgFundingRate: number;
}
