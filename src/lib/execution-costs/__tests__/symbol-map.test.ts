/**
 * Tests for the venue-native symbol mapper used by /trade-optimizer's
 * book fetchers. Sub-cent memecoins (PEPE, SHIB, BONK, ...) don't have
 * fine enough tick precision for a 1× perp, so exchanges quote them as
 * "1000PEPE" / "1000000PEPE" / "SHIB1000" with an embedded multiplier.
 *
 * Two failure modes if the mapping breaks:
 *   1. nativeSymbol returns "PEPE" instead of "1000PEPE" → the venue
 *      fetcher 404s → row missing from the optimizer (silent drop).
 *   2. nativePriceScale returns 1 instead of 1000 → prices come back
 *      at 1000× the real value, sanity-check oracle deviation flags
 *      the row as "Stale price" → again silently dropped.
 *
 * Both regressions are silent: page still loads, just with fewer venues.
 */
import { describe, it, expect } from 'vitest';
import { nativeSymbol, nativePriceScale } from '../symbol-map';

describe('nativeSymbol — pass-through for normal pairs', () => {
  it('returns the asset unchanged for non-meme tickers', () => {
    for (const ex of ['Binance', 'Bybit', 'OKX', 'Bitget', 'Aster', 'Aevo']) {
      expect(nativeSymbol(ex, 'BTC')).toBe('BTC');
      expect(nativeSymbol(ex, 'ETH')).toBe('ETH');
      expect(nativeSymbol(ex, 'SOL')).toBe('SOL');
    }
  });

  it('returns asset unchanged for unknown venue', () => {
    expect(nativeSymbol('NoSuchVenue', 'PEPE')).toBe('PEPE');
  });

  it('returns asset unchanged for unmapped meme on a mapped venue', () => {
    // Binance handles PEPE as 1000PEPE but doesn't list e.g. CAT — fall through.
    expect(nativeSymbol('Binance', 'CAT')).toBe('CAT');
  });

  it('case-insensitive lookup', () => {
    expect(nativeSymbol('Binance', 'pepe')).toBe('1000PEPE');
    expect(nativeSymbol('Binance', 'Pepe')).toBe('1000PEPE');
  });
});

describe('nativeSymbol — Binance overrides', () => {
  it('prefixes 1000 for sub-cent memes', () => {
    expect(nativeSymbol('Binance', 'PEPE')).toBe('1000PEPE');
    expect(nativeSymbol('Binance', 'SHIB')).toBe('1000SHIB');
    expect(nativeSymbol('Binance', 'BONK')).toBe('1000BONK');
    expect(nativeSymbol('Binance', 'FLOKI')).toBe('1000FLOKI');
    expect(nativeSymbol('Binance', 'LUNC')).toBe('1000LUNC');
    expect(nativeSymbol('Binance', 'RATS')).toBe('1000RATS');
    expect(nativeSymbol('Binance', 'SATS')).toBe('1000SATS');
    expect(nativeSymbol('Binance', 'XEC')).toBe('1000XEC');
  });
});

describe('nativeSymbol — Bybit (suffix quirk)', () => {
  it('uses 1000 prefix for most memes', () => {
    expect(nativeSymbol('Bybit', 'PEPE')).toBe('1000PEPE');
    expect(nativeSymbol('Bybit', 'BONK')).toBe('1000BONK');
    expect(nativeSymbol('Bybit', 'FLOKI')).toBe('1000FLOKI');
  });

  it('uses SHIB1000 SUFFIX (Bybit historical quirk)', () => {
    // CRITICAL: Bybit's SHIB perp is named with the multiplier as a
    // SUFFIX, not a prefix. Don't normalise this — they actually use
    // "SHIB1000" as the symbol on the wire.
    expect(nativeSymbol('Bybit', 'SHIB')).toBe('SHIB1000');
  });
});

describe('nativeSymbol — Aevo (1,000,000 multiplier)', () => {
  it('uses 1000000 prefix for super-low-priced memes', () => {
    // Aevo's tick is granular enough that they can use 1M-unit pairs
    // for things like PEPE without precision loss.
    expect(nativeSymbol('Aevo', 'PEPE')).toBe('1000000PEPE');
    expect(nativeSymbol('Aevo', 'SHIB')).toBe('1000000SHIB');
    expect(nativeSymbol('Aevo', 'BONK')).toBe('1000000BONK');
  });

  it('FLOKI on Aevo is 10000FLOKI (intermediate scale)', () => {
    expect(nativeSymbol('Aevo', 'FLOKI')).toBe('10000FLOKI');
  });
});

describe('nativePriceScale — divisor lines up with the symbol prefix', () => {
  it('returns 1 for normal pairs / unknown venue / unmapped asset', () => {
    expect(nativePriceScale('Binance', 'BTC')).toBe(1);
    expect(nativePriceScale('NoSuchVenue', 'PEPE')).toBe(1);
    expect(nativePriceScale('Binance', 'CAT')).toBe(1);
  });

  it('returns 1000 for Binance/Bybit/Aster mapped memes', () => {
    expect(nativePriceScale('Binance', 'PEPE')).toBe(1000);
    expect(nativePriceScale('Binance', 'SHIB')).toBe(1000);
    expect(nativePriceScale('Bybit', 'BONK')).toBe(1000);
    expect(nativePriceScale('Bybit', 'SHIB')).toBe(1000);
    expect(nativePriceScale('Aster', 'PEPE')).toBe(1000);
  });

  it('returns 1_000_000 for Aevo million-scale memes', () => {
    expect(nativePriceScale('Aevo', 'PEPE')).toBe(1_000_000);
    expect(nativePriceScale('Aevo', 'SHIB')).toBe(1_000_000);
    expect(nativePriceScale('Aevo', 'BONK')).toBe(1_000_000);
  });

  it('returns 10_000 for Aevo FLOKI (intermediate scale)', () => {
    expect(nativePriceScale('Aevo', 'FLOKI')).toBe(10_000);
  });
});

describe('symbol-map invariants — symbol and scale stay in sync', () => {
  // If a symbol is mapped to "1000PEPE" but the scale entry is missing,
  // the optimizer would compute prices 1000× off. Lock the invariant:
  // every override on a venue must have a matching scale entry.
  it('every Binance override has a matching scale', () => {
    for (const meme of ['PEPE', 'SHIB', 'BONK', 'FLOKI', 'LUNC', 'RATS', 'SATS', 'XEC']) {
      const sym = nativeSymbol('Binance', meme);
      expect(sym).not.toBe(meme); // it IS overridden
      expect(nativePriceScale('Binance', meme)).toBeGreaterThan(1);
    }
  });

  it('every Aevo override has a matching scale', () => {
    for (const meme of ['PEPE', 'SHIB', 'BONK', 'FLOKI']) {
      const sym = nativeSymbol('Aevo', meme);
      expect(sym).not.toBe(meme);
      expect(nativePriceScale('Aevo', meme)).toBeGreaterThan(1);
    }
  });
});
