'use client';

import { useState, useEffect } from 'react';
import WidgetSkeleton from '../WidgetSkeleton';
import UpdatedAgo from '../UpdatedAgo';

interface ExchangeInfo {
  exchange: string;
  count: number;
}

export default function ExchangeStatusWidget() {
  const [exchanges, setExchanges] = useState<ExchangeInfo[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch('/api/funding?assetClass=crypto');
        if (!res.ok) return;
        const json = await res.json();
        const data: { exchange: string }[] = json?.data || [];

        // Count entries per exchange as a proxy for health
        const counts: Record<string, number> = {};
        for (const e of data) {
          if (!e.exchange) continue;
          counts[e.exchange] = (counts[e.exchange] || 0) + 1;
        }

        const sorted = Object.entries(counts)
          .map(([exchange, count]) => ({ exchange, count }))
          .sort((a, b) => b.count - a.count);

        if (mounted) {
          setExchanges(sorted);
          setUpdatedAt(Date.now());
        }
      } catch (err) { console.error('[ExchangeStatus] error:', err); }
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  if (!exchanges) return <WidgetSkeleton variant="list" />;

  return (
    <div>
      <div className="space-y-1">
        {exchanges.slice(0, 10).map(ex => {
          const status = ex.count > 20 ? 'green' : ex.count > 5 ? 'yellow' : 'red';
          return (
            <div key={ex.exchange} className="flex items-center gap-2 text-xs py-0.5">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                status === 'green' ? 'bg-green-500' :
                status === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
              }`} />
              <span className="text-neutral-300 flex-1 truncate">{ex.exchange}</span>
              <span className="font-mono text-neutral-500 text-[10px]">{ex.count} pairs</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-neutral-600">{exchanges.length} exchanges active</span>
        <UpdatedAgo ts={updatedAt} />
      </div>
    </div>
  );
}
