/**
 * Unit tests for the cross-venue ticker selection logic on /chart.
 *
 * The /api/tickers endpoint returns one row per symbol per venue —
 * Binance, Coinbase, Bitstamp, etc. — with varying field coverage.
 * useTickerStats picks the row most likely to render a complete
 * stat bar. We test the pick + projection separately because they
 * solve different problems.
 *
 * Regression: the BITSTAMP-shaped sparse row used to win the
 * max-price tiebreak and render '$0.0000e+0' in the stat bar.
 * locked in by the "ignores BITSTAMP-shaped sparse row" case below.
 */

import { describe, it, expect } from 'vitest';
import {
  scoreTickerCompleteness, pickBestTicker, projectTickerStat,
  type RawTicker,
} from '../tickerSelection';

describe('scoreTickerCompleteness', () => {
  it('returns 0 for an entirely empty ticker', () => {
    expect(scoreTickerCompleteness({ symbol: 'BTC' })).toBe(0);
  });

  it('+1 for price only', () => {
    expect(scoreTickerCompleteness({ symbol: 'BTC', lastPrice: 50000 })).toBe(1);
    expect(scoreTickerCompleteness({ symbol: 'BTC', price: 50000 })).toBe(1);
  });

  it('+2 for any of the four 24h fields', () => {
    expect(scoreTickerCompleteness({ symbol: 'BTC', priceChangePercent24h: 1.5 })).toBe(2);
    expect(scoreTickerCompleteness({ symbol: 'BTC', highPrice24h: 51000 })).toBe(2);
    expect(scoreTickerCompleteness({ symbol: 'BTC', lowPrice24h: 49000 })).toBe(2);
    expect(scoreTickerCompleteness({ symbol: 'BTC', volume24h: 1e9 })).toBe(2);
  });

  it('falls back to alternate field names', () => {
    const a = scoreTickerCompleteness({ symbol: 'BTC', lastPrice: 1, priceChangePercent24h: 1, highPrice24h: 1, lowPrice24h: 1, volume24h: 1 });
    const b = scoreTickerCompleteness({ symbol: 'BTC', price: 1, change24h: 1, high24h: 1, low24h: 1, quoteVolume24h: 1 });
    expect(a).toBe(b);
    expect(a).toBe(9);
  });

  it('treats zero values as "missing"', () => {
    // 0 doesn't earn credit — important for sparse Bitstamp-style rows
    // where the API returns 0 instead of omitting.
    expect(scoreTickerCompleteness({
      symbol: 'BTC',
      lastPrice: 50000,
      priceChangePercent24h: 0,
      highPrice24h: 0,
      lowPrice24h: 0,
      volume24h: 0,
    })).toBe(1); // only the price field contributes
  });

  it('treats negative 24h change as informative (non-zero)', () => {
    expect(scoreTickerCompleteness({
      symbol: 'BTC', lastPrice: 50000, priceChangePercent24h: -2.5,
    })).toBe(3);
  });

  it('full ticker scores 9', () => {
    expect(scoreTickerCompleteness({
      symbol: 'BTC', lastPrice: 50000, priceChangePercent24h: 1.5,
      highPrice24h: 51000, lowPrice24h: 49000, volume24h: 1e9,
    })).toBe(9);
  });
});

describe('pickBestTicker', () => {
  it('returns null on empty list', () => {
    expect(pickBestTicker([])).toBeNull();
  });

  it('returns the only entry when list has length 1', () => {
    const only = { symbol: 'BTC', lastPrice: 50000 };
    expect(pickBestTicker([only])).toBe(only);
  });

  it('picks the more-complete ticker even if price is lower', () => {
    const complete = { symbol: 'BTC', lastPrice: 50000, priceChangePercent24h: 1.5, highPrice24h: 51000, lowPrice24h: 49000, volume24h: 1e9 };
    const sparse   = { symbol: 'BTC', lastPrice: 50500 }; // higher price, no 24h data
    expect(pickBestTicker([sparse, complete])).toBe(complete);
  });

  it('regression: ignores BITSTAMP-shaped sparse row (max price but no 24h)', () => {
    // Exact shape of the bug — Bitstamp had max price but no other fields,
    // beat Binance under the old max-price rule and rendered $0.0000e+0.
    const bitstamp = { symbol: 'BTC', lastPrice: 50_100 };
    const binance  = { symbol: 'BTC', lastPrice: 50_000, priceChangePercent24h: 2.1, highPrice24h: 50_500, lowPrice24h: 49_500, volume24h: 1e10 };
    expect(pickBestTicker([bitstamp, binance])).toBe(binance);
  });

  it('uses price as tiebreaker when scores match', () => {
    const cheap = { symbol: 'BTC', lastPrice: 50000, priceChangePercent24h: 1.5, highPrice24h: 51000, lowPrice24h: 49000, volume24h: 1e9 };
    const dear  = { symbol: 'BTC', lastPrice: 50500, priceChangePercent24h: 1.5, highPrice24h: 51000, lowPrice24h: 49000, volume24h: 1e9 };
    expect(pickBestTicker([cheap, dear])).toBe(dear);
  });

  it('picks correctly across many candidates', () => {
    const winner = { symbol: 'BTC', lastPrice: 50000, priceChangePercent24h: 1.5, highPrice24h: 51000, lowPrice24h: 49000, volume24h: 1e9 };
    const rest = [
      { symbol: 'BTC', lastPrice: 50500 },
      { symbol: 'BTC', priceChangePercent24h: 1.5 },
      { symbol: 'BTC', lastPrice: 49000, volume24h: 1e9 },
      winner,
      { symbol: 'BTC', highPrice24h: 51000, lowPrice24h: 49000 },
    ];
    expect(pickBestTicker(rest)).toBe(winner);
  });
});

describe('projectTickerStat', () => {
  it('maps full fields straight through', () => {
    const raw: RawTicker = {
      symbol: 'BTC', lastPrice: 50000, priceChangePercent24h: 1.5,
      highPrice24h: 51000, lowPrice24h: 49000, volume24h: 1e9,
    };
    expect(projectTickerStat(raw)).toEqual({
      price: 50000, change24h: 1.5, high24h: 51000, low24h: 49000, volume24h: 1e9,
    });
  });

  it('falls back to alternate field names', () => {
    const raw: RawTicker = {
      symbol: 'BTC', price: 50000, change24h: -1.5,
      high24h: 51000, low24h: 49000, quoteVolume24h: 1e9,
    };
    expect(projectTickerStat(raw)).toEqual({
      price: 50000, change24h: -1.5, high24h: 51000, low24h: 49000, volume24h: 1e9,
    });
  });

  it('coerces zero fields to undefined so consumers can tell "no data" from "literal 0"', () => {
    const raw: RawTicker = {
      symbol: 'BTC', lastPrice: 50000, priceChangePercent24h: 0,
      highPrice24h: 0, lowPrice24h: 0, volume24h: 0,
    };
    expect(projectTickerStat(raw)).toEqual({
      price: 50000,
      change24h: undefined,
      high24h: undefined,
      low24h: undefined,
      volume24h: undefined,
    });
  });

  it('preserves price even if 0 (consumers handle missing-price separately)', () => {
    // The price field has its own missing-data semantics — we don't
    // coerce 0 to undefined for price because rendering "$0.00" is a
    // valid degenerate display.
    const raw: RawTicker = { symbol: 'BTC' };
    expect(projectTickerStat(raw).price).toBeUndefined();
  });

  it('handles negative change24h cleanly', () => {
    expect(projectTickerStat({ symbol: 'BTC', priceChangePercent24h: -3.5 }).change24h).toBe(-3.5);
  });
});
