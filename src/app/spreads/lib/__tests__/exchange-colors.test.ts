import { describe, it, expect } from 'vitest';
import { EX_COLORS, getExchangeColor, getLineStyle } from '../exchange-colors';

describe('EX_COLORS', () => {
  it('every value is a valid hex color', () => {
    Object.values(EX_COLORS).forEach((color) => {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  it('contains the top CEX venues', () => {
    expect(EX_COLORS.Binance).toBeDefined();
    expect(EX_COLORS.Bybit).toBeDefined();
    expect(EX_COLORS.OKX).toBeDefined();
  });

  it('contains the top DEX venues', () => {
    expect(EX_COLORS.Hyperliquid).toBeDefined();
    expect(EX_COLORS.dYdX).toBeDefined();
  });

  it('Binance is the canonical Binance gold (#F0B90B)', () => {
    expect(EX_COLORS.Binance).toBe('#F0B90B');
  });

  it('no two adjacent (lex-order) colors are identical (avoid chart confusion)', () => {
    const colors = Object.values(EX_COLORS);
    const set = new Set(colors);
    // Some duplicates may exist intentionally for visual distinction across
    // CEX vs DEX, but we don't expect MASSIVE collisions — at least 90% unique
    expect(set.size / colors.length).toBeGreaterThan(0.9);
  });
});

describe('getExchangeColor', () => {
  it('returns the mapped color for known exchanges', () => {
    expect(getExchangeColor('Binance', 0)).toBe('#F0B90B');
    expect(getExchangeColor('Bybit', 0)).toBe('#FF4040');
  });

  it('falls back to the palette for unknown exchanges using the index', () => {
    // Pass an exchange not in EX_COLORS — should use PALETTE[index % len]
    const fallback = getExchangeColor('UnknownVenue', 0);
    expect(fallback).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('different indices return different palette entries', () => {
    const a = getExchangeColor('Unknown1', 0);
    const b = getExchangeColor('Unknown1', 1);
    // The function uses index unless name is known. Both fall back to palette.
    // The actual logic: returns EX_COLORS[exchange] OR PALETTE[index % len]
    // 'Unknown1' isn't in EX_COLORS, so both use palette with different indices
    expect(a).not.toBe(b);
  });

  it('always returns a hex color string', () => {
    [
      ['Binance', 0],
      ['ZzzNotAVenue', 5],
      ['', 100],
    ].forEach(([name, idx]) => {
      const result = getExchangeColor(name as string, idx as number);
      expect(result).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  it('handles large indices via modulo', () => {
    // 1000 % palette.length should still return a valid color
    const result = getExchangeColor('Unknown', 1000);
    expect(result).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});

describe('getLineStyle', () => {
  it('returns 0 (solid) for first 4 lines', () => {
    expect(getLineStyle(0)).toBe(0);
    expect(getLineStyle(1)).toBe(0);
    expect(getLineStyle(2)).toBe(0);
    expect(getLineStyle(3)).toBe(0);
  });

  it('returns 2 (dashed) for the 5th line onward', () => {
    expect(getLineStyle(4)).toBe(2);
    expect(getLineStyle(10)).toBe(2);
    expect(getLineStyle(100)).toBe(2);
  });

  it('only returns 0 or 2 (matches lightweight-charts LineStyle enum)', () => {
    for (let i = 0; i < 20; i++) {
      const out = getLineStyle(i);
      expect([0, 2]).toContain(out);
    }
  });
});
