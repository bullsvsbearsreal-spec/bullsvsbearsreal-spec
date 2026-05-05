/**
 * GMX V2 market metadata cache.
 *
 * The subsquid only stores raw market contract addresses — to display
 * "BTC/USD" instead of "0x47c031…" we resolve against GMX's public
 * markets/info endpoint and keep a 1h in-memory map.
 *
 * Shared between routes so the lookup stays warm.
 */

interface RawMarket {
  name: string;              // e.g. "BTC/USD [WBTC.b-USDC]"
  marketToken: string;       // lowercase or checksum address
  indexToken: string;
  longToken: string;
  shortToken: string;
  isListed: boolean;
}

export interface MarketInfo {
  address: string;           // lowercase (for UI/storage keys)
  addressOriginal: string;   // checksum casing (for subsquid string-exact queries)
  symbol: string;            // e.g. "BTC"
  fullName: string;          // original GMX name
  pair: string;              // e.g. "BTC-USD"
  collateralPair: string;    // e.g. "WBTC.b-USDC"
  /** Lowercase address of the index token (the asset being tracked). Used
   *  to look up the per-token decimals from the tickers table — without
   *  this, `sizeInTokens` for non-18-decimal tokens (BTC=8, SOL=9, etc.)
   *  divides by the wrong precision and renders as size=0. */
  indexToken: string;
  isDeprecated: boolean;
}

const ARBITRUM_MARKETS_URL = 'https://arbitrum-api.gmxinfra.io/markets/info';
const AVALANCHE_MARKETS_URL = 'https://avalanche-api.gmxinfra.io/markets/info';
const ARBITRUM_TICKERS_URL = 'https://arbitrum-api.gmxinfra.io/prices/tickers';
const AVALANCHE_TICKERS_URL = 'https://avalanche-api.gmxinfra.io/prices/tickers';
const CACHE_TTL = 60 * 60 * 1000; // 1h — market list rarely changes
const TICKER_TTL = 60_000;         // 1 min — prices move faster

interface MarketCacheEntry {
  map: Map<string, MarketInfo>;
  ts: number;
}

interface TokenTicker {
  symbol: string;
  address: string;           // lowercase
  minPriceRaw: string;       // GMX precision big-int string
  maxPriceRaw: string;
  /** Inferred token decimals based on the raw price magnitude. */
  decimals: number;
  /** Live USD price (midpoint of min/max). */
  priceUsd: number;
}

interface TickerCacheEntry {
  byAddress: Map<string, TokenTicker>;
  bySymbol: Map<string, TokenTicker>;
  ts: number;
}

const cache: Record<string, MarketCacheEntry> = {};
const tickerCache: Record<string, TickerCacheEntry> = {};

/** Parse "BTC/USD [WBTC.b-USDC]" into structured parts. */
function parseMarketName(name: string): Pick<MarketInfo, 'symbol' | 'pair' | 'collateralPair' | 'isDeprecated'> {
  const isDeprecated = /deprecated/i.test(name);
  // Collateral in brackets
  const bracketMatch = name.match(/\[([^\]]+)\]/);
  const collateralPair = bracketMatch ? bracketMatch[1] : '';
  // Primary pair is before the bracket
  const primary = (bracketMatch ? name.slice(0, bracketMatch.index).trim() : name).trim();
  // Primary is usually "BTC/USD" — take first "/" half as symbol
  const slash = primary.indexOf('/');
  const symbol = slash > 0 ? primary.slice(0, slash).trim() : primary.trim();
  const pair = primary.replace('/', '-');
  return { symbol, pair, collateralPair, isDeprecated };
}

async function fetchMarketsFor(url: string): Promise<Map<string, MarketInfo>> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(8_000),
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'InfoHub/2.0 (info-hub.io)',
    },
  });
  if (!res.ok) throw new Error(`GMX markets fetch returned ${res.status}`);
  const json = await res.json();
  const markets: RawMarket[] = json?.markets || [];
  const map = new Map<string, MarketInfo>();
  for (const m of markets) {
    if (!m.marketToken || !m.name) continue;
    const parsed = parseMarketName(m.name);
    map.set(m.marketToken.toLowerCase(), {
      address: m.marketToken.toLowerCase(),
      addressOriginal: m.marketToken, // keep checksum casing for subsquid queries
      symbol: parsed.symbol || '?',
      fullName: m.name,
      pair: parsed.pair,
      collateralPair: parsed.collateralPair,
      indexToken: (m.indexToken || '').toLowerCase(),
      isDeprecated: parsed.isDeprecated,
    });
  }
  return map;
}

/**
 * Get market metadata for a chain. Returns a Map of lowercase address → MarketInfo.
 * Cached 1h. Safe to call on every request — deduped internally.
 */
export async function getGMXMarkets(chain: 'arbitrum' | 'avalanche' = 'arbitrum'): Promise<Map<string, MarketInfo>> {
  const now = Date.now();
  const existing = cache[chain];
  if (existing && now - existing.ts < CACHE_TTL) {
    return existing.map;
  }

  const url = chain === 'avalanche' ? AVALANCHE_MARKETS_URL : ARBITRUM_MARKETS_URL;
  try {
    const map = await fetchMarketsFor(url);
    cache[chain] = { map, ts: now };
    return map;
  } catch (err) {
    console.warn(`[gmx-markets] ${chain} fetch error:`, err instanceof Error ? err.message : err);
    // Return stale cache rather than failing the whole request
    if (existing) return existing.map;
    return new Map();
  }
}

/**
 * Resolve a single market address to its MarketInfo, or a fallback with just the address.
 */
export async function resolveMarket(
  address: string,
  chain: 'arbitrum' | 'avalanche' = 'arbitrum',
): Promise<MarketInfo> {
  const lower = (address || '').toLowerCase();
  const map = await getGMXMarkets(chain);
  const hit = map.get(lower);
  if (hit) return hit;
  return {
    address: lower,
    addressOriginal: address || lower,
    symbol: '?',
    fullName: `${lower.slice(0, 6)}…${lower.slice(-4)}`,
    pair: '',
    collateralPair: '',
    indexToken: '',
    isDeprecated: false,
  };
}

/**
 * Infer token decimals from a GMX raw price. Prices are stored as
 * `usd_price × (1e30 / 10^tokenDecimals)`, so:
 *   decimals = 30 - log10(raw_price) - log10(usd_price)
 * We don't know usd_price, but we can pick the decimals such that the
 * recovered USD price lands in a plausible crypto range. For live tickers
 * we always pick the decimal set [6, 8, 9, 18] that produces the highest-
 * magnitude sensible price (BTC at $74k beats BTC at $0.74 even though
 * both are "plausible").
 */
function inferDecimals(rawPrice: string): { decimals: number; priceUsd: number } {
  let bn: bigint;
  try { bn = BigInt(rawPrice); } catch { return { decimals: 18, priceUsd: 0 }; }
  if (bn <= BigInt(0)) return { decimals: 18, priceUsd: 0 };

  const candidates = [6, 8, 9, 18];
  let best = { decimals: 18, priceUsd: 0, score: -Infinity };
  for (const dec of candidates) {
    const priceUsd = Number(bn) * Math.pow(10, dec) / 1e30;
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) continue;
    // Plausible crypto price range: $0.00001 .. $500,000
    if (priceUsd < 1e-5 || priceUsd > 500_000) continue;
    // Prefer higher-magnitude prices within the plausible range. Reason:
    // BTC at $74k uses 8 decimals → plausible; if you also compute 6 decimals
    // you'd get $740 which is also "plausible" but wrong. The higher figure
    // is always correct because the precision constant divides.
    const score = Math.log10(priceUsd);
    if (score > best.score) best = { decimals: dec, priceUsd, score };
  }
  return { decimals: best.decimals, priceUsd: best.priceUsd };
}

async function fetchTickersFor(url: string): Promise<TickerCacheEntry> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(6_000),
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'InfoHub/2.0 (info-hub.io)',
    },
  });
  if (!res.ok) throw new Error(`GMX tickers fetch returned ${res.status}`);
  const rows: Array<{ tokenSymbol: string; tokenAddress: string; minPrice: string; maxPrice: string }> = await res.json();
  const byAddress = new Map<string, TokenTicker>();
  const bySymbol = new Map<string, TokenTicker>();
  for (const r of rows) {
    if (!r.tokenAddress || !r.minPrice) continue;
    const { decimals, priceUsd } = inferDecimals(r.minPrice);
    const entry: TokenTicker = {
      symbol: r.tokenSymbol,
      address: r.tokenAddress.toLowerCase(),
      minPriceRaw: r.minPrice,
      maxPriceRaw: r.maxPrice,
      decimals,
      priceUsd,
    };
    byAddress.set(entry.address, entry);
    if (!bySymbol.has(r.tokenSymbol)) bySymbol.set(r.tokenSymbol, entry);
  }
  return { byAddress, bySymbol, ts: Date.now() };
}

/**
 * Get live GMX price + decimals per token, keyed by both address and symbol.
 * Cached 1 minute.
 */
export async function getGMXTickers(chain: 'arbitrum' | 'avalanche' = 'arbitrum'): Promise<TickerCacheEntry> {
  const now = Date.now();
  const existing = tickerCache[chain];
  if (existing && now - existing.ts < TICKER_TTL) return existing;

  const url = chain === 'avalanche' ? AVALANCHE_TICKERS_URL : ARBITRUM_TICKERS_URL;
  try {
    const fresh = await fetchTickersFor(url);
    tickerCache[chain] = fresh;
    return fresh;
  } catch (err) {
    console.warn(`[gmx-markets] ${chain} tickers fetch error:`, err instanceof Error ? err.message : err);
    if (existing) return existing;
    return { byAddress: new Map(), bySymbol: new Map(), ts: now };
  }
}

/**
 * Resolve a GMX V2 entry price to a USD number using live-ticker-calibrated
 * token decimals. Falls back to the log-space heuristic if the ticker for
 * this symbol isn't available.
 */
export function resolveEntryPriceUsd(
  rawEntry: string | null,
  symbol: string | undefined,
  tickers: TickerCacheEntry,
): number {
  if (!rawEntry || rawEntry === '0') return 0;
  let bn: bigint;
  try { bn = BigInt(rawEntry); } catch { return 0; }
  if (bn <= BigInt(0)) return 0;

  // Best path: use decimals inferred from the live ticker for this symbol
  if (symbol) {
    const ticker = tickers.bySymbol.get(symbol);
    if (ticker && ticker.decimals) {
      const priceUsd = Number(bn) * Math.pow(10, ticker.decimals) / 1e30;
      if (Number.isFinite(priceUsd) && priceUsd > 0) return priceUsd;
    }
  }

  // Fallback: same magnitude heuristic as ticker inference
  const { priceUsd } = inferDecimals(rawEntry);
  return priceUsd;
}
