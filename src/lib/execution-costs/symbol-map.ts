/**
 * Maps normalized asset symbols to venue-native formats.
 *
 * Two layers:
 *   - VENUE_SYMBOL_FORMATS: per-venue suffix/prefix conventions
 *     (BTC → BTCUSDT on Aster, BTC-USD on dYdX, BTC on HL, etc.)
 *   - nativeSymbol(): canonical → venue-native ticker for low-priced
 *     memecoins that need a "1000" / "1000000" multiplier prefix
 *     (or "SHIB1000" suffix on Bybit). Sub-cent perps don't have
 *     fine enough tick precision, so exchanges quote them at
 *     1k or 1M-unit granularity. Without this, /api/execution-costs
 *     fetchers query e.g. "PEPEUSDT" on Binance and get a 400.
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

// ─── Per-venue overrides for sub-cent assets ─────────────────────────────

type Venue =
  | 'Binance' | 'Bybit' | 'OKX' | 'Bitget'
  | 'Aster'   | 'Aevo'  | 'edgeX' | 'Lighter'
  | 'dYdX'    | 'Hyperliquid';

/** Pairs that need a "1000<TICKER>" / "SHIB1000" / "1000000<TICKER>" name. */
const NATIVE_OVERRIDES: Partial<Record<Venue, Record<string, string>>> = {
  Binance: {
    PEPE: '1000PEPE', SHIB: '1000SHIB', BONK: '1000BONK',
    FLOKI: '1000FLOKI', LUNC: '1000LUNC', RATS: '1000RATS',
    SATS: '1000SATS', XEC: '1000XEC',
  },
  Bybit: {
    PEPE: '1000PEPE', BONK: '1000BONK', FLOKI: '1000FLOKI',
    LUNC: '1000LUNC', XEC: '1000XEC',
    // Bybit historical quirk: SHIB uses a SUFFIX rather than a prefix.
    SHIB: 'SHIB1000',
  },
  Aster: {
    PEPE: '1000PEPE', SHIB: '1000SHIB', BONK: '1000BONK',
    FLOKI: '1000FLOKI', LUNC: '1000LUNC',
  },
  Aevo: {
    PEPE: '1000000PEPE', SHIB: '1000000SHIB', BONK: '1000000BONK',
    FLOKI: '10000FLOKI',
  },
};

/** Multiplier embedded in the venue-native symbol — divide rawPrice by this
 *  to recover canonical $/token. Same set as NATIVE_OVERRIDES; kept separate
 *  so a future overrides-only change doesn't accidentally double-scale. */
const NATIVE_PRICE_SCALE: Partial<Record<Venue, Record<string, number>>> = {
  Binance: { PEPE: 1000, SHIB: 1000, BONK: 1000, FLOKI: 1000, LUNC: 1000, RATS: 1000, SATS: 1000, XEC: 1000 },
  Bybit:   { PEPE: 1000, BONK: 1000, FLOKI: 1000, LUNC: 1000, XEC: 1000, SHIB: 1000 },
  Aster:   { PEPE: 1000, SHIB: 1000, BONK: 1000, FLOKI: 1000, LUNC: 1000 },
  Aevo:    { PEPE: 1_000_000, SHIB: 1_000_000, BONK: 1_000_000, FLOKI: 10_000 },
};

/** Canonical → venue-native ticker. Returns the asset unchanged when no
 *  override is registered. */
export function nativeSymbol(venue: string, asset: string): string {
  const map = NATIVE_OVERRIDES[venue as Venue];
  if (!map) return asset;
  return map[asset.toUpperCase()] ?? asset;
}

/** Price-rescale divisor for the venue × asset pair (1 if no scaling).
 *  For "1000PEPE" on Binance this returns 1000. Apply as:
 *    canonicalPrice = rawPriceFromVenue / nativePriceScale(venue, asset)
 *  AND multiply size by the same factor so (price × size) USD value is
 *  preserved. */
export function nativePriceScale(venue: string, asset: string): number {
  const map = NATIVE_PRICE_SCALE[venue as Venue];
  if (!map) return 1;
  return map[asset.toUpperCase()] ?? 1;
}
