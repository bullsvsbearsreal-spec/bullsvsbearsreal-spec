/**
 * Shared coin-filter sets used by altseason, outperformers, breakouts, and
 * other screeners. Single source of truth so when we add a new stablecoin
 * or BTC wrapper, every screener stays in sync.
 *
 * All sets use lowercase symbols. Callers should `.toLowerCase()` the input
 * before checking. Helper `isExcludedFromAltLens` bundles the common pattern.
 */

/** USD-pegged, EUR-pegged, commodity-pegged, and tokenised treasury products. */
export const STABLE_SYMBOLS = new Set<string>([
  // USD-pegged fiat-backed
  'usdt', 'usdc', 'busd', 'dai', 'tusd', 'usdp', 'gusd', 'usdd', 'frax',
  'lusd', 'susd', 'fdusd', 'pyusd', 'usde', 'usd0', 'usdx', 'usds',
  'ustc', 'usdn', 'mim', 'usd1', 'rlusd', 'buidl', 'usdg', 'usdf', 'usyc',
  'usdy', 'ustb', 'usdo', 'ousg', 'usdv', 'jtrsy', 'usdm',
  // EUR-pegged
  'eurc', 'eurs', 'eur', 'eure', 'ageur',
  // Gold / commodity-pegged (outperformance-vs-BTC is meaningless for these)
  'paxg', 'xaut', 'kau',
]);

/** BTC wrappers / synthetic BTC. Excluded from alt-outperformance analysis because their return mirrors BTC. */
export const BTC_PROXIES = new Set<string>([
  'wbtc', 'cbbtc', 'tbtc', 'hbtc', 'renbtc', 'btcb', 'lbtc',
]);

/** ETH wrappers / LSTs. Excluded from alt-outperformance because their return mirrors ETH. */
export const ETH_PROXIES = new Set<string>([
  'steth', 'weth', 'cbeth', 'reth', 'wsteth',
  'eeth', 'weeth', 'oseth', 'lseth', 'ankreth',
]);

/**
 * Returns true if `symbol` should be dropped from an "alt outperformance"
 * universe (stablecoin, BTC/ETH, or a wrapper/LST).
 * Accepts any casing.
 */
export function isExcludedFromAltLens(symbol: string | undefined | null): boolean {
  if (!symbol) return true;
  const s = symbol.toLowerCase();
  if (s === 'btc' || s === 'eth') return true;
  if (STABLE_SYMBOLS.has(s)) return true;
  if (BTC_PROXIES.has(s)) return true;
  if (ETH_PROXIES.has(s)) return true;
  return false;
}

/**
 * Name-pattern exclusion — catches wrappers/pegged products that slip past
 * the symbol set (e.g. "Wrapped Bitcoin" variants, any "Liquid Staked X").
 */
export function hasExcludedName(name: string | undefined | null): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  if (n.includes('wrapped bitcoin') || n.includes('wrapped btc')) return true;
  if (n.includes('wrapped ether')) return true;
  if (n.includes('liquid stak')) return true;
  return false;
}
