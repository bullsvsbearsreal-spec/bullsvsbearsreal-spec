'use client';

import { useState, useEffect } from 'react';
import { fetchMarketStats } from '@/lib/api/aggregator';

interface MarketStats {
  totalVolume24h: number;
  totalOpenInterest: number;
  btcLongShort: { longRatio: number; shortRatio: number };
  btcDominance: number;
}

function formatLargeNumber(num: number): string {
  if (num === undefined || num === null || isNaN(num)) return '$0';
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  return `$${num.toLocaleString()}`;
}

export default function TopStatsBar() {
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [liqStats, setLiqStats] = useState({ total: 0, longs: 0, shorts: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await fetchMarketStats();
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch market stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleLiqUpdate = (event: CustomEvent) => {
      setLiqStats(event.detail);
    };
    window.addEventListener('liquidationUpdate' as any, handleLiqUpdate);
    return () => window.removeEventListener('liquidationUpdate' as any, handleLiqUpdate);
  }, []);

  if (loading || !stats) {
    return (
      <div className="bg-gradient-to-r from-hub-black via-hub-dark to-hub-black border-b border-hub-gray/10">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex flex-col gap-1">
                  <div className="h-3 w-16 bg-hub-gray/20 rounded" />
                  <div className="h-5 w-24 bg-hub-gray/30 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const statItems = [
    {
      label: 'Volume 24H',
      value: formatLargeNumber(stats.totalVolume24h),
    },
    {
      label: 'Open Interest',
      value: formatLargeNumber(stats.totalOpenInterest),
    },
    {
      label: 'BTC Dominance',
      value: `${stats.btcDominance?.toFixed(1) || '54.2'}%`,
    },
    {
      label: 'Long/Short',
      value: `${stats.btcLongShort.longRatio.toFixed(1)}% / ${stats.btcLongShort.shortRatio.toFixed(1)}%`,
      isLongDominant: stats.btcLongShort.longRatio > 50,
    },
  ];

  return (
    <div className="bg-gradient-to-r from-hub-black via-hub-dark to-hub-black border-b border-hub-gray/10">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Stats */}
          <div className="flex items-center gap-6 md:gap-10 overflow-x-auto scrollbar-hide">
            {statItems.map((item, index) => (
              <div key={index} className="flex flex-col min-w-fit">
                <span className="text-[10px] uppercase tracking-wider text-hub-gray-text/70 mb-0.5">
                  {item.label}
                </span>
                <span className={`text-sm font-semibold tracking-tight ${
                  'isLongDominant' in item
                    ? item.isLongDominant ? 'text-success' : 'text-danger'
                    : 'text-white'
                }`}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>

          {/* Live Status */}
          <div className="flex items-center gap-2 pl-4 border-l border-hub-gray/20">
            <div className="relative">
              <span className="absolute inset-0 h-2 w-2 rounded-full bg-success animate-ping opacity-75"></span>
              <span className="relative h-2 w-2 rounded-full bg-success block"></span>
            </div>
            <span className="text-xs font-medium text-white/80">Live</span>
          </div>
        </div>
      </div>
    </div>
  );
}
