// Shared fetch utilities for API routes
import { getCache, setCache, isDBConfigured } from '@/lib/db';

// Filter out tokenized stocks, indices, and known non-crypto symbols
// BingX lists NCSK* (tokenized equities), *X stock indices (AAPLX, NVDAX, SPYX)
// Kraken lists *X stock derivatives (SPYXUSD, AAPLXUSD)
const STOCK_SYMBOL_PATTERNS = /^(NCSK|NCCO|NCFX|NCSI|ACNSTOCK)/;
const STOCK_SUFFIX_SYMBOLS = new Set([
  'AAPLX', 'NVDAX', 'SPYX', 'CRCLX', 'METAX', 'WMTX', 'GOOGX', 'AMZX',
  'MSFTX', 'TSLAX', 'COINX', 'HOODDX', 'ARMX', 'INTCX', 'PLTRX', 'MRVLX',
]);
export function isCryptoSymbol(symbol: string): boolean {
  if (!symbol) return false;
  if (STOCK_SYMBOL_PATTERNS.test(symbol)) return false;
  if (STOCK_SUFFIX_SYMBOLS.has(symbol)) return false;
  return true;
}

// Symbol normalization for token rebrands — map old ticker to canonical name
const SYMBOL_ALIASES: Record<string, string> = {
  'RNDR': 'RENDER',
  'MATIC': 'POL',
};
export function normalizeSymbol(symbol: string): string {
  const original = symbol;
  // Strip quantity prefixes used by exchanges for low-price tokens
  // 1000000PEPE (Aevo), 10000SATS (Aevo), 1000SHIB (Bybit/OKX/Bitget), 1MBONK (Drift)
  if (symbol.startsWith('1000000')) symbol = symbol.slice(7);
  else if (symbol.startsWith('10000')) symbol = symbol.slice(5);
  else if (symbol.startsWith('1000')) symbol = symbol.slice(4);
  else if (symbol.startsWith('1M')) symbol = symbol.slice(2);
  if (!symbol) return original; // guard against prefix-only inputs
  return SYMBOL_ALIASES[symbol] || symbol;
}

// Common headers to help with API requests
export const commonHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Proxy URL for CloudFlare-blocked exchanges and unreliable data APIs
// Set PROXY_URL env var to a proxy service URL, e.g. "https://proxy.info-hub.io" (DO droplet)
// The proxy should forward: GET {PROXY_URL}?url={encoded_target_url}
// Defensive: strip whitespace/newlines/backslashes that can leak from .env corruption
const _rawProxyUrl = (process.env.PROXY_URL || '')
  .trim()
  .replace(/\\n$/, '')        // strip literal "\n" tail (seen in Vercel env corruption)
  .replace(/[\r\n\s]+$/g, ''); // strip trailing whitespace/newlines
const PROXY_URL = _rawProxyUrl && _rawProxyUrl.startsWith('https://') ? _rawProxyUrl.replace(/\/$/, '') : '';
if (_rawProxyUrl && !PROXY_URL) {
  console.warn('[proxy] PROXY_URL ignored — must start with https://');
}

/** Domains that need proxying due to CloudFlare datacenter IP blocks, stale responses, or geo-blocking */
const PROXIED_DOMAINS = new Set([
  'www.bitmex.com',
  'api.hbdm.com',        // HTX — consistently blocked from Vercel IPs since ~Mar 2026
  'omni-client-api.prod.ap-northeast-1.variational.io', // Variational
  'query1.finance.yahoo.com',
  'query2.finance.yahoo.com',
  'data.api.drift.trade', // Drift data API — unreliable from Vercel bom1; route through DO droplet
  'dlob.drift.trade',     // Drift DLOB API (fallback price data)
  // Gate.io (api.gateio.ws) and edgeX (pro.edgex.exchange) work directly from FRA1
  // but fail through CF Worker proxy — keep them direct-only
]);

/** Rewrite a URL through the proxy if the domain is blocked and proxy is configured */
export function maybeProxyUrl(url: string): string {
  if (!PROXY_URL) return url;
  try {
    const { hostname } = new URL(url);
    if (PROXIED_DOMAINS.has(hostname)) {
      return `${PROXY_URL}?url=${encodeURIComponent(url)}`;
    }
  } catch {}
  return url;
}

// Top 500 coins by market cap — cached for 30 minutes (CMC)
let top500Cache: { symbols: Set<string>; timestamp: number } | null = null;
let top500FailedAt = 0; // Cooldown to avoid spamming CMC on repeated failures
let top500FailLogged = false; // Only log the warning once per failure window
const TOP500_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const TOP500_FAIL_COOLDOWN = 5 * 60 * 1000; // 5 min cooldown after failure

const CMC_API_KEY = process.env.CMC_API_KEY || '';

export async function getTop500Symbols(): Promise<Set<string>> {
  // L1: In-memory cache
  if (top500Cache && Date.now() - top500Cache.timestamp < TOP500_CACHE_TTL) {
    return top500Cache.symbols;
  }

  // Failure cooldown — don't hammer CMC if it just failed
  if (top500FailedAt && Date.now() - top500FailedAt < TOP500_FAIL_COOLDOWN) {
    return top500Cache?.symbols ?? new Set<string>();
  }

  // L2: DB cache (may have been populated by top-movers route)
  if (isDBConfigured()) {
    try {
      const dbSymbols = await getCache<string[]>('top500-symbols');
      if (dbSymbols && dbSymbols.length > 100) {
        const symbols = new Set<string>(dbSymbols);
        top500Cache = { symbols, timestamp: Date.now() };
        top500FailLogged = false;
        return symbols;
      }
    } catch { /* proceed to CMC */ }
  }

  // Fetch from CMC
  try {
    const res = await fetch(
      'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?limit=500&sort=market_cap&convert=USD',
      {
        headers: { 'X-CMC_PRO_API_KEY': CMC_API_KEY, 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!res.ok) throw new Error(`CMC top500 failed: ${res.status}`);
    const json = await res.json();
    const symbolArray = (json.data || []).map((c: any) => c.symbol?.toUpperCase()).filter(Boolean);
    const symbols = new Set<string>(symbolArray);
    if (symbols.size > 100) {
      top500Cache = { symbols, timestamp: Date.now() };
      top500FailedAt = 0;
      top500FailLogged = false;
      // Store in DB for other routes to reuse
      if (isDBConfigured()) {
        setCache('top500-symbols', symbolArray, 1800).catch(e => console.warn('[fetch] cache symbols failed:', e));
      }
    }
    return symbols;
  } catch (err) {
    top500FailedAt = Date.now();
    // Only log once per failure window to avoid spamming logs
    if (!top500FailLogged) {
      top500FailLogged = true;
      console.warn('[CMC] Top500 fetch failed — using fallback (suppressing further warnings for 5 min):', err instanceof Error ? err.message : err);
    }
    return top500Cache?.symbols ?? new Set<string>();
  }
}

export function isTop500Symbol(symbol: string, top500: Set<string>): boolean {
  // Empty set means CMC failed — allow all to avoid dropping data
  if (top500.size === 0) return true;
  return top500.has(symbol.toUpperCase());
}

// Binance domain fallback — fapi.binance.com is geo-blocked in some regions
const BINANCE_FAPI_DOMAINS = [
  'https://fapi.binance.com',
  'https://fapi.binance.me',
];

// Bybit domain fallback — api.bybit.com is geo-blocked in some regions
const BYBIT_API_DOMAINS = [
  'https://api.bybit.com',
  'https://api.bytick.com',
];

// Rewrite URL to try alternate domains when primary is blocked
function getDomainFallbacks(url: string): string[] {
  for (const primary of BINANCE_FAPI_DOMAINS) {
    if (url.startsWith(primary)) {
      return BINANCE_FAPI_DOMAINS.filter(d => d !== primary).map(d => url.replace(primary, d));
    }
  }
  for (const primary of BYBIT_API_DOMAINS) {
    if (url.startsWith(primary)) {
      return BYBIT_API_DOMAINS.filter(d => d !== primary).map(d => url.replace(primary, d));
    }
  }
  return [];
}

// Helper function for fetch with timeout
export async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 10000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  // Route through proxy for CloudFlare-blocked domains
  const effectiveUrl = maybeProxyUrl(url);
  try {
    const response = await fetch(effectiveUrl, {
      ...options,
      signal: controller.signal,
      headers: { ...commonHeaders, ...options.headers },
    });
    clearTimeout(id);
    // If geo-blocked (451/403), try fallback domains
    if (response.status === 451 || response.status === 403) {
      const fallbacks = getDomainFallbacks(url);
      for (const fallbackUrl of fallbacks) {
        const controller2 = new AbortController();
        const id2 = setTimeout(() => controller2.abort(), timeout);
        try {
          const fallbackResponse = await fetch(fallbackUrl, {
            ...options,
            signal: controller2.signal,
            headers: { ...commonHeaders, ...options.headers },
          });
          clearTimeout(id2);
          if (fallbackResponse.ok) return fallbackResponse;
        } catch {
          clearTimeout(id2);
          continue;
        }
      }
    }
    return response;
  } catch (error) {
    clearTimeout(id);
    // On network error, also try fallbacks
    const fallbacks = getDomainFallbacks(url);
    for (const fallbackUrl of fallbacks) {
        const controller2 = new AbortController();
        const id2 = setTimeout(() => controller2.abort(), timeout);
        try {
          const fallbackResponse = await fetch(fallbackUrl, {
            ...options,
            signal: controller2.signal,
            headers: { ...commonHeaders, ...options.headers },
          });
          clearTimeout(id2);
          if (fallbackResponse.ok) return fallbackResponse;
        } catch {
          clearTimeout(id2);
          continue;
        }
    }
    throw error;
  }
}
