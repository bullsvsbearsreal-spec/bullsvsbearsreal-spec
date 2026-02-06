'use client';

import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, TrendingDown } from 'lucide-react';
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
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Top Open Interest</h3>
            <p className="text-hub-gray-text text-xs">By total OI value</p>
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse h-12 bg-hub-gray/30 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {oiData.slice(0, 5).map((item, index) => (
            <div
              key={`${item.symbol}-${item.exchange}`}
              className="flex items-center justify-between p-3 rounded-xl bg-hub-gray/30 hover:bg-hub-gray/40 transition-all"
            >
              <div className="flex items-center gap-3">
                <span className="text-hub-gray-text text-xs w-5">{index + 1}</span>
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/30 to-blue-600/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-blue-400">
                    {item.symbol.slice(0, 2)}
                  </span>
                </div>
                <div>
                  <span className="text-white font-medium">{item.symbol}</span>
                  <span className="text-hub-gray-text text-xs ml-2">{item.exchange}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-white font-semibold text-sm">
                  {formatValue(item.openInterestValue)}
                </div>
                <div className="text-hub-gray-text text-xs">
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
