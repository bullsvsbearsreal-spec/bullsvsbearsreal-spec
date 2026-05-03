/**
 * GET /api/listings
 *
 * Exchange-listing tracker. Filters the news aggregator for listing-type
 * announcements (Binance Listings, Bybit, OKX, Coinbase, Upbit, Kraken, etc.)
 * and extracts ticker symbols from titles. Returns a compact stream a user
 * can scan to see what just got listed where.
 *
 * Upstream: our own /api/news (already aggregates 21+ exchange feeds).
 *
 * Cache: 60s.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

interface NewsArticle {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceType?: string;
  publishedAt: number;   // seconds
  categories?: string;
  currencies?: string;
  origin?: string;
  priority?: number;
  newsCategory?: string;
}

export interface ListingRow {
  id: string;
  title: string;
  url: string;
  exchange: string;
  tickers: string[];
  kind: 'spot' | 'perpetual' | 'futures' | 'earn' | 'delist' | 'other';
  publishedAt: number;
  ageMins: number;
}

interface ListingsResponse {
  data: ListingRow[];
  summary: {
    total: number;
    last24h: number;
    last7d: number;
    newestAgeMins: number | null;
    exchanges: Array<{ exchange: string; count: number }>;
  };
  meta: { timestamp: number; returned: number };
}

const cache = new Map<string, { body: ListingsResponse; ts: number }>();
const CACHE_TTL = 60_000;

// Known "listing" announcement sources we expect in the news feed
const LISTING_SOURCE_PATTERN = /(binance listings|binance futures|bybit|okx|coinbase|upbit|kraken|mexc|kucoin|htx|gate\.io|bitget|bingx|phemex|crypto\.com)/i;

// Keywords in title that confirm it's an actual listing action (not just an announcement)
const LISTING_TITLE_PATTERN = /\b(list|listing|launches|launched|launching|will add|will list|adds support|introduces|new trading pair|enables deposits|enables trading|spot trading|perpetual|perpetuals)\b/i;
const DELIST_TITLE_PATTERN = /\b(delist|delisting|will remove|discontinue|will suspend)\b/i;

// Extract tickers from title. Heuristics:
//   * Parenthesised tokens: "Chip (CHIP)" → CHIP
//   * All-caps words 2-10 chars (excluding common words)
const COMMON_UPPERCASE = new Set(['USD', 'USDT', 'USDC', 'NEW', 'PERP', 'ETF', 'AI', 'LIVE', 'TRADE', 'TRADING', 'VIP', 'IP', 'API']);

function extractTickers(title: string): string[] {
  const tickers = new Set<string>();
  // Parenthesised (X) capture
  const parens = title.match(/\(([A-Z][A-Z0-9]{1,9})\)/g);
  if (parens) {
    for (const p of parens) {
      const sym = p.replace(/[()]/g, '');
      if (!COMMON_UPPERCASE.has(sym)) tickers.add(sym);
    }
  }
  // "TICKER/USDT" or "TICKERUSDT" pattern
  const pairs = title.match(/\b([A-Z][A-Z0-9]{1,9})(?:USDT|\/USDT|USDC|\/USDC|PERP)\b/g);
  if (pairs) {
    for (const p of pairs) {
      const m = p.match(/^([A-Z][A-Z0-9]{1,9})/);
      if (m && !COMMON_UPPERCASE.has(m[1])) tickers.add(m[1]);
    }
  }
  return Array.from(tickers).slice(0, 5);
}

function classifyKind(title: string): ListingRow['kind'] {
  const t = title.toLowerCase();
  if (DELIST_TITLE_PATTERN.test(title)) return 'delist';
  if (/\bperpetual\b/i.test(t) || /\bperp\b/i.test(t)) return 'perpetual';
  if (/\bfutures\b/i.test(t)) return 'futures';
  if (/\b(earn|save|flexible saving|staking)\b/i.test(t)) return 'earn';
  if (/\bspot\b/i.test(t)) return 'spot';
  return 'other';
}

function normalizeExchangeSource(source: string): string {
  const s = source.toLowerCase();
  if (s.includes('binance futures')) return 'Binance Futures';
  if (s.includes('binance listings') || s.includes('binance')) return 'Binance';
  if (s.includes('bybit')) return 'Bybit';
  if (s.includes('okx')) return 'OKX';
  if (s.includes('coinbase')) return 'Coinbase';
  if (s.includes('upbit')) return 'Upbit';
  if (s.includes('kraken')) return 'Kraken';
  if (s.includes('mexc')) return 'MEXC';
  if (s.includes('kucoin')) return 'KuCoin';
  if (s.includes('htx')) return 'HTX';
  if (s.includes('gate')) return 'Gate.io';
  if (s.includes('bitget')) return 'Bitget';
  if (s.includes('bingx')) return 'BingX';
  if (s.includes('phemex')) return 'Phemex';
  if (s.includes('crypto.com')) return 'Crypto.com';
  return source;
}

async function fetchJson<T>(url: string, timeoutMs = 10_000): Promise<T | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'Accept': 'application/json', 'User-Agent': 'InfoHub/2.0 (info-hub.io)' },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '80', 10) || 80));
  const kindFilter = (searchParams.get('kind') || 'all').toLowerCase();
  const exchangeFilter = (searchParams.get('exchange') || '').toLowerCase();

  const cacheKey = `listings:${limit}:${kindFilter}:${exchangeFilter}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.body, { headers: { 'X-Cache': 'HIT' } });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://info-hub.io';
  // Pull a wide window (200 articles) so we have enough to filter down from
  const news = await fetchJson<{ articles?: NewsArticle[] }>(`${baseUrl}/api/news?limit=200`);
  const articles = news?.articles ?? [];

  // Filter to listing announcements
  const nowMs = Date.now();
  const rows: ListingRow[] = [];
  for (const a of articles) {
    if (!a.title || !a.source) continue;
    if (!LISTING_SOURCE_PATTERN.test(a.source)) continue;
    const isDelist = DELIST_TITLE_PATTERN.test(a.title);
    const isListing = LISTING_TITLE_PATTERN.test(a.title);
    if (!isDelist && !isListing) continue;

    const exchange = normalizeExchangeSource(a.source);
    const kind = classifyKind(a.title);
    const tickers = extractTickers(a.title);
    const publishedMs = (a.publishedAt || 0) * 1000;
    const ageMins = Math.max(0, Math.floor((nowMs - publishedMs) / 60_000));

    rows.push({
      id: a.id || `${a.source}-${a.publishedAt}`,
      title: a.title,
      url: a.url,
      exchange,
      tickers,
      kind,
      publishedAt: a.publishedAt,
      ageMins,
    });
  }

  // Sort newest first
  rows.sort((a, b) => b.publishedAt - a.publishedAt);

  // Filter
  let filtered = rows;
  if (kindFilter !== 'all') {
    filtered = filtered.filter(r => r.kind === kindFilter);
  }
  if (exchangeFilter) {
    filtered = filtered.filter(r => r.exchange.toLowerCase().includes(exchangeFilter));
  }
  const trimmed = filtered.slice(0, limit);

  // Summary windows
  const nowSec = nowMs / 1000;
  const dayAgo = nowSec - 86_400;
  const weekAgo = nowSec - 7 * 86_400;
  const last24 = rows.filter(r => r.publishedAt >= dayAgo);
  const last7 = rows.filter(r => r.publishedAt >= weekAgo);
  // Exchange breakdown uses 7-day window so it's populated even on slow days.
  const byExchange = new Map<string, number>();
  for (const r of last7) byExchange.set(r.exchange, (byExchange.get(r.exchange) || 0) + 1);
  const exchanges = Array.from(byExchange.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([exchange, count]) => ({ exchange, count }));

  // Age of the most recent listing (used by the UI to show "last update" state).
  const newestAgeMins = rows.length
    ? Math.max(0, Math.floor((nowSec - rows[0].publishedAt) / 60))
    : null;

  const body: ListingsResponse = {
    data: trimmed,
    summary: {
      total: rows.length,
      last24h: last24.length,
      last7d: last7.length,
      newestAgeMins,
      exchanges,
    },
    meta: { timestamp: Date.now(), returned: trimmed.length },
  };

  cache.set(cacheKey, { body, ts: Date.now() });
  return NextResponse.json(body, {
    headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  });
}
