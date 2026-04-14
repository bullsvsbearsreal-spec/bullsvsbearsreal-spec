import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
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

export type SourceType = 'news' | 'exchange' | 'blog' | 'aggregator';

export type NewsCategory = 'listing' | 'regulatory' | 'hack' | 'macro' | 'partnership' | 'funding-round' | 'airdrop' | 'defi' | 'general';

export interface UnifiedNewsArticle {
  id: string;
  title: string;
  body?: string;
  url: string;
  imageUrl?: string;
  source: string;
  sourceType: SourceType;
  publishedAt: number;
  categories: string[];
  currencies: string[];
  sentiment?: 'bullish' | 'bearish' | 'neutral';
  votes?: { positive: number; negative: number };
  origin: 'cryptocompare' | 'cryptopanic' | 'rss';
  /** 1 = exchange announcement (market-moving), 2 = high-signal, 3 = standard news, 4 = aggregator */
  priority?: number;
  /** Auto-classified topic */
  newsCategory?: NewsCategory;
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

/* ─── RSS feed config ────────────────────────────────────────── */

const RSS_FEEDS: { url: string; name: string; type: SourceType; format?: 'atom' }[] = [
  // Major news outlets
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', name: 'CoinDesk', type: 'news' },
  { url: 'https://www.theblock.co/rss.xml', name: 'The Block', type: 'news' },
  { url: 'https://decrypt.co/feed', name: 'Decrypt', type: 'news' },
  { url: 'https://cointelegraph.com/rss', name: 'Cointelegraph', type: 'news' },
  { url: 'https://www.dlnews.com/arc/outboundfeeds/rss/', name: 'DL News', type: 'news' },
  { url: 'https://blockworks.co/feed', name: 'Blockworks', type: 'news', format: 'atom' },
  { url: 'https://bitcoinmagazine.com/.rss/full/', name: 'Bitcoin Magazine', type: 'news' },
  { url: 'https://cryptoslate.com/feed/', name: 'CryptoSlate', type: 'news' },
  { url: 'https://beincrypto.com/feed/', name: 'BeInCrypto', type: 'news' },
  { url: 'https://news.bitcoin.com/feed/', name: 'Bitcoin.com', type: 'news' },
  { url: 'https://u.today/rss', name: 'U.Today', type: 'news' },
  { url: 'https://bitcoinist.com/feed/', name: 'Bitcoinist', type: 'news' },
  { url: 'https://cryptopotato.com/feed/', name: 'CryptoPotato', type: 'news' },
  { url: 'https://ambcrypto.com/feed/', name: 'AMBCrypto', type: 'news' },
  { url: 'https://www.newsbtc.com/feed/', name: 'NewsBTC', type: 'news' },
  { url: 'https://cryptobriefing.com/feed/', name: 'Crypto Briefing', type: 'news' },
  // High-signal / Tree-of-Alpha-style sources
  { url: 'https://watcher.guru/news/feed/', name: 'Watcher Guru', type: 'news' },
  { url: 'https://protos.com/feed/', name: 'Protos', type: 'news' },
  { url: 'https://unchainedcrypto.com/feed/', name: 'Unchained', type: 'news' },
  { url: 'https://www.bitmex.com/feed', name: 'BitMEX Research', type: 'exchange' },
  // Exchange blogs
  { url: 'https://blog.kraken.com/feed/', name: 'Kraken', type: 'exchange' },
  { url: 'https://blog.mexc.com/feed/', name: 'MEXC', type: 'exchange' },
  { url: 'https://blog.deribit.com/feed/', name: 'Deribit', type: 'exchange' },
  // Blogs / analysis
  { url: 'https://blog.chainalysis.com/feed/', name: 'Chainalysis', type: 'blog' },
  { url: 'https://www.thedefiant.io/feed', name: 'The Defiant', type: 'blog' },
];

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
  if (cache.size > 500) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
}

/* ─── Fetch CryptoCompare ────────────────────────────────────── */

async function fetchCryptoCompare(currency?: string): Promise<UnifiedNewsArticle[]> {
  try {
    const params = new URLSearchParams({ lang: 'EN', sortOrder: 'latest' });
    if (currency) params.set('categories', currency.toUpperCase());
    const res = await fetch(`https://min-api.cryptocompare.com/data/v2/news/?${params}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const articles: CCArticle[] = data.Data || [];

    return articles
      .filter(a => a.published_on && !isNaN(a.published_on) && a.published_on > 0)
      .map(a => ({
        id: `cc-${a.id}`,
        title: a.title,
        body: a.body?.substring(0, 300),
        url: a.url,
        imageUrl: a.imageurl,
        source: a.source_info?.name || a.source,
        sourceType: 'aggregator' as SourceType,
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
      sourceType: 'aggregator' as SourceType,
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

/* ─── Fetch RSS feeds ────────────────────────────────────────── */

/** Lightweight RSS/Atom XML parser — no dependencies */
function parseFeedItems(xml: string, feedName: string, feedType: SourceType): UnifiedNewsArticle[] {
  // Auto-detect: Atom uses <entry>, RSS uses <item>
  const isAtom = /<feed[\s>]/i.test(xml) && /<entry[\s>]/i.test(xml);
  return isAtom
    ? parseAtomEntries(xml, feedName, feedType)
    : parseRSSItems(xml, feedName, feedType);
}

function parseRSSItems(xml: string, feedName: string, feedType: SourceType): UnifiedNewsArticle[] {
  const items: UnifiedNewsArticle[] = [];
  const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link') || extractAttr(block, 'link', 'href');
    const pubDate = extractTag(block, 'pubDate') || extractTag(block, 'dc:date');
    const description = extractTag(block, 'description') || extractTag(block, 'content:encoded');
    const mediaUrl = extractAttr(block, 'media:content', 'url')
      || extractAttr(block, 'media:thumbnail', 'url')
      || extractAttr(block, 'enclosure', 'url');

    if (!title || !link) continue;

    const publishedAt = pubDate ? Math.floor(new Date(pubDate).getTime() / 1000) : Math.floor(Date.now() / 1000);
    if (isNaN(publishedAt) || publishedAt > Date.now() / 1000 + 3600) continue;

    items.push({
      id: `rss-${feedName.toLowerCase().replace(/\s/g, '')}-${hashTitle(title)}`,
      title: decodeHTMLEntities(title),
      body: description ? decodeHTMLEntities(stripHTML(description)).substring(0, 300) : undefined,
      url: link,
      imageUrl: mediaUrl || undefined,
      source: feedName,
      sourceType: feedType,
      publishedAt,
      categories: [],
      currencies: extractCurrenciesFromTitle(title),
      origin: 'rss' as const,
    });
  }

  return items;
}

/** Parse Atom <entry> blocks (used by Blockworks, etc.) */
function parseAtomEntries(xml: string, feedName: string, feedType: SourceType): UnifiedNewsArticle[] {
  const items: UnifiedNewsArticle[] = [];
  const entryRegex = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
  let match: RegExpExecArray | null;

  while ((match = entryRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTag(block, 'title');
    const link = extractAttr(block, 'link', 'href');
    const published = extractTag(block, 'published') || extractTag(block, 'updated');
    const summary = extractTag(block, 'summary') || extractTag(block, 'content');

    if (!title || !link) continue;

    const publishedAt = published ? Math.floor(new Date(published).getTime() / 1000) : Math.floor(Date.now() / 1000);
    if (isNaN(publishedAt) || publishedAt > Date.now() / 1000 + 3600) continue;

    items.push({
      id: `rss-${feedName.toLowerCase().replace(/\s/g, '')}-${hashTitle(title)}`,
      title: decodeHTMLEntities(title),
      body: summary ? decodeHTMLEntities(stripHTML(summary)).substring(0, 300) : undefined,
      url: link,
      source: feedName,
      sourceType: feedType,
      publishedAt,
      categories: [],
      currencies: extractCurrenciesFromTitle(title),
      origin: 'rss' as const,
    });
  }

  return items;
}

function extractTag(xml: string, tag: string): string | null {
  // Handle CDATA: <tag><![CDATA[content]]></tag>
  const cdataRegex = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, 'i');
  const cdataMatch = cdataRegex.exec(xml);
  if (cdataMatch) return cdataMatch[1].trim();

  // Handle regular: <tag>content</tag>
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = regex.exec(xml);
  return match ? match[1].trim() : null;
}

function extractAttr(xml: string, tag: string, attr: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i');
  const match = regex.exec(xml);
  return match ? match[1] : null;
}

function stripHTML(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#8217;/g, "\u2019")
    .replace(/&#8216;/g, "\u2018")
    .replace(/&#8220;/g, "\u201C")
    .replace(/&#8221;/g, "\u201D")
    .replace(/&#8211;/g, "\u2013")
    .replace(/&#8212;/g, "\u2014");
}

function hashTitle(title: string): string {
  // Simple hash for dedup IDs
  let h = 0;
  for (let i = 0; i < title.length; i++) {
    h = ((h << 5) - h + title.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

/* ─── Fetch Binance announcements (listing firehose) ────────── */

interface BinanceArticle {
  id: number;
  code: string;
  title: string;
  releaseDate: number;
}

async function fetchBinanceAnnouncements(): Promise<UnifiedNewsArticle[]> {
  const cached = getCached<UnifiedNewsArticle[]>('binance-announcements');
  if (cached) return cached;

  // Catalog IDs: 48 = New Listings, 49 = Latest News, 161 = Airdrops
  const catalogs = [
    { id: 48, label: 'Listings' },
    { id: 49, label: 'Latest' },
  ];

  const all: UnifiedNewsArticle[] = [];
  await Promise.all(
    catalogs.map(async ({ id, label }) => {
      try {
        const res = await fetch(
          `https://www.binance.com/bapi/composite/v1/public/cms/article/list/query?type=1&catalogId=${id}&pageNo=1&pageSize=15`,
          {
            signal: AbortSignal.timeout(6000),
            headers: { 'User-Agent': 'Mozilla/5.0 InfoHub/1.0' },
          },
        );
        if (!res.ok) return;
        const json = await res.json();
        const articles: BinanceArticle[] = json?.data?.catalogs?.[0]?.articles || [];
        for (const a of articles) {
          all.push({
            id: `binance-ann-${a.id}`,
            title: a.title,
            url: `https://www.binance.com/en/support/announcement/${a.code}`,
            source: `Binance ${label}`,
            sourceType: 'exchange',
            publishedAt: Math.floor(a.releaseDate / 1000),
            categories: [label.toLowerCase()],
            currencies: extractCurrenciesFromTitle(a.title),
            origin: 'rss' as const,
          });
        }
      } catch (err) {
        console.error(`Binance announcement fetch error (${label}):`, err);
      }
    }),
  );

  setCache('binance-announcements', all);
  return all;
}

/* ─── OKX Announcements ─────────────────────────────────────── */

async function fetchOKXAnnouncements(): Promise<UnifiedNewsArticle[]> {
  const cached = getCached<UnifiedNewsArticle[]>('okx-announcements');
  if (cached) return cached;

  const all: UnifiedNewsArticle[] = [];
  try {
    const res = await fetch(
      'https://www.okx.com/v2/support/home/web/announcement?page=1&annType=all',
      {
        signal: AbortSignal.timeout(6000),
        headers: { 'User-Agent': 'Mozilla/5.0 InfoHub/1.0' },
      },
    );
    if (!res.ok) { setCache('okx-announcements', all); return all; }
    const json = await res.json();
    const items: any[] = json?.data?.notices || json?.data?.announcements || [];
    for (const item of items.slice(0, 20)) {
      const title = item.title || item.annTitle || '';
      const id = item.annId || item.id || hashTitle(title);
      const pubTime = item.pTime || item.publishTime || item.publishDate || 0;
      const publishedAt = typeof pubTime === 'number'
        ? (pubTime > 1e12 ? Math.floor(pubTime / 1000) : pubTime)
        : Math.floor(new Date(pubTime).getTime() / 1000);
      if (!title || isNaN(publishedAt) || publishedAt <= 0) continue;
      all.push({
        id: `okx-ann-${id}`,
        title: decodeHTMLEntities(title),
        url: `https://www.okx.com/support/hc/announcements/${id}`,
        source: 'OKX',
        sourceType: 'exchange',
        publishedAt,
        categories: ['announcement'],
        currencies: extractCurrenciesFromTitle(title),
        origin: 'rss' as const,
      });
    }
  } catch (err) {
    console.error('OKX announcement fetch error:', err);
  }

  setCache('okx-announcements', all);
  return all;
}

/* ─── Bybit Announcements ───────────────────────────────────── */

async function fetchBybitAnnouncements(): Promise<UnifiedNewsArticle[]> {
  const cached = getCached<UnifiedNewsArticle[]>('bybit-announcements');
  if (cached) return cached;

  const all: UnifiedNewsArticle[] = [];
  try {
    const res = await fetch(
      'https://api.bybit.com/v5/announcements/index?locale=en-US&limit=20',
      {
        signal: AbortSignal.timeout(6000),
        headers: { 'User-Agent': 'Mozilla/5.0 InfoHub/1.0' },
      },
    );
    if (!res.ok) { setCache('bybit-announcements', all); return all; }
    const json = await res.json();
    const items: any[] = json?.result?.list || [];
    for (const item of items) {
      const title = item.title || '';
      const id = item.announcementId || item.id || hashTitle(title);
      const pubTime = item.publishTime || item.dateTimestamp || 0;
      const publishedAt = typeof pubTime === 'number'
        ? (pubTime > 1e12 ? Math.floor(pubTime / 1000) : pubTime)
        : Math.floor(new Date(pubTime).getTime() / 1000);
      if (!title || isNaN(publishedAt) || publishedAt <= 0) continue;
      all.push({
        id: `bybit-ann-${id}`,
        title: decodeHTMLEntities(title),
        url: item.url || `https://announcements.bybit.com/article/${item.slug || id}`,
        source: 'Bybit',
        sourceType: 'exchange',
        publishedAt,
        categories: [item.type?.title?.toLowerCase() || 'announcement'],
        currencies: extractCurrenciesFromTitle(title),
        origin: 'rss' as const,
      });
    }
  } catch (err) {
    console.error('Bybit announcement fetch error:', err);
  }

  setCache('bybit-announcements', all);
  return all;
}

/* ─── Bitget Announcements ──────────────────────────────────── */

async function fetchBitgetAnnouncements(): Promise<UnifiedNewsArticle[]> {
  const cached = getCached<UnifiedNewsArticle[]>('bitget-announcements');
  if (cached) return cached;

  const all: UnifiedNewsArticle[] = [];
  try {
    // Bitget public announcement endpoint — annType: new_listing(6), latest(1)
    const res = await fetch(
      'https://api.bitget.com/api/v2/public/annoucements?language=en_US&annType=all&pageNo=1&pageSize=20',
      {
        signal: AbortSignal.timeout(6000),
        headers: { 'User-Agent': 'Mozilla/5.0 InfoHub/1.0' },
      },
    );
    if (!res.ok) { setCache('bitget-announcements', all); return all; }
    const json = await res.json();
    const items: any[] = json?.data?.items || json?.data || [];
    for (const item of items.slice(0, 20)) {
      const title = item.annTitle || item.title || '';
      const id = item.annId || item.id || hashTitle(title);
      const pubTime = item.annTime || item.cTime || item.publishTime || 0;
      const publishedAt = typeof pubTime === 'number'
        ? (pubTime > 1e12 ? Math.floor(pubTime / 1000) : pubTime)
        : Math.floor(new Date(pubTime).getTime() / 1000);
      if (!title || isNaN(publishedAt) || publishedAt <= 0) continue;
      all.push({
        id: `bitget-ann-${id}`,
        title: decodeHTMLEntities(title),
        url: item.annUrl || `https://www.bitget.com/support/articles/${id}`,
        source: 'Bitget',
        sourceType: 'exchange',
        publishedAt,
        categories: ['announcement'],
        currencies: extractCurrenciesFromTitle(title),
        origin: 'rss' as const,
      });
    }
  } catch (err) {
    console.error('Bitget announcement fetch error:', err);
  }

  setCache('bitget-announcements', all);
  return all;
}

async function fetchRSSFeeds(): Promise<UnifiedNewsArticle[]> {
  const cached = getCached<UnifiedNewsArticle[]>('rss-raw');
  if (cached) return cached;

  const results = await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      try {
        const res = await fetch(feed.url, {
          signal: AbortSignal.timeout(5000),
          headers: { 'User-Agent': 'InfoHub/1.0 (news aggregator)' },
        });
        if (!res.ok) return [];
        const xml = await res.text();
        return parseFeedItems(xml, feed.name, feed.type);
      } catch (err) {
        console.error(`RSS fetch error (${feed.name}):`, err);
        return [];
      }
    })
  );

  const articles = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  setCache('rss-raw', articles);
  return articles;
}

/* ─── Helpers ────────────────────────────────────────────────── */

const COMMON_COINS = new Set([
  // Top 20 by mcap
  'BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'DOT', 'LINK', 'UNI',
  'BNB', 'TRX', 'TON', 'NEAR', 'APT', 'SUI', 'HBAR', 'BCH', 'LTC', 'XLM',
  // L2s & infra
  'MATIC', 'ARB', 'OP', 'SEI', 'TIA', 'STRK', 'ZK', 'EIGEN', 'MANTA', 'BLAST',
  // DeFi
  'AAVE', 'MKR', 'LDO', 'CRV', 'PENDLE', 'ENA', 'COMP', 'SNX', 'DYDX',
  'GMX', 'JUP', 'RAY', 'ONDO', 'ETHFI',
  // AI & compute
  'RENDER', 'FET', 'TAO', 'AKT', 'IO', 'GRASS',
  // Memecoins
  'WIF', 'PEPE', 'BONK', 'SHIB', 'FLOKI', 'FARTCOIN', 'POPCAT', 'BOME', 'PENGU',
  // Gaming & social
  'IMX', 'GALA', 'AXS', 'SAND', 'MANA',
  // Perp DEXs tracked by InfoHub
  'HYPE', 'INJ', 'DRIFT', 'AEVO',
]);

function extractCurrencies(categories: string, tags: string, title: string): string[] {
  const all = [categories, tags].join('|').toUpperCase().split('|').map(s => s.trim());
  const found = all.filter(s => COMMON_COINS.has(s));
  // Also check title for $SYMBOL pattern and direct mentions
  addTitleMentions(title, found);
  return Array.from(new Set(found));
}

function extractCurrenciesFromTitle(title: string): string[] {
  const found: string[] = [];
  addTitleMentions(title, found);
  return Array.from(new Set(found));
}

function addTitleMentions(title: string, found: string[]): void {
  // $SYMBOL pattern (e.g. "$BTC", "$ETH")
  const dollarMatches = title.match(/\$([A-Z]{2,6})/g);
  if (dollarMatches) {
    for (const m of dollarMatches) {
      const sym = m.replace('$', '');
      if (COMMON_COINS.has(sym)) found.push(sym);
    }
  }
  // (SYMBOL) pattern — common in exchange listing announcements
  const parenMatches = title.match(/\(([A-Z]{2,6})\)/g);
  if (parenMatches) {
    for (const m of parenMatches) {
      const sym = m.replace(/[()]/g, '');
      if (COMMON_COINS.has(sym)) found.push(sym);
    }
  }
  // SYMBOL/USDT or SYMBOL/USD pattern — common in trading pair announcements
  const pairMatches = title.match(/\b([A-Z]{2,6})\/(?:USDT|USD|USDC|BTC|ETH)\b/g);
  if (pairMatches) {
    for (const m of pairMatches) {
      const sym = m.split('/')[0];
      if (COMMON_COINS.has(sym)) found.push(sym);
    }
  }
  // Direct word mentions: "Bitcoin" → BTC, "Ethereum" → ETH, etc.
  const nameMap: Record<string, string> = {
    bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL', ripple: 'XRP', dogecoin: 'DOGE',
    cardano: 'ADA', avalanche: 'AVAX', polkadot: 'DOT', chainlink: 'LINK',
    uniswap: 'UNI', arbitrum: 'ARB', optimism: 'OP', celestia: 'TIA',
    jupiter: 'JUP', aave: 'AAVE', pendle: 'PENDLE', injective: 'INJ',
    hyperliquid: 'HYPE', litecoin: 'LTC', toncoin: 'TON', tron: 'TRX',
    hedera: 'HBAR', aptos: 'APT', sui: 'SUI', pepe: 'PEPE', bonk: 'BONK',
    render: 'RENDER', worldcoin: 'WLD', mantle: 'MNT', starknet: 'STRK',
    shiba: 'SHIB', floki: 'FLOKI', immutable: 'IMX', near: 'NEAR',
    maker: 'MKR', compound: 'COMP', synthetix: 'SNX', ondo: 'ONDO',
    eigenlayer: 'EIGEN', ethena: 'ENA', drift: 'DRIFT',
  };
  const lower = title.toLowerCase();
  for (const [name, sym] of Object.entries(nameMap)) {
    if (lower.includes(name)) found.push(sym);
  }
}

/* ─── Source priority (1 = highest signal, 4 = lowest) ────────── */

const SOURCE_PRIORITY: Record<string, number> = {
  // Exchange announcements — priority 1 (market-moving)
  'Binance Listings': 1, 'Binance Latest': 1, 'OKX': 1, 'Bybit': 1, 'Bitget': 1,
  // High-signal sources — priority 2
  'The Block': 2, 'CoinDesk': 2, 'Blockworks': 2, 'DL News': 2, 'Unchained': 2,
  'BitMEX Research': 2, 'Chainalysis': 2, 'Watcher Guru': 2, 'Protos': 2,
  // Exchange blogs — priority 2
  'Kraken': 2, 'MEXC': 2, 'Deribit': 2,
};

function getSourcePriority(source: string, sourceType: SourceType): number {
  if (SOURCE_PRIORITY[source]) return SOURCE_PRIORITY[source];
  if (sourceType === 'exchange') return 1;
  if (sourceType === 'blog') return 3;
  if (sourceType === 'aggregator') return 4;
  return 3; // standard news
}

/* ─── Auto-categorization ──────────────────────────────────────── */

const CATEGORY_PATTERNS: [NewsCategory, RegExp][] = [
  ['listing', /\b(list(?:ing|ed|s)|delist|perpetual.*launch|new.*(?:pair|market|trading)|adds?\s+\w+\/|futures?\s+launch)\b/i],
  ['regulatory', /\b(sec |cftc|regul|lawsuit|fine[sd]|ban[ns]?|compliance|sanction|subpoena|enforce|approval|etf\b|spot.*etf)\b/i],
  ['hack', /\b(hack|exploit|breach|drain|stolen|vulnerability|rug\s*pull|flash.*loan.*attack)\b/i],
  ['macro', /\b(fed\b|fomc|cpi\b|inflation|interest.*rate|gdp\b|payroll|unemployment|treasury|tariff)\b/i],
  ['partnership', /\b(partner|collaborat|integrat(?:ion|e)|team.*up|alliance|deal\b)\b/i],
  ['funding-round', /\b(raise[sd]?|funding.*round|series\s+[a-d]|venture|seed\s+round|valuation|invest(?:ment|or))\b/i],
  ['airdrop', /\b(airdrop|token.*distribut|claim.*token|reward.*distribut)\b/i],
  ['defi', /\b(defi|tvl|yield|liquidity|amm|dex\b|lending|staking|restaking|lsd\b)\b/i],
];

function classifyArticle(title: string): NewsCategory {
  for (const [category, pattern] of CATEGORY_PATTERNS) {
    if (pattern.test(title)) return category;
  }
  return 'general';
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

/* ─── Time range filter ──────────────────────────────────────── */

const TIME_RANGES: Record<string, number> = {
  '1h': 3600,
  '24h': 86400,
  '7d': 604800,
  '30d': 2592000,
};

/* ─── Macro Events ───────────────────────────────────────────── */

interface MacroEvent {
  title: string;
  date: string; // ISO date
  time?: string; // e.g. "13:30 UTC"
  impact: 'high' | 'medium' | 'low';
}

async function fetchMacroEvents(): Promise<MacroEvent[]> {
  const cached = getCached<MacroEvent[]>('macro-events');
  if (cached) return cached;

  try {
    const res = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();

    // Filter to high-impact events only
    interface RawForexEvent { title?: string; event?: string; date?: string; impact?: string; country?: string; actual?: string; forecast?: string; previous?: string }
    const events: MacroEvent[] = (data as RawForexEvent[])
      .filter((e) => e.impact === 'High' || e.impact === 'Medium')
      .slice(0, 10)
      .map((e) => ({
        title: e.title || e.event || '',
        date: e.date || '',
        time: e.date ? new Date(e.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC' : undefined,
        impact: (e.impact === 'High' ? 'high' : 'medium') as 'high' | 'medium',
      }));

    setCache('macro-events', events);
    return events;
  } catch (err) {
    console.error('Macro events fetch error:', err);
    return [];
  }
}

/* ─── Handler ────────────────────────────────────────────────── */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const filter = searchParams.get('filter') || 'all'; // all | hot | rising | bullish | bearish
  const currency = searchParams.get('currency') || '';
  const search = searchParams.get('search') || '';
  const timeRange = searchParams.get('timeRange') || 'all';
  const sourceType = searchParams.get('sourceType') || 'all'; // all | news | exchange | blog | aggregator
  const perPage = 20;

  const cacheKey = `news:${filter}:${currency}:${page}:${search}:${timeRange}:${sourceType}`;
  const cached = getCached<{ articles: UnifiedNewsArticle[]; total: number; trending: { symbol: string; count: number }[]; sources: string[] }>(cacheKey);
  if (cached) {
    return NextResponse.json({
      articles: cached.articles,
      meta: {
        total: cached.total,
        page,
        perPage,
        totalPages: Math.ceil(cached.total / perPage),
        trending: cached.trending,
        hasCryptoPanic: true,
        sources: cached.sources,
        cached: true,
      },
    });
  }

  // Fetch from all sources in parallel
  const [ccArticles, cpArticles, rssArticles, binanceAnn, okxAnn, bybitAnn, bitgetAnn, macroEvents] = await Promise.all([
    fetchCryptoCompare(currency || undefined),
    fetchCryptoPanic(filter, currency || undefined),
    fetchRSSFeeds(),
    fetchBinanceAnnouncements(),
    fetchOKXAnnouncements(),
    fetchBybitAnnouncements(),
    fetchBitgetAnnouncements(),
    fetchMacroEvents(),
  ]);

  // Merge and deduplicate (exchange announcements first — highest signal, market-moving)
  let merged = deduplicateArticles([...binanceAnn, ...okxAnn, ...bybitAnn, ...bitgetAnn, ...cpArticles, ...rssArticles, ...ccArticles]);

  // Assign priority and auto-classify
  for (const article of merged) {
    article.priority = getSourcePriority(article.source, article.sourceType);
    article.newsCategory = classifyArticle(article.title);
  }

  // Sort by priority ASC (highest signal first), then publishedAt DESC (newest first)
  merged.sort((a, b) => {
    const pa = a.priority ?? 3;
    const pb = b.priority ?? 3;
    if (pa !== pb) return pa - pb;
    return b.publishedAt - a.publishedAt;
  });

  // Apply time range filter
  if (timeRange !== 'all' && TIME_RANGES[timeRange]) {
    const cutoff = Math.floor(Date.now() / 1000) - TIME_RANGES[timeRange];
    merged = merged.filter(a => a.publishedAt >= cutoff);
  }

  // Apply source type filter
  if (sourceType !== 'all') {
    merged = merged.filter(a => a.sourceType === sourceType);
  }

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

  // Collect active source names
  const sourceSet = new Set<string>();
  sourceSet.add('CryptoCompare');
  if (cpArticles.length > 0) sourceSet.add('CryptoPanic');
  for (const feed of RSS_FEEDS) {
    if (rssArticles.some(a => a.source === feed.name)) sourceSet.add(feed.name);
  }
  for (const a of [...binanceAnn, ...okxAnn, ...bybitAnn, ...bitgetAnn]) sourceSet.add(a.source);
  const sources = Array.from(sourceSet);

  const result = { articles, total, trending, sources, macroEvents };
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
      sources,
      macroEvents,
    },
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  });
}
