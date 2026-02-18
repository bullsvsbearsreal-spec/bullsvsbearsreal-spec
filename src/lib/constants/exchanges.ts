// Canonical list of active exchanges
export const ALL_EXCHANGES = [
  'Binance', 'Bybit', 'OKX', 'Bitget', 'MEXC',
  'Kraken', 'BingX', 'Phemex', 'Bitunix', 'Hyperliquid', 'dYdX', 'Aster', 'Lighter',
  'Aevo', 'Drift', 'GMX', 'KuCoin', 'Deribit', 'HTX', 'Bitfinex', 'WhiteBIT',
  'Coinbase', 'CoinEx', 'gTrade', 'Extended', 'edgeX', 'Variational',
] as const;

export type ExchangeName = (typeof ALL_EXCHANGES)[number];

// Tailwind background color classes for exchange selector dots
export const EXCHANGE_COLORS: Record<string, string> = {
  'Binance': 'bg-yellow-500',
  'Bybit': 'bg-orange-500',
  'OKX': 'bg-white',
  'Bitget': 'bg-cyan-400',
  'MEXC': 'bg-teal-500',
  'Kraken': 'bg-violet-500',
  'BingX': 'bg-blue-600',
  'Phemex': 'bg-lime-400',
  'Bitunix': 'bg-cyan-600',
  'Hyperliquid': 'bg-green-400',
  'dYdX': 'bg-purple-500',
  'Aster': 'bg-pink-500',
  'Lighter': 'bg-emerald-400',
  'Aevo': 'bg-rose-400',
  'Drift': 'bg-indigo-400',
  'GMX': 'bg-indigo-500',
  'KuCoin': 'bg-green-500',
  'Deribit': 'bg-blue-400',
  'HTX': 'bg-blue-500',
  'Bitfinex': 'bg-green-600',
  'WhiteBIT': 'bg-gray-300',
  'Coinbase': 'bg-blue-500',
  'CoinEx': 'bg-teal-400',
  'gTrade': 'bg-teal-500',
  'Extended': 'bg-amber-400',
  'edgeX': 'bg-sky-400',
  'Variational': 'bg-fuchsia-400',
};

// Exchange badge colors for table cells
export const EXCHANGE_BADGE_COLORS: Record<string, string> = {
  'Binance': 'bg-yellow-500/20 text-yellow-400',
  'Bybit': 'bg-orange-500/20 text-orange-400',
  'OKX': 'bg-blue-500/20 text-blue-400',
  'Bitget': 'bg-cyan-500/20 text-cyan-400',
  'MEXC': 'bg-teal-500/20 text-teal-400',
  'Kraken': 'bg-violet-500/20 text-violet-400',
  'BingX': 'bg-blue-600/20 text-blue-300',
  'Phemex': 'bg-lime-500/20 text-lime-400',
  'Bitunix': 'bg-cyan-600/20 text-cyan-400',
  'Hyperliquid': 'bg-green-500/20 text-green-400',
  'dYdX': 'bg-purple-500/20 text-purple-400',
  'Aster': 'bg-pink-500/20 text-pink-400',
  'Lighter': 'bg-emerald-400/20 text-emerald-300',
  'Aevo': 'bg-rose-400/20 text-rose-300',
  'Drift': 'bg-indigo-400/20 text-indigo-300',
  'GMX': 'bg-indigo-500/20 text-indigo-400',
  'KuCoin': 'bg-green-500/20 text-green-400',
  'Deribit': 'bg-blue-400/20 text-blue-300',
  'HTX': 'bg-blue-500/20 text-blue-400',
  'Bitfinex': 'bg-green-600/20 text-green-400',
  'WhiteBIT': 'bg-gray-300/20 text-gray-300',
  'Coinbase': 'bg-blue-500/20 text-blue-300',
  'CoinEx': 'bg-teal-400/20 text-teal-300',
  'gTrade': 'bg-teal-500/20 text-teal-400',
  'Extended': 'bg-amber-400/20 text-amber-300',
  'edgeX': 'bg-sky-400/20 text-sky-300',
  'Variational': 'bg-fuchsia-400/20 text-fuchsia-300',
};

// DEX exchanges (on-chain / decentralized perpetual protocols)
export const DEX_EXCHANGES: ReadonlySet<string> = new Set([
  'Hyperliquid', 'dYdX', 'Aster', 'Lighter', 'Aevo', 'Drift', 'GMX', 'gTrade',
  'Extended', 'edgeX', 'Variational',
]);

// CEX exchanges (centralized)
export const CEX_EXCHANGES: ReadonlySet<string> = new Set(
  ALL_EXCHANGES.filter(ex => !DEX_EXCHANGES.has(ex))
);

export function isExchangeDex(exchange: string): boolean {
  return DEX_EXCHANGES.has(exchange);
}

export function getExchangeBadgeColor(exchange: string): string {
  return EXCHANGE_BADGE_COLORS[exchange] || 'bg-hub-gray/50 text-hub-gray-text';
}

// Generate a direct trading link to the exchange's perpetual futures page for a given symbol
export function getExchangeTradeUrl(exchange: string, symbol: string): string | null {
  const s = symbol.toUpperCase();
  switch (exchange) {
    case 'Binance':    return `https://www.binance.com/en/futures/${s}USDT`;
    case 'Bybit':      return `https://www.bybit.com/trade/usdt/${s}USDT`;
    case 'OKX':        return `https://www.okx.com/trade-swap/${s.toLowerCase()}-usdt-swap`;
    case 'Bitget':     return `https://www.bitget.com/futures/usdt/${s}USDT`;
    case 'MEXC':       return `https://futures.mexc.com/exchange/${s}_USDT`;
    case 'Kraken':     return `https://futures.kraken.com/trade/futures/${s.toLowerCase()}-perpetual`;
    case 'BingX':      return `https://bingx.com/en/perpetual/${s}-USDT/`;
    case 'Phemex':     return `https://phemex.com/contract/trade/${s}USDT`;
    case 'Bitunix':    return `https://www.bitunix.com/futures/${s}USDT`;
    case 'Hyperliquid': return `https://app.hyperliquid.xyz/trade/${s}`;
    case 'dYdX':       return `https://trade.dydx.exchange/trade/${s}-USD`;
    case 'Aster':      return `https://app.aster.finance/#/perpetual/${s}USDT`;
    case 'Lighter':    return `https://app.lighter.xyz/trade/${s}-USDT`;
    case 'Aevo':       return `https://app.aevo.xyz/perpetual/${s.toLowerCase()}`;
    case 'Drift':      return `https://app.drift.trade/trade/${s}-PERP`;
    case 'GMX':        return 'https://app.gmx.io/#/trade';
    case 'KuCoin':     return `https://www.kucoin.com/futures/trade/${s}USDTM`;
    case 'Deribit':    return `https://www.deribit.com/futures/${s}`;
    case 'HTX':        return `https://www.htx.com/futures/linear_swap/exchange#contract_code=${s}-USDT`;
    case 'Bitfinex':   return `https://trading.bitfinex.com/t/${s}F0:USTF0`;
    case 'WhiteBIT':   return `https://whitebit.com/trade/${s}_USDT?type=futures`;
    case 'Coinbase':   return `https://www.coinbase.com/advanced-trade/spot/${s}-USDT`;
    case 'CoinEx':     return `https://www.coinex.com/en/futures/${s}USDT`;
    case 'gTrade':     return `https://gains.trade/trading#${s}/USD`;
    case 'Extended':   return `https://app.extended.exchange/trade/${s}-USD`;
    case 'edgeX':      return `https://pro.edgex.exchange/trade/${s}USD`;
    case 'Variational': return `https://app.variational.io/trade/${s}`;
    default:           return null;
  }
}
