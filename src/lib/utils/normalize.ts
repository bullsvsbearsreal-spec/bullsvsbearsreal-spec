/**
 * Normalize a raw exchange symbol to a base asset symbol for cross-exchange matching.
 * "BTCUSDT" → "BTC", "1000SHIBUSDT" → "SHIB", "SOL-USD-SWAP" → "SOL"
 */
export function normalizeSymbolBase(raw: string): string {
  const result = raw
    .toUpperCase()
    .replace(/[-_]/g, '')
    .replace(/(USDT|USDC|USD|BUSD|PERP|SWAP)$/i, '')
    .replace(/^1000000/, '')
    .replace(/^10000/, '')
    .replace(/^1000/, '')
    .replace(/^1M/, '');
  // If normalization stripped everything (e.g. "USDT", "1000USDT"), return the original uppercased
  return result || raw.toUpperCase();
}
