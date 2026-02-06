'use client';

import { useState, useEffect } from 'react';
import { Newspaper, ExternalLink, TrendingUp, Clock, ChevronRight } from 'lucide-react';
import { fetchCryptoNews, fetchCoinNews, NewsArticle, formatTimeAgo } from '@/lib/api/coinmarketcal';

interface NewsSectionProps {
  coinSymbol?: string;
  limit?: number;
  compact?: boolean;
}

export default function NewsSection({ coinSymbol, limit = 8, compact = false }: NewsSectionProps) {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadNews() {
      setLoading(true);
      const data = coinSymbol
        ? await fetchCoinNews(coinSymbol, limit)
        : await fetchCryptoNews(limit);
      setNews(data);
      setLoading(false);
    }
    loadNews();
  }, [coinSymbol, limit]);

  if (loading) {
    return (
      <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-hub-yellow/10 flex items-center justify-center">
            <Newspaper className="w-5 h-5 text-hub-yellow" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Latest News</h3>
            <p className="text-hub-gray-text text-sm">Loading real-time news...</p>
          </div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-24 bg-hub-gray/30 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-3">
        {news.slice(0, limit).map((article) => (
          <CompactNewsCard key={article.id} article={article} />
        ))}
      </div>
    );
  }

  return (
    <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-hub-yellow/10 flex items-center justify-center">
            <Newspaper className="w-5 h-5 text-hub-yellow" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">
              {coinSymbol ? `${coinSymbol.toUpperCase()} News` : 'Market News'}
            </h3>
            <p className="text-hub-gray-text text-sm">
              Real-time from CryptoCompare
            </p>
          </div>
        </div>
        <span className="flex items-center gap-1 text-xs text-success">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
          </span>
          Live
        </span>
      </div>

      {/* News Grid */}
      <div className="space-y-4">
        {news.map((article, index) => (
          <NewsCard key={article.id || index} article={article} featured={index === 0} />
        ))}
      </div>

      {/* View More */}
      {news.length >= limit && (
        <a
          href="https://www.cryptocompare.com/news/"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full mt-4 py-3 text-center text-hub-yellow text-sm font-medium hover:bg-hub-yellow/10 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          View More News
          <ChevronRight className="w-4 h-4" />
        </a>
      )}
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
      className={`group block bg-hub-gray/30 hover:bg-hub-gray/50 border border-hub-gray/30 hover:border-hub-yellow/30 rounded-xl transition-all ${
        featured ? 'p-5' : 'p-4'
      }`}
    >
      <div className="flex gap-4">
        {/* Image */}
        {article.imageurl && (
          <div className={`flex-shrink-0 ${featured ? 'w-32 h-24' : 'w-20 h-16'} rounded-lg overflow-hidden bg-hub-gray/50`}>
            <img
              src={article.imageurl}
              alt=""
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
          <h4 className={`text-white font-medium group-hover:text-hub-yellow transition-colors ${
            featured ? 'text-lg line-clamp-2' : 'text-sm line-clamp-2'
          }`}>
            {article.title}
          </h4>

          {/* Description for featured */}
          {featured && article.body && (
            <p className="text-hub-gray-text text-sm mt-2 line-clamp-2">
              {article.body.substring(0, 150)}...
            </p>
          )}

          {/* Source */}
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-hub-gray-text">
              {article.source_info?.name || article.source}
            </span>
            <ExternalLink className="w-3 h-3 text-hub-gray-text group-hover:text-hub-yellow transition-colors" />
          </div>
        </div>
      </div>
    </a>
  );
}

function CompactNewsCard({ article }: { article: NewsArticle }) {
  const timeAgo = formatTimeAgo(article.published_on);

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 p-3 bg-hub-gray/20 hover:bg-hub-gray/40 border border-hub-gray/30 hover:border-hub-yellow/30 rounded-xl transition-all"
    >
      <div className="w-10 h-10 rounded-lg bg-hub-yellow/10 flex items-center justify-center flex-shrink-0">
        <Newspaper className="w-5 h-5 text-hub-yellow" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-white text-sm font-medium line-clamp-1 group-hover:text-hub-yellow transition-colors">
          {article.title}
        </h4>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-hub-gray-text">{article.source_info?.name || article.source}</span>
          <span className="text-xs text-hub-gray-text">•</span>
          <span className="text-xs text-hub-gray-text">{timeAgo}</span>
        </div>
      </div>
      <ExternalLink className="w-4 h-4 text-hub-gray-text group-hover:text-hub-yellow flex-shrink-0" />
    </a>
  );
}
