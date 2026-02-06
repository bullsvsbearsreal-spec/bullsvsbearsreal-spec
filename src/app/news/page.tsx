'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import MarketTicker from '@/components/MarketTicker';
import { Newspaper, ExternalLink, Clock, TrendingUp, Filter, RefreshCw } from 'lucide-react';
import { fetchCryptoNews, NewsArticle, formatTimeAgo } from '@/lib/api/coinmarketcal';

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
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-hub-yellow/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-hub-orange/5 rounded-full blur-3xl" />
      </div>

      <Header />
      <MarketTicker />

      <main className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-hub-yellow/10 flex items-center justify-center">
                <Newspaper className="w-5 h-5 text-hub-yellow" />
              </div>
              <h1 className="text-3xl font-bold text-white">Market News</h1>
            </div>
            <p className="text-hub-gray-text">
              Real-time news from across the market
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={refreshNews}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-hub-gray/30 border border-hub-gray/30 text-hub-gray-text hover:text-white hover:border-hub-yellow/30 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <span className="flex items-center gap-2 px-3 py-2 rounded-xl bg-success/10 border border-success/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
              </span>
              <span className="text-xs text-success font-medium">Live</span>
            </span>
          </div>
        </div>

        {/* News Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="animate-pulse bg-hub-gray/20 border border-hub-gray/30 rounded-2xl p-6">
                <div className="flex gap-4">
                  <div className="w-24 h-20 bg-hub-gray/30 rounded-xl" />
                  <div className="flex-1 space-y-3">
                    <div className="h-4 bg-hub-gray/30 rounded w-3/4" />
                    <div className="h-4 bg-hub-gray/30 rounded w-1/2" />
                    <div className="h-3 bg-hub-gray/30 rounded w-1/4" />
                  </div>
                </div>
              </div>
            ))}
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
              className="inline-flex items-center gap-2 px-6 py-3 bg-hub-gray/30 border border-hub-gray/30 rounded-xl text-hub-gray-text hover:text-white hover:border-hub-yellow/30 transition-all"
            >
              View More on CryptoCompare
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-hub-gray/20 mt-16">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <p className="text-center text-hub-gray-text text-sm">
            © 2026 InfoHub. News powered by CryptoCompare.
          </p>
        </div>
      </footer>
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
      className={`group block bg-hub-gray/20 hover:bg-hub-gray/30 border border-hub-gray/30 hover:border-hub-yellow/30 rounded-2xl transition-all duration-300 ${
        featured ? 'md:col-span-2 p-6' : 'p-5'
      }`}
    >
      <div className={`flex gap-4 ${featured ? 'flex-col md:flex-row' : ''}`}>
        {/* Image */}
        {article.imageurl && (
          <div className={`flex-shrink-0 ${featured ? 'w-full md:w-48 h-40' : 'w-24 h-20'} rounded-xl overflow-hidden bg-hub-gray/30`}>
            <img
              src={article.imageurl}
              alt=""
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
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
            <span className="flex items-center gap-1 text-xs text-hub-gray-text">
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
            <p className="text-hub-gray-text text-sm line-clamp-2 mb-3">
              {article.body.substring(0, 200)}...
            </p>
          )}

          {/* Source */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-hub-gray-text">
              {article.source_info?.name || article.source}
            </span>
            <ExternalLink className="w-4 h-4 text-hub-gray-text group-hover:text-hub-yellow transition-colors" />
          </div>
        </div>
      </div>
    </a>
  );
}
