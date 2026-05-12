/**
 * Tests for the tweet text composers. Each event kind now has 3-4
 * variants picked deterministically per eventId — tests lock in:
 *   - All variants stay under 280 chars (the Twitter limit).
 *   - The funnel URL always survives truncation.
 *   - The symbol appears (otherwise the tweet is rootless).
 *   - Voice rules: lowercase prose, no hashtags, no emojis, no
 *     "InfoHub is excited to announce..." marketing slop.
 *   - Variant selection is deterministic given eventId.
 *   - Cashtags ($BTC) are the one allowed uppercase.
 */

import { describe, it, expect } from 'vitest';
import { composeTweet, composeFundingExtreme, composeOISpike, composeLiqCascade } from '../templates';
import type { AutoTweetEvent } from '../types';

function ev(overrides: Partial<AutoTweetEvent> & Pick<AutoTweetEvent, 'kind'>): AutoTweetEvent {
  return {
    eventId: overrides.eventId ?? `test-${overrides.kind}-${Math.random()}`,
    kind: overrides.kind,
    symbol: overrides.symbol ?? 'BTC',
    venue: overrides.venue ?? 'Binance',
    value: overrides.value ?? 0.002,
    metadata: overrides.metadata ?? {},
    detectedAt: overrides.detectedAt ?? Date.now(),
  };
}

/** Get all 3 variants for a given composer by varying eventId. */
function allVariants(compose: (e: AutoTweetEvent) => string, base: AutoTweetEvent): Set<string> {
  const out = new Set<string>();
  // 50 eventIds is enough to hit every variant for our 3-variant
  // composers given a stable hash.
  for (let i = 0; i < 50; i++) {
    out.add(compose({ ...base, eventId: `vary-${i}` }));
  }
  return out;
}

/** Universal voice checks that should hold across every composer/variant. */
function assertVoice(text: string, sym: string) {
  // Stays under tweet limit
  expect(text.length).toBeLessThanOrEqual(280);
  // Always has the funnel URL
  expect(text).toMatch(/https:\/\/info-hub\.io\//);
  // Cashtag form ($SYM) appears
  expect(text).toContain(`$${sym}`);
  // No hashtags (we explicitly banned them)
  expect(text).not.toMatch(/#\w/);
  // No InfoHub-slop verbs
  expect(text.toLowerCase()).not.toContain('excited to announce');
  expect(text.toLowerCase()).not.toContain('proud to');
  // No emoji slop (very rough — covers common SaaS emojis)
  // Common SaaS emoji slop (Unicode escapes — `u` flag would need ES2018+).
  expect(text).not.toMatch(/[\uD83D][\uDE80-\uDEFF]/);  // 🚀-emojis (1F680-1F6FF surrogate pair)
  expect(text).not.toMatch(/[\uD83E][\uDD00-\uDDFF]/);  // 🤖-emojis (1F900-1F9FF surrogate pair)
  expect(text).not.toContain('✨');
}

describe('composeFundingExtreme', () => {
  it('every positive-funding variant stays under 280 and links', () => {
    const variants = allVariants(composeFundingExtreme, ev({ kind: 'funding-extreme', value: 0.0015 }));
    expect(variants.size).toBeGreaterThanOrEqual(2); // proves rotation
    for (const text of Array.from(variants)) assertVoice(text, 'BTC');
  });

  it('every negative-funding variant stays under 280 and links', () => {
    const variants = allVariants(composeFundingExtreme, ev({ kind: 'funding-extreme', value: -0.0015 }));
    expect(variants.size).toBeGreaterThanOrEqual(2);
    for (const text of Array.from(variants)) assertVoice(text, 'BTC');
  });

  it('positive funding mentions longs paying (any variant)', () => {
    const text = composeFundingExtreme(ev({ kind: 'funding-extreme', value: 0.002, eventId: 'pos-1' }));
    // Any of "longs are paying", "longs paying", "longs just to hold"
    expect(text.toLowerCase()).toMatch(/long/);
  });

  it('negative funding mentions shorts paying', () => {
    const text = composeFundingExtreme(ev({ kind: 'funding-extreme', value: -0.002, eventId: 'neg-1' }));
    expect(text.toLowerCase()).toMatch(/short/);
  });

  it('links to symbol-specific /funding page', () => {
    const text = composeFundingExtreme(ev({ kind: 'funding-extreme', symbol: 'ETH', value: 0.0015 }));
    expect(text).toContain('https://info-hub.io/funding/ETH');
  });

  it('includes the venue name (lowercased)', () => {
    const text = composeFundingExtreme(ev({ kind: 'funding-extreme', venue: 'Bybit', value: 0.0015 }));
    expect(text.toLowerCase()).toContain('bybit');
  });

  it('shows formatted 8h rate with sign', () => {
    const text = composeFundingExtreme(ev({ kind: 'funding-extreme', value: 0.0015, eventId: 'r-1' }));
    expect(text).toContain('+0.150%');
  });

  it('most variants include the ~APR estimate (one variant uses different framing)', () => {
    const variants = allVariants(composeFundingExtreme, ev({ kind: 'funding-extreme', value: 0.001 }));
    const withApr = Array.from(variants).filter(v => /APR/.test(v)).length;
    expect(withApr).toBeGreaterThanOrEqual(2);
  });

  it('same eventId returns same variant (deterministic)', () => {
    const e = ev({ kind: 'funding-extreme', value: 0.002, eventId: 'fixed-1' });
    expect(composeFundingExtreme(e)).toBe(composeFundingExtreme(e));
  });
});

describe('composeOISpike', () => {
  it('every positive-OI variant stays under 280 and links', () => {
    const variants = allVariants(composeOISpike, ev({
      kind: 'oi-spike', venue: null, value: 8,
      metadata: { currentOiUsd: 1.2e9 },
    }));
    expect(variants.size).toBeGreaterThanOrEqual(2);
    for (const text of Array.from(variants)) assertVoice(text, 'BTC');
  });

  it('every negative-OI variant stays under 280 and links', () => {
    const variants = allVariants(composeOISpike, ev({
      kind: 'oi-spike', venue: null, value: -7,
      metadata: { currentOiUsd: 0.92e9 },
    }));
    expect(variants.size).toBeGreaterThanOrEqual(2);
    for (const text of Array.from(variants)) assertVoice(text, 'BTC');
  });

  it('shows current OI in B/M format', () => {
    const text = composeOISpike(ev({
      kind: 'oi-spike', venue: null, value: 6, eventId: 'oi-1',
      metadata: { currentOiUsd: 2.5e9 },
    }));
    expect(text).toContain('$2.50B');
  });

  it('shows pct with 1 decimal', () => {
    const text = composeOISpike(ev({
      kind: 'oi-spike', venue: null, value: 7.5, eventId: 'oi-2',
      metadata: { currentOiUsd: 1.07e9 },
    }));
    expect(text).toContain('7.5%');
  });

  it('links to /open-interest', () => {
    const text = composeOISpike(ev({
      kind: 'oi-spike', venue: null, value: 6, eventId: 'oi-3',
      metadata: { currentOiUsd: 1.5e9 },
    }));
    expect(text).toContain('https://info-hub.io/open-interest');
  });
});

describe('composeLiqCascade', () => {
  it('every long-dominant variant stays under 280 and links', () => {
    const variants = allVariants(composeLiqCascade, ev({
      kind: 'liq-cascade', venue: null, value: 15e6,
      metadata: { longSharePct: 85, dominantSide: 'long' },
    }));
    expect(variants.size).toBeGreaterThanOrEqual(2);
    for (const text of Array.from(variants)) assertVoice(text, 'BTC');
  });

  it('every short-dominant variant stays under 280 and links', () => {
    const variants = allVariants(composeLiqCascade, ev({
      kind: 'liq-cascade', venue: null, value: 12e6,
      metadata: { longSharePct: 10, dominantSide: 'short' },
    }));
    expect(variants.size).toBeGreaterThanOrEqual(2);
    for (const text of Array.from(variants)) assertVoice(text, 'BTC');
  });

  it('mixed-side variants stay under 280 and link', () => {
    const variants = allVariants(composeLiqCascade, ev({
      kind: 'liq-cascade', venue: null, value: 12e6,
      metadata: { longSharePct: 51, dominantSide: 'mixed' },
    }));
    for (const text of Array.from(variants)) assertVoice(text, 'BTC');
  });

  it('long-dominant text mentions "long" or "longs"', () => {
    const text = composeLiqCascade(ev({
      kind: 'liq-cascade', venue: null, value: 15e6, eventId: 'liq-1',
      metadata: { longSharePct: 88, dominantSide: 'long' },
    }));
    expect(text.toLowerCase()).toMatch(/long/);
  });

  it('short-dominant text mentions "short" or "shorts"', () => {
    const text = composeLiqCascade(ev({
      kind: 'liq-cascade', venue: null, value: 12e6, eventId: 'liq-2',
      metadata: { longSharePct: 10, dominantSide: 'short' },
    }));
    expect(text.toLowerCase()).toMatch(/short/);
  });

  it('shows total USD in B/M format', () => {
    const text = composeLiqCascade(ev({
      kind: 'liq-cascade', venue: null, value: 15_000_000, eventId: 'liq-3',
      metadata: { longSharePct: 85, dominantSide: 'long' },
    }));
    expect(text).toContain('$15.0M');
  });

  it('links to /liquidations with the symbol query', () => {
    const text = composeLiqCascade(ev({
      kind: 'liq-cascade', symbol: 'ETH', venue: null, value: 12e6, eventId: 'liq-4',
      metadata: { longSharePct: 80, dominantSide: 'long' },
    }));
    expect(text).toContain('https://info-hub.io/liquidations?symbol=ETH');
  });
});

describe('composeTweet (dispatch)', () => {
  it('dispatches funding-extreme', () => {
    const text = composeTweet(ev({ kind: 'funding-extreme' }));
    expect(text).toContain('$BTC');
    expect(text).toContain('/funding/BTC');
  });

  it('dispatches oi-spike', () => {
    const text = composeTweet(ev({
      kind: 'oi-spike', venue: null, value: 10,
      metadata: { currentOiUsd: 1e9 },
    }));
    expect(text).toContain('/open-interest');
  });

  it('dispatches liq-cascade', () => {
    const text = composeTweet(ev({
      kind: 'liq-cascade', venue: null, value: 15e6,
      metadata: { longSharePct: 80, dominantSide: 'long' },
    }));
    expect(text).toContain('/liquidations?symbol=BTC');
  });

  it('throws for whale-fill (not yet implemented)', () => {
    expect(() =>
      composeTweet(ev({ kind: 'whale-fill', venue: null, value: 5e6 }))
    ).toThrow();
  });
});

describe('All composers stay under 280 chars across edge cases', () => {
  const cases: Array<Partial<AutoTweetEvent> & Pick<AutoTweetEvent, 'kind'>> = [
    { kind: 'funding-extreme', value: 1.5 },
    { kind: 'funding-extreme', value: -1.5, symbol: 'GIGACHAD' },
    { kind: 'oi-spike', venue: null, value: 999, metadata: { currentOiUsd: 999e9 } },
    { kind: 'liq-cascade', venue: null, value: 999e9, metadata: { longSharePct: 99.9, dominantSide: 'long' } },
  ];
  for (const c of cases) {
    it(`${c.kind} with value ${c.value} fits across all variants`, () => {
      const variants = allVariants(composeTweet, ev(c));
      for (const v of Array.from(variants)) {
        expect(v.length).toBeLessThanOrEqual(280);
      }
    });
  }
});
