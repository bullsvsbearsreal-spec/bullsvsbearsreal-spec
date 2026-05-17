'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PageHero from '@/components/PageHero';
import { AtSign, ExternalLink, RefreshCw, Filter, Twitter } from 'lucide-react';

interface SocialPost {
  id: string;
  handle: string;
  displayName?: string | null;
  body: string;
  link: string;
  pubDate: string; // ISO from JSON
}

interface ApiResponse {
  posts: SocialPost[];
  count: number;
  handles: string[];
  ts: number;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Auto-link handles, $TICKERS and URLs in tweet body without dangerouslySetInnerHTML. */
function renderBody(body: string): React.ReactNode {
  // Split on (https URLs | @handles | $TICKERS) keeping delimiters
  const parts = body.split(/(https?:\/\/\S+|@[A-Za-z0-9_]{1,15}\b|\$[A-Z]{2,8}\b)/g);
  return parts.map((part, i) => {
    if (!part) return null;
    if (/^https?:\/\//.test(part)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline break-all">
          {part.length > 50 ? `${part.slice(0, 47)}…` : part}
        </a>
      );
    }
    if (/^@[A-Za-z0-9_]{1,15}$/.test(part)) {
      return (
        <a key={i} href={`https://x.com/${part.slice(1)}`} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">
          {part}
        </a>
      );
    }
    if (/^\$[A-Z]{2,8}$/.test(part)) {
      return <span key={i} className="text-amber-400 font-medium">{part}</span>;
    }
    return <span key={i}>{part}</span>;
  });
}

export default function SocialPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const url = filter ? `/api/news/social?limit=200&handle=${encodeURIComponent(filter)}` : '/api/news/social?limit=200';
      const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ApiResponse;
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    load(false);
    const iv = setInterval(() => load(true), 60_000);
    return () => clearInterval(iv);
  }, [load]);

  const handles = useMemo(() => data?.handles?.slice().sort() ?? [], [data?.handles]);

  return (
    <>
      <Header />
      <main className="max-w-[1100px] mx-auto w-full px-4 py-6">
        <PageHero
          icon={Twitter}
          eyebrow={`live · ${data?.posts.length ?? 0} posts`}
          title="KOL"
          accentNoun="feed"
          accent="cyan"
          description="Curated crypto + macro voices on X, polled every 15 min via RSS. All links go to x.com — read in context, no algorithm reshuffling timing."
          actions={
            <button
              onClick={() => load(false)}
              disabled={refreshing}
              className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-hub-yellow disabled:opacity-40"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              refresh
            </button>
          }
        />

        {/* Filter row */}
        <div className="card-premium p-3 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Filter className="w-3.5 h-3.5 text-neutral-500" />
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">Filter by handle</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilter('')}
              className={`text-[11px] px-2 py-1 rounded-md font-mono transition-colors ${
                filter === '' ? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40' : 'bg-white/[0.04] text-neutral-400 hover:bg-white/[0.08]'
              }`}
            >
              all
            </button>
            {handles.map(h => (
              <button
                key={h}
                onClick={() => setFilter(h)}
                className={`text-[11px] px-2 py-1 rounded-md font-mono transition-colors ${
                  filter === h ? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40' : 'bg-white/[0.04] text-neutral-400 hover:bg-white/[0.08]'
                }`}
              >
                @{h}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="card-premium p-4 text-center mb-4">
            <p className="text-red-400 text-sm">Failed to load · {error}</p>
            <button onClick={() => load(false)} className="mt-2 text-xs text-hub-yellow hover:underline">
              retry
            </button>
          </div>
        )}

        {/* Empty state — first run before cron has populated */}
        {data && data.posts.length === 0 && !error && (
          <div className="card-premium p-8 text-center">
            <AtSign className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
            <p className="text-sm text-neutral-400">
              {filter ? `No posts yet for @${filter}` : 'No posts yet — feed populates every 15 minutes.'}
            </p>
            <p className="text-[11px] text-neutral-600 mt-1">First fetch may take a few minutes after deploy.</p>
          </div>
        )}

        {/* Timeline */}
        {data && data.posts.length > 0 && (
          <div className="space-y-2">
            {data.posts.map(p => (
              <a
                key={p.id}
                href={p.link}
                target="_blank"
                rel="noopener noreferrer"
                className="card-premium block p-3 group hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-sky-500/10 flex items-center justify-center flex-shrink-0 ring-1 ring-sky-500/20">
                      <AtSign className="w-3.5 h-3.5 text-sky-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate group-hover:text-sky-300 transition-colors">
                        {p.displayName || p.handle}
                      </p>
                      <p className="text-[10px] text-neutral-500 font-mono">
                        @{p.handle} · {timeAgo(p.pubDate)}
                      </p>
                    </div>
                  </div>
                  <ExternalLink className="w-3 h-3 text-neutral-700 group-hover:text-neutral-400 transition-colors flex-shrink-0 mt-1" />
                </div>
                <p className="text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap break-words">
                  {renderBody(p.body)}
                </p>
              </a>
            ))}
          </div>
        )}

        {/* Loading state */}
        {!data && !error && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="card-premium p-4 animate-pulse">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full bg-white/[0.04]" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 bg-white/[0.04] rounded w-32" />
                    <div className="h-2 bg-white/[0.04] rounded w-20" />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="h-3 bg-white/[0.04] rounded w-full" />
                  <div className="h-3 bg-white/[0.04] rounded w-4/5" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer link */}
        <div className="mt-6 text-center">
          <Link href="/news" className="text-xs text-neutral-500 hover:text-hub-yellow">
            ← back to news
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
