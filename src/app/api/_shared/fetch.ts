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
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}
