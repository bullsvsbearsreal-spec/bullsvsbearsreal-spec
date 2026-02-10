// Canonical list of active exchanges
export const ALL_EXCHANGES = [
  'Binance', 'Bybit', 'OKX', 'Bitget', 'Gate.io', 'MEXC',
  'Kraken', 'BingX', 'Phemex', 'Hyperliquid', 'dYdX', 'Aster', 'Lighter',
  'BitMEX', 'KuCoin', 'Deribit', 'HTX', 'Bitfinex', 'WhiteBIT',
  'Coinbase', 'CoinEx', 'Crypto.com',
] as const;

export type ExchangeName = (typeof ALL_EXCHANGES)[number];

// Tailwind background color classes for exchange selector dots
export const EXCHANGE_COLORS: Record<string, string> = {
  'Binance': 'bg-yellow-500',
  'Bybit': 'bg-orange-500',
  'OKX': 'bg-white',
  'Bitget': 'bg-cyan-400',
  'Gate.io': 'bg-emerald-500',
  'MEXC': 'bg-teal-500',
  'Kraken': 'bg-violet-500',
  'BingX': 'bg-blue-600',
  'Phemex': 'bg-lime-400',
  'Hyperliquid': 'bg-green-400',
  'dYdX': 'bg-purple-500',
  'Aster': 'bg-pink-500',
  'Lighter': 'bg-emerald-400',
  'BitMEX': 'bg-red-500',
  'KuCoin': 'bg-green-500',
  'Deribit': 'bg-blue-400',
  'HTX': 'bg-blue-500',
  'Bitfinex': 'bg-green-600',
  'WhiteBIT': 'bg-gray-300',
  'Coinbase': 'bg-blue-500',
  'CoinEx': 'bg-teal-400',
  'Crypto.com': 'bg-indigo-500',
};

// Exchange badge colors for table cells
export const EXCHANGE_BADGE_COLORS: Record<string, string> = {
  'Binance': 'bg-yellow-500/20 text-yellow-400',
  'Bybit': 'bg-orange-500/20 text-orange-400',
  'OKX': 'bg-blue-500/20 text-blue-400',
  'Bitget': 'bg-cyan-500/20 text-cyan-400',
  'Gate.io': 'bg-emerald-500/20 text-emerald-400',
  'MEXC': 'bg-teal-500/20 text-teal-400',
  'Kraken': 'bg-violet-500/20 text-violet-400',
  'BingX': 'bg-blue-600/20 text-blue-300',
  'Phemex': 'bg-lime-500/20 text-lime-400',
  'Hyperliquid': 'bg-green-500/20 text-green-400',
  'dYdX': 'bg-purple-500/20 text-purple-400',
  'Aster': 'bg-pink-500/20 text-pink-400',
  'Lighter': 'bg-emerald-400/20 text-emerald-300',
  'BitMEX': 'bg-red-500/20 text-red-400',
  'KuCoin': 'bg-green-500/20 text-green-400',
  'Deribit': 'bg-blue-400/20 text-blue-300',
  'HTX': 'bg-blue-500/20 text-blue-400',
  'Bitfinex': 'bg-green-600/20 text-green-400',
  'WhiteBIT': 'bg-gray-300/20 text-gray-300',
  'Coinbase': 'bg-blue-500/20 text-blue-300',
  'CoinEx': 'bg-teal-400/20 text-teal-300',
  'Crypto.com': 'bg-indigo-500/20 text-indigo-400',
};

export function getExchangeBadgeColor(exchange: string): string {
  return EXCHANGE_BADGE_COLORS[exchange] || 'bg-hub-gray/50 text-hub-gray-text';
}
