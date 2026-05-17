/**
 * Tests for the search-palette fallback heuristic that triggers a
 * "Open in /chart" suggestion when the curated symbol list misses.
 *
 * Real-world repro: christian/snake type CSX, AAPL, MSTR into ⌘K and
 * previously got "No matches" — even though /chart resolves them via
 * TradingView. The heuristic catches anything that LOOKS LIKE a
 * ticker without us needing to maintain an exhaustive list of every
 * symbol on every exchange.
 */
import { describe, it, expect } from 'vitest';
import { looksLikeTicker } from '../searchHelpers';

describe('looksLikeTicker — accepts', () => {
  it('common crypto tickers', () => {
    expect(looksLikeTicker('BTC')).toBe(true);
    expect(looksLikeTicker('ETH')).toBe(true);
    expect(looksLikeTicker('SOL')).toBe(true);
    expect(looksLikeTicker('HYPE')).toBe(true);
  });

  it('common stock tickers (Christian uses these)', () => {
    expect(looksLikeTicker('CSX')).toBe(true);
    expect(looksLikeTicker('AAPL')).toBe(true);
    expect(looksLikeTicker('MSTR')).toBe(true);
    expect(looksLikeTicker('COIN')).toBe(true);
    expect(looksLikeTicker('NVDA')).toBe(true);
  });

  it('FX pairs', () => {
    expect(looksLikeTicker('EURUSD')).toBe(true);
    expect(looksLikeTicker('GBPUSD')).toBe(true);
    expect(looksLikeTicker('DXY')).toBe(true);
  });

  it('commodity tickers (4-6 letters)', () => {
    expect(looksLikeTicker('XAUUSD')).toBe(true);
    expect(looksLikeTicker('XAGUSD')).toBe(true);
  });

  it('futures with a trailing 1!', () => {
    // TradingView futures: CL1! (oil), NG1! (gas), HG1! (copper)
    expect(looksLikeTicker('CL1!')).toBe(true);
    expect(looksLikeTicker('NG1!')).toBe(true);
    expect(looksLikeTicker('HG1!')).toBe(true);
  });

  it('lowercase input gets uppercased before matching', () => {
    // The palette doesn't case-fold user input, so the heuristic
    // upcases internally — typing "csx" or "Csx" should match.
    expect(looksLikeTicker('csx')).toBe(true);
    expect(looksLikeTicker('Csx')).toBe(true);
    expect(looksLikeTicker('aapl')).toBe(true);
  });

  it('handles surrounding whitespace', () => {
    expect(looksLikeTicker(' CSX ')).toBe(true);
    expect(looksLikeTicker('AAPL\n')).toBe(true);
  });
});

describe('looksLikeTicker — rejects', () => {
  it('empty / null-ish input', () => {
    expect(looksLikeTicker('')).toBe(false);
    expect(looksLikeTicker('   ')).toBe(false);
  });

  it('single-letter strings (no real exchange ticker is 1 letter)', () => {
    expect(looksLikeTicker('A')).toBe(false);
    expect(looksLikeTicker('X')).toBe(false);
  });

  it('strings longer than 6 letters', () => {
    // Real tickers don't go past ~6 chars; longer = probably search query
    expect(looksLikeTicker('BITCOIN')).toBe(false);
    expect(looksLikeTicker('ETHEREUM')).toBe(false);
  });

  it('strings with non-letter punctuation (commas, slashes, hyphens)', () => {
    // These would catch typos like "BTC, ETH" or "BTC/USD" and the
    // heuristic correctly rejects them so the palette shows a real
    // search result instead of a meaningless fallback.
    expect(looksLikeTicker('BTC, ETH')).toBe(false);
    expect(looksLikeTicker('BTC/USD')).toBe(false);
    expect(looksLikeTicker('btc-eth')).toBe(false);
  });

  it('multi-word queries (these are search queries, not tickers)', () => {
    expect(looksLikeTicker('funding heatmap')).toBe(false);
    expect(looksLikeTicker('open interest')).toBe(false);
  });

  it('numeric-only strings', () => {
    expect(looksLikeTicker('12345')).toBe(false);
    expect(looksLikeTicker('100')).toBe(false);
  });

  it('addresses are NOT tickers', () => {
    // Long enough to fail the 6-char ceiling, but a good sanity check
    // since users might paste a hex address into the palette by reflex.
    expect(looksLikeTicker('0xabF68ea28e2522726F53b6413b87Ef7067FDf21A')).toBe(false);
  });
});
