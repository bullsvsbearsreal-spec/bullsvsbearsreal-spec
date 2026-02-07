'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity, DollarSign, BarChart3, Zap, Users } from 'lucide-react';
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
    const interval = setInterval(fetchStats, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Listen for liquidation updates from WebSocket (if component is used with liquidations)
  useEffect(() => {
    const handleLiqUpdate = (event: CustomEvent) => {
      setLiqStats(event.detail);
    };
    window.addEventListener('liquidationUpdate' as any, handleLiqUpdate);
    return () => window.removeEventListener('liquidationUpdate' as any, handleLiqUpdate);
  }, []);

  if (loading || !stats) {
    return (
      <div className="bg-hub-black border-b border-hub-gray/30">
        <div className="max-w-full mx-auto px-4 py-2">
          <div className="flex items-center gap-6 overflow-x-auto scrollbar-hide animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-5 w-40 bg-hub-gray/30 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const statItems = [
    {
      label: '24h Volume',
      value: formatLargeNumber(stats.totalVolume24h),
      icon: DollarSign,
      color: 'text-hub-yellow',
    },
    {
      label: 'Open Interest',
      value: formatLargeNumber(stats.totalOpenInterest),
      icon: BarChart3,
      color: 'text-blue-400',
    },
    {
      label: '24h Liquidation',
      value: formatLargeNumber(liqStats.total),
      icon: Zap,
      color: 'text-orange-400',
    },
    {
      label: '24h Long/Short',
      value: `${stats.btcLongShort.longRatio.toFixed(2)}%/${stats.btcLongShort.shortRatio.toFixed(2)}%`,
      icon: Users,
      color: stats.btcLongShort.longRatio > 50 ? 'text-success' : 'text-danger',
    },
  ];

  return (
    <div className="bg-hub-black border-b border-hub-gray/30">
      <div className="max-w-full mx-auto px-4 py-2">
        <div className="flex items-center justify-center gap-4 md:gap-8 overflow-x-auto scrollbar-hide text-xs md:text-sm">
          {statItems.map((item, index) => (
            <div key={index} className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-hub-gray-text">{item.label}</span>
              <span className={`font-medium ${item.color}`}>{item.value}</span>
            </div>
          ))}

          {/* Live indicator */}
          <div className="flex items-center gap-1.5 text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success"></span>
            <span className="text-xs">Live</span>
          </div>
        </div>
      </div>
    </div>
  );
}
