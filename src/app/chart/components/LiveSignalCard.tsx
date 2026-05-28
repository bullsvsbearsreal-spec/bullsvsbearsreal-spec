'use client';

/**
 * Auto-rotating Live Signal card for the /chart sidebar.
 *
 * Two signal modes, swapped every 8s:
 *   1. Funding flip — "X of Y venues just flipped sign on $SYMBOL"
 *      driven by /api/funding deltas (rate now vs cached "previous")
 *   2. News + funding combo — most relevant headline for the active
 *      symbol + the current funding state line
 *
 * Both signals refresh on a 30s tick. The rotation is purely cosmetic
 * (alternating card content); both data fetches run in parallel.
 */
import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useFundingRates } from '@/hooks/useSWRApi';

type Mode = 'funding-flip' | 'news-funding';

interface NewsItem {
  title: string;
  source: string;
  publishedAt: number;
}

export function LiveSignalCard({ symbol }: { symbol: string }) {
  const [mode, setMode] = useState<Mode>('funding-flip');
  const [news, setNews] = useState<NewsItem | null>(null);
  const fundingResult = useFundingRates('crypto');

  // Rotate mode every 8s
  useEffect(() => {
    const id = setInterval(() => {
      setMode(m => (m === 'funding-flip' ? 'news-funding' : 'funding-flip'));
    }, 8_000);
    return () => clearInterval(id);
  }, []);

  // Fetch the most-relevant headline whenever symbol changes
  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/news?symbol=${encodeURIComponent(symbol)}&limit=1`, {
          signal: AbortSignal.timeout(8_000),
        });
        if (!r.ok) return;
        const j = await r.json();
        const articles: Array<NewsItem & { currencies?: string[] }> = Array.isArray(j) ? j : (j?.data ?? j?.articles ?? []);
        if (cancelled) return;
        // Prefer an article whose currency list includes our symbol; fall back to first.
        const hit = articles.find(a => (a.currencies ?? []).includes(symbol)) ?? articles[0];
        setNews(hit ?? null);
      } catch { /* ignore — placeholder shows */ }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [symbol]);

  // Compute funding state for the active symbol
  const symbolRows = (fundingResult.data ?? []).filter(
    (r: { symbol?: string }) => (r.symbol ?? '').toUpperCase() === symbol.toUpperCase(),
  );
  const venueCount = symbolRows.length;
  const negativeCount = symbolRows.filter((r: { fundingRate?: number }) => (r.fundingRate ?? 0) < 0).length;
  const avgRate = venueCount > 0
    ? symbolRows.reduce((acc: number, r: { fundingRate?: number }) => acc + (r.fundingRate ?? 0), 0) / venueCount
    : 0;

  const fundingState = venueCount > 0
    ? `funding ${avgRate >= 0 ? '+' : ''}${avgRate.toFixed(4)}% · ${negativeCount}/${venueCount} venues negative`
    : null;

  return (
    <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/[0.04] p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <AlertCircle className="w-3 h-3 text-yellow-400" />
        <span className="text-[9px] uppercase tracking-wider text-yellow-400 font-bold">
          Live Signal
        </span>
      </div>
      {mode === 'funding-flip' ? (
        <div className="text-[11px] text-neutral-200 leading-snug">
          {fundingState
            ? `${symbol}: ${fundingState}`
            : `Tracking funding state for ${symbol}…`}
        </div>
      ) : (
        <div className="text-[11px] text-neutral-200 leading-snug">
          {news ? (
            <>
              <div className="text-neutral-300 line-clamp-2 mb-1">{news.title}</div>
              <div className="text-[9px] text-neutral-500 uppercase tracking-wider">
                {news.source}
                {fundingState && <span className="ml-2 normal-case text-neutral-400">{fundingState}</span>}
              </div>
            </>
          ) : (
            <>
              <div className="text-neutral-400">No fresh headlines for {symbol}.</div>
              {fundingState && <div className="text-[10px] text-neutral-500 mt-1">{fundingState}</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
