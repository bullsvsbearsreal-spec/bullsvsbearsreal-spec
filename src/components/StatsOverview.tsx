'use client';

import { useState, useEffect } from 'react';
import { fetchAllTickers, fetchAllOpenInterest, fetchAllFundingRates } from '@/lib/api/aggregator';
import { formatNumber } from '@/lib/utils/format';
import { DollarSign, BarChart3, Percent, TrendingUp, TrendingDown, Layers } from 'lucide-react';

export default function StatsOverview() {
  const [stats, setStats] = useState({
    totalVolume: 0,
    totalOI: 0,
    avgFunding: 0,
    topGainer: { symbol: '-', change: 0 },
    topLoser: { symbol: '-', change: 0 },
    activeMarkets: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [tickers, oiData, fundingRates, moversRes] = await Promise.all([
          fetchAllTickers(),
          fetchAllOpenInterest(),
          fetchAllFundingRates(),
          fetch('/api/top-movers').then(r => r.json()).catch(() => ({ gainers: [], losers: [] })),
        ]);

        const totalVolume = tickers.reduce((sum, t) => sum + (t.quoteVolume24h || 0), 0);
        const totalOI = oiData.reduce((sum, o) => sum + (o.openInterestValue || 0), 0);

        const avgFunding = fundingRates.length > 0
          ? fundingRates.reduce((sum, f) => sum + (f.fundingRate || 0), 0) / fundingRates.length
          : 0;

        const topGainerCoin = moversRes.gainers?.[0];
        const topLoserCoin = moversRes.losers?.[0];

        setStats({
          totalVolume,
          totalOI,
          avgFunding,
          topGainer: {
            symbol: topGainerCoin?.symbol || '-',
            change: topGainerCoin?.change24h || 0,
          },
          topLoser: {
            symbol: topLoserCoin?.symbol || '-',
            change: topLoserCoin?.change24h || 0,
          },
          activeMarkets: tickers.length,
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="card-premium px-3 py-3 animate-pulse">
            <div className="h-3 w-16 bg-white/[0.06] rounded mb-2" />
            <div className="h-5 w-20 bg-white/[0.06] rounded" />
          </div>
        ))}
      </div>
    );
  }

  const statItems = [
    {
      label: '24h Volume',
      value: formatNumber(stats.totalVolume),
      icon: DollarSign,
      iconColor: 'text-hub-yellow',
      iconBg: 'bg-hub-yellow/10',
    },
    {
      label: 'Open Interest',
      value: formatNumber(stats.totalOI),
      icon: BarChart3,
      iconColor: 'text-blue-400',
      iconBg: 'bg-blue-400/10',
    },
    {
      label: 'Avg Funding',
      value: `${stats.avgFunding >= 0 ? '+' : ''}${stats.avgFunding.toFixed(4)}%`,
      color: stats.avgFunding >= 0 ? 'text-green-400' : 'text-red-400',
      icon: Percent,
      iconColor: stats.avgFunding >= 0 ? 'text-green-400' : 'text-red-400',
      iconBg: stats.avgFunding >= 0 ? 'bg-green-500/10' : 'bg-red-500/10',
    },
    {
      label: 'Top Gainer',
      value: stats.topGainer.symbol,
      sub: `${stats.topGainer.change >= 0 ? '+' : ''}${stats.topGainer.change.toFixed(1)}%`,
      subColor: 'text-green-400',
      icon: TrendingUp,
      iconColor: 'text-green-400',
      iconBg: 'bg-green-500/10',
    },
    {
      label: 'Top Loser',
      value: stats.topLoser.symbol,
      sub: `${stats.topLoser.change.toFixed(1)}%`,
      subColor: 'text-red-400',
      icon: TrendingDown,
      iconColor: 'text-red-400',
      iconBg: 'bg-red-500/10',
    },
    {
      label: 'Markets',
      value: stats.activeMarkets.toString(),
      icon: Layers,
      iconColor: 'text-purple-400',
      iconBg: 'bg-purple-400/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
      {statItems.map((item) => (
        <div key={item.label} className="card-premium px-3 py-3 group">
          <div className="flex items-center gap-2 mb-1.5">
            <div className={`w-5 h-5 rounded-md ${item.iconBg} flex items-center justify-center`}>
              <item.icon className={`w-3 h-3 ${item.iconColor}`} />
            </div>
            <span className="text-neutral-600 text-[10px] uppercase tracking-wider font-medium">{item.label}</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-sm font-bold font-mono tabular-nums ${item.color || 'text-white'}`}>
              {item.value}
            </span>
            {item.sub && (
              <span className={`text-[10px] font-mono font-semibold ${item.subColor}`}>{item.sub}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
