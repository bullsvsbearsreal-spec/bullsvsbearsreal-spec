// Canonical list of active exchanges
export const ALL_EXCHANGES = [
  'Binance', 'Bybit', 'OKX', 'Bitget', 'MEXC',
  'Kraken', 'BingX', 'Phemex', 'Bitunix', 'Hyperliquid', 'dYdX', 'Aster', 'Lighter',
  'Aevo', 'Drift', 'GMX', 'KuCoin', 'Deribit', 'HTX', 'Bitfinex', 'WhiteBIT',
  'Coinbase', 'CoinEx', 'gTrade', 'Extended', 'Variational',
  'BitMEX', 'Gate.io', 'edgeX', 'Nado',
  'BloFin', 'Backpack', 'Orderly', 'Paradex',
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
  'Variational': 'bg-fuchsia-400',
  'BitMEX': 'bg-red-500',
  'Gate.io': 'bg-blue-400',
  'edgeX': 'bg-sky-400',
  'Nado': 'bg-red-400',
  'BloFin': 'bg-green-500',
  'Backpack': 'bg-red-500',
  'Orderly': 'bg-purple-400',
  'Paradex': 'bg-violet-500',
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
  'Variational': 'bg-fuchsia-400/20 text-fuchsia-300',
  'BitMEX': 'bg-red-500/20 text-red-400',
  'Gate.io': 'bg-blue-400/20 text-blue-300',
  'edgeX': 'bg-sky-400/20 text-sky-300',
  'Nado': 'bg-red-400/20 text-red-300',
  'BloFin': 'bg-green-500/20 text-green-400',
  'Backpack': 'bg-red-500/20 text-red-400',
  'Orderly': 'bg-purple-400/20 text-purple-300',
  'Paradex': 'bg-violet-500/20 text-violet-400',
};

// DEX exchanges (on-chain / decentralized perpetual protocols)
export const DEX_EXCHANGES: ReadonlySet<string> = new Set([
  'Hyperliquid', 'dYdX', 'Aster', 'Lighter', 'Aevo', 'Drift', 'GMX', 'gTrade',
  'Extended', 'Variational', 'edgeX', 'Nado',
  'Backpack', 'Orderly', 'Paradex',
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

// Base-tier perpetual futures trading fees (% per trade)
// Sources: official fee pages as of Feb 2026. Some DEXes have non-standard models (noted).
// Used in arbitrage PnL calculations for per-pair fee accuracy.
export interface ExchangeFees {
  taker: number;  // % per trade (e.g., 0.05 = 0.05%)
  maker: number;  // % per trade (negative = rebate)
}

export const EXCHANGE_FEES: Record<string, ExchangeFees> = {
  'Binance':      { taker: 0.0500, maker: 0.0200 },
  'Bybit':        { taker: 0.0550, maker: 0.0200 },
  'OKX':          { taker: 0.0500, maker: 0.0200 },
  'Bitget':       { taker: 0.0600, maker: 0.0200 },
  'Hyperliquid':  { taker: 0.0450, maker: 0.0150 },
  'dYdX':         { taker: 0.0300, maker: 0.0000 }, // maker rebate ignored for simplicity
  'Aster':        { taker: 0.0350, maker: 0.0100 },
  'Lighter':      { taker: 0.0000, maker: 0.0000 }, // zero-fee standard tier
  'Aevo':         { taker: 0.0500, maker: 0.0200 },
  'MEXC':         { taker: 0.0200, maker: 0.0000 },
  'Kraken':       { taker: 0.0500, maker: 0.0200 },
  'BingX':        { taker: 0.0500, maker: 0.0200 },
  'Phemex':       { taker: 0.0600, maker: 0.0100 },
  'Bitunix':      { taker: 0.0600, maker: 0.0200 },
  'KuCoin':       { taker: 0.0600, maker: 0.0200 },
  'Deribit':      { taker: 0.0500, maker: 0.0000 },
  'HTX':          { taker: 0.0500, maker: 0.0200 },
  'Bitfinex':     { taker: 0.0000, maker: 0.0000 }, // zero-fee since Dec 2025
  'WhiteBIT':     { taker: 0.0550, maker: 0.0100 },
  'Coinbase':     { taker: 0.0300, maker: 0.0000 }, // promotional rate
  'CoinEx':       { taker: 0.0500, maker: 0.0300 },
  'gTrade':       { taker: 0.0500, maker: 0.0500 }, // flat open+close fee (no orderbook)
  'Drift':        { taker: 0.0350, maker: 0.0000 }, // maker rebate ignored
  'GMX':          { taker: 0.0700, maker: 0.0500 }, // position open+close fee
  'Extended':     { taker: 0.0250, maker: 0.0000 },
  'Variational':  { taker: 0.0000, maker: 0.0000 }, // zero explicit fees
  'BitMEX':       { taker: 0.0500, maker: 0.0000 }, // maker rebate ignored
  'Gate.io':      { taker: 0.0500, maker: 0.0150 },
  'edgeX':        { taker: 0.0350, maker: 0.0150 },
  'Nado':         { taker: 0.0150, maker: -0.0080 }, // taker 1.5bps, maker rebate up to -0.8bps
  'BloFin':       { taker: 0.0600, maker: 0.0200 },
  'Backpack':     { taker: 0.0400, maker: 0.0100 },
  'Orderly':      { taker: 0.0500, maker: 0.0200 },
  'Paradex':      { taker: 0.0400, maker: 0.0200 },
};

// Get round-trip fee for an arbitrage pair (taker on both sides: open + close on each exchange)
export function getArbRoundTripFee(exchangeA: string, exchangeB: string): number {
  const feesA = EXCHANGE_FEES[exchangeA];
  const feesB = EXCHANGE_FEES[exchangeB];
  // Round-trip = open + close on each exchange = 2× taker per exchange
  const costA = feesA ? feesA.taker * 2 : 0.10; // fallback 0.05% each way
  const costB = feesB ? feesB.taker * 2 : 0.10;
  return costA + costB;
}

// Generate a direct trading link to the exchange's perpetual futures page for a given symbol.
// Embeds referral codes where available so new users sign up via our affiliate links.
export function getExchangeTradeUrl(exchange: string, symbol: string): string | null {
  const s = symbol.toUpperCase();
  switch (exchange) {
    case 'Binance':    return `https://www.binance.com/en/futures/${s}USDT`;
    case 'Bybit':      return `https://www.bybit.com/trade/usdt/${s}USDT?affiliate_id=VL792O`;
    case 'OKX':        return `https://www.okx.com/trade-swap/${s.toLowerCase()}-usdt-swap`;
    case 'Bitget':     return `https://www.bitget.com/futures/usdt/${s}USDT?shareChannel=SSFL1S2B`;
    case 'MEXC':       return `https://futures.mexc.com/exchange/${s}_USDT?inviteCode=${Math.random() < 0.5 ? '7zeuU9AdFM' : 'i98MMJzX'}`;
    case 'Kraken':     return `https://futures.kraken.com/trade/futures/${s.toLowerCase()}-perpetual`;
    case 'BingX':      return `https://bingx.com/en/perpetual/${s}-USDT/`;
    case 'Phemex':     return `https://phemex.com/contract/trade/${s}USDT`;
    case 'Bitunix':    return `https://www.bitunix.com/futures/${s}USDT?inviteCode=sv6axk`;
    case 'Hyperliquid': return `https://app.hyperliquid.xyz/trade/${s}?ref=SNAKETHER`;
    case 'dYdX':       return `https://www.dydx.xyz/trade/${s}-USD`;
    case 'Aster':      return `https://app.aster.finance/?ref=48aFb9#/perpetual/${s}USDT`;
    case 'Lighter':    return `https://app.lighter.xyz/trade/${s}-USDT?referral=7162321B`;
    case 'Aevo':       return `https://app.aevo.xyz/perpetual/${s.toLowerCase()}`;
    case 'Drift':      return `https://app.drift.trade/trade/${s}-PERP`;
    case 'GMX':        return `https://app.gmx.io/#/trade/?ref=${Math.random() < 0.5 ? 'Q9ENQ' : 'snakether'}`;
    case 'KuCoin':     return `https://www.kucoin.com/futures/trade/${s}USDTM?rcode=${Math.random() < 0.5 ? 'CXEJE3SG' : 'QBS4DW6N'}`;
    case 'Deribit':    return `https://www.deribit.com/futures/${s}`;
    case 'HTX':        return `https://www.htx.com/futures/linear_swap/exchange#contract_code=${s}-USDT`;
    case 'Bitfinex':   return `https://trading.bitfinex.com/t/${s}F0:USTF0`;
    case 'WhiteBIT':   return `https://whitebit.com/trade/${s}_USDT?type=futures`;
    case 'Coinbase':   return `https://www.coinbase.com/advanced-trade/spot/${s}-USDT`;
    case 'CoinEx':     return `https://www.coinex.com/en/futures/${s}USDT`;
    case 'gTrade':     return `https://gains.trade/trading?ref=arasaka#${s}/USD`;
    case 'Extended':   return `https://app.extended.exchange/trade/${s}-USD`;
    case 'Variational': return `https://app.variational.io/trade/${s}`;
    case 'BitMEX':     return `https://www.bitmex.com/app/trade/${s}USD`;
    case 'Gate.io':    return `https://www.gate.io/futures_trade/USDT/${s}_USDT`;
    case 'edgeX':      return `https://pro.edgex.exchange/trade/${s}USDT`;
    case 'Nado':       return `https://www.nado.xyz/trade/${s}-PERP`;
    case 'BloFin':     return `https://blofin.com/futures/${s}-USDT`;
    case 'Backpack':   return `https://backpack.exchange/trade/${s}_USDC_PERP`;
    case 'Orderly':    return `https://app.orderly.network/perp/PERP_${s}_USDC`;
    case 'Paradex':    return `https://app.paradex.trade/trade/${s}-USD-PERP`;
    default:           return null;
  }
}
