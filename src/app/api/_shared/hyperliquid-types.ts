/* ------------------------------------------------------------------ */
/*  Shared Hyperliquid API types (clearinghouseState response)         */
/* ------------------------------------------------------------------ */

export interface HLPosition {
  coin: string;
  szi: string;          // size (negative = short)
  entryPx: string;
  positionValue: string;
  unrealizedPnl: string;
  returnOnEquity: string;
  liquidationPx: string | null;
  leverage: { type: string; value: number };
  marginUsed: string;
  maxLeverage: number;
  cumFunding: {
    allTime: string;
    sinceOpen: string;
    sinceChange: string;
  };
}

export interface HLClearingHouseState {
  marginSummary: {
    accountValue: string;
    totalNtlPos: string;
    totalRawUsd: string;
    totalMarginUsed: string;
  };
  crossMarginSummary: {
    accountValue: string;
    totalNtlPos: string;
    totalRawUsd: string;
    totalMarginUsed: string;
  };
  withdrawable: string;
  assetPositions: Array<{
    type: string;
    position: HLPosition;
  }>;
  time: number;
}
