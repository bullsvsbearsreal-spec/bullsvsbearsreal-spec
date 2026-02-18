// Liquidation value thresholds (USD)
export const LIQ_THRESHOLD = {
  MAJOR_CEX: 500_000,
  MIDCAP_CEX: 100_000,
  ALT_CEX: 50_000,
  DEX_MIN: 10_000,
  SOUND_ALERT: 100_000,
  ARB_BADGE: 50_000,
  HIGHLIGHT_PURPLE: 1_000_000,
  HIGHLIGHT_RED: 500_000,
  HIGHLIGHT_ORANGE: 100_000,
} as const;

// Time constants (ms)
export const TIMEFRAME_MS: Record<string, number> = {
  '1h': 3_600_000,
  '4h': 14_400_000,
  '12h': 43_200_000,
  '24h': 86_400_000,
};

// Timeline bucket size (ms)
export const TIMELINE_BUCKET_MS = 5 * 60 * 1000;

// Data display limits
export const DISPLAY = {
  HEATMAP_MAX_SYMBOLS: 20,
  PRICE_LEVEL_MAX_SYMBOLS: 8,
  PRICE_LEVEL_MAX_BINS: 8,
  TICKER_MAX_ITEMS: 15,
  MAX_LIQUIDATIONS: 200,
  FEED_MAX_HEIGHT: 600,
} as const;

// Exchange heatmap brand colors (hex)
export const EXCHANGE_BRAND_HEX: Record<string, string> = {
  Binance: '#F0B90B',
  Bybit: '#F7A600',
  OKX: '#ffffff',
  Bitget: '#00D2AA',
  Deribit: '#5FC694',
  MEXC: '#2CA58D',
  BingX: '#3B82F6',
  HTX: '#3B82F6',
  gTrade: '#14B8A6',
};
