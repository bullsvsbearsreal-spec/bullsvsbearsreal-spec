/**
 * Promo-post filtering for the /news feed featured-article picker.
 *
 * Extracted from page.tsx so the cardinality-control logic
 * (`isExchangeSource` prefix-match + `looksLikePromo` AND-gate) can
 * be unit-tested without spinning up a Next.js page. The regression
 * this guards against is silent: a relaxed regex or a missing
 * exchange name lets sponsored "Predict & Earn" posts take over the
 * featured slot above real news.
 */

/** Source-name prefixes that identify an exchange's own RSS feed.
 *  PREFIX-match because the news API exposes per-feed labels like
 *  "Binance Listings", "Binance Latest", "Bybit", "Kraken". A
 *  Set-equality check (the pre-1307984a state) caught the shorter
 *  labels but missed Binance, so "Up to 100% bonus" + "Predict &
 *  Earn" listings from Binance slipped through. */
export const EXCHANGE_SOURCE_PREFIXES = [
  'Bybit', 'Binance', 'OKX', 'Coinbase', 'Kraken', 'KuCoin', 'Bitget',
  'Bitfinex', 'MEXC', 'Gate.io', 'HTX', 'Bitstamp', 'BingX', 'BitMEX',
];

/** Keywords that look like sponsored / incentive-program posts.
 *  Case-insensitive. Match has to be on the *title* — promo
 *  text in the body alone is fine (real journalism quotes promo
 *  text). The full filter (`looksLikePromo`) AND-gates source +
 *  title so news outlets writing ABOUT a promo aren't suppressed. */
export const PROMO_KEYWORDS = /(predict\s*&?\s*earn|airdrop|bonus|earn\s+up\s+to|launchpad|giveaway|cashback|trading\s+contest|deposit\s+to\s+win|points\s+mall|carnival|festival|trade\s+to\s+earn)/i;

/** True when `source` is the exchange's own feed (exact match OR
 *  prefix-followed-by-space). Returns false for empty input. */
export function isExchangeSource(source: string | null | undefined): boolean {
  if (!source) return false;
  return EXCHANGE_SOURCE_PREFIXES.some(
    name => source === name || source.startsWith(name + ' '),
  );
}

/** True only when source IS an exchange AND title matches a promo
 *  keyword. The AND-gate is deliberate: a Cointelegraph piece about
 *  a Bybit airdrop should still appear as news, not be skipped as a
 *  promo. */
export function looksLikePromo(article: { source: string; title: string }): boolean {
  if (!isExchangeSource(article.source)) return false;
  return PROMO_KEYWORDS.test(article.title);
}
