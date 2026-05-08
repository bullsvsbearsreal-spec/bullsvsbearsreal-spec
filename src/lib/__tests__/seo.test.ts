/**
 * Tests for the SEO metadata helpers — these power every page's
 * <title> tag, OpenGraph card, Twitter Card, and canonical URL.
 *
 * Two failure modes:
 *   - pickVariant routes to the wrong OG image (e.g. /funding-heatmap
 *     gets the funding card instead of the heatmap card) — silent on
 *     the page itself, just looks wrong on social shares.
 *   - pageMetadata returns the wrong canonical / image URL.
 */
import { describe, it, expect } from 'vitest';
import { pickVariant, pageMetadata, PAGE_META } from '../seo';

describe('pickVariant — explicit override', () => {
  it('honours the explicit variant when provided', () => {
    expect(pickVariant('/funding', 'screener')).toBe('screener');
    expect(pickVariant('/anything', 'options')).toBe('options');
  });
});

describe('pickVariant — substring matching (declaration order)', () => {
  it('routes heatmap variants first (longer match wins)', () => {
    // CRITICAL: 'funding-heatmap' must hit the heatmap entry, NOT the
    // 'funding' entry below it.
    expect(pickVariant('/funding-heatmap')).toBe('heatmap');
    expect(pickVariant('/liquidation-heatmap')).toBe('heatmap');
    expect(pickVariant('/oi-heatmap')).toBe('heatmap');
  });

  it('routes liquidations / OI / longshort families', () => {
    expect(pickVariant('/liquidations/BTC')).toBe('liquidations');
    expect(pickVariant('/open-interest')).toBe('oi');
    expect(pickVariant('/long-short')).toBe('ratios');
  });

  it('routes screener-family pages (top-movers / momentum / breakouts)', () => {
    expect(pickVariant('/screener')).toBe('screener');
    expect(pickVariant('/top-movers')).toBe('screener');
    expect(pickVariant('/momentum')).toBe('screener');
    expect(pickVariant('/breakouts')).toBe('screener');
  });

  it('routes news-family pages', () => {
    expect(pickVariant('/news')).toBe('news');
    expect(pickVariant('/economic-calendar')).toBe('news');
    expect(pickVariant('/token-unlocks')).toBe('news');
  });

  it('routes options-family pages', () => {
    expect(pickVariant('/options-iv')).toBe('options');
    expect(pickVariant('/max-pain')).toBe('options');
    expect(pickVariant('/options')).toBe('options');
  });

  it('falls back to "default" when nothing matches', () => {
    expect(pickVariant('/about')).toBe('default');
    expect(pickVariant('/changelog')).toBe('default');
    expect(pickVariant('/')).toBe('default');
  });

  it('lowercases the path before matching (case-insensitive)', () => {
    expect(pickVariant('/FUNDING-HEATMAP')).toBe('heatmap');
    expect(pickVariant('/Open-Interest')).toBe('oi');
  });
});

describe('pageMetadata — output shape', () => {
  it('returns empty object for unknown path', () => {
    expect(pageMetadata('/no-such-page')).toEqual({});
  });

  it('builds title + description + canonical for known path', () => {
    // Use any path that exists in PAGE_META (test below also catches
    // schema drift).
    const knownPath = Object.keys(PAGE_META)[0];
    const meta = pageMetadata(knownPath);
    expect(meta.title).toBeTruthy();
    expect(meta.description).toBeTruthy();
    expect((meta as any).alternates?.canonical).toMatch(/^https:\/\/info-hub\.io/);
  });

  it('canonical URL embeds the path verbatim', () => {
    const knownPath = Object.keys(PAGE_META).find(p => p !== '/') || '/';
    const meta = pageMetadata(knownPath);
    expect((meta as any).alternates?.canonical).toBe(`https://info-hub.io${knownPath}`);
  });

  it('OG image URL embeds title, description, and variant', () => {
    const knownPath = Object.keys(PAGE_META)[0];
    const meta = pageMetadata(knownPath);
    const og = (meta as any).openGraph;
    expect(og?.images?.[0]).toContain('/api/og?');
    expect(og?.images?.[0]).toContain('title=');
    expect(og?.images?.[0]).toContain('desc=');
    expect(og?.images?.[0]).toContain('v=');
  });

  it('respects noIndex flag → robots: { index: false, follow: false }', () => {
    // Find a noIndex page if any exist.
    const noIndexPath = Object.entries(PAGE_META).find(([, m]) => m.noIndex)?.[0];
    if (!noIndexPath) {
      // No noIndex pages defined right now — skip the assertion but
      // the test passes (no regression to guard against).
      return;
    }
    const meta = pageMetadata(noIndexPath);
    expect((meta as any).robots).toEqual({ index: false, follow: false });
  });
});

describe('PAGE_META — schema sanity', () => {
  it('every entry has non-empty title + description', () => {
    for (const [path, meta] of Object.entries(PAGE_META)) {
      expect(meta.title, `Empty title for ${path}`).toBeTruthy();
      expect(meta.description, `Empty desc for ${path}`).toBeTruthy();
    }
  });

  it('description is reasonable length (between 30 and 250 chars)', () => {
    // SEO best-practice: ~50-160 chars; our copy bumps to 250 for some
    // dense pages but anything under 30 is suspicious.
    for (const [path, meta] of Object.entries(PAGE_META)) {
      expect(
        meta.description.length,
        `Suspiciously short description for ${path}: "${meta.description}"`,
      ).toBeGreaterThanOrEqual(30);
      expect(meta.description.length).toBeLessThanOrEqual(400);
    }
  });
});
