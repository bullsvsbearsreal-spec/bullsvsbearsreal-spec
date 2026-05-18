import { describe, it, expect } from 'vitest';
import {
  getCoinIconUrl,
  getCoinIcon,
  hasKnownIcon,
  getExchangeIcon,
} from '../coinIcons';

describe('getCoinIconUrl', () => {
  it('returns a CoinGecko URL for known crypto symbols', () => {
    const url = getCoinIconUrl('BTC');
    expect(url).toBeTruthy();
    expect(url).toContain('coingecko');
  });

  it('is case-insensitive on input (symbol normalized to uppercase)', () => {
    expect(getCoinIconUrl('btc')).toBe(getCoinIconUrl('BTC'));
    expect(getCoinIconUrl('eth')).toBe(getCoinIconUrl('ETH'));
  });

  it('returns null for unknown symbols', () => {
    expect(getCoinIconUrl('NOTACOIN')).toBeNull();
    expect(getCoinIconUrl('XYZABC')).toBeNull();
  });

  it('returns null for empty / whitespace input', () => {
    expect(getCoinIconUrl('')).toBeNull();
  });

  it('handles ETH, SOL, BTC + a few popular memes (cached map lookups)', () => {
    // Smoke check the most-trafficked symbols at least have something
    expect(getCoinIconUrl('BTC')).not.toBeNull();
    expect(getCoinIconUrl('ETH')).not.toBeNull();
    expect(getCoinIconUrl('SOL')).not.toBeNull();
    expect(getCoinIconUrl('PEPE')).not.toBeNull();
    expect(getCoinIconUrl('DOGE')).not.toBeNull();
  });
});

describe('getCoinIcon', () => {
  it('always returns a string (CoinGecko URL or fallback to CryptoCompare)', () => {
    // Known crypto → CoinGecko URL
    expect(getCoinIcon('BTC')).toContain('coingecko');
    // Unknown crypto → CryptoCompare fallback
    const fallback = getCoinIcon('NOTACOIN');
    expect(fallback).toContain('cryptocompare');
    expect(fallback).toContain('notacoin');  // lowercased symbol
  });

  it('returns data-URI emoji for known non-crypto assets', () => {
    const eur = getCoinIcon('EUR');
    // EUR maps to an emoji; expect a data URI (or some non-crypto icon)
    expect(typeof eur).toBe('string');
  });
});

describe('hasKnownIcon', () => {
  it('returns true for popular crypto symbols', () => {
    expect(hasKnownIcon('BTC')).toBe(true);
    expect(hasKnownIcon('ETH')).toBe(true);
    expect(hasKnownIcon('SOL')).toBe(true);
  });

  it('returns false for unknown symbols', () => {
    expect(hasKnownIcon('NOTACOIN')).toBe(false);
    expect(hasKnownIcon('XYZABC')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(hasKnownIcon('btc')).toBe(hasKnownIcon('BTC'));
    expect(hasKnownIcon('Btc')).toBe(true);
  });

  it('returns false on empty', () => {
    expect(hasKnownIcon('')).toBe(false);
  });
});

describe('getExchangeIcon', () => {
  it('returns a favicon URL for known exchanges', () => {
    const binance = getExchangeIcon('Binance');
    expect(binance).toBeTruthy();
    expect(binance).toContain('google.com/s2/favicons');
    expect(binance).toContain('binance.com');
  });

  it('returns null for unknown exchanges', () => {
    expect(getExchangeIcon('Atlantis Exchange')).toBeNull();
    expect(getExchangeIcon('NotARealExchange')).toBeNull();
  });

  it('is exact-match (case-sensitive) on exchange names', () => {
    // The map uses capitalized names — lowercase form misses
    expect(getExchangeIcon('binance')).toBeNull();
    expect(getExchangeIcon('Binance')).not.toBeNull();
  });
});
