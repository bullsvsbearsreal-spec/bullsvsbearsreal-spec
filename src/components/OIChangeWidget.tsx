'use client';

import { useState, useEffect } from 'react';
import { TokenIconSimple } from './TokenIcon';
import WatchlistStar from './WatchlistStar';
import { fetchOIChanges } from '@/lib/api/aggregator';
import { OpenInterestData } from '@/lib/api/types';
import { formatUSD } from '@/lib/utils/format';
import { BarChart3, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function OIChangeWidget() {
  const [oiData, setOIData] = useState<OpenInterestData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = async () => {
    try {
      const data = await fetchOIChanges();
      setOIData(data);
      setError(false);
    } catch (err) {
      console.error('Failed to fetch OI changes:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

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
          <button onClick={() => { setLoading(true); loadData(); }} className="text-hub-yellow text-xs hover:underline">Retry</button>
        </div>
      ) : (
        <div className="space-y-1">
          {oiData.slice(0, 5).map((item, index) => (
            <div
              key={`${item.symbol}-${item.exchange}`}
              className="data-row-premium flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <span className="text-neutral-700 text-[10px] font-mono w-3">{index + 1}</span>
                <WatchlistStar symbol={item.symbol} />
                <TokenIconSimple symbol={item.symbol} size={20} />
                <div className="flex flex-col">
                  <span className="text-white font-medium text-xs">{item.symbol}</span>
                  <span className="text-neutral-600 text-[9px] leading-none">{item.exchange}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-white font-mono font-bold text-xs tabular-nums">
                  {formatUSD(item.openInterestValue)}
                </div>
                <div className="text-neutral-600 text-[9px] font-mono tabular-nums">
                  {item.openInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })} contracts
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
