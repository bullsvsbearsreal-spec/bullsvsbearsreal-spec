/**
 * Tests for normalizePageRoute. These lock in the cardinality-control
 * contract for the /api/track-page-view beacon — every page that
 * goes into the page_views table must end up under a bounded set of
 * route templates, OR explicitly stay fixed.
 *
 * History informs the cases below:
 *   · commit 977b710c: added /coin/[id] + /funding/[symbol] parent
 *     collapse — without it, every popular coin became its own row
 *   · commit 8e5ade6f: walked back the /bounce/[X] catchall after it
 *     would have eaten /bounce/leaderboard, /bounce/check, /bounce/claim
 *
 * Any future edit to normalizePageRoute should keep these green.
 */
import { describe, it, expect } from 'vitest';
import { normalizePageRoute } from '../normalizePageRoute';

describe('normalizePageRoute — invalid inputs', () => {
  it('returns null for non-string input', () => {
    expect(normalizePageRoute(undefined as unknown as string)).toBe(null);
    expect(normalizePageRoute(null as unknown as string)).toBe(null);
    expect(normalizePageRoute(123 as unknown as string)).toBe(null);
  });
  it('returns null for paths that do not start with /', () => {
    expect(normalizePageRoute('home')).toBe(null);
    expect(normalizePageRoute('https://example.com/foo')).toBe(null);
  });
  it('returns null for absurdly long paths (>200 chars)', () => {
    const long = '/' + 'a'.repeat(201);
    expect(normalizePageRoute(long)).toBe(null);
  });
  it('returns null for /api/* paths', () => {
    expect(normalizePageRoute('/api/funding')).toBe(null);
    expect(normalizePageRoute('/api/v1/status')).toBe(null);
  });
  it('returns null for /_next/* paths', () => {
    expect(normalizePageRoute('/_next/static/foo.js')).toBe(null);
  });
});

describe('normalizePageRoute — query + hash stripping', () => {
  it('strips ?query', () => {
    expect(normalizePageRoute('/funding?assetClass=crypto')).toBe('/funding');
  });
  it('strips #hash', () => {
    expect(normalizePageRoute('/dashboard#alerts')).toBe('/dashboard');
  });
  it('strips both', () => {
    expect(normalizePageRoute('/screener?sort=funding#row-5')).toBe('/screener');
  });
});

describe('normalizePageRoute — segment-level address detection', () => {
  it('collapses 0x... address segments', () => {
    expect(normalizePageRoute('/trader/0xabcdef123456'))
      .toBe('/trader/[address]');
    expect(normalizePageRoute('/bounce/0xc6e2729BBa563BBa3935e16421aF1fEcdcC5BF6d'))
      .toBe('/bounce/[address]');
  });
  it('collapses long alphanumeric (>=20 chars) as [id]', () => {
    // Solana address example — base58, >20 chars
    expect(normalizePageRoute('/wallet/GeHtgruEheEcicReRGEFmZSQZKArn7Hpj5CdTEqSBAHE'))
      .toBe('/wallet/[address]');
  });
  it('collapses 4+ digit numeric segments', () => {
    expect(normalizePageRoute('/orders/12345')).toBe('/orders/[id]');
  });
  it('leaves short alphanumeric segments alone', () => {
    expect(normalizePageRoute('/symbol/BTC')).toBe('/symbol/[symbol]');
    expect(normalizePageRoute('/funding')).toBe('/funding');
    expect(normalizePageRoute('/dashboard')).toBe('/dashboard');
  });
});

describe('normalizePageRoute — parent-path collapse', () => {
  it('collapses /symbol/X to /symbol/[symbol]', () => {
    expect(normalizePageRoute('/symbol/BTC')).toBe('/symbol/[symbol]');
    expect(normalizePageRoute('/symbol/PEPE')).toBe('/symbol/[symbol]');
    expect(normalizePageRoute('/symbol/HYPE')).toBe('/symbol/[symbol]');
  });
  it('collapses /coin/X to /coin/[id] (dictionary-word slugs)', () => {
    // These would NOT be caught by the segment normalizer (not
    // address-shaped, not long enough). Parent-path rule catches them.
    expect(normalizePageRoute('/coin/bitcoin')).toBe('/coin/[id]');
    expect(normalizePageRoute('/coin/ethereum')).toBe('/coin/[id]');
    expect(normalizePageRoute('/coin/avalanche-2')).toBe('/coin/[id]');
  });
  it('collapses /funding/X to /funding/[symbol]', () => {
    expect(normalizePageRoute('/funding/BTC')).toBe('/funding/[symbol]');
    expect(normalizePageRoute('/funding/ETH')).toBe('/funding/[symbol]');
  });
  it('collapses /trader/X to /trader/[address]', () => {
    expect(normalizePageRoute('/trader/0xabcdef123456'))
      .toBe('/trader/[address]');
  });
});

describe('normalizePageRoute — does NOT collapse fixed sub-pages', () => {
  // Regression test: commit 977b710c added a /bounce/[^/]+ catchall
  // that would have eaten these. Walked back in 8e5ade6f. These tests
  // prevent the regression from coming back.
  it('keeps /bounce/leaderboard distinct', () => {
    expect(normalizePageRoute('/bounce/leaderboard')).toBe('/bounce/leaderboard');
  });
  it('keeps /bounce/check distinct', () => {
    expect(normalizePageRoute('/bounce/check')).toBe('/bounce/check');
  });
  it('keeps /bounce/claim distinct', () => {
    expect(normalizePageRoute('/bounce/claim')).toBe('/bounce/claim');
  });
  it('still collapses /bounce/0xAddress via segment normalizer', () => {
    expect(normalizePageRoute('/bounce/0xc6e2729BBa563BBa3935e16421aF1fEcdcC5BF6d'))
      .toBe('/bounce/[address]');
  });
  it('keeps /smart-money/leaderboard distinct', () => {
    expect(normalizePageRoute('/smart-money/leaderboard'))
      .toBe('/smart-money/leaderboard');
  });
  it('keeps /developers/docs distinct', () => {
    expect(normalizePageRoute('/developers/docs')).toBe('/developers/docs');
  });
  it('keeps /developers/webhooks distinct', () => {
    expect(normalizePageRoute('/developers/webhooks'))
      .toBe('/developers/webhooks');
  });
  it('keeps /invite/leaderboard distinct', () => {
    expect(normalizePageRoute('/invite/leaderboard')).toBe('/invite/leaderboard');
  });
});

describe('normalizePageRoute — top-level pages pass through unchanged', () => {
  it('/funding', () => { expect(normalizePageRoute('/funding')).toBe('/funding'); });
  it('/spreads', () => { expect(normalizePageRoute('/spreads')).toBe('/spreads'); });
  it('/dashboard', () => { expect(normalizePageRoute('/dashboard')).toBe('/dashboard'); });
  it('/pricing', () => { expect(normalizePageRoute('/pricing')).toBe('/pricing'); });
  it('/home', () => { expect(normalizePageRoute('/home')).toBe('/home'); });
});
