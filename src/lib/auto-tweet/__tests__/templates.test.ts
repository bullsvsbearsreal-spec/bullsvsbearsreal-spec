/**
 * Tests for the tweet text composers. Locks in:
 *   - Output stays under Twitter's 280-char limit (even with long
 *     symbol names or extreme values).
 *   - The URL always survives (it's the point — must funnel back
 *     to InfoHub).
 *   - Voice / format consistency (terse, numbers-first, no emojis
 *     in body, hashtags off).
 */

import { describe, it, expect } from 'vitest';
import { composeTweet, composeFundingExtreme, composeOISpike, composeLiqCascade } from '../templates';
import type { AutoTweetEvent } from '../types';

const baseEvent: AutoTweetEvent = {
  eventId: 'test:1',
  kind: 'funding-extreme',
  symbol: 'BTC',
  venue: 'Binance',
  value: 0.002,
  metadata: {},
  detectedAt: Date.now(),
};

describe('composeFundingExtreme', () => {
  it('mentions the symbol, the venue, and the 8h rate', () => {
    const text = composeFundingExtreme({ ...baseEvent, value: 0.0015 });
    expect(text).toContain('BTC');
    expect(text).toContain('Binance');
    expect(text).toMatch(/\+0\.150%\/8h/);
  });

  it('uses "Longs paying" for positive rates', () => {
    const text = composeFundingExtreme({ ...baseEvent, value: 0.0012 });
    expect(text).toContain('Longs paying');
  });

  it('uses "Shorts paying" for negative rates', () => {
    const text = composeFundingExtreme({ ...baseEvent, value: -0.0012 });
    expect(text).toContain('Shorts paying');
  });

  it('links to the symbol-specific /funding page', () => {
    const text = composeFundingExtreme({ ...baseEvent, symbol: 'ETH' });
    expect(text).toContain('https://info-hub.io/funding/ETH');
  });

  it('stays under 280 chars even at large values', () => {
    const text = composeFundingExtreme({ ...baseEvent, value: 0.5 }); // absurd
    expect(text.length).toBeLessThanOrEqual(280);
  });

  it('includes an annualized APR estimate', () => {
    const text = composeFundingExtreme({ ...baseEvent, value: 0.001 });
    // 0.001 * 3 * 365 * 100 = 109.5 → ~110% APR
    expect(text).toMatch(/APR/);
  });
});

describe('composeOISpike', () => {
  it('says "building" for positive moves', () => {
    const text = composeOISpike({
      ...baseEvent, kind: 'oi-spike', venue: null, value: 12,
      metadata: { currentOiUsd: 1.2e9, previousOiUsd: 1.0e9 },
    });
    expect(text).toContain('building');
  });

  it('says "unwinding" for negative moves', () => {
    const text = composeOISpike({
      ...baseEvent, kind: 'oi-spike', venue: null, value: -8,
      metadata: { currentOiUsd: 0.92e9, previousOiUsd: 1.0e9 },
    });
    expect(text).toContain('unwinding');
  });

  it('renders pct with 1 decimal and includes ▲/▼ arrow', () => {
    const text = composeOISpike({
      ...baseEvent, kind: 'oi-spike', venue: null, value: 7.5,
      metadata: { currentOiUsd: 1.07e9, previousOiUsd: 1.0e9 },
    });
    expect(text).toContain('7.5%');
    expect(text).toMatch(/[▲▼]/);
  });

  it('shows current OI in B/M format', () => {
    const text = composeOISpike({
      ...baseEvent, kind: 'oi-spike', venue: null, value: 6,
      metadata: { currentOiUsd: 2.5e9, previousOiUsd: 2.36e9 },
    });
    expect(text).toContain('$2.50B');
  });

  it('links to /open-interest', () => {
    const text = composeOISpike({
      ...baseEvent, kind: 'oi-spike', venue: null, value: 6,
      metadata: { currentOiUsd: 1.5e9, previousOiUsd: 1.4e9 },
    });
    expect(text).toContain('https://info-hub.io/open-interest');
  });
});

describe('composeLiqCascade', () => {
  it('renders total USD in B/M format', () => {
    const text = composeLiqCascade({
      ...baseEvent, kind: 'liq-cascade', venue: null, value: 15_000_000,
      metadata: { longSharePct: 85, dominantSide: 'long' },
    });
    expect(text).toContain('$15.0M');
  });

  it('classifies long-side carnage and short-side wreckage', () => {
    const longHeavy = composeLiqCascade({
      ...baseEvent, kind: 'liq-cascade', venue: null, value: 12e6,
      metadata: { longSharePct: 88, dominantSide: 'long' },
    });
    expect(longHeavy).toContain('Long-side carnage');

    const shortHeavy = composeLiqCascade({
      ...baseEvent, kind: 'liq-cascade', venue: null, value: 12e6,
      metadata: { longSharePct: 10, dominantSide: 'short' },
    });
    expect(shortHeavy).toContain('Shorts wrecked');
  });

  it('handles two-sided cascades', () => {
    const text = composeLiqCascade({
      ...baseEvent, kind: 'liq-cascade', venue: null, value: 12e6,
      metadata: { longSharePct: 51, dominantSide: 'mixed' },
    });
    expect(text).toContain('Two-sided');
  });

  it('links to /liquidations with the symbol query', () => {
    const text = composeLiqCascade({
      ...baseEvent, kind: 'liq-cascade', symbol: 'ETH', venue: null, value: 12e6,
      metadata: { longSharePct: 80, dominantSide: 'long' },
    });
    expect(text).toContain('https://info-hub.io/liquidations?symbol=ETH');
  });
});

describe('composeTweet (dispatch)', () => {
  it('dispatches funding-extreme correctly', () => {
    const text = composeTweet({ ...baseEvent, kind: 'funding-extreme' });
    expect(text).toContain('funding hot');
  });

  it('dispatches oi-spike correctly', () => {
    const text = composeTweet({
      ...baseEvent, kind: 'oi-spike', venue: null, value: 10,
      metadata: { currentOiUsd: 1e9 },
    });
    expect(text).toContain('open interest');
  });

  it('dispatches liq-cascade correctly', () => {
    const text = composeTweet({
      ...baseEvent, kind: 'liq-cascade', venue: null, value: 15e6,
      metadata: { longSharePct: 80, dominantSide: 'long' },
    });
    expect(text).toContain('liquidated');
  });

  it('throws for whale-fill (not yet implemented)', () => {
    expect(() =>
      composeTweet({ ...baseEvent, kind: 'whale-fill', venue: null, value: 5e6, metadata: {} })
    ).toThrow();
  });
});

describe('All composers stay under 280 chars across edge cases', () => {
  const cases: AutoTweetEvent[] = [
    { ...baseEvent, kind: 'funding-extreme', value: 1.5 },
    { ...baseEvent, kind: 'funding-extreme', value: -1.5, symbol: 'GIGACHAD' },
    { ...baseEvent, kind: 'oi-spike', venue: null, value: 999, metadata: { currentOiUsd: 999e9 } },
    { ...baseEvent, kind: 'liq-cascade', venue: null, value: 999e9, metadata: { longSharePct: 99.9, dominantSide: 'long' } },
  ];
  for (const ev of cases) {
    it(`${ev.kind} with value ${ev.value} fits`, () => {
      expect(composeTweet(ev).length).toBeLessThanOrEqual(280);
    });
  }
});
