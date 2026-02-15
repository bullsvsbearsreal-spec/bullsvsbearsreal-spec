'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import MarketTicker from '@/components/MarketTicker';
import { Newspaper, ExternalLink, Clock, TrendingUp, Filter, RefreshCw } from 'lucide-react';
import { fetchCryptoNews, NewsArticle, formatTimeAgo } from '@/lib/api/coinmarketcal';
import Footer from '@/components/Footer';

export default function NewsPage() {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNews = async () => {
    setLoading(true);
    const data = await fetchCryptoNews(30);
    setNews(data);
    setLoading(false);
  };

  const refreshNews = async () => {
    setRefreshing(true);
    const data = await fetchCryptoNews(30);
    setNews(data);
    setRefreshing(false);
  };

  useEffect(() => {
    loadNews();
  }, []);

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <MarketTicker />

      <main id="main-content" className="max-w-[1400px] mx-auto px-4 py-6">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">Market News</h1>
            <p className="text-neutral-500 text-xs mt-0.5">Real-time news from across the market</p>
          </div>
          <button
            onClick={refreshNews}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] rounded-md text-neutral-400 text-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* News Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="animate-pulse bg-hub-darker border border-white/[0.06] rounded-xl p-6">
                <div className="flex gap-4">
                  <div className="w-24 h-20 bg-white/[0.04] rounded-xl" />
                  <div className="flex-1 space-y-3">
                    <div className="h-4 bg-white/[0.04] rounded w-3/4" />
                    <div className="h-4 bg-white/[0.04] rounded w-1/2" />
                    <div className="h-3 bg-white/[0.04] rounded w-1/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : news.length === 0 ? (
          <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-12 text-center">
            <Newspaper className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
            <h3 className="text-white font-semibold mb-1">No news available</h3>
            <p className="text-neutral-600 text-sm mb-4">
              The CryptoCompare news API is temporarily unavailable. Try refreshing.
            </p>
            <button
              onClick={refreshNews}
              className="inline-flex items-center gap-2 px-4 py-2 bg-hub-yellow text-black rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try Again
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {news.map((article, index) => (
              <NewsCard key={article.id || index} article={article} featured={index === 0} />
            ))}
          </div>
        )}

        {/* Load More */}
        {!loading && news.length > 0 && (
          <div className="mt-8 text-center">
            <a
              href="https://www.cryptocompare.com/news/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-neutral-600 hover:text-white hover:border-hub-yellow/30 transition-all"
            >
              View More on CryptoCompare
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

function NewsCard({ article, featured = false }: { article: NewsArticle; featured?: boolean }) {
  const categories = article.categories?.split('|').slice(0, 3) || [];
  const timeAgo = formatTimeAgo(article.published_on);

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group block bg-hub-darker hover:bg-hub-darker border border-white/[0.06] hover:border-white/[0.1] rounded-xl transition-all ${
        featured ? 'md:col-span-2 p-4' : 'p-3'
      }`}
    >
      <div className={`flex gap-4 ${featured ? 'flex-col md:flex-row' : ''}`}>
        {/* Image */}
        {article.imageurl && (
          <div className={`flex-shrink-0 ${featured ? 'w-full md:w-48 h-40' : 'w-24 h-20'} rounded-xl overflow-hidden bg-white/[0.04]`}>
            <img
              src={article.imageurl}
              alt=""
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                img.style.display = 'none';
                const parent = img.parentElement;
                if (parent) {
                  parent.classList.add('flex', 'items-center', 'justify-center');
                  const placeholder = document.createElement('div');
                  placeholder.className = 'text-neutral-700';
                  placeholder.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>';
                  parent.appendChild(placeholder);
                }
              }}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Categories */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {categories.map((cat, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded text-xs bg-hub-yellow/10 text-hub-yellow"
              >
                {cat}
              </span>
            ))}
            <span className="flex items-center gap-1 text-xs text-neutral-600">
              <Clock className="w-3 h-3" />
              {timeAgo}
            </span>
          </div>

          {/* Title */}
          <h3 className={`text-white font-semibold group-hover:text-hub-yellow transition-colors line-clamp-2 ${
            featured ? 'text-xl mb-3' : 'text-sm mb-2'
          }`}>
            {article.title}
          </h3>

          {/* Description for featured */}
          {featured && article.body && (
            <p className="text-neutral-600 text-sm line-clamp-2 mb-3">
              {article.body.substring(0, 200)}...
            </p>
          )}

          {/* Source */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-600">
              {article.source_info?.name || article.source}
            </span>
            <ExternalLink className="w-4 h-4 text-neutral-600 group-hover:text-hub-yellow transition-colors" />
          </div>
        </div>
      </div>
    </a>
  );
}
