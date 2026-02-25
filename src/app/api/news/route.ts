import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';

/* ─── CryptoCompare types ────────────────────────────────────── */

interface CCArticle {
  id: string;
  title: string;
  body: string;
  url: string;
  imageurl: string;
  source: string;
  source_info: { name: string; img: string };
  published_on: number;
  categories: string;
  tags: string;
}

/* ─── Unified News Article ───────────────────────────────────── */

export interface UnifiedNewsArticle {
  id: string;
  title: string;
  body?: string;
  url: string;
  imageUrl?: string;
  source: string;
  publishedAt: number;
  categories: string[];
  currencies: string[];
  sentiment?: 'bullish' | 'bearish' | 'neutral';
  votes?: { positive: number; negative: number };
  origin: 'cryptocompare' | 'cryptopanic';
}

/* ─── CryptoPanic types ──────────────────────────────────────── */

interface CPPost {
  id: number;
  title: string;
  url: string;
  source: { title: string; domain: string };
  published_at: string;
  currencies?: { code: string; title: string }[];
  votes?: { positive: number; negative: number; important: number; liked: number; disliked: number; lol: number; toxic: number };
}

/* ─── Cache ──────────────────────────────────────────────────── */

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data as T;
  return null;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
}

/* ─── Fetch CryptoCompare ────────────────────────────────────── */

async function fetchCryptoCompare(currency?: string): Promise<UnifiedNewsArticle[]> {
  try {
    const params = new URLSearchParams({ lang: 'EN', sortOrder: 'popular' });
    if (currency) params.set('categories', currency.toUpperCase());
    const res = await fetch(`https://min-api.cryptocompare.com/data/v2/news/?${params}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const articles: CCArticle[] = data.Data || [];

    return articles.map(a => ({
      id: `cc-${a.id}`,
      title: a.title,
      body: a.body?.substring(0, 300),
      url: a.url,
      imageUrl: a.imageurl,
      source: a.source_info?.name || a.source,
      publishedAt: a.published_on,
      categories: a.categories ? a.categories.split('|').filter(Boolean) : [],
      currencies: extractCurrencies(a.categories, a.tags, a.title),
      origin: 'cryptocompare' as const,
    }));
  } catch (err) {
    console.error('CryptoCompare fetch error:', err);
    return [];
  }
}

/* ─── Fetch CryptoPanic (optional) ───────────────────────────── */

async function fetchCryptoPanic(filter?: string, currency?: string): Promise<UnifiedNewsArticle[]> {
  const apiKey = process.env.CRYPTOPANIC_API_KEY;
  if (!apiKey) return [];

  try {
    const params = new URLSearchParams({ auth_token: apiKey, public: 'true' });
    if (filter && filter !== 'all') params.set('filter', filter);
    if (currency) params.set('currencies', currency.toUpperCase());

    const res = await fetch(`https://cryptopanic.com/api/v1/posts/?${params}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const posts: CPPost[] = data.results || [];

    return posts.map(p => ({
      id: `cp-${p.id}`,
      title: p.title,
      url: p.url,
      source: p.source?.title || p.source?.domain || 'CryptoPanic',
      publishedAt: Math.floor(new Date(p.published_at).getTime() / 1000),
      categories: [],
      currencies: p.currencies?.map(c => c.code) || [],
      sentiment: deriveSentiment(p.votes),
      votes: p.votes ? { positive: p.votes.positive, negative: p.votes.negative } : undefined,
      origin: 'cryptopanic' as const,
    }));
  } catch (err) {
    console.error('CryptoPanic fetch error:', err);
    return [];
  }
}

/* ─── Helpers ────────────────────────────────────────────────── */

const COMMON_COINS = new Set(['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'DOT', 'LINK', 'UNI', 'MATIC', 'ARB', 'OP', 'SUI', 'BNB', 'TRX', 'TON', 'NEAR', 'APT']);

function extractCurrencies(categories: string, tags: string, title: string): string[] {
  const all = [categories, tags].join('|').toUpperCase().split('|').map(s => s.trim());
  const found = all.filter(s => COMMON_COINS.has(s));
  // Also check title for $SYMBOL pattern
  const titleMatches = title.match(/\$([A-Z]{2,6})/g);
  if (titleMatches) {
    for (const m of titleMatches) found.push(m.replace('$', ''));
  }
  return Array.from(new Set(found));
}

function deriveSentiment(votes?: CPPost['votes']): 'bullish' | 'bearish' | 'neutral' | undefined {
  if (!votes) return undefined;
  const pos = votes.positive + votes.liked;
  const neg = votes.negative + votes.disliked + votes.toxic;
  if (pos > neg * 1.5) return 'bullish';
  if (neg > pos * 1.5) return 'bearish';
  return 'neutral';
}

/** Deduplicate by URL domain + title similarity */
function deduplicateArticles(articles: UnifiedNewsArticle[]): UnifiedNewsArticle[] {
  const seen = new Map<string, UnifiedNewsArticle>();
  for (const a of articles) {
    // Normalize title for comparison
    const normalTitle = a.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);
    if (!seen.has(normalTitle)) {
      seen.set(normalTitle, a);
    }
  }
  return Array.from(seen.values());
}

/* ─── Handler ────────────────────────────────────────────────── */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const filter = searchParams.get('filter') || 'all'; // all | hot | rising | bullish | bearish
  const currency = searchParams.get('currency') || '';
  const search = searchParams.get('search') || '';
  const perPage = 20;

  const cacheKey = `news:${filter}:${currency}:${page}:${search}`;
  const cached = getCached<{ articles: UnifiedNewsArticle[]; total: number }>(cacheKey);
  if (cached) {
    return NextResponse.json({
      articles: cached.articles,
      meta: { total: cached.total, page, perPage, cached: true },
    });
  }

  // Fetch from both sources in parallel
  const [ccArticles, cpArticles] = await Promise.all([
    fetchCryptoCompare(currency || undefined),
    fetchCryptoPanic(filter, currency || undefined),
  ]);

  // Merge and deduplicate
  let merged = deduplicateArticles([...cpArticles, ...ccArticles]);

  // Sort by publish time (newest first)
  merged.sort((a, b) => b.publishedAt - a.publishedAt);

  // Apply search filter
  if (search) {
    const q = search.toLowerCase();
    merged = merged.filter(a =>
      a.title.toLowerCase().includes(q) ||
      a.currencies.some(c => c.toLowerCase() === q) ||
      a.source.toLowerCase().includes(q)
    );
  }

  // Apply sentiment filter from CryptoPanic
  if (filter === 'bullish') merged = merged.filter(a => a.sentiment === 'bullish');
  if (filter === 'bearish') merged = merged.filter(a => a.sentiment === 'bearish');

  const total = merged.length;
  const start = (page - 1) * perPage;
  const articles = merged.slice(start, start + perPage);

  // Compute trending coins
  const coinCounts = new Map<string, number>();
  for (const a of merged) {
    for (const c of a.currencies) {
      coinCounts.set(c, (coinCounts.get(c) || 0) + 1);
    }
  }
  const trending = Array.from(coinCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([symbol, count]) => ({ symbol, count }));

  const result = { articles, total };
  setCache(cacheKey, result);

  return NextResponse.json({
    articles,
    meta: {
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
      trending,
      hasCryptoPanic: cpArticles.length > 0,
    },
  });
}
