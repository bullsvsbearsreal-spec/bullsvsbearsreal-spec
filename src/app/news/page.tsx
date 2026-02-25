'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Newspaper, ExternalLink, Clock, Search, RefreshCw, X, ChevronLeft, ChevronRight, TrendingUp, ThumbsUp, ThumbsDown } from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────── */

interface NewsArticle {
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

interface TrendingCoin {
  symbol: string;
  count: number;
}

interface ApiResponse {
  articles: NewsArticle[];
  meta: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
    trending: TrendingCoin[];
    hasCryptoPanic: boolean;
  };
}

type FilterType = 'all' | 'hot' | 'rising' | 'bullish' | 'bearish';

/* ─── Helpers ────────────────────────────────────────────────── */

function formatTimeAgo(unixTs: number): string {
  const now = Date.now() / 1000;
  const diff = now - unixTs;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(unixTs * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const SENTIMENT_COLORS = {
  bullish: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  bearish: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400' },
  neutral: { bg: 'bg-neutral-500/10', text: 'text-neutral-400', dot: 'bg-neutral-400' },
};

/* ─── Main Page ──────────────────────────────────────────────── */

export default function NewsPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [trending, setTrending] = useState<TrendingCoin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<FilterType>('all');
  const [currency, setCurrency] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [hasCryptoPanic, setHasCryptoPanic] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchNews = useCallback(async (pg: number, f: FilterType, cur: string, q: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams({ page: String(pg) });
      if (f !== 'all') params.set('filter', f);
      if (cur) params.set('currency', cur);
      if (q) params.set('search', q);
      const res = await fetch(`/api/news?${params}`);
      if (!res.ok) throw new Error('Failed');
      const data: ApiResponse = await res.json();
      setArticles(data.articles);
      setTrending(data.meta.trending);
      setTotalPages(data.meta.totalPages);
      setTotal(data.meta.total);
      setHasCryptoPanic(data.meta.hasCryptoPanic);
    } catch {
      setArticles([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch on filter/page/search changes
  useEffect(() => {
    fetchNews(page, filter, currency, debouncedSearch);
  }, [page, filter, currency, debouncedSearch, fetchNews]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filter, currency, debouncedSearch]);

  const handleRefresh = () => fetchNews(page, filter, currency, debouncedSearch, true);

  const handleCurrencyClick = (sym: string) => {
    setCurrency(prev => prev === sym ? '' : sym);
  };

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />

      <main id="main-content" className="max-w-[1400px] mx-auto px-4 py-6">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="heading-page">Market News</h1>
            <p className="text-neutral-500 text-xs mt-0.5">
              Real-time news from across the market
              {hasCryptoPanic && <span className="text-emerald-400 ml-2">+ CryptoPanic sentiment</span>}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] rounded-md text-neutral-400 text-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Search + Filter Row */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {/* Search input */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-600" />
            <input
              type="text"
              placeholder="Search news, coins, sources..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-hub-yellow/40"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-white/[0.08] text-neutral-500">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-1">
            {([
              { key: 'all', label: 'All' },
              { key: 'hot', label: 'Hot' },
              { key: 'rising', label: 'Rising' },
              { key: 'bullish', label: 'Bullish' },
              { key: 'bearish', label: 'Bearish' },
            ] as { key: FilterType; label: string }[]).map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === f.key
                    ? f.key === 'bullish' ? 'bg-emerald-500/20 text-emerald-400' :
                      f.key === 'bearish' ? 'bg-red-500/20 text-red-400' :
                      'bg-hub-yellow text-black'
                    : 'text-neutral-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Active currency filter */}
          {currency && (
            <button
              onClick={() => setCurrency('')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-hub-yellow/20 text-hub-yellow"
            >
              {currency}
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Main grid: content + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          {/* Main content */}
          <div>
            {loading ? (
              <div className="space-y-4">
                {/* Featured skeleton */}
                <div className="animate-pulse bg-hub-darker border border-white/[0.06] rounded-xl p-5">
                  <div className="flex gap-4 flex-col md:flex-row">
                    <div className="w-full md:w-48 h-40 bg-white/[0.04] rounded-xl" />
                    <div className="flex-1 space-y-3">
                      <div className="h-5 bg-white/[0.04] rounded w-3/4" />
                      <div className="h-4 bg-white/[0.04] rounded w-1/2" />
                      <div className="h-3 bg-white/[0.04] rounded w-full" />
                      <div className="h-3 bg-white/[0.04] rounded w-2/3" />
                    </div>
                  </div>
                </div>
                {/* Card skeletons */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="animate-pulse bg-hub-darker border border-white/[0.06] rounded-xl p-4">
                      <div className="flex gap-3">
                        <div className="w-20 h-16 bg-white/[0.04] rounded-lg flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-white/[0.04] rounded w-3/4" />
                          <div className="h-3 bg-white/[0.04] rounded w-1/2" />
                          <div className="h-3 bg-white/[0.04] rounded w-1/4" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : articles.length === 0 ? (
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-12 text-center">
                <Newspaper className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
                <h3 className="text-white font-semibold mb-1">No news found</h3>
                <p className="text-neutral-600 text-sm mb-4">
                  {search ? `No results for "${search}"` : 'Try adjusting your filters'}
                </p>
                <button
                  onClick={() => { setSearch(''); setFilter('all'); setCurrency(''); }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-hub-yellow text-black rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Featured article (first one) */}
                {articles.length > 0 && (
                  <FeaturedArticle article={articles[0]} onCurrencyClick={handleCurrencyClick} />
                )}

                {/* Article grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {articles.slice(1).map(article => (
                    <NewsCard key={article.id} article={article} onCurrencyClick={handleCurrencyClick} />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-neutral-400 hover:text-white disabled:opacity-30 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 7) {
                        pageNum = i + 1;
                      } else if (page <= 4) {
                        pageNum = i + 1;
                      } else if (page >= totalPages - 3) {
                        pageNum = totalPages - 6 + i;
                      } else {
                        pageNum = page - 3 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                            page === pageNum
                              ? 'bg-hub-yellow text-black'
                              : 'bg-white/[0.04] text-neutral-400 hover:text-white hover:bg-white/[0.08]'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-neutral-400 hover:text-white disabled:opacity-30 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    <span className="text-xs text-neutral-600 ml-2">
                      {total} articles
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Trending Coins */}
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
              <div className="p-4 border-b border-white/[0.06] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-hub-yellow" />
                <h3 className="text-white font-semibold text-sm">Trending in News</h3>
              </div>
              {trending.length === 0 && !loading ? (
                <div className="p-4 text-center text-neutral-600 text-sm">No trending data</div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {(loading ? Array.from({ length: 5 }, (_, i) => ({ symbol: '', count: 0 })) : trending).map((coin, i) => (
                    <button
                      key={coin.symbol || i}
                      onClick={() => coin.symbol && handleCurrencyClick(coin.symbol)}
                      className={`w-full flex items-center justify-between p-3 hover:bg-white/[0.02] transition-colors text-left ${
                        currency === coin.symbol ? 'bg-hub-yellow/5' : ''
                      }`}
                      disabled={loading}
                    >
                      {loading ? (
                        <div className="animate-pulse flex items-center gap-3 w-full">
                          <div className="w-6 h-4 bg-white/[0.06] rounded" />
                          <div className="h-3 bg-white/[0.06] rounded w-16" />
                          <div className="ml-auto h-3 bg-white/[0.06] rounded w-8" />
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-neutral-600 w-5">{i + 1}.</span>
                            <span className={`text-sm font-semibold ${currency === coin.symbol ? 'text-hub-yellow' : 'text-white'}`}>
                              {coin.symbol}
                            </span>
                          </div>
                          <span className="text-xs text-neutral-500">{coin.count} articles</span>
                        </>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Data sources info */}
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4">
              <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
                Data Sources
              </h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  <span className="text-xs text-neutral-400">CryptoCompare</span>
                  <span className="text-[10px] text-neutral-600 ml-auto">Public API</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${hasCryptoPanic ? 'bg-emerald-400' : 'bg-neutral-600'}`} />
                  <span className="text-xs text-neutral-400">CryptoPanic</span>
                  <span className="text-[10px] text-neutral-600 ml-auto">
                    {hasCryptoPanic ? 'Connected' : 'Not configured'}
                  </span>
                </div>
              </div>
              {!hasCryptoPanic && (
                <p className="text-[10px] text-neutral-600 mt-2">
                  Set CRYPTOPANIC_API_KEY for sentiment data and additional sources.
                </p>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

/* ─── Featured Article Component ────────────────────────────── */

function FeaturedArticle({ article, onCurrencyClick }: { article: NewsArticle; onCurrencyClick: (sym: string) => void }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block bg-hub-darker hover:bg-hub-darker border border-white/[0.06] hover:border-white/[0.1] rounded-xl transition-all p-5"
    >
      <div className="flex gap-5 flex-col md:flex-row">
        {/* Image */}
        {article.imageUrl && (
          <div className="flex-shrink-0 w-full md:w-56 h-40 rounded-xl overflow-hidden bg-white/[0.04]">
            <img
              src={article.imageUrl}
              alt=""
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {article.currencies.slice(0, 4).map(c => (
              <button
                key={c}
                onClick={(e) => { e.preventDefault(); onCurrencyClick(c); }}
                className="px-2 py-0.5 rounded text-xs bg-hub-yellow/10 text-hub-yellow hover:bg-hub-yellow/20 transition-colors"
              >
                {c}
              </button>
            ))}
            {article.sentiment && (
              <SentimentBadge sentiment={article.sentiment} />
            )}
            <span className="flex items-center gap-1 text-xs text-neutral-600">
              <Clock className="w-3 h-3" />
              {formatTimeAgo(article.publishedAt)}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-xl font-semibold text-white group-hover:text-hub-yellow transition-colors line-clamp-2 mb-2">
            {article.title}
          </h3>

          {/* Body preview */}
          {article.body && (
            <p className="text-neutral-500 text-sm line-clamp-2 mb-3">
              {article.body}
            </p>
          )}

          {/* Source + votes */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-600">{article.source}</span>
            <div className="flex items-center gap-3">
              {article.votes && (
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="flex items-center gap-0.5 text-emerald-400"><ThumbsUp className="w-3 h-3" />{article.votes.positive}</span>
                  <span className="flex items-center gap-0.5 text-red-400"><ThumbsDown className="w-3 h-3" />{article.votes.negative}</span>
                </div>
              )}
              <ExternalLink className="w-4 h-4 text-neutral-600 group-hover:text-hub-yellow transition-colors" />
            </div>
          </div>
        </div>
      </div>
    </a>
  );
}

/* ─── News Card Component ────────────────────────────────────── */

function NewsCard({ article, onCurrencyClick }: { article: NewsArticle; onCurrencyClick: (sym: string) => void }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block bg-hub-darker hover:bg-hub-darker border border-white/[0.06] hover:border-white/[0.1] rounded-xl transition-all p-3"
    >
      <div className="flex gap-3">
        {/* Image */}
        {article.imageUrl && (
          <div className="flex-shrink-0 w-20 h-16 rounded-lg overflow-hidden bg-white/[0.04]">
            <img
              src={article.imageUrl}
              alt=""
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            {article.currencies.slice(0, 2).map(c => (
              <button
                key={c}
                onClick={(e) => { e.preventDefault(); onCurrencyClick(c); }}
                className="px-1.5 py-0.5 rounded text-[10px] bg-hub-yellow/10 text-hub-yellow hover:bg-hub-yellow/20 transition-colors"
              >
                {c}
              </button>
            ))}
            {article.sentiment && (
              <SentimentDot sentiment={article.sentiment} />
            )}
            <span className="flex items-center gap-1 text-[10px] text-neutral-600">
              <Clock className="w-2.5 h-2.5" />
              {formatTimeAgo(article.publishedAt)}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-sm font-semibold text-white group-hover:text-hub-yellow transition-colors line-clamp-2 mb-1">
            {article.title}
          </h3>

          {/* Source */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-neutral-600">{article.source}</span>
            <ExternalLink className="w-3 h-3 text-neutral-600 group-hover:text-hub-yellow transition-colors" />
          </div>
        </div>
      </div>
    </a>
  );
}

/* ─── Sentiment Components ───────────────────────────────────── */

function SentimentBadge({ sentiment }: { sentiment: 'bullish' | 'bearish' | 'neutral' }) {
  const c = SENTIMENT_COLORS[sentiment];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {sentiment}
    </span>
  );
}

function SentimentDot({ sentiment }: { sentiment: 'bullish' | 'bearish' | 'neutral' }) {
  const c = SENTIMENT_COLORS[sentiment];
  return (
    <span className={`w-2 h-2 rounded-full ${c.dot}`} title={sentiment} />
  );
}
