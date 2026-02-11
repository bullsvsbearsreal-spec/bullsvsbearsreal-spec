// Crypto Events API integration
// Uses CryptoCompare News API (free) for real news data
// CoinMarketCal API requires paid subscription - uses mock data as fallback

const CRYPTOCOMPARE_NEWS_API = 'https://min-api.cryptocompare.com/data/v2/news';
const COINMARKETCAL_API = 'https://developers.coinmarketcal.com/v1';

// Optional API key for CoinMarketCal (paid service)
const COINMARKETCAL_API_KEY = process.env.NEXT_PUBLIC_COINMARKETCAL_API_KEY || '';

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
}

// Fetch REAL crypto news from CryptoCompare (FREE API)
export async function fetchCryptoNews(limit: number = 20): Promise<NewsArticle[]> {
  const cacheKey = `news:${limit}`;
  const cached = getCached<NewsArticle[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(
      `${CRYPTOCOMPARE_NEWS_API}/?lang=EN&sortOrder=popular`,
      { next: { revalidate: 300 } }
    );

    if (response.ok) {
      const data = await response.json();
      const articles = (data.Data || []).slice(0, limit);
      setCache(cacheKey, articles);
      return articles;
    }
  } catch (error) {
    console.error('CryptoCompare News API error:', error);
  }
  return [];
}

// Fetch news for a specific coin category
export async function fetchCoinNews(coinSymbol: string, limit: number = 10): Promise<NewsArticle[]> {
  const cacheKey = `news:${coinSymbol}:${limit}`;
  const cached = getCached<NewsArticle[]>(cacheKey);
  if (cached) return cached;

  try {
    // CryptoCompare uses categories for filtering
    const categories = coinSymbol.toUpperCase();
    const response = await fetch(
      `${CRYPTOCOMPARE_NEWS_API}/?categories=${categories}&lang=EN&sortOrder=latest`,
      { next: { revalidate: 300 } }
    );

    if (response.ok) {
      const data = await response.json();
      const articles = (data.Data || []).slice(0, limit);
      setCache(cacheKey, articles);
      return articles;
    }
  } catch (error) {
    console.error('CryptoCompare News API error:', error);
  }

  // Fallback to general news if coin-specific fails
  return fetchCryptoNews(limit);
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

  // Generate events from news as fallback
  const news = await fetchCoinNews(coinId, 5);
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
    const categories = article.categories?.split('|') || ['News'];
    const tags = article.tags?.split('|') || [];

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
      description: article.body?.substring(0, 200) + '...' || article.title,
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
