/**
 * Normalize a URL/user-input symbol like "BTCUSDT" / "BTC-USDT" / "BTC_USD"
 * / "BTCUSDC" into the bare asset symbol "BTC" that the /api/tickers feed
 * uses. Without this, /symbol/BTCUSDT (a natural URL for users) rendered
 * all zeros because the filter `t.symbol === 'BTCUSDT'` never matched any
 * row (tickers are normalized to base assets upstream).
 *
 * Stripped quote suffixes (in priority order — longest first to avoid
 * USDT being shortened to USD):
 *   USDT, USDC, BUSD, TUSD, USDE, USDP, USDD, USD, EUR, BTC, ETH
 *
 * Edge cases:
 *   - "BTC" stays "BTC" (don't strip when result would be empty)
 *   - "USDT" stays "USDT" (same)
 *   - "BTCUSDT" → "BTC"
 *   - "BTC-USDT" → "BTC"
 *   - "ETHBTC" → "ETH" (cross-pair gets the base asset)
 */
export function normalizeSymbolParam(raw: string): string {
  if (!raw) return '';
  const upper = raw.toUpperCase().replace(/[-_]/g, '');
  for (const quote of [
    'USDT', 'USDC', 'BUSD', 'TUSD', 'USDE', 'USDP', 'USDD',
    'USD', 'EUR', 'BTC', 'ETH',
  ]) {
    if (upper.endsWith(quote) && upper.length > quote.length) {
      return upper.slice(0, -quote.length);
    }
  }
  return upper;
}
