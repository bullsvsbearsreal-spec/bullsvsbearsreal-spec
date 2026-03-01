'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Newspaper } from 'lucide-react';
import WidgetSkeleton from '../WidgetSkeleton';
import UpdatedAgo from '../UpdatedAgo';

type SourceType = 'news' | 'exchange' | 'blog' | 'aggregator';

interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceType?: SourceType;
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

const sourceTypeColor: Record<string, string> = {
  news: 'text-blue-400',
  exchange: 'text-orange-400',
  blog: 'text-purple-400',
  aggregator: 'text-neutral-500',
};

export default function NewsWidget({ wide }: { wide?: boolean }) {
  const [news, setNews] = useState<NewsItem[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch('/api/news');
        if (!res.ok) return;
        const json = await res.json();
        const articles = json?.articles || [];
        if (mounted) {
          setNews(articles.slice(0, wide ? 5 : 3));
          setUpdatedAt(Date.now());
        }
      } catch (err) { console.error('[News] fetch error:', err); }
    };
    load();
    const iv = setInterval(load, 300_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [wide]);

  if (news === null) return <WidgetSkeleton variant="list" rows={3} />;

  if (news.length === 0) {
    return (
      <div className="text-center py-4">
        <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto mb-2">
          <Newspaper className="w-4 h-4 text-orange-400/60" />
        </div>
        <p className="text-xs text-neutral-500">No recent headlines</p>
        <p className="text-[10px] text-neutral-600 mt-0.5">Crypto news will show here</p>
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
            className="block group py-1 px-1.5 -mx-1.5 rounded-md hover:bg-white/[0.04] transition-colors"
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
                  <span className={item.sourceType ? sourceTypeColor[item.sourceType] || 'text-neutral-600' : 'text-neutral-600'}>{item.source}</span> · {timeAgo(item.publishedAt)}
                </p>
              </div>
            </div>
          </a>
        ))}
      </div>
      <div className="flex items-center justify-between mt-2">
        <Link href="/news" className="text-[10px] text-hub-yellow hover:underline">
          View all news
        </Link>
        <UpdatedAgo ts={updatedAt} />
      </div>
    </div>
  );
}
