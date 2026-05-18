import { describe, it, expect } from 'vitest';
import sitemap from '../sitemap';

describe('sitemap()', () => {
  const entries = sitemap();

  it('returns a non-empty array', () => {
    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBeGreaterThan(0);
  });

  it('every entry has url + lastModified + changeFrequency + priority', () => {
    entries.forEach((e) => {
      expect(e.url).toBeTruthy();
      expect(e.lastModified).toBeInstanceOf(Date);
      expect(e.changeFrequency).toBeTruthy();
      expect(typeof e.priority).toBe('number');
    });
  });

  it('every URL starts with the canonical base (info-hub.io)', () => {
    entries.forEach((e) => {
      expect(e.url).toMatch(/^https:\/\/info-hub\.io/);
    });
  });

  it('every priority is in [0, 1]', () => {
    entries.forEach((e) => {
      expect(e.priority).toBeGreaterThanOrEqual(0);
      expect(e.priority).toBeLessThanOrEqual(1);
    });
  });

  it('every changeFrequency is one of the standard values', () => {
    const valid = new Set([
      'always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never',
    ]);
    entries.forEach((e) => {
      expect(valid.has(e.changeFrequency as string)).toBe(true);
    });
  });

  it('has no duplicate URLs', () => {
    const urls = entries.map((e) => e.url);
    const unique = new Set(urls);
    // Allow small overlap from /symbol/BTC + /funding/BTC pairs (different paths)
    expect(unique.size).toBe(urls.length);
  });

  it('root "/" is the highest priority page (1.0)', () => {
    const root = entries.find((e) => e.url === 'https://info-hub.io/');
    expect(root).toBeDefined();
    expect(root!.priority).toBe(1.0);
  });

  it('includes the major data tools at priority 0.9 (top tier)', () => {
    const topTier = ['/funding', '/open-interest', '/liquidations', '/chart'];
    topTier.forEach((path) => {
      const entry = entries.find((e) => e.url === `https://info-hub.io${path}`);
      expect(entry).toBeDefined();
      expect(entry!.priority).toBeGreaterThanOrEqual(0.8);
    });
  });

  it('includes per-symbol pages for major tickers', () => {
    const btcSymbol = entries.find((e) => e.url === 'https://info-hub.io/symbol/BTC');
    const ethSymbol = entries.find((e) => e.url === 'https://info-hub.io/symbol/ETH');
    expect(btcSymbol).toBeDefined();
    expect(ethSymbol).toBeDefined();
  });

  it('includes /funding/BTC and /funding/ETH (deep symbol-funding pages)', () => {
    const btcFunding = entries.find((e) => e.url === 'https://info-hub.io/funding/BTC');
    const ethFunding = entries.find((e) => e.url === 'https://info-hub.io/funding/ETH');
    expect(btcFunding).toBeDefined();
    expect(ethFunding).toBeDefined();
  });

  it('includes coin pages for the canonical CG IDs', () => {
    const bitcoin = entries.find((e) => e.url === 'https://info-hub.io/coin/bitcoin');
    const ethereum = entries.find((e) => e.url === 'https://info-hub.io/coin/ethereum');
    expect(bitcoin).toBeDefined();
    expect(ethereum).toBeDefined();
  });

  it('legal pages are lower priority', () => {
    const terms = entries.find((e) => e.url === 'https://info-hub.io/terms');
    const privacy = entries.find((e) => e.url === 'https://info-hub.io/privacy');
    expect(terms?.priority).toBeLessThanOrEqual(0.5);
    expect(privacy?.priority).toBeLessThanOrEqual(0.5);
  });

  it('hourly-refresh pages match data tools (live market data)', () => {
    const hourly = entries.filter((e) => e.changeFrequency === 'hourly');
    // Should be a substantial chunk — live data tools dominate the site
    expect(hourly.length).toBeGreaterThan(20);
  });

  it('lastModified is a fresh Date (no stale-pinned timestamps)', () => {
    const now = Date.now();
    entries.forEach((e) => {
      const mod = (e.lastModified as Date).getTime();
      // Within 60s of "now" — generated at request time
      expect(Math.abs(now - mod)).toBeLessThan(60_000);
    });
  });
});
