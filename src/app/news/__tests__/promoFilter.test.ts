/**
 * Tests for the /news promo filter. These lock in the bug fix from
 * commit 1307984a — without them, a relaxed regex or a renamed exchange
 * name lets sponsored "Predict & Earn" posts take over the featured
 * slot above real news.
 *
 * History:
 *   · pre-1307984a: EXCHANGE_SOURCES was a Set with `Set.has()` exact
 *     equality. The news API exposes per-feed labels — Binance has both
 *     "Binance Listings" and "Binance Latest" — neither matched the
 *     short "Binance" entry, so Binance promo titles slipped through.
 *   · 1307984a: switched to prefix-match. The tests below verify the
 *     prefix path AND keep the AND-gate honest (news outlets writing
 *     about a promo must not be suppressed).
 */
import { describe, it, expect } from 'vitest';
import {
  isExchangeSource,
  looksLikePromo,
  PROMO_KEYWORDS,
  EXCHANGE_SOURCE_PREFIXES,
} from '../promoFilter';

describe('isExchangeSource — empty / null', () => {
  it('returns false for empty string', () => {
    expect(isExchangeSource('')).toBe(false);
  });
  it('returns false for null', () => {
    expect(isExchangeSource(null)).toBe(false);
  });
  it('returns false for undefined', () => {
    expect(isExchangeSource(undefined)).toBe(false);
  });
});

describe('isExchangeSource — exact match', () => {
  // Short labels that the news API DOES expose as-is. The pre-fix
  // Set.has() path caught these — we keep them working.
  it.each([
    'Bybit', 'OKX', 'Coinbase', 'Kraken', 'KuCoin', 'Bitget',
    'Bitfinex', 'MEXC', 'Gate.io', 'HTX', 'Bitstamp', 'BingX', 'BitMEX',
  ])('treats %s (exact) as exchange', (name) => {
    expect(isExchangeSource(name)).toBe(true);
  });
});

describe('isExchangeSource — prefix match (the 1307984a regression guard)', () => {
  // These are the labels the pre-fix code MISSED. Binance had two
  // suffixed feeds, neither matched a bare-"Binance" Set entry.
  it('matches "Binance Listings"', () => {
    expect(isExchangeSource('Binance Listings')).toBe(true);
  });
  it('matches "Binance Latest"', () => {
    expect(isExchangeSource('Binance Latest')).toBe(true);
  });
  it('matches "Binance Square"', () => {
    expect(isExchangeSource('Binance Square')).toBe(true);
  });
  it('matches "Bybit Announcements"', () => {
    expect(isExchangeSource('Bybit Announcements')).toBe(true);
  });
  it('matches "OKX Insights"', () => {
    expect(isExchangeSource('OKX Insights')).toBe(true);
  });
  it('matches "Kraken Blog"', () => {
    expect(isExchangeSource('Kraken Blog')).toBe(true);
  });
});

describe('isExchangeSource — NOT a prefix substring (must not over-match)', () => {
  // The prefix rule uses `name + " "` so "Binancers Daily" or
  // "OKXploit Weekly" don't get marked as exchange feeds. Without the
  // trailing space the regex would over-match and suppress real
  // journalism.
  it('does NOT match "Binancers Daily" (no space after Binance)', () => {
    expect(isExchangeSource('Binancers Daily')).toBe(false);
  });
  it('does NOT match "OKXploit" (no space)', () => {
    expect(isExchangeSource('OKXploit')).toBe(false);
  });
  it('does NOT match "Krakenology News"', () => {
    expect(isExchangeSource('Krakenology News')).toBe(false);
  });
});

describe('isExchangeSource — real news outlets', () => {
  it.each([
    'Cointelegraph',
    'CoinDesk',
    'The Block',
    'Decrypt',
    'CryptoSlate',
    'Bloomberg',
    'Reuters',
    'Wall Street Journal',
  ])('does not flag %s as exchange', (name) => {
    expect(isExchangeSource(name)).toBe(false);
  });
});

describe('PROMO_KEYWORDS regex', () => {
  it.each([
    ['BTC Predict & Earn Challenge', true],
    ['predict&earn launch event', true],
    ['Predict Earn campaign starts now', true],
    ['Airdrop announcement: 10M tokens', true],
    ['Up to 100% bonus on first deposit', true],
    ['Earn up to 12% APY with USDC', true],
    ['Launchpad: $XYZ token sale opens Friday', true],
    ['Giveaway: $5,000 in prizes', true],
    ['Cashback on every trade this week', true],
    ['Trading Contest with $1M prize pool', true],
    ['Deposit to Win an iPhone 15', true],
    ['Points Mall — redeem for merch', true],
    ['Crypto Carnival 2026', true],
    ['Spring Festival promotion live now', true],
    ['Trade to earn campaign', true],
  ])('matches promo title %j', (title, expected) => {
    expect(PROMO_KEYWORDS.test(title as string)).toBe(expected);
  });

  it.each([
    // Real journalism about market moves — must NOT match
    'Bitcoin breaks $100k as ETF inflows accelerate',
    'SEC settles with major exchange over compliance issues',
    'Hyperliquid passes $1B in 24h volume',
    'On-chain analysis: where the dip buyers are',
    'Macro outlook: rate cut expectations for Q3',
  ])('does NOT match real news title: %j', (title) => {
    expect(PROMO_KEYWORDS.test(title)).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(PROMO_KEYWORDS.test('AIRDROP')).toBe(true);
    expect(PROMO_KEYWORDS.test('Bonus')).toBe(true);
    expect(PROMO_KEYWORDS.test('LAUNCHPAD')).toBe(true);
  });
});

describe('looksLikePromo — the AND-gate', () => {
  // This is the whole point of having TWO predicates. A real news
  // outlet WRITING ABOUT a promo (Cointelegraph covering a Bybit
  // campaign, CoinDesk on a Binance airdrop) is legitimate news and
  // should NOT be suppressed. Only sponsored posts coming straight
  // from the exchange's own feed get filtered out.

  it('flags exchange source + promo title as promo', () => {
    expect(looksLikePromo({
      source: 'Binance Listings',
      title: 'BTC Predict & Earn Challenge — earn up to 8% APR',
    })).toBe(true);
  });

  it('flags exact-match exchange source + promo title', () => {
    expect(looksLikePromo({
      source: 'Bybit',
      title: 'New Airdrop: 1M XYZ tokens up for grabs',
    })).toBe(true);
  });

  it('does NOT flag news outlet covering a promo (the AND-gate)', () => {
    expect(looksLikePromo({
      source: 'Cointelegraph',
      title: 'Bybit launches new airdrop campaign',
    })).toBe(false);
  });

  it('does NOT flag news outlet reporting on a launchpad', () => {
    expect(looksLikePromo({
      source: 'CoinDesk',
      title: 'Binance Launchpad sees record participation',
    })).toBe(false);
  });

  it('does NOT flag exchange source with neutral title', () => {
    expect(looksLikePromo({
      source: 'Binance Listings',
      title: 'XYZ Token listed on spot market',
    })).toBe(false);
  });

  it('does NOT flag exchange source with technical/announcement title', () => {
    expect(looksLikePromo({
      source: 'Coinbase',
      title: 'Maintenance scheduled for 2026-06-01 02:00 UTC',
    })).toBe(false);
  });

  it('does NOT flag news outlet reviewing a trading contest', () => {
    // The word "trading contest" appears in the title but the source
    // is a news outlet — must pass through.
    expect(looksLikePromo({
      source: 'The Block',
      title: 'Trading contest results: who came out on top?',
    })).toBe(false);
  });
});

describe('EXCHANGE_SOURCE_PREFIXES — completeness', () => {
  // Sanity guard: the list should at least cover the major venues we
  // also have RSS feeds for. If a new venue with its own feed gets
  // wired in, we should add it here (and this test makes that
  // discoverable).
  it('includes Binance (the original miss)', () => {
    expect(EXCHANGE_SOURCE_PREFIXES).toContain('Binance');
  });
  it('includes Bybit', () => {
    expect(EXCHANGE_SOURCE_PREFIXES).toContain('Bybit');
  });
  it('includes OKX', () => {
    expect(EXCHANGE_SOURCE_PREFIXES).toContain('OKX');
  });
  it('has no duplicates', () => {
    expect(new Set(EXCHANGE_SOURCE_PREFIXES).size).toBe(EXCHANGE_SOURCE_PREFIXES.length);
  });
  it('has no entries with a trailing space', () => {
    // The trailing space is supplied by isExchangeSource when checking
    // — if a prefix already has a trailing space the match becomes
    // double-spaced and breaks.
    for (const name of EXCHANGE_SOURCE_PREFIXES) {
      expect(name).toBe(name.trim());
    }
  });
});
