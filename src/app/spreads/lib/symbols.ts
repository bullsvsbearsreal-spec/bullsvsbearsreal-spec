// ─── Default Symbols & Categories ─────────────────────────────────────────────
// 145 symbols across crypto, commodities, forex, stocks, indices

export const SYMBOLS: Record<string, string[]> = {
  // ── Crypto ──
  Majors: ['BTC','ETH','SOL','BNB','XRP','ADA','DOGE','AVAX','LINK','TON','LTC','BCH','ETC','TRX'],
  'Layer 2': ['ARB','OP','MATIC','STRK','ZK','IMX','MANTA','STX','SEI','METIS','BLAST'],
  AI: ['TAO','FET','RENDER','RNDR','ARKM','WLD','OCEAN','AGIX','AKT','NEAR','AR'],
  Alts: ['SUI','APT','DOT','FIL','ATOM','INJ','HBAR','TIA','ALGO','VET','FTM','KAS','JASMY','IOTA','EOS','XLM','THETA','EGLD','GRT','SAND'],
  DeFi: ['AAVE','UNI','MKR','CRV','DYDX','SNX','COMP','LDO','EIGEN','ENA','ONDO','JUP','PYTH','PENDLE','CAKE','SUSHI','1INCH','GMX','RSR'],
  Memes: ['PEPE','WIF','BONK','FLOKI','SHIB','POPCAT','BRETT','MOG','MEW','TRUMP','PENGU','TURBO','NEIRO','DEGEN','BOME','MYRO','MOODENG'],
  Gaming: ['MANA','AXS','GALA','BLUR','ENS','W','ZRO','PIXEL','PORTAL','PRIME','RONIN','BEAM'],
  // ── Commodities ──
  'Precious Metals': ['XAU','XAG','XAUT','XPT','XPD'],
  Energy: ['WTI','BRENT','NATGAS'],
  Industrial: ['COPPER'],
  // ── Forex ──
  'Forex Majors': ['EURUSD','GBPUSD','USDJPY','USDCHF','AUDUSD','USDCAD','NZDUSD'],
  'Forex Crosses': ['EURGBP','EURJPY','GBPJPY','AUDJPY','EURAUD','EURCHF'],
  // ── Equities ──
  'Mega Cap Stocks': ['AAPL','TSLA','NVDA','GOOGL','MSFT','AMZN','META','NFLX','INTC','ARM'],
  'Crypto Stocks': ['COIN','MSTR','HOOD','PLTR'],
  // ── Indices ──
  Indices: ['SPX','QQQ','DIA','IWM'],
};

export const CEX_EXCHANGES = [
  'Binance','Bybit','OKX','Bitget','MEXC','Kraken','BingX','HTX','Phemex',
  'KuCoin','Bitfinex','WhiteBIT','Coinbase','CoinEx','Bitunix','Deribit','BitMEX','Gate.io',
];

export const DEX_EXCHANGES = [
  'Hyperliquid','dYdX','gTrade','Aster','Lighter','Aevo','Drift',
  'Extended','Variational','Nado','Backpack','Orderly','Paradex',
];

export const ALL_EXCHANGES = [...CEX_EXCHANGES, ...DEX_EXCHANGES];

export const DEFAULT_SELECTED = ['Binance','Bybit','OKX','Bitget','MEXC','Kraken','Hyperliquid','dYdX'];

// Asset class detection based on category
export type AssetClass = 'crypto' | 'commodities' | 'forex' | 'stocks' | 'indices';

const NON_CRYPTO_CATEGORIES: Record<string, AssetClass> = {
  'Precious Metals': 'commodities',
  Energy: 'commodities',
  Industrial: 'commodities',
  'Forex Majors': 'forex',
  'Forex Crosses': 'forex',
  'Mega Cap Stocks': 'stocks',
  'Crypto Stocks': 'stocks',
  Indices: 'indices',
};

export function getAssetClass(symbol: string): AssetClass {
  for (const [cat, ac] of Object.entries(NON_CRYPTO_CATEGORIES)) {
    if (SYMBOLS[cat]?.includes(symbol)) return ac;
  }
  return 'crypto';
}

export function getCategoryForSymbol(symbol: string): string | null {
  for (const [cat, syms] of Object.entries(SYMBOLS)) {
    if (syms.includes(symbol)) return cat;
  }
  return null;
}

export function getAllDefaultSymbols(): string[] {
  return Object.values(SYMBOLS).flat();
}
