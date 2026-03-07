'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useApi, useTickers, useOpenInterest, useMarketStats } from '@/hooks/useSWRApi';
import { formatNumber } from '@/lib/utils/format';
import { DollarSign, BarChart3, TrendingUp, TrendingDown, Layers } from 'lucide-react';

export default function StatsOverview() {
  const { data: tickers } = useTickers();
  const { data: oiData } = useOpenInterest();
  const { data: marketStats } = useMarketStats();
  const { data: moversRes } = useApi({
    key: 'topMovers',
    fetcher: () => fetch('/api/top-movers').then(r => r.json()).catch(() => ({ gainers: [], losers: [] })),
    refreshInterval: 60_000,
  });

  const stats = useMemo(() => {
    // Use marketStats for volume + OI (single source of truth, consistent with TopStatsBar)
    const totalVolume = marketStats?.totalVolume24h ?? 0;
    const totalOI = marketStats?.totalOpenInterest ?? oiData?.reduce((sum, o) => sum + (o.openInterestValue || 0), 0) ?? 0;
    const topGainerCoin = moversRes?.gainers?.[0];
    const topLoserCoin = moversRes?.losers?.[0];
    return {
      totalVolume,
      totalOI,
      topGainer: { symbol: topGainerCoin?.symbol || '-', change: topGainerCoin?.change24h || 0 },
      topLoser: { symbol: topLoserCoin?.symbol || '-', change: topLoserCoin?.change24h || 0 },
      activeMarkets: tickers?.length ?? 0,
    };
  }, [tickers, oiData, moversRes, marketStats]);

  const isLoading = !tickers;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="card-premium px-3 py-3 animate-pulse">
            <div className="h-3 w-16 bg-white/[0.06] rounded mb-2" />
            <div className="h-5 w-20 bg-white/[0.06] rounded" />
          </div>
        ))}
      </div>
    );
  }

  // Skeleton placeholder for values that are still zero / empty after load
  const skeleton = <span className="inline-block h-5 w-16 bg-neutral-800 rounded animate-pulse" />;

  const statItems = [
    {
      label: '24h Volume',
      value: stats.totalVolume > 0 ? formatNumber(stats.totalVolume) : null,
      icon: DollarSign,
      iconColor: 'text-hub-yellow',
      iconBg: 'bg-hub-yellow/10',
      href: '/screener',
    },
    {
      label: 'Open Interest',
      value: stats.totalOI > 0 ? formatNumber(stats.totalOI) : null,
      icon: BarChart3,
      iconColor: 'text-blue-400',
      iconBg: 'bg-blue-400/10',
      href: '/open-interest',
    },
    {
      label: 'Top Gainer',
      value: stats.topGainer.symbol !== '-' ? stats.topGainer.symbol : null,
      sub: stats.topGainer.symbol !== '-' ? `${stats.topGainer.change >= 0 ? '+' : ''}${stats.topGainer.change.toFixed(1)}%` : null,
      subColor: 'text-green-400',
      icon: TrendingUp,
      iconColor: 'text-green-400',
      iconBg: 'bg-green-500/10',
      href: '/top-movers',
    },
    {
      label: 'Top Loser',
      value: stats.topLoser.symbol !== '-' ? stats.topLoser.symbol : null,
      sub: stats.topLoser.symbol !== '-' ? `${stats.topLoser.change.toFixed(1)}%` : null,
      subColor: 'text-red-400',
      icon: TrendingDown,
      iconColor: 'text-red-400',
      iconBg: 'bg-red-500/10',
      href: '/top-movers',
    },
    {
      label: 'Markets',
      value: stats.activeMarkets > 0 ? stats.activeMarkets.toString() : null,
      icon: Layers,
      iconColor: 'text-purple-400',
      iconBg: 'bg-purple-400/10',
      href: '/screener',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
      {statItems.map((item) => (
        <Link key={item.label} href={item.href} className="card-premium px-3 py-3 group cursor-pointer">
          <div className="flex items-center gap-2 mb-1.5">
            <div className={`w-5 h-5 rounded-md ${item.iconBg} flex items-center justify-center`}>
              <item.icon className={`w-3 h-3 ${item.iconColor}`} />
            </div>
            <span className="text-neutral-600 text-[10px] uppercase tracking-wider font-medium group-hover:text-neutral-400 transition-colors">{item.label}</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            {item.value !== null ? (
              <>
                <span className="text-sm font-bold font-mono tabular-nums text-white">
                  {item.value}
                </span>
                {item.sub && (
                  <span className={`text-[10px] font-mono font-semibold ${item.subColor}`}>{item.sub}</span>
                )}
              </>
            ) : skeleton}
          </div>
        </Link>
      ))}
    </div>
  );
}
