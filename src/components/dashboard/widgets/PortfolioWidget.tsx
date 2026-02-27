'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Briefcase } from 'lucide-react';
import { TokenIconSimple } from '@/components/TokenIcon';

export default function PortfolioWidget() {
  const [holdings, setHoldings] = useState<any[] | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/user/data');
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) setHoldings(data.portfolio || []);
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  if (holdings === null) {
    return <div className="h-12 flex items-center justify-center"><div className="w-5 h-5 border-2 border-hub-yellow/30 border-t-hub-yellow rounded-full animate-spin" /></div>;
  }

  if (holdings.length === 0) {
    return (
      <div className="text-center py-2">
        <Briefcase className="w-5 h-5 text-neutral-700 mx-auto mb-1" />
        <p className="text-xs text-neutral-600">No holdings yet</p>
        <Link href="/portfolio" className="text-[10px] text-hub-yellow hover:underline">Add holdings</Link>
      </div>
    );
  }

  return (
    <div>
      <p className="text-lg font-bold text-white mb-2">{holdings.length} holding{holdings.length !== 1 ? 's' : ''}</p>
      <div className="flex flex-wrap gap-1.5">
        {holdings.slice(0, 6).map((h: any, i: number) => (
          <span key={h.symbol || i} className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] text-xs text-neutral-400">
            <TokenIconSimple symbol={h.symbol} size={12} />
            {h.symbol}
          </span>
        ))}
        {holdings.length > 6 && (
          <span className="px-2 py-0.5 rounded-md bg-white/[0.04] text-xs text-neutral-600">+{holdings.length - 6}</span>
        )}
      </div>
    </div>
  );
}
