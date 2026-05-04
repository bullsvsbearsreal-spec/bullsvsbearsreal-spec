'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Newspaper, AtSign } from 'lucide-react';
import WidgetSkeleton from '../WidgetSkeleton';
import UpdatedAgo from '../UpdatedAgo';

type SourceType = 'news' | 'exchange' | 'blog' | 'aggregator' | 'kol';

interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceType?: SourceType;
  publishedAt: number;
  sentiment?: 'bullish' | 'bearish' | 'neutral';
  /** True for KOL Twitter posts — used for the @-icon + different style. */
  isSocial?: boolean;
  /** "@goodalexander" — only set on social items. */
  handle?: string;
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
  kol: 'text-sky-400',
};

/** Trim a body string to N chars with ellipsis on a word boundary if possible. */
function trimBody(body: string, max: number): string {
  if (body.length <= max) return body;
  const cut = body.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut) + '…';
}

export default function NewsWidget({ wide }: { wide?: boolean }) {
  const [news, setNews] = useState<NewsItem[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        // Fan out to news + KOL social feeds in parallel. Either failing
        // shouldn't block the other — the widget renders whatever it gets.
        const [newsRes, socialRes] = await Promise.allSettled([
          fetch('/api/news', { signal: AbortSignal.timeout(10000) }),
          fetch('/api/news/social?limit=20', { signal: AbortSignal.timeout(10000) }),
        ]);

        const articles: NewsItem[] = [];
        if (newsRes.status === 'fulfilled' && newsRes.value.ok) {
          const json = await newsRes.value.json();
          for (const a of json?.articles || []) {
            articles.push({
              id: String(a.id),
              title: a.title,
              url: a.url,
              source: a.source,
              sourceType: a.sourceType,
              publishedAt: a.publishedAt,
              sentiment: a.sentiment,
            });
          }
        }
        if (socialRes.status === 'fulfilled' && socialRes.value.ok) {
          const json = await socialRes.value.json();
          for (const p of json?.posts || []) {
            const ts = Math.floor(new Date(p.pubDate).getTime() / 1000);
            if (!Number.isFinite(ts)) continue;
            articles.push({
              id: `social_${p.id}`,
              title: trimBody(p.body || '', 180),
              url: p.link,
              source: `@${p.handle}`,
              sourceType: 'kol',
              publishedAt: ts,
              isSocial: true,
              handle: p.handle,
            });
          }
        }

        // Merge interleaved by publishedAt DESC, then dedupe (different
        // sources sometimes pick up the same headline twice).
        articles.sort((a, b) => b.publishedAt - a.publishedAt);
        const seen = new Set<string>();
        const merged: NewsItem[] = [];
        for (const a of articles) {
          const key = a.url || a.id;
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(a);
        }

        if (mounted) {
          setNews(merged.slice(0, wide ? 6 : 4));
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
              {item.isSocial ? (
                <AtSign className="w-3 h-3 mt-1 flex-shrink-0 text-sky-400/80" />
              ) : item.sentiment ? (
                <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${sentimentDot[item.sentiment] || sentimentDot.neutral}`} />
              ) : null}
              <div className="min-w-0">
                <p className="text-xs text-neutral-300 leading-snug line-clamp-2 group-hover:text-white transition-colors">
                  {item.title}
                </p>
                <p className="text-[10px] text-neutral-600 mt-0.5">
                  <span className={item.sourceType ? sourceTypeColor[item.sourceType] || 'text-neutral-600' : 'text-neutral-600'}>
                    {item.source}
                  </span>
                  {' · '}
                  {timeAgo(item.publishedAt)}
                </p>
              </div>
            </div>
          </a>
        ))}
      </div>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-3">
          <Link href="/news" className="text-[10px] text-hub-yellow hover:underline">
            View all news
          </Link>
          <Link href="/social" className="text-[10px] text-sky-400 hover:underline">
            KOLs
          </Link>
        </div>
        <UpdatedAgo ts={updatedAt} />
      </div>
    </div>
  );
}
