'use client';

import { useState, useEffect } from 'react';
import { fetchMarketStats } from '@/lib/api/aggregator';
import { TrendingUp, BarChart3, PieChart, Activity } from 'lucide-react';

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

// Animated number component
function AnimatedValue({ value, className }: { value: string; className?: string }) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (value !== displayValue) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setDisplayValue(value);
        setIsAnimating(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [value, displayValue]);

  return (
    <span className={`${className} transition-all duration-300 ${isAnimating ? 'opacity-50 scale-95' : 'opacity-100 scale-100'}`}>
      {displayValue}
    </span>
  );
}

export default function TopStatsBar() {
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
      <div className="bg-gradient-to-r from-hub-black via-hub-dark to-hub-black border-b border-hub-gray/10">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-lg bg-hub-gray/20" />
                <div className="flex flex-col gap-1">
                  <div className="h-3 w-16 bg-hub-gray/20 rounded" />
                  <div className="h-5 w-20 bg-hub-gray/30 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const statItems = [
    {
      label: 'Volume 24H',
      value: formatLargeNumber(stats.totalVolume24h),
      icon: TrendingUp,
      color: 'text-hub-yellow',
      bgColor: 'bg-hub-yellow/10',
    },
    {
      label: 'Open Interest',
      value: formatLargeNumber(stats.totalOpenInterest),
      icon: BarChart3,
      color: 'text-blue-400',
      bgColor: 'bg-blue-400/10',
    },
    {
      label: 'BTC Dominance',
      value: `${stats.btcDominance?.toFixed(1) || '54.2'}%`,
      icon: PieChart,
      color: 'text-hub-orange',
      bgColor: 'bg-hub-orange/10',
    },
    {
      label: 'Long/Short',
      value: `${stats.btcLongShort.longRatio.toFixed(1)}% / ${stats.btcLongShort.shortRatio.toFixed(1)}%`,
      icon: Activity,
      isLongDominant: stats.btcLongShort.longRatio > 50,
      color: stats.btcLongShort.longRatio > 50 ? 'text-success' : 'text-danger',
      bgColor: stats.btcLongShort.longRatio > 50 ? 'bg-success/10' : 'bg-danger/10',
    },
  ];

  return (
    <div className="bg-gradient-to-r from-hub-black via-hub-dark to-hub-black border-b border-hub-gray/10">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {statItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={index}
                className={`flex items-center gap-3 transition-all duration-500 ${
                  mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                }`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div className={`w-9 h-9 rounded-lg ${item.bgColor} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-4 h-4 ${item.color}`} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] uppercase tracking-wider text-hub-gray-text/70">
                    {item.label}
                  </span>
                  <AnimatedValue
                    value={item.value}
                    className={`text-sm font-semibold tracking-tight truncate ${
                      'isLongDominant' in item
                        ? item.isLongDominant ? 'text-success' : 'text-danger'
                        : 'text-white'
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
