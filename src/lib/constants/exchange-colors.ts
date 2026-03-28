/**
 * Centralized hex color mapping for all exchanges.
 * Single source of truth — use this instead of duplicating colors in chart components.
 */
export const EXCHANGE_HEX_COLORS: Record<string, string> = {
  'Binance': '#EAB308',
  'Bybit': '#F97316',
  'OKX': '#FFFFFF',
  'Bitget': '#22D3EE',
  'MEXC': '#14B8A6',
  'Kraken': '#8B5CF6',
  'BingX': '#2563EB',
  'Phemex': '#A3E635',
  'Bitunix': '#0891B2',
  'Hyperliquid': '#4ADE80',
  'dYdX': '#A855F7',
  'Aster': '#EC4899',
  'Lighter': '#34D399',
  'Aevo': '#FB7185',
  'Drift': '#A78BFA',
  'GMX': '#6366F1',
  'KuCoin': '#22C55E',
  'Deribit': '#60A5FA',
  'HTX': '#3B82F6',
  'Bitfinex': '#16A34A',
  'WhiteBIT': '#D1D5DB',
  'Coinbase': '#3B82F6',
  'CoinEx': '#2DD4BF',
  'gTrade': '#14B8A6',
  'Extended': '#FBBF24',
  'Variational': '#E879F9',
  'BitMEX': '#EF4444',
  'Gate.io': '#60A5FA',
  'edgeX': '#38BDF8',
  'Nado': '#F87171',
  'Backpack': '#EF4444',
  'Orderly': '#C084FC',
  'Paradex': '#8B5CF6',
};

export const EXCHANGE_HEX_FALLBACK = '#6B7280';

/** Get hex color for an exchange, with fallback */
export function getExchangeHexColor(exchange: string): string {
  return EXCHANGE_HEX_COLORS[exchange] ?? EXCHANGE_HEX_FALLBACK;
}
