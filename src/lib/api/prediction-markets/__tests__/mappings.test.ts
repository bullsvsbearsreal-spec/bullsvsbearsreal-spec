/**
 * Tests for the cross-platform prediction-market matchers used by
 * /prediction-markets to pair Polymarket questions with Kalshi
 * questions of the same event.
 *
 * The riskiest function is `hasConflictingPolarity`. A regression
 * here would silently pair "BTC above $100K" (yes-side from
 * Polymarket) with "BTC below $100K" (the OPPOSITE side from
 * Kalshi). Users would see "Polymarket 65¢ / Kalshi 35¢" as if
 * those were arbitrage prices, when in reality they're prices
 * on opposite sides of the trade.
 */
import { describe, it, expect } from 'vitest';
import {
  extractKeywords,
  extractNumbers,
  hasConflictingPolarity,
  keywordSimilarity,
} from '../mappings';

describe('extractKeywords', () => {
  it('lowercases, splits on non-alpha, drops short words and stop-words', () => {
    expect(extractKeywords('Will BTC be above $100,000 by 2026?'))
      .toEqual(['btc', '100', '000']);
  });

  it('strips months and year stop-words', () => {
    expect(extractKeywords('Will Trump win in November 2026?'))
      .toEqual(['trump']);
  });

  it('handles empty / short input', () => {
    expect(extractKeywords('')).toEqual([]);
    expect(extractKeywords('a')).toEqual([]);
  });

  it('preserves longer multi-word keywords', () => {
    expect(extractKeywords('Will Iran ceasefire happen?'))
      .toContain('iran');
    expect(extractKeywords('Will Iran ceasefire happen?'))
      .toContain('ceasefire');
  });
});

describe('extractNumbers', () => {
  it('parses plain numbers ≥10', () => {
    expect(extractNumbers('order of 50 widgets at 100')).toEqual([50, 100]);
  });

  it('handles K / M / B / T suffixes', () => {
    expect(extractNumbers('above $100k')).toEqual([100_000]);
    expect(extractNumbers('FDV $5B target')).toEqual([5_000_000_000]);
    expect(extractNumbers('$2M loss')).toEqual([2_000_000]);
    expect(extractNumbers('$1.5T market')).toEqual([1_500_000_000_000]);
  });

  it('handles comma-separated thousands', () => {
    expect(extractNumbers('above $100,000')).toEqual([100_000]);
    expect(extractNumbers('reaches 1,234,567')).toEqual([1_234_567]);
  });

  it('skips years (2020-2035)', () => {
    expect(extractNumbers('Win in 2026 with target $100,000')).toEqual([100_000]);
    expect(extractNumbers('happens before 2030')).toEqual([]);
  });

  it('skips small numbers (<10) — likely counts not thresholds', () => {
    expect(extractNumbers('Top 5 winners')).toEqual([]);
    expect(extractNumbers('Win 1 game')).toEqual([]);
  });
});

describe('hasConflictingPolarity — the load-bearing matcher invariant', () => {
  it('detects above-vs-below conflict (the canonical bug)', () => {
    expect(hasConflictingPolarity(
      'Will BTC be above $100k?',
      'Will BTC fall below $100k?',
    )).toBe(true);
    expect(hasConflictingPolarity(
      'Will BTC dip below $100k?',
      'Will BTC reach $100k?',
    )).toBe(true);
  });

  it('returns false when both questions go the same direction', () => {
    expect(hasConflictingPolarity(
      'Will BTC be above $100k?',
      'Will BTC reach $100k?',
    )).toBe(false);
    expect(hasConflictingPolarity(
      'Will BTC fall below $100k?',
      'Will BTC dip below $100k?',
    )).toBe(false);
  });

  it('returns false for non-price questions (no up/down language at all)', () => {
    expect(hasConflictingPolarity(
      'Will Trump win the election?',
      'Will Trump lose the election?',
    )).toBe(false);
  });

  it('returns false when one side has BOTH up and down (ambiguous)', () => {
    // "Will BTC dip below 60k OR rise above 100k?" should not flag a
    // conflict because we can't tell its polarity.
    expect(hasConflictingPolarity(
      'Will BTC dip below 60k or rise above 100k?',
      'Will BTC be above 100k?',
    )).toBe(false);
  });
});

describe('keywordSimilarity — Jaccard', () => {
  it('1.0 for identical sets', () => {
    expect(keywordSimilarity(['btc', 'above'], ['btc', 'above'])).toBe(1);
  });

  it('0 for disjoint sets', () => {
    expect(keywordSimilarity(['btc'], ['eth'])).toBe(0);
  });

  it('partial overlap = intersection / union', () => {
    // {a,b,c} ∩ {b,c,d} = {b,c} (2)
    // {a,b,c,d}        = (4)
    // J = 2/4 = 0.5
    expect(keywordSimilarity(['a', 'b', 'c'], ['b', 'c', 'd'])).toBe(0.5);
  });

  it('handles empty input gracefully', () => {
    expect(keywordSimilarity([], [])).toBe(0);
    expect(keywordSimilarity(['a'], [])).toBe(0);
  });

  it('order-independent + duplicate-tolerant', () => {
    // Duplicates collapse via Set in implementation.
    expect(keywordSimilarity(['a', 'a', 'b'], ['b', 'a'])).toBe(1);
  });
});
