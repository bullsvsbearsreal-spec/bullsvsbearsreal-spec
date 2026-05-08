// Crypto Events API integration
// Uses CryptoCompare News API (free) for real news data
// CoinMarketCal API requires paid subscription - uses mock data as fallback

const CRYPTOCOMPARE_NEWS_API = 'https://min-api.cryptocompare.com/data/v2/news';
const COINMARKETCAL_API = 'https://developers.coinmarketcal.com/v1';

// Optional API key for CoinMarketCal (paid service)
const COINMARKETCAL_API_KEY = process.env.COINMARKETCAL_API_KEY || '';

export interface CryptoEvent {
  id: number;
  title: string;
  coins: {
    id: string;
    name: string;
    symbol: string;
    rank: number;
  }[];
  date_event: string;
  created_date: string;
  description: string;
  proof: string;
  source: string;
  is_hot: boolean;
  vote_count: number;
  positive_vote_count: number;
  percentage: number;
  categories: {
    id: number;
    name: string;
  }[];
}

export interface NewsArticle {
  id: string;
  title: string;
  body: string;
  url: string;
  imageurl: string;
  source: string;
  source_info: {
    name: string;
    img: string;
  };
  published_on: number;
  categories: string;
  tags: string;
}

export interface EventCategory {
  id: number;
  name: string;
}

// Event categories
export const EVENT_CATEGORIES = {
  EXCHANGE: { id: 1, name: 'Exchange', icon: '🏦' },
  AIRDROP: { id: 2, name: 'Airdrop', icon: '🎁' },
  RELEASE: { id: 3, name: 'Release', icon: '🚀' },
  UPDATE: { id: 4, name: 'Update', icon: '⬆️' },
  PARTNERSHIP: { id: 5, name: 'Partnership', icon: '🤝' },
  BURN: { id: 6, name: 'Burn', icon: '🔥' },
  CONFERENCE: { id: 7, name: 'Conference', icon: '🎤' },
  MEETUP: { id: 8, name: 'Meetup', icon: '👥' },
  HARDFORK: { id: 9, name: 'Hard Fork', icon: '🍴' },
  ICO: { id: 10, name: 'ICO', icon: '💰' },
  COMMUNITY: { id: 11, name: 'Community', icon: '🌐' },
  REBRANDING: { id: 12, name: 'Rebranding', icon: '✨' },
  STAKING: { id: 13, name: 'Staking', icon: '💎' },
  AMA: { id: 14, name: 'AMA', icon: '❓' },
  TOKENOMICS: { id: 15, name: 'Tokenomics', icon: '📊' },
  UNLOCK: { id: 16, name: 'Token Unlock', icon: '🔓' },
  NEWS: { id: 17, name: 'News', icon: '📰' },
};

// Cache for API responses
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 300000; // 5 minutes

function getCached<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }
  return null;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
  if (cache.size > 500) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
}

// Fetch REAL crypto news. Historically used CryptoCompare's public API but
// they started requiring an API key in 2025 which also blocks browser CORS
// with a generic "Failed to fetch". We now route through our own
// `/api/news` aggregator (which already handles 21+ sources server-side).
// Returned objects are mapped into the CryptoCompare NewsArticle shape so
// existing callers (homepage widget) don't need to change.
export async function fetchCryptoNews(limit: number = 20): Promise<NewsArticle[]> {
  const cacheKey = `news:${limit}`;
  const cached = getCached<NewsArticle[]>(cacheKey);
  if (cached) return cached;

  try {
    // Use a relative URL client-side; for server-side (SSR/prerender) use an
    // absolute URL so fetch doesn't error with "Only absolute URLs supported".
    const base = typeof window === 'undefined'
      ? (process.env.NEXT_PUBLIC_BASE_URL || 'https://info-hub.io')
      : '';
    const response = await fetch(`${base}/api/news?limit=${limit}`, {
      next: { revalidate: 300 },
    });
    if (!response.ok) return [];

    const data = await response.json();
    const src: Array<{
      id?: string; title?: string; url?: string; source?: string;
      publishedAt?: number; categories?: string; currencies?: string;
    }> = Array.isArray(data?.articles) ? data.articles : [];

    const articles: NewsArticle[] = src.slice(0, limit).map((a, i) => ({
      id: a.id ?? `infohub-${i}`,
      title: a.title ?? '',
      body: '',                        // not stored by our aggregator
      url: a.url ?? '',
      imageurl: '',                    // ditto
      source: a.source ?? 'InfoHub',
      source_info: { name: a.source ?? 'InfoHub', img: '' },
      published_on: a.publishedAt ?? Math.floor(Date.now() / 1000),
      categories: a.categories ?? '',
      tags: a.currencies ?? '',
    }));

    setCache(cacheKey, articles);
    return articles;
  } catch (error) {
    console.error('fetchCryptoNews proxy error:', error);
  }
  return [];
}

// Coerce a field that "should" be a pipe-separated string to one — handles
// upstream feeds that occasionally return an array of strings instead.
function toStringField(v: unknown): string {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.filter(x => typeof x === 'string').join('|');
  return '';
}

// Check if a news article is actually relevant to the searched coin symbol
/**
 * Decides whether a news article should appear on a per-coin page.
 *
 * Sources of truth (any one is enough):
 *   1. Symbol or "$SYMBOL" appears in the title
 *   2. Symbol appears as an exact tag (pipe-separated)
 *   3. Symbol appears as an exact category (pipe-separated)
 *   4. Symbol appears in the first 500 chars of the body, with word
 *      boundaries (\b) so "ENA" does NOT match inside "ARENA".
 *
 * The word-boundary check is load-bearing — without it, /coin/ENA
 * would surface unrelated arena/marina articles as if they were
 * Ethena news.
 */
export function isArticleRelevant(article: NewsArticle, symbol: string): boolean {
  const sym = symbol.toUpperCase();

  // Check title (most important signal)
  const title = toStringField(article.title).toUpperCase();
  if (title.includes(sym) || title.includes(`$${sym}`)) return true;

  // Check tags (pipe-separated; some feeds send an array — coerce safely)
  const tags = toStringField(article.tags).toUpperCase();
  const tagList = tags.split('|').map(t => t.trim());
  if (tagList.includes(sym)) return true;

  // Check categories (pipe-separated)
  const cats = toStringField(article.categories).toUpperCase();
  const catList = cats.split('|').map(c => c.trim());
  if (catList.includes(sym)) return true;

  // Check body (first 500 chars to avoid false positives in long articles)
  // Use word boundary check to avoid partial matches (e.g., "ARENA" matching "ENA")
  const body = toStringField(article.body).substring(0, 500);
  const wordBoundaryRegex = new RegExp(`\\b${sym}\\b`, 'i');
  if (wordBoundaryRegex.test(body)) return true;

  return false;
}

// Fetch news for a specific coin, with client-side relevance filtering.
// Routes through our own /api/news aggregator and post-filters for symbol mentions.
export async function fetchCoinNews(coinSymbol: string, limit: number = 10): Promise<NewsArticle[]> {
  const cacheKey = `news:${coinSymbol}:${limit}`;
  const cached = getCached<NewsArticle[]>(cacheKey);
  if (cached) return cached;

  const symbol = coinSymbol.toUpperCase();

  try {
    // Pull a larger candidate pool from our aggregator so relevance filtering
    // has something to work with — the aggregator doesn't support per-coin filtering.
    const general = await fetchCryptoNews(80);
    const relevant = general.filter(a => isArticleRelevant(a, symbol));
    const result = relevant.slice(0, limit);
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('fetchCoinNews error:', error);
  }

  setCache(cacheKey, []);
  return [];
}

// Fetch events for a specific coin
export async function fetchCoinEvents(coinId: string): Promise<CryptoEvent[]> {
  const cacheKey = `events:${coinId}`;
  const cached = getCached<CryptoEvent[]>(cacheKey);
  if (cached) return cached;

  // Try CoinMarketCal API if key is available
  if (COINMARKETCAL_API_KEY) {
    try {
      const response = await fetch(
        `${COINMARKETCAL_API}/events?coins=${coinId}&max=20`,
        {
          headers: {
            'Accept': 'application/json',
            'x-api-key': COINMARKETCAL_API_KEY,
          },
          next: { revalidate: 300 },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.body && data.body.length > 0) {
          setCache(cacheKey, data.body);
          return data.body;
        }
      }
    } catch (error) {
      console.error('CoinMarketCal API error:', error);
    }
  }

  // Generate events from relevant news only — don't fake events from unrelated articles
  const news = await fetchCoinNews(coinId, 5);
  if (news.length === 0) {
    // No relevant news found — return empty, don't fake it
    setCache(cacheKey, []);
    return [];
  }
  const events = convertNewsToEvents(news, coinId);
  setCache(cacheKey, events);
  return events;
}

// Fetch upcoming events across all coins
export async function fetchUpcomingEvents(limit: number = 20): Promise<CryptoEvent[]> {
  const cacheKey = `upcoming:${limit}`;
  const cached = getCached<CryptoEvent[]>(cacheKey);
  if (cached) return cached;

  // Try CoinMarketCal API if key available
  if (COINMARKETCAL_API_KEY) {
    try {
      const response = await fetch(
        `${COINMARKETCAL_API}/events?max=${limit}&sortBy=hot_events`,
        {
          headers: {
            'Accept': 'application/json',
            'x-api-key': COINMARKETCAL_API_KEY,
          },
          next: { revalidate: 300 },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.body && data.body.length > 0) {
          setCache(cacheKey, data.body);
          return data.body;
        }
      }
    } catch (error) {
      console.error('CoinMarketCal API error:', error);
    }
  }

  // Get real news and convert to events format
  const news = await fetchCryptoNews(limit);
  const events = convertNewsToEvents(news);
  setCache(cacheKey, events);
  return events;
}

// Convert news articles to event format for consistent display
function convertNewsToEvents(articles: NewsArticle[], coinId?: string): CryptoEvent[] {
  return articles.map((article, index) => {
    const publishedDate = new Date(article.published_on * 1000);
    // Defensive coercion: upstream sometimes returns arrays instead of pipe-strings.
    const catsStr = toStringField(article.categories);
    const tagsStr = toStringField(article.tags);
    const categories = catsStr ? catsStr.split('|').filter(Boolean) : ['News'];
    const tags = tagsStr ? tagsStr.split('|').filter(Boolean) : [];

    // Extract coin symbols from tags
    const coinSymbols = tags.filter(tag => tag.length <= 6 && tag === tag.toUpperCase());

    return {
      id: index + Date.now(),
      title: article.title,
      coins: coinSymbols.length > 0
        ? coinSymbols.map((s, i) => ({ id: String(i), name: s, symbol: s, rank: i + 1 }))
        : coinId
          ? [{ id: '1', name: coinId, symbol: coinId.toUpperCase(), rank: 1 }]
          : [{ id: '1', name: 'Crypto', symbol: 'CRYPTO', rank: 1 }],
      date_event: publishedDate.toISOString(),
      created_date: publishedDate.toISOString(),
      description: article.body ? article.body.substring(0, 200) + '...' : article.title,
      proof: article.url,
      source: article.source_info?.name || article.source || 'CryptoCompare',
      is_hot: false,
      vote_count: 0, // No vote data available from news source
      positive_vote_count: 0,
      percentage: 0, // No confidence score — derived from news, not community votes
      categories: [{ id: 17, name: categories[0] || 'News' }],
    };
  });
}

// Get category icon
export function getCategoryIcon(categoryName: string): string {
  const category = Object.values(EVENT_CATEGORIES).find(
    (c) => c.name.toLowerCase() === categoryName.toLowerCase()
  );
  return category?.icon || '📅';
}

// Format event date
export function formatEventDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays < -1 && diffDays > -7) return `${Math.abs(diffDays)} days ago`;
  if (diffDays < 0) return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (diffDays <= 7) return `In ${diffDays} days`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Format timestamp to relative time
export function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - (timestamp * 1000);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
