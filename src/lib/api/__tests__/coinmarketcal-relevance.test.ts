/**
 * Tests for isArticleRelevant — the per-coin news filter on /coin/[symbol].
 *
 * Two silent-failure modes:
 *   - Too lenient (e.g. lose the \b word-boundary regex) → "ARENA" matches
 *     /coin/ENA and Ethena's news section is full of unrelated arena
 *     articles.
 *   - Too strict (e.g. forget the title check) → relevant news is hidden,
 *     coin page looks dead.
 */
import { describe, it, expect } from 'vitest';
import { isArticleRelevant } from '../coinmarketcal';
import type { NewsArticle } from '../coinmarketcal';

function art(overrides: Partial<NewsArticle>): NewsArticle {
  return {
    id: '1',
    title: '',
    body: '',
    url: 'https://example.com',
    imageurl: '',
    source: 'X',
    source_info: { name: 'X', img: '' },
    published_on: 0,
    categories: '',
    tags: '',
    ...overrides,
  };
}

describe('isArticleRelevant — title matching', () => {
  it('matches when symbol is in the title', () => {
    expect(isArticleRelevant(art({ title: 'BTC hits new ATH' }), 'BTC')).toBe(true);
  });

  it('matches "$SYMBOL" form in the title', () => {
    expect(isArticleRelevant(art({ title: 'Why $SOL is pumping' }), 'SOL')).toBe(true);
  });

  it('is case-insensitive on title (symbol is uppercased internally)', () => {
    expect(isArticleRelevant(art({ title: 'btc news' }), 'btc')).toBe(true);
    expect(isArticleRelevant(art({ title: 'BTC news' }), 'BTC')).toBe(true);
  });
});

describe('isArticleRelevant — tag / category matching (exact)', () => {
  it('matches exact tag in pipe-separated tags', () => {
    expect(isArticleRelevant(art({ tags: 'ETH|defi|news' }), 'ETH')).toBe(true);
  });

  it('matches exact category in pipe-separated categories', () => {
    expect(isArticleRelevant(art({ categories: 'BTC|altcoin' }), 'BTC')).toBe(true);
  });

  it('does NOT match a substring tag (must be exact)', () => {
    // "BITCOIN" in tags should NOT match "BTC" symbol via tag check.
    // (Title or body might still match — separate path.)
    expect(isArticleRelevant(art({ tags: 'BITCOIN|altcoin' }), 'BTC')).toBe(false);
  });
});

describe('isArticleRelevant — body matching with word boundaries', () => {
  it('matches symbol as a standalone word in body', () => {
    expect(isArticleRelevant(art({ body: 'ENA price target raised by analysts.' }), 'ENA')).toBe(true);
  });

  it('does NOT match when symbol is a substring of another word', () => {
    // CRITICAL: this is the bug-fix invariant. "ARENA" should NOT match "ENA".
    expect(isArticleRelevant(art({ body: 'New crypto arena game launched' }), 'ENA')).toBe(false);
    // "WBTC" should NOT match "BTC" via body (it would via title/tag if listed).
    expect(isArticleRelevant(art({ body: 'Holders of WBTC migrate to native chains.' }), 'BTC')).toBe(false);
    // "MARINADE" should NOT match "MAR" or anything inside it.
    expect(isArticleRelevant(art({ body: 'Marinade Finance launches v2' }), 'INADE')).toBe(false);
  });

  it('only checks the first 500 chars of the body (long-article noise guard)', () => {
    const longBody = 'A'.repeat(500) + ' SOL is great';
    // SOL appears AFTER the 500-char cutoff → not matched via body.
    expect(isArticleRelevant(art({ body: longBody }), 'SOL')).toBe(false);
  });
});

describe('isArticleRelevant — no match', () => {
  it('returns false when symbol is mentioned nowhere', () => {
    expect(isArticleRelevant(art({
      title: 'DeFi sector rallies',
      tags: 'defi|news',
      categories: 'altcoin',
      body: 'Several alts rallied today as sentiment improved.',
    }), 'BTC')).toBe(false);
  });

  it('returns false on empty article', () => {
    expect(isArticleRelevant(art({}), 'BTC')).toBe(false);
  });
});

describe('isArticleRelevant — multiple-source confirmation', () => {
  it('any one source is sufficient (title alone)', () => {
    expect(isArticleRelevant(art({ title: 'BTC news' }), 'BTC')).toBe(true);
  });

  it('any one source is sufficient (tag alone)', () => {
    expect(isArticleRelevant(art({ tags: 'BTC' }), 'BTC')).toBe(true);
  });

  it('any one source is sufficient (body alone, word-bounded)', () => {
    expect(isArticleRelevant(art({ body: 'BTC just crossed $100k.' }), 'BTC')).toBe(true);
  });
});
