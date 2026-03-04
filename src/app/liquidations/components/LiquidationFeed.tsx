'use client';

import { useRef, useEffect, useMemo } from 'react';
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

  // Filter data by side
  const filteredData = useMemo(() => {
    if (sideFilter === 'all') return data;
    return data.filter((item) => item.side === sideFilter);
  }, [data, sideFilter]);

  // Track the latest timestamp to detect genuinely new items
  const latestTs = data.length > 0 ? data[0].ts : 0;
  const hasNewItems = latestTs > prevLatestTs.current && prevLatestTs.current > 0;

  // Auto-scroll to top when new items arrive
  useEffect(() => {
    if (latestTs > prevLatestTs.current && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
    prevLatestTs.current = latestTs;
  }, [latestTs]);

  return (
    <div className="flex flex-col h-full border border-white/[0.06] rounded-xl bg-[#0a0a0a] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-white/[0.02] border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-hub-yellow" />
          <span className="text-sm font-medium text-white">Live Feed</span>
          <span className="text-[10px] font-mono bg-white/[0.06] text-neutral-400 px-1.5 py-0.5 rounded-full">
            {filteredData.length}
          </span>
        </div>

        {/* Side filter pills */}
        <div className="flex items-center gap-1">
          {SIDE_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => onSideFilterChange(opt)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                sideFilter === opt
                  ? 'bg-hub-yellow/20 text-hub-yellow'
                  : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04]'
              }`}
            >
              {opt[0].toUpperCase() + opt.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full py-12 gap-3">
            <Loader2 className="w-5 h-5 text-neutral-500 animate-spin" />
            <span className="text-xs text-neutral-600">Loading liquidations...</span>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 gap-3">
            <Zap className="w-5 h-5 text-neutral-700" />
            <span className="text-xs text-neutral-600">No liquidations in this timeframe</span>
          </div>
        ) : (
          filteredData.map((item, idx) => (
            <LiquidationFeedRow
              key={`${item.exchange}-${item.symbol}-${item.ts}-${idx}`}
              symbol={item.symbol}
              side={item.side}
              value={item.valueUsd}
              exchange={item.exchange}
              timestamp={item.ts}
              isNew={idx === 0 && hasNewItems}
            />
          ))
        )}
      </div>
    </div>
  );
}
