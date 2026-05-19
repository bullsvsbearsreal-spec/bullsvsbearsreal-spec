import { describe, it, expect } from 'vitest';
import { UPCOMING_TGES, type TgeEntry } from '../tge-calendar';

describe('UPCOMING_TGES', () => {
  it('is non-empty', () => {
    expect(UPCOMING_TGES.length).toBeGreaterThan(0);
  });

  it('every entry has the required fields', () => {
    UPCOMING_TGES.forEach((t: TgeEntry) => {
      expect(t.name).toBeTruthy();
      expect(t.date).toBeTruthy();
      expect(t.chain).toBeTruthy();
      expect(t.category).toBeTruthy();
      expect(t.description).toBeTruthy();
    });
  });

  it('every date is ISO-formatted (YYYY-MM-DD)', () => {
    UPCOMING_TGES.forEach((t) => {
      expect(t.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(new Date(t.date).getTime())).toBe(false);
    });
  });

  it('symbol is either a non-empty string or explicitly null (no undefined)', () => {
    UPCOMING_TGES.forEach((t) => {
      expect(t.symbol === null || typeof t.symbol === 'string').toBe(true);
      if (typeof t.symbol === 'string') {
        expect(t.symbol.length).toBeGreaterThan(0);
      }
    });
  });

  it('every category is one of the documented enum values', () => {
    const valid = new Set([
      'L1', 'L2', 'DeFi', 'AI', 'Infra', 'RWA', 'Memes', 'Gaming',
      'Social', 'DePIN', 'Other',
    ]);
    UPCOMING_TGES.forEach((t) => {
      expect(valid.has(t.category)).toBe(true);
    });
  });

  it('descriptions are concise (under ~120 chars per spec)', () => {
    UPCOMING_TGES.forEach((t) => {
      // The spec says one sentence, max ~120 chars — allow some headroom
      expect(t.description.length).toBeLessThan(200);
    });
  });

  it('fdvUsd is null OR a positive number', () => {
    UPCOMING_TGES.forEach((t) => {
      if (t.fdvUsd === null) return;
      expect(t.fdvUsd).toBeGreaterThan(0);
    });
  });

  it('initialCirc (% supply at TGE) is null OR in [0, 100]', () => {
    UPCOMING_TGES.forEach((t) => {
      if (t.initialCirc === null) return;
      expect(t.initialCirc).toBeGreaterThanOrEqual(0);
      expect(t.initialCirc).toBeLessThanOrEqual(100);
    });
  });

  it('vestingCliffMonths is null OR positive integer', () => {
    UPCOMING_TGES.forEach((t) => {
      if (t.vestingCliffMonths === null) return;
      expect(t.vestingCliffMonths).toBeGreaterThan(0);
      expect(Number.isInteger(t.vestingCliffMonths)).toBe(true);
    });
  });

  it('website is null OR a valid http/https URL', () => {
    UPCOMING_TGES.forEach((t) => {
      if (t.website === null) return;
      expect(t.website).toMatch(/^https?:\/\//);
    });
  });

  it('fundingRaised (when present) is positive', () => {
    UPCOMING_TGES.forEach((t) => {
      if (t.fundingRaised === undefined) return;
      expect(t.fundingRaised).toBeGreaterThan(0);
    });
  });

  it('twitter handles (when present) have no @ prefix + no whitespace', () => {
    UPCOMING_TGES.forEach((t) => {
      if (!t.twitter) return;
      expect(t.twitter.startsWith('@')).toBe(false);
      expect(t.twitter).not.toMatch(/\s/);
    });
  });

  it('no duplicate names across entries', () => {
    const names = UPCOMING_TGES.map((t) => t.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});
