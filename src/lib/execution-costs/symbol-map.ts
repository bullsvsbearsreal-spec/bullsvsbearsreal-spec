/**
 * Maps normalized asset symbols to venue-native formats.
 * For venues using pair indices (gTrade) or market IDs (Lighter),
 * we need the metadata fetch to resolve these dynamically.
 */

export type VenueSymbolFormat = {
  formatSymbol: (asset: string) => string;
};

export const VENUE_SYMBOL_FORMATS: Record<string, VenueSymbolFormat> = {
  Hyperliquid: { formatSymbol: (asset) => asset },
  dYdX: { formatSymbol: (asset) => `${asset}-USD` },
  Drift: { formatSymbol: (asset) => `${asset}-PERP` },
  Aster: { formatSymbol: (asset) => `${asset}USDT` },
  Aevo: { formatSymbol: (asset) => asset },
  Lighter: { formatSymbol: (asset) => asset },
  Extended: { formatSymbol: (asset) => `${asset}-USD` },
  edgeX: { formatSymbol: (asset) => `${asset}USD` },
  gTrade: { formatSymbol: (asset) => asset },
  GMX: { formatSymbol: (asset) => asset },
  Variational: { formatSymbol: (asset) => asset },
};

export const DEFAULT_ASSETS = [
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'DOT',
  'MATIC', 'UNI', 'NEAR', 'ARB', 'OP', 'SUI', 'APT', 'FIL', 'ATOM', 'LTC',
  'TIA', 'SEI', 'INJ', 'JUP', 'WIF', 'PEPE', 'BONK', 'RENDER', 'FET', 'TAO',
  'AAVE', 'MKR', 'CRV', 'PENDLE', 'STX', 'IMX', 'MANA', 'SAND', 'GALA', 'AXS',
  'ORDI', 'WLD', 'STRK', 'BLUR', 'JTO', 'PYTH', 'W', 'ENA', 'ONDO', 'TON',
] as const;

export type SupportedAsset = (typeof DEFAULT_ASSETS)[number] | string;
