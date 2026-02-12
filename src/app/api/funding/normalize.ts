// Centralized symbol normalization and asset class classification
// Used by exchange fetchers to properly tag stocks, forex, and commodities

export type AssetClass = 'crypto' | 'stocks' | 'forex' | 'commodities';

// Known stock symbols (traded as perps on various DEX/CEX)
export const KNOWN_STOCKS = new Set([
  // FAANG + Big Tech
  'AAPL', 'AMZN', 'GOOGL', 'GOOG', 'META', 'MSFT', 'NFLX', 'NVDA', 'TSLA',
  // Fintech / Crypto-adjacent
  'COIN', 'HOOD', 'MSTR', 'SQ', 'PYPL', 'RIOT', 'MARA', 'CLSK', 'CIFR',
  // Semiconductors
  'AMD', 'INTC', 'ARM', 'AVGO', 'QCOM', 'TSM', 'MRVL', 'MU',
  // Other mega-cap / popular
  'PLTR', 'UBER', 'ABNB', 'SNOW', 'CRM', 'ORCL', 'SHOP', 'NET', 'BA',
  'DIS', 'JPM', 'V', 'MA', 'WMT', 'KO', 'PEP', 'JNJ', 'PFE', 'LLY',
  'UNH', 'BRK', 'XOM', 'CVX', 'PG', 'NKE', 'MCD', 'HD', 'COST',
  'CSCO', 'ACN', 'ASML', 'RDDT', 'APP', 'IBM', 'GME', 'GE', 'RACE', 'CRCL', 'WDC',
  // ETFs / Indices
  'SPY', 'SPX', 'QQQ', 'IWM', 'DIA', 'ARKK',
]);

// Known forex pairs (canonical form, no separators)
export const KNOWN_FOREX = new Set([
  // Majors
  'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD',
  // Crosses
  'EURGBP', 'EURJPY', 'EURCHF', 'EURAUD', 'EURCAD', 'EURNZD',
  'GBPJPY', 'GBPCHF', 'GBPAUD', 'GBPCAD', 'GBPNZD',
  'AUDJPY', 'AUDCHF', 'AUDNZD', 'AUDCAD',
  'NZDJPY', 'NZDCHF', 'NZDCAD',
  'CADJPY', 'CADCHF', 'CHFJPY',
  // Emerging market
  'USDKRW', 'USDMXN', 'USDBRL', 'USDTRY', 'USDZAR', 'USDSGD', 'USDHKD',
  'USDSEK', 'USDNOK', 'USDPLN', 'USDCZK', 'USDHUF', 'USDTWD', 'USDINR',
  'USDDKK', 'USDILS',
  // Exotic crosses
  'EURSGD', 'GBPSGD',
  // Reversed forms (some exchanges use XXX/USD instead of USD/XXX)
  'TRYUSD', 'JPYUSD', 'CHFUSD', 'MXNUSD', 'KRWUSD', 'SGDUSD',
  'HKDUSD', 'SEKUSD', 'NOKUSD', 'PLNUSD', 'CZKUSD', 'HUFUSD',
  'CADUSD', 'ZARUSD', 'BRLUSD', 'TWDUSD', 'INRUSD',
]);

// Known forex BASE symbols (for gTrade "from" field matching)
const FOREX_BASES = new Set([
  'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD',
  'SEK', 'NOK', 'PLN', 'CZK', 'HUF', 'TRY', 'ZAR',
  'SGD', 'HKD', 'KRW', 'MXN', 'BRL', 'TWD', 'INR',
]);

// Known commodity symbols
export const KNOWN_COMMODITIES = new Set([
  // Precious metals
  'XAU', 'XAG', 'XPT', 'XPD',
  // Base metals
  'XCU', 'HG',
  // Energy
  'WTI', 'BRENT', 'NATGAS', 'UKOIL', 'USOIL',
  // PAXG is tokenized gold — treat as commodity
  'PAXG',
]);

// gTrade group index → asset class mapping
export const GTRADE_GROUP_ASSET_CLASS: Record<number, AssetClass> = {
  0: 'crypto',     // BTC, ETH
  1: 'forex',      // Forex majors (EUR/USD, GBP/USD, etc.)
  2: 'stocks',     // Stocks tier 1
  3: 'stocks',     // Stocks tier 2
  4: 'stocks',     // Stocks tier 3
  5: 'stocks',     // Indices (SPY, QQQ)
  6: 'commodities', // Metals (XAU, XAG)
  7: 'commodities', // Energy (WTI, BRENT, NATGAS)
  8: 'forex',      // Forex crosses
  9: 'forex',      // Forex EM
  10: 'crypto',    // Altcoins
  11: 'crypto',    // Crypto degen
};

interface NormalizeResult {
  symbol: string;
  assetClass: AssetClass;
}

/**
 * Normalize a raw exchange symbol and classify its asset class.
 * Each exchange has quirky symbol formats that need per-exchange handling.
 */
export function normalizeSymbol(rawSymbol: string, exchange: string): NormalizeResult {
  switch (exchange.toLowerCase()) {
    case 'gate.io':
    case 'gateio':
      return normalizeGateio(rawSymbol);

    case 'aster':
      return normalizeAster(rawSymbol);

    case 'lighter':
      return normalizeLighter(rawSymbol);

    case 'phemex':
      return normalizePhemex(rawSymbol);

    case 'dydx':
      return normalizeDydx(rawSymbol);

    case 'bingx':
      return normalizeBingx(rawSymbol);

    default:
      return classifySymbol(rawSymbol);
  }
}

/**
 * Gate.io xStocks format: AAPLX_USDT, TSLAX_USDT, SPYX_USDT
 * Stock symbols have trailing X suffix. Strip _USDT and trailing X for stocks.
 */
function normalizeGateio(raw: string): NormalizeResult {
  // Raw comes pre-stripped of _USDT by the fetcher
  const symbol = raw.replace('_USDT', '');

  // Check if it's a known stock with X suffix (AAPLX → AAPL)
  if (symbol.endsWith('X')) {
    const base = symbol.slice(0, -1);
    if (KNOWN_STOCKS.has(base)) {
      return { symbol: base, assetClass: 'stocks' };
    }
  }

  // Other stock patterns
  if (KNOWN_STOCKS.has(symbol)) return { symbol, assetClass: 'stocks' };

  return classifySymbol(symbol);
}

/**
 * Aster DEX format: TSLAUSDT, AAPLUSDT, SHIELDTSLAUSDT, SHIELDAAPLUSDT
 * SHIELD prefix = hedge variant. Strip SHIELD + USDT/USDC suffix.
 */
function normalizeAster(raw: string): NormalizeResult {
  let symbol = raw;
  const hadShield = symbol.startsWith('SHIELD');

  // Strip SHIELD prefix (hedge variants of stocks/forex/commodities)
  if (hadShield) {
    symbol = symbol.slice(6); // Remove 'SHIELD'
  }

  // Strip quote currency suffix
  if (symbol.endsWith('USDT')) symbol = symbol.slice(0, -4);
  else if (symbol.endsWith('USDC')) symbol = symbol.slice(0, -4);

  // Classify
  if (KNOWN_STOCKS.has(symbol)) return { symbol, assetClass: 'stocks' };
  if (KNOWN_COMMODITIES.has(symbol)) return { symbol, assetClass: 'commodities' };

  // Aster forex pairs: EURUSDUSDT → EURUSD, JPYUSDUSDT → JPYUSD
  if (KNOWN_FOREX.has(symbol)) return { symbol, assetClass: 'forex' };
  // Check if it ends with USD and the base is a known forex currency
  if (symbol.endsWith('USD') && FOREX_BASES.has(symbol.replace('USD', ''))) {
    // Some are reversed (JPYUSD instead of USDJPY) — normalize to canonical form
    const base = symbol.replace('USD', '');
    const canonicalForward = base + 'USD'; // e.g., JPYUSD
    const canonicalReverse = 'USD' + base; // e.g., USDJPY
    const canonical = KNOWN_FOREX.has(canonicalForward) ? canonicalForward
      : KNOWN_FOREX.has(canonicalReverse) ? canonicalReverse
      : canonicalForward;
    return { symbol: canonical, assetClass: 'forex' };
  }

  // SHIELD prefix = hedge variant of a non-crypto asset (e.g., SHIELDSTXUSDT = Seagate stock)
  // If no known classification matched, SHIELD symbols default to stocks
  if (hadShield) return { symbol, assetClass: 'stocks' };

  return { symbol, assetClass: 'crypto' };
}

/**
 * Lighter symbols are pre-normalized (AAPL, EURUSD, XAU, BTC).
 * Just classify by set membership.
 */
function normalizeLighter(raw: string): NormalizeResult {
  if (KNOWN_STOCKS.has(raw)) return { symbol: raw, assetClass: 'stocks' };
  if (KNOWN_FOREX.has(raw)) return { symbol: raw, assetClass: 'forex' };
  if (KNOWN_COMMODITIES.has(raw)) return { symbol: raw, assetClass: 'commodities' };
  return { symbol: raw, assetClass: 'crypto' };
}

/**
 * Phemex format: TSLAUSDT, AAPLUSDT, XAUUSDT
 * Strip USDT suffix, then classify.
 */
function normalizePhemex(raw: string): NormalizeResult {
  let symbol = raw;
  if (symbol.endsWith('USDT')) symbol = symbol.slice(0, -4);

  if (KNOWN_STOCKS.has(symbol)) return { symbol, assetClass: 'stocks' };
  if (KNOWN_COMMODITIES.has(symbol)) return { symbol, assetClass: 'commodities' };
  if (KNOWN_FOREX.has(symbol)) return { symbol, assetClass: 'forex' };

  return { symbol, assetClass: 'crypto' };
}

/**
 * dYdX format: BTC-USD, EUR-USD, TRY-USD, PAXG-USD
 * Strip -USD suffix. EUR → EURUSD (forex), PAXG → commodity, rest → crypto.
 * Note: dYdX is primarily crypto — only classify non-crypto for known forex/commodity.
 * Some symbols like CVX (Convex Finance) collide with stock tickers, so skip stock check.
 */
function normalizeDydx(raw: string): NormalizeResult {
  const symbol = raw.replace('-USD', '');

  // Check if the base is a known forex currency → construct pair
  if (FOREX_BASES.has(symbol)) {
    const pair = symbol + 'USD';
    return { symbol: pair, assetClass: 'forex' };
  }

  if (KNOWN_COMMODITIES.has(symbol)) return { symbol, assetClass: 'commodities' };
  // Intentionally skip KNOWN_STOCKS check for dYdX — CVX, DIS, etc. are crypto tokens on dYdX

  return { symbol, assetClass: 'crypto' };
}

/**
 * BingX format: AAPL-USDT, NCSK* patterns, *2USD tokenized stocks
 * Strip -USDT suffix, handle NCSK prefix and 2USD suffix, classify.
 */
function normalizeBingx(raw: string): NormalizeResult {
  let symbol = raw.replace('-USDT', '');

  // BingX prefixes: NCSK=stocks, NCCO=commodities, NCFX=forex, NCSI=indices
  if (symbol.startsWith('NCCO')) {
    let ticker = symbol.slice(4); // Strip 'NCCO'
    if (ticker.endsWith('2USD')) ticker = ticker.slice(0, -4);
    // Map common commodity names to standard symbols
    const BINGX_COMMODITY_MAP: Record<string, string> = {
      'GOLD': 'XAU', 'SILVER': 'XAG', 'OILWTI': 'WTI', 'OILBRENT': 'BRENT',
      'NATURALGAS': 'NATGAS', 'COPPER': 'XCU', 'PALLADIUM': 'XPD', 'XAG': 'XAG',
      'ALUMINIUM': 'ALU', 'COCOA': 'COCOA', 'COFFEE': 'COFFEE', 'GASOLINE': 'GASOLINE',
      'HEATINGOIL': 'HEATINGOIL', 'LEAD': 'LEAD', 'NICKEL': 'NICKEL', 'SOYBEANS': 'SOYBEANS', 'ZINC': 'ZINC',
    };
    const mapped = BINGX_COMMODITY_MAP[ticker] || ticker;
    return { symbol: mapped, assetClass: 'commodities' };
  }

  if (symbol.startsWith('NCFX')) {
    let ticker = symbol.slice(4); // Strip 'NCFX'
    // Strip 2USD denomination suffix first (EURSGD2USD → EURSGD, EUR2JPY → EUR2JPY)
    if (ticker.endsWith('2USD')) ticker = ticker.slice(0, -4);
    // Then strip remaining '2' separators: EUR2JPY → EURJPY
    ticker = ticker.replace('2', '');
    // If bare forex base currency (EUR from NCFXEUR2USD), construct full pair
    if (FOREX_BASES.has(ticker)) {
      const pair = ticker + 'USD';
      return { symbol: pair, assetClass: 'forex' };
    }
    if (KNOWN_FOREX.has(ticker)) return { symbol: ticker, assetClass: 'forex' };
    // If ends with USD and base is known forex currency
    if (ticker.endsWith('USD') && FOREX_BASES.has(ticker.replace('USD', ''))) {
      return { symbol: ticker, assetClass: 'forex' };
    }
    if (ticker.startsWith('USD') && ticker.length > 3) return { symbol: ticker, assetClass: 'forex' };
    return { symbol: ticker, assetClass: 'forex' };
  }

  if (symbol.startsWith('NCSI')) {
    let ticker = symbol.slice(4); // Strip 'NCSI'
    if (ticker.endsWith('2USD')) ticker = ticker.slice(0, -4);
    // Indices: map to standard symbols
    const BINGX_INDEX_MAP: Record<string, string> = {
      'SP500': 'SPX', 'NASDAQ100': 'QQQ', 'DOWJONES': 'DIA', 'RUSSELL2000': 'IWM', 'NIKKEI225': 'NIKKEI',
    };
    const mapped = BINGX_INDEX_MAP[ticker] || ticker;
    return { symbol: mapped, assetClass: 'stocks' }; // Indices grouped with stocks
  }

  if (symbol.startsWith('NCSK') || symbol.startsWith('ACNSTOCK')) {
    // Tokenized stock — extract ticker: NCSKTSLA2USD → TSLA
    let ticker = symbol.replace('NCSK', '').replace('ACNSTOCK', '');
    // Strip 2USD suffix if present
    if (ticker.endsWith('2USD')) ticker = ticker.slice(0, -4);
    if (KNOWN_STOCKS.has(ticker)) return { symbol: ticker, assetClass: 'stocks' };
    return { symbol: ticker || symbol, assetClass: 'stocks' };
  }

  // BingX tokenized stocks may also use plain 2USD suffix or X suffix
  if (symbol.endsWith('2USD')) {
    const ticker = symbol.slice(0, -4); // Strip '2USD'
    if (KNOWN_STOCKS.has(ticker)) return { symbol: ticker, assetClass: 'stocks' };
    return { symbol: ticker, assetClass: 'stocks' }; // Assume stock if 2USD suffix
  }

  // BingX X-suffix stocks (AAPLX → AAPL)
  if (symbol.endsWith('X')) {
    const base = symbol.slice(0, -1);
    if (KNOWN_STOCKS.has(base)) return { symbol: base, assetClass: 'stocks' };
  }

  if (KNOWN_STOCKS.has(symbol)) return { symbol, assetClass: 'stocks' };
  if (KNOWN_COMMODITIES.has(symbol)) return { symbol, assetClass: 'commodities' };

  return { symbol, assetClass: 'crypto' };
}

/**
 * Generic symbol classifier — check against known sets.
 */
function classifySymbol(symbol: string): NormalizeResult {
  if (KNOWN_STOCKS.has(symbol)) return { symbol, assetClass: 'stocks' };
  if (KNOWN_FOREX.has(symbol)) return { symbol, assetClass: 'forex' };
  if (KNOWN_COMMODITIES.has(symbol)) return { symbol, assetClass: 'commodities' };
  return { symbol, assetClass: 'crypto' };
}
