'use client';

import { TokenIconSimple } from './TokenIcon';
import WatchlistStar from './WatchlistStar';
import { useOIChanges } from '@/hooks/useSWRApi';
import { formatUSD } from '@/lib/utils/format';
import { BarChart3, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function OIChangeWidget() {
  const { data: oiData, isLoading: loading, error: errorMsg, refresh: loadData } = useOIChanges();
  const error = !!errorMsg;

  return (
    <div className="card-premium p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-blue-400/10 flex items-center justify-center">
            <BarChart3 className="w-3 h-3 text-blue-400" />
          </div>
          <h3 className="text-white font-semibold text-sm">Top Open Interest</h3>
        </div>
        <Link href="/open-interest" className="group/link flex items-center gap-1 text-hub-yellow/60 hover:text-hub-yellow text-[10px] font-medium transition-colors">
          View All <ChevronRight className="w-3 h-3 group-hover/link:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-1.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse h-10 bg-white/[0.03] rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-6">
          <p className="text-neutral-500 text-xs mb-2">Failed to load data</p>
          <button onClick={() => loadData()} className="text-hub-yellow text-xs hover:underline">Retry</button>
        </div>
      ) : (
        <div className="ranked-list space-y-0.5">
          {(oiData ?? []).slice(0, 5).map((item, index) => {
            const isExtremeChange = (item.pct1h != null && Math.abs(item.pct1h) >= 10) ||
                                    (item.pct24h != null && Math.abs(item.pct24h) >= 15);
            return (
              <div
                key={`${item.symbol}-${item.exchange}`}
                className="rank-row"
              >
                <span className={`rank-number ${index < 3 ? 'rank-number-top' : ''}`}>{index + 1}</span>
                <WatchlistStar symbol={item.symbol} />
                <TokenIconSimple symbol={item.symbol} size={20} />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-white font-medium text-xs">{item.symbol}</span>
                  <span className="text-neutral-600 text-[9px] leading-none">{item.exchange}</span>
                </div>
                <div className="text-right">
                  <div className="text-white font-mono font-bold text-sm tabular-nums tracking-tight">
                    {formatUSD(item.openInterestValue)}
                  </div>
                  <div className="flex items-center gap-1.5 justify-end">
                    {item.pct1h != null && (
                      <span className={`delta-badge text-[9px] ${
                        Math.abs(item.pct1h) >= 10
                          ? (item.pct1h > 0 ? 'delta-badge-extreme-up' : 'delta-badge-extreme-down')
                          : (item.pct1h > 0 ? 'delta-badge-up' : item.pct1h < 0 ? 'delta-badge-down' : 'bg-white/5 text-neutral-600')
                      }`}>
                        {item.pct1h > 0 ? '+' : ''}{item.pct1h.toFixed(1)}%
                      </span>
                    )}
                    {item.pct24h != null && (
                      <span className={`text-[9px] font-mono tabular-nums ${item.pct24h > 0 ? 'text-green-400/60' : item.pct24h < 0 ? 'text-red-400/60' : 'text-neutral-600'}`}>
                        24h {item.pct24h > 0 ? '+' : ''}{item.pct24h.toFixed(1)}%
                      </span>
                    )}
                    {item.pct1h == null && item.pct24h == null && (
                      <span className="text-neutral-600 text-[9px] font-mono tabular-nums">
                        {item.openInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })} contracts
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
