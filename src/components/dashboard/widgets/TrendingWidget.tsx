'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Zap } from 'lucide-react';
import { TokenIconSimple } from '@/components/TokenIcon';

interface TrendingCoin {
  symbol: string;
  count: number;
}

export default function TrendingWidget({ wide }: { wide?: boolean }) {
  const [trending, setTrending] = useState<TrendingCoin[] | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch('/api/news');
        if (!res.ok) return;
        const json = await res.json();
        const items = json?.meta?.trending || [];
        if (mounted) setTrending(items.slice(0, wide ? 8 : 5));
      } catch (err) { console.error('[Trending] fetch error:', err); }
    };
    load();
    const iv = setInterval(load, 300_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [wide]);

  if (trending === null) {
    return <div className="h-16 flex items-center justify-center"><div className="w-5 h-5 border-2 border-hub-yellow/30 border-t-hub-yellow rounded-full animate-spin" /></div>;
  }

  if (trending.length === 0) {
    return (
      <div className="text-center py-4">
        <Zap className="w-5 h-5 text-neutral-700 mx-auto mb-1" />
        <p className="text-xs text-neutral-600">No trending data</p>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-1">
        {trending.map((coin, i) => (
          <div key={coin.symbol} className="flex items-center justify-between py-0.5">
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
      <Link href="/news" className="block text-center mt-2 text-[10px] text-hub-yellow hover:underline">
        View news
      </Link>
    </div>
  );
}
