'use client';

import { useRef, useEffect, useMemo, useState } from 'react';
import { Zap, Loader2 } from 'lucide-react';
import LiquidationFeedRow from './LiquidationFeedRow';

interface LiquidationItem {
  symbol: string;
  exchange: string;
  side: 'long' | 'short';
  price: number;
  quantity: number;
  valueUsd: number;
  ts: number;
}

interface LiquidationFeedProps {
  data: LiquidationItem[];
  isLoading: boolean;
  sideFilter: 'all' | 'long' | 'short';
  onSideFilterChange: (f: 'all' | 'long' | 'short') => void;
}

const SIDE_OPTIONS = ['all', 'long', 'short'] as const;

export default function LiquidationFeed({
  data,
  isLoading,
  sideFilter,
  onSideFilterChange,
}: LiquidationFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLatestTs = useRef(0);

  // Tick counter to force timestamp re-renders every 10s
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const filteredData = useMemo(() => {
    if (sideFilter === 'all') return data;
    return data.filter((item) => item.side === sideFilter);
  }, [data, sideFilter]);

  const latestTs = data.length > 0 ? data[0].ts : 0;
  const hasNewItems = latestTs > prevLatestTs.current && prevLatestTs.current > 0;

  useEffect(() => {
    if (latestTs > prevLatestTs.current && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
    prevLatestTs.current = latestTs;
  }, [latestTs]);

  return (
    <div className="flex flex-col h-full border border-hub-subtle rounded-2xl bg-hub-dark/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-hub-subtle shrink-0">
        <div className="flex items-center gap-2.5">
          <Zap className="w-4 h-4 text-hub-yellow" />
          <span className="text-sm font-medium text-neutral-300">Live Feed</span>
          {filteredData.length > 0 && (
            <span className="text-[10px] font-mono bg-white/[0.04] text-neutral-500 px-1.5 py-0.5 rounded-md tabular-nums">
              {filteredData.length}
            </span>
          )}
        </div>

        {/* Side filter */}
        <div className="flex items-center bg-hub-dark/60 border border-hub-subtle rounded-lg p-0.5" role="tablist" aria-label="Side filter">
          {SIDE_OPTIONS.map((opt) => (
            <button
              key={opt}
              role="tab"
              aria-selected={sideFilter === opt}
              onClick={() => onSideFilterChange(opt)}
              className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                sideFilter === opt
                  ? opt === 'long'
                    ? 'bg-red-500/10 text-red-400'
                    : opt === 'short'
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-white/[0.06] text-white'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {opt[0].toUpperCase() + opt.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full py-16 gap-3">
            <Loader2 className="w-5 h-5 text-neutral-500 animate-spin" />
            <p className="text-sm text-neutral-500">Connecting to live feeds...</p>
            <p className="text-xs text-neutral-600">Streaming from 8 exchanges in real-time</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 gap-3">
            <Zap className="w-6 h-6 text-neutral-700" />
            <p className="text-sm text-neutral-500">No recent liquidations</p>
            <p className="text-xs text-neutral-600">Market conditions are calm. Liquidations appear here in real-time.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {filteredData.map((item, idx) => (
              <LiquidationFeedRow
                key={`${item.exchange}-${item.symbol}-${item.ts}-${idx}`}
                symbol={item.symbol}
                side={item.side}
                value={item.valueUsd}
                exchange={item.exchange}
                timestamp={item.ts}
                isNew={idx === 0 && hasNewItems}
                tick={tick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
