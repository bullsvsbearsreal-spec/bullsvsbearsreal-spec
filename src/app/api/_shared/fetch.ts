// Shared fetch utilities for Edge Runtime API routes

// Filter out tokenized stocks, indices, and known non-crypto symbols
// BingX lists NCSK* (tokenized equities), *X stock indices (AAPLX, NVDAX, SPYX)
// Kraken lists *X stock derivatives (SPYXUSD, AAPLXUSD)
const STOCK_SYMBOL_PATTERNS = /^(NCSK|ACNSTOCK)/;
const STOCK_SUFFIX_SYMBOLS = new Set([
  'AAPLX', 'NVDAX', 'SPYX', 'CRCLX', 'METAX', 'WMTX', 'GOOGX', 'AMZX',
  'MSFTX', 'TSLAX', 'COINX', 'HOODDX', 'ARMX', 'INTCX', 'PLTRX', 'MRVLX',
]);
export function isCryptoSymbol(symbol: string): boolean {
  if (STOCK_SYMBOL_PATTERNS.test(symbol)) return false;
  if (STOCK_SUFFIX_SYMBOLS.has(symbol)) return false;
  return true;
}

// Common headers to help with API requests
export const commonHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Top 500 coins by market cap — cached for 10 minutes
let top500Cache: { symbols: Set<string>; timestamp: number } | null = null;
const TOP500_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export async function getTop500Symbols(): Promise<Set<string>> {
  if (top500Cache && Date.now() - top500Cache.timestamp < TOP500_CACHE_TTL) {
    return top500Cache.symbols;
  }
  try {
    const [page1, page2] = await Promise.all([
      fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false', {
        headers: commonHeaders,
        signal: AbortSignal.timeout(8000),
      }).then(r => r.ok ? r.json() : []),
      fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=2&sparkline=false', {
        headers: commonHeaders,
        signal: AbortSignal.timeout(8000),
      }).then(r => r.ok ? r.json() : []),
    ]);
    const symbols = new Set<string>(
      [...page1, ...page2].map((c: any) => c.symbol?.toUpperCase()).filter(Boolean)
    );
    if (symbols.size > 100) {
      top500Cache = { symbols, timestamp: Date.now() };
    }
    return symbols;
  } catch {
    // On failure, return cached data if available, otherwise allow all
    return top500Cache?.symbols ?? new Set<string>();
  }
}

export function isTop500Symbol(symbol: string, top500: Set<string>): boolean {
  // Empty set means CoinGecko failed — allow all to avoid dropping data
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
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { ...commonHeaders, ...options.headers },
    });
    clearTimeout(id);
    // If geo-blocked (451/403), try fallback domains
    if (response.status === 451 || response.status === 403) {
      const fallbacks = getDomainFallbacks(url);
      for (const fallbackUrl of fallbacks) {
        try {
          const controller2 = new AbortController();
          const id2 = setTimeout(() => controller2.abort(), timeout);
          const fallbackResponse = await fetch(fallbackUrl, {
            ...options,
            signal: controller2.signal,
            headers: { ...commonHeaders, ...options.headers },
          });
          clearTimeout(id2);
          if (fallbackResponse.ok) return fallbackResponse;
        } catch {
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
      try {
        const controller2 = new AbortController();
        const id2 = setTimeout(() => controller2.abort(), timeout);
        const fallbackResponse = await fetch(fallbackUrl, {
          ...options,
          signal: controller2.signal,
          headers: { ...commonHeaders, ...options.headers },
        });
        clearTimeout(id2);
        if (fallbackResponse.ok) return fallbackResponse;
      } catch {
        continue;
      }
    }
    throw error;
  }
}
