'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Newspaper } from 'lucide-react';

interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: number;
  sentiment?: 'bullish' | 'bearish' | 'neutral';
}

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const sentimentDot: Record<string, string> = {
  bullish: 'bg-green-400',
  bearish: 'bg-red-400',
  neutral: 'bg-neutral-500',
};

export default function NewsWidget({ wide }: { wide?: boolean }) {
  const [news, setNews] = useState<NewsItem[] | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch('/api/news');
        if (!res.ok) return;
        const json = await res.json();
        const articles = json?.articles || [];
        if (mounted) setNews(articles.slice(0, wide ? 5 : 3));
      } catch (err) { console.error('[News] fetch error:', err); }
    };
    load();
    const iv = setInterval(load, 300_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [wide]);

  if (news === null) {
    return <div className="h-16 flex items-center justify-center"><div className="w-5 h-5 border-2 border-hub-yellow/30 border-t-hub-yellow rounded-full animate-spin" /></div>;
  }

  if (news.length === 0) {
    return (
      <div className="text-center py-4">
        <Newspaper className="w-5 h-5 text-neutral-700 mx-auto mb-1" />
        <p className="text-xs text-neutral-600">No news available</p>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-2">
        {news.map((item) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block group"
          >
            <div className="flex items-start gap-1.5">
              {item.sentiment && (
                <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${sentimentDot[item.sentiment] || sentimentDot.neutral}`} />
              )}
              <div className="min-w-0">
                <p className="text-xs text-neutral-300 leading-snug line-clamp-2 group-hover:text-white transition-colors">
                  {item.title}
                </p>
                <p className="text-[10px] text-neutral-600 mt-0.5">
                  {item.source} · {timeAgo(item.publishedAt)}
                </p>
              </div>
            </div>
          </a>
        ))}
      </div>
      <Link href="/news" className="block text-center mt-2 text-[10px] text-hub-yellow hover:underline">
        View all news
      </Link>
    </div>
  );
}
