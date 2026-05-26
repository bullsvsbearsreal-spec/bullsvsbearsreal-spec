import { describe, it, expect } from 'vitest';
import { TWITTER_KOLS } from '../kols';

describe('TWITTER_KOLS', () => {
  it('is non-empty (we have curated handles for social fetch)', () => {
    expect(TWITTER_KOLS.length).toBeGreaterThan(0);
  });

  it('has no duplicate handles (case-insensitive)', () => {
    const lower = TWITTER_KOLS.map((h) => h.toLowerCase());
    const unique = new Set(lower);
    expect(unique.size).toBe(lower.length);
  });

  it('every handle is a string', () => {
    TWITTER_KOLS.forEach((h) => {
      expect(typeof h).toBe('string');
    });
  });

  it('no handle starts with @ (we store canonical usernames only)', () => {
    TWITTER_KOLS.forEach((h) => {
      expect(h.startsWith('@')).toBe(false);
    });
  });

  it('no handle contains whitespace', () => {
    TWITTER_KOLS.forEach((h) => {
      expect(h).not.toMatch(/\s/);
    });
  });

  it('every handle is within X (Twitter)\'s 15-char limit', () => {
    TWITTER_KOLS.forEach((h) => {
      expect(h.length).toBeLessThanOrEqual(15);
      expect(h.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('every handle uses only valid Twitter characters (alphanumeric + underscore)', () => {
    TWITTER_KOLS.forEach((h) => {
      expect(h).toMatch(/^[A-Za-z0-9_]+$/);
    });
  });

  it('contains at least one zachxbt (canonical on-chain investigator)', () => {
    const lower = TWITTER_KOLS.map((h) => h.toLowerCase());
    expect(lower).toContain('zachxbt');
  });

  it('is readonly at the type level (const tuple)', () => {
    // This is mostly a compile-time check — we just verify it's array-like
    expect(Array.isArray(TWITTER_KOLS)).toBe(true);
  });
});
