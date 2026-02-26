'use client';

import { useState, useEffect } from 'react';
import { fetchMarketStats } from '@/lib/api/aggregator';
import { formatNumber } from '@/lib/utils/format';

interface MarketStats {
  totalVolume24h: number;
  totalOpenInterest: number;
  btcLongShort: { longRatio: number; shortRatio: number };
  btcDominance: number;
}


export default function TopStatsBar() {
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading || !stats) {
    return (
      <div className="border-b border-white/[0.04] bg-hub-dark">
        <div className="max-w-[1400px] mx-auto px-4 py-2">
          <div className="flex items-center gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-2 animate-pulse">
                <div className="h-3 w-14 bg-white/[0.06] rounded" />
                <div className="h-3 w-16 bg-white/[0.06] rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const isLongDominant = stats.btcLongShort.longRatio > 50;

  const items = [
    { label: 'Vol 24H', value: formatNumber(stats.totalVolume24h) },
    { label: 'OI', value: formatNumber(stats.totalOpenInterest) },
    { label: 'BTC Dom', value: `${stats.btcDominance?.toFixed(1) || '54.2'}%` },
    {
      label: 'Long/Short',
      value: `${stats.btcLongShort.longRatio.toFixed(1)}/${stats.btcLongShort.shortRatio.toFixed(1)}`,
      color: isLongDominant ? 'text-green-400' : 'text-red-400',
    },
  ];

  return (
    <div className="border-b border-white/[0.04] bg-hub-dark">
      <div className="max-w-[1400px] mx-auto px-4 py-1.5">
        <div className="flex items-center gap-6 overflow-x-auto text-xs">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="text-neutral-600">{item.label}</span>
              <span className={`font-mono font-medium ${item.color || 'text-neutral-300'}`}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
