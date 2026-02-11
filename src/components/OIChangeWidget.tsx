'use client';

import { useState, useEffect } from 'react';
import { TokenIconSimple } from './TokenIcon';
import { fetchOIChanges } from '@/lib/api/aggregator';
import { OpenInterestData } from '@/lib/api/types';

function formatValue(num: number): string {
  if (num === undefined || num === null || isNaN(num)) return '$0';
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
  return `$${num.toFixed(0)}`;
}

export default function OIChangeWidget() {
  const [oiData, setOIData] = useState<OpenInterestData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await fetchOIChanges();
        setOIData(data);
      } catch (error) {
        console.error('Failed to fetch OI changes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold text-sm">Top Open Interest</h3>
        <span className="text-neutral-600 text-[10px]">By value</span>
      </div>

      {loading ? (
        <div className="space-y-1.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse h-10 bg-white/[0.03] rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {oiData.slice(0, 5).map((item, index) => (
            <div
              key={`${item.symbol}-${item.exchange}`}
              className="flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-white/[0.03] transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-neutral-600 text-[10px] font-mono w-3">{index + 1}</span>
                <TokenIconSimple symbol={item.symbol} size={20} />
                <div className="flex items-center gap-1.5">
                  <span className="text-white font-medium text-xs">{item.symbol}</span>
                  <span className="text-neutral-600 text-[10px]">{item.exchange}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-white font-mono font-semibold text-xs">
                  {formatValue(item.openInterestValue)}
                </div>
                <div className="text-neutral-600 text-[10px] font-mono">
                  {item.openInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
