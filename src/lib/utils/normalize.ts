/**
 * Normalize a raw exchange symbol to a base asset symbol for cross-exchange matching.
 * "BTCUSDT" → "BTC", "1000SHIBUSDT" → "SHIB", "SOL-USD-SWAP" → "SOL"
 *
 * Suffixes are stripped iteratively so multi-suffix venue strings like
 * "SOL-USD-SWAP" (which becomes "SOLUSDSWAP" after dash removal) collapse
 * fully to "SOL" — earlier this only stripped one suffix per call,
 * leaving "SOLUSD" in the cross-exchange aggregation map.
 */
export function normalizeSymbolBase(raw: string): string {
  let s = raw.toUpperCase().replace(/[-_]/g, '');
  // Iteratively strip recognised suffixes until none match.
  const suffixRe = /(USDT|USDC|USD|BUSD|PERP|SWAP)$/i;
  while (suffixRe.test(s)) {
    s = s.replace(suffixRe, '');
  }
  s = s
    .replace(/^1000000/, '')
    .replace(/^10000/, '')
    .replace(/^1000/, '')
    .replace(/^1M/, '');
  // If normalization stripped everything (e.g. "USDT", "1000USDT"), return the original uppercased
  return s || raw.toUpperCase();
}
