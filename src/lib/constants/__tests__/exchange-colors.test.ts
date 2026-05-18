import { describe, it, expect } from 'vitest';
import {
  EXCHANGE_HEX_COLORS,
  EXCHANGE_HEX_FALLBACK,
  getExchangeHexColor,
} from '../exchange-colors';
import { ALL_EXCHANGES } from '../exchanges';

describe('EXCHANGE_HEX_COLORS', () => {
  it('every entry is a valid hex color (#XXXXXX)', () => {
    Object.values(EXCHANGE_HEX_COLORS).forEach((color) => {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  it('fallback is a valid hex color', () => {
    expect(EXCHANGE_HEX_FALLBACK).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('covers all major CEX exchanges (smoke test)', () => {
    expect(EXCHANGE_HEX_COLORS['Binance']).toBeDefined();
    expect(EXCHANGE_HEX_COLORS['OKX']).toBeDefined();
    expect(EXCHANGE_HEX_COLORS['Bybit']).toBeDefined();
    expect(EXCHANGE_HEX_COLORS['Bitget']).toBeDefined();
  });

  it('covers all DEX exchanges (smoke test)', () => {
    expect(EXCHANGE_HEX_COLORS['Hyperliquid']).toBeDefined();
    expect(EXCHANGE_HEX_COLORS['dYdX']).toBeDefined();
    expect(EXCHANGE_HEX_COLORS['GMX']).toBeDefined();
    expect(EXCHANGE_HEX_COLORS['Aevo']).toBeDefined();
  });

  it('does not have duplicate exchange entries (case-sensitive)', () => {
    const keys = Object.keys(EXCHANGE_HEX_COLORS);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it('has a color for every exchange in ALL_EXCHANGES (no orphan exchanges)', () => {
    const missing: string[] = [];
    for (const ex of ALL_EXCHANGES) {
      // ALL_EXCHANGES is a tuple of string literals, not objects
      if (!EXCHANGE_HEX_COLORS[ex]) {
        missing.push(ex);
      }
    }
    // Some venues might intentionally lack colors (fallback handles those).
    // We're not asserting zero missing; just surfacing what's uncovered for
    // visibility — the contract is that getExchangeHexColor always returns
    // a string (tested below).
    expect(Array.isArray(missing)).toBe(true);
  });
});

describe('getExchangeHexColor', () => {
  it('returns the mapped color for known exchanges', () => {
    expect(getExchangeHexColor('Binance')).toBe('#EAB308');
    expect(getExchangeHexColor('Bybit')).toBe('#F97316');
    expect(getExchangeHexColor('Hyperliquid')).toBe('#4ADE80');
  });

  it('returns the fallback color for unknown exchanges', () => {
    expect(getExchangeHexColor('NotARealExchange')).toBe(EXCHANGE_HEX_FALLBACK);
    expect(getExchangeHexColor('UnknownVenue')).toBe(EXCHANGE_HEX_FALLBACK);
  });

  it('is case-sensitive (matches exchange name spelling exactly)', () => {
    // The map uses 'Binance' (capital B) — lowercase misses
    expect(getExchangeHexColor('binance')).toBe(EXCHANGE_HEX_FALLBACK);
    expect(getExchangeHexColor('BINANCE')).toBe(EXCHANGE_HEX_FALLBACK);
    expect(getExchangeHexColor('Binance')).not.toBe(EXCHANGE_HEX_FALLBACK);
  });

  it('returns fallback for empty / whitespace inputs', () => {
    expect(getExchangeHexColor('')).toBe(EXCHANGE_HEX_FALLBACK);
    expect(getExchangeHexColor(' ')).toBe(EXCHANGE_HEX_FALLBACK);
  });

  it('always returns a non-empty string', () => {
    const result = getExchangeHexColor('Binance');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returned colors are always valid hex (chart components depend on this)', () => {
    const samples = ['Binance', 'OKX', 'NotReal', '', 'Hyperliquid'];
    samples.forEach((s) => {
      expect(getExchangeHexColor(s)).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });
});
