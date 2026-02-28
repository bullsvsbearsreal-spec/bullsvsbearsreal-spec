'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Zap } from 'lucide-react';
import WidgetSkeleton from '../WidgetSkeleton';
import UpdatedAgo from '../UpdatedAgo';
import { TokenIconSimple } from '@/components/TokenIcon';

interface TrendingCoin {
  symbol: string;
  count: number;
}

export default function TrendingWidget({ wide }: { wide?: boolean }) {
  const [trending, setTrending] = useState<TrendingCoin[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch('/api/news');
        if (!res.ok) return;
        const json = await res.json();
        const items = json?.meta?.trending || [];
        if (mounted) {
          setTrending(items.slice(0, wide ? 8 : 5));
          setUpdatedAt(Date.now());
        }
      } catch (err) { console.error('[Trending] fetch error:', err); }
    };
    load();
    const iv = setInterval(load, 300_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [wide]);

  if (trending === null) return <WidgetSkeleton variant="list" rows={5} />;

  if (trending.length === 0) {
    return (
      <div className="text-center py-4">
        <div className="w-8 h-8 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-2">
          <Zap className="w-4 h-4 text-yellow-400/60" />
        </div>
        <p className="text-xs text-neutral-500">No trending coins</p>
        <p className="text-[10px] text-neutral-600 mt-0.5">Based on recent news mentions</p>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-1">
        {trending.map((coin, i) => (
          <div key={coin.symbol} className="flex items-center justify-between py-1 px-1.5 -mx-1.5 rounded-md hover:bg-white/[0.04] transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-neutral-600 w-4 text-right tabular-nums">{i + 1}</span>
              <TokenIconSimple symbol={coin.symbol} size={14} />
              <span className="text-xs text-neutral-300">{coin.symbol}</span>
            </div>
            <span className="text-[10px] text-neutral-500 tabular-nums">
              {coin.count} mention{coin.count !== 1 ? 's' : ''}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-2">
        <Link href="/news" className="text-[10px] text-hub-yellow hover:underline">
          View news
        </Link>
        <UpdatedAgo ts={updatedAt} />
      </div>
    </div>
  );
}
