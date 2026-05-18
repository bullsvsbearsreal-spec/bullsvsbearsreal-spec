import { describe, it, expect } from 'vitest';
import { isArticleRelevant } from '../coinmarketcal';
import type { NewsArticle } from '../coinmarketcal';

function article(o: Partial<NewsArticle>): NewsArticle {
  return {
    id: '1',
    title: '',
    body: '',
    url: '',
    source: '',
    pubDate: '',
    image: null,
    tags: '',
    categories: '',
    ...o,
  } as NewsArticle;
}

describe('isArticleRelevant', () => {
  it('matches symbol in the title', () => {
    expect(isArticleRelevant(article({ title: 'BTC hits new high' }), 'BTC')).toBe(true);
  });

  it('matches $SYMBOL syntax in title', () => {
    expect(isArticleRelevant(article({ title: 'Why $ETH is going up' }), 'ETH')).toBe(true);
  });

  it('matches symbol in tags (pipe-separated)', () => {
    expect(isArticleRelevant(article({ tags: 'crypto|BTC|markets' }), 'BTC')).toBe(true);
  });

  it('matches symbol in categories (pipe-separated)', () => {
    expect(isArticleRelevant(article({ categories: 'top|ETH|news' }), 'ETH')).toBe(true);
  });

  it('matches whole-word symbol in body (first 500 chars)', () => {
    expect(isArticleRelevant(article({ body: 'Some news about BTC today.' }), 'BTC')).toBe(true);
  });

  it('REJECTS body matches that are partial words (the ENA-in-ARENA bug)', () => {
    // The word-boundary check is the whole point — 'ENA' inside
    // 'ARENA' or 'arsenal' must NOT count as a match.
    const a = article({ body: 'Sports arena hosted the event.' });
    expect(isArticleRelevant(a, 'ENA')).toBe(false);
  });

  it('REJECTS title-substring matches that look like partial words', () => {
    // Title check uses `includes`, but the body check uses word boundary.
    // The title 'Some BTCUSD news' SHOULD match BTC (substring match) since
    // ticker symbols in titles often appear as part of pair names. Locking
    // in current behavior — be careful when tweaking.
    expect(isArticleRelevant(article({ title: 'BTCUSDT funding rate' }), 'BTC')).toBe(true);
  });

  it('is case-insensitive on input symbol', () => {
    expect(isArticleRelevant(article({ title: 'BTC news' }), 'btc')).toBe(true);
    expect(isArticleRelevant(article({ title: 'Some ETH thing' }), 'eth')).toBe(true);
  });

  it('returns false when nothing matches', () => {
    expect(isArticleRelevant(article({
      title: 'Bitcoin gains', body: 'About crypto',
    }), 'PEPE')).toBe(false);
  });

  it('only checks first 500 chars of body to avoid false positives in long articles', () => {
    // PEPE appears at char 600 — should NOT match
    const longBody = 'word '.repeat(120) + ' PEPE token launches today';
    expect(isArticleRelevant(article({ body: longBody }), 'PEPE')).toBe(false);
  });

  it('handles missing fields safely (defensive)', () => {
    expect(isArticleRelevant(article({}), 'BTC')).toBe(false);
  });

  it('handles array-shaped tags from upstream (coerce to pipe-string)', () => {
    // toStringField coerces arrays to '|'-joined strings
    const a = article({ tags: ['crypto', 'BTC', 'markets'] as unknown as string });
    expect(isArticleRelevant(a, 'BTC')).toBe(true);
  });

  it('matches tags with whitespace around the symbol (trims correctly)', () => {
    expect(isArticleRelevant(article({ tags: ' crypto | BTC | markets ' }), 'BTC')).toBe(true);
  });
});
