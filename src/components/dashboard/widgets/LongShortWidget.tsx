'use client';

import { useState, useEffect } from 'react';

interface LSData {
  longRatio: number;
  shortRatio: number;
  exchange: string;
  fallback?: boolean;
}

export default function LongShortWidget() {
  const [data, setData] = useState<LSData | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch('/api/longshort?symbol=BTCUSDT&source=global&limit=1');
        if (!res.ok) return;
        const json = await res.json();
        if (!mounted) return;
        setData({
          longRatio: json.longRatio ?? 50,
          shortRatio: json.shortRatio ?? 50,
          exchange: json.exchange || 'binance',
          fallback: json.fallback,
        });
      } catch (err) { console.error('[LongShort] fetch error:', err); }
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  if (!data) {
    return <div className="h-16 flex items-center justify-center"><div className="w-5 h-5 border-2 border-hub-yellow/30 border-t-hub-yellow rounded-full animate-spin" /></div>;
  }

  const longW = Math.max(data.longRatio, 5);
  const shortW = Math.max(data.shortRatio, 5);
  const total = longW + shortW;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-neutral-400">BTC Long/Short</span>
        <span className="text-[10px] text-neutral-600 capitalize">{data.exchange}</span>
      </div>

      {/* Stacked bar */}
      <div className="flex rounded-full overflow-hidden h-5 mb-2">
        <div
          className="flex items-center justify-center bg-green-500/80 transition-all"
          style={{ width: `${(longW / total) * 100}%` }}
        >
          <span className="text-[10px] font-bold text-white">{data.longRatio.toFixed(1)}%</span>
        </div>
        <div
          className="flex items-center justify-center bg-red-500/80 transition-all"
          style={{ width: `${(shortW / total) * 100}%` }}
        >
          <span className="text-[10px] font-bold text-white">{data.shortRatio.toFixed(1)}%</span>
        </div>
      </div>

      {/* Labels */}
      <div className="flex justify-between text-[10px]">
        <span className="text-green-400">Longs</span>
        <span className="text-red-400">Shorts</span>
      </div>
    </div>
  );
}
