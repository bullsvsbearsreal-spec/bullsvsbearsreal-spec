'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { TokenIconSimple } from '@/components/TokenIcon';

export default function WatchlistWidget() {
  const [items, setItems] = useState<string[] | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/user/data');
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) setItems(data.watchlist || []);
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  if (items === null) {
    return <div className="h-12 flex items-center justify-center"><div className="w-5 h-5 border-2 border-hub-yellow/30 border-t-hub-yellow rounded-full animate-spin" /></div>;
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-2">
        <Star className="w-5 h-5 text-neutral-700 mx-auto mb-1" />
        <p className="text-xs text-neutral-600">No symbols yet</p>
        <Link href="/watchlist" className="text-[10px] text-hub-yellow hover:underline">Add watchlist</Link>
      </div>
    );
  }

  return (
    <div>
      <p className="text-lg font-bold text-white mb-2">{items.length}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.slice(0, 8).map((sym) => (
          <span key={sym} className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] text-xs text-neutral-400">
            <TokenIconSimple symbol={sym} size={12} />
            {sym}
          </span>
        ))}
        {items.length > 8 && (
          <span className="px-2 py-0.5 rounded-md bg-white/[0.04] text-xs text-neutral-600">+{items.length - 8}</span>
        )}
      </div>
    </div>
  );
}
