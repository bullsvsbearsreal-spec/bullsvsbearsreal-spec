'use client';

import { useState, useEffect } from 'react';
import { fetchAllTickers, fetchAllOpenInterest, fetchAllFundingRates } from '@/lib/api/aggregator';
import { formatNumber } from '@/lib/utils/format';

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

        // Top gainer/loser from CMC spot market data (accurate, real-time)
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 stagger-container">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="card-hub rounded-lg px-3 py-2.5 animate-pulse stagger-item">
            <div className="h-3 w-16 bg-white/[0.06] rounded mb-2" />
            <div className="h-5 w-20 bg-white/[0.06] rounded" />
          </div>
        ))}
      </div>
    );
  }

  const statItems = [
    { label: '24h Volume', value: formatNumber(stats.totalVolume) },
    { label: 'Open Interest', value: formatNumber(stats.totalOI) },
    {
      label: 'Avg Funding',
      value: `${stats.avgFunding >= 0 ? '+' : ''}${stats.avgFunding.toFixed(4)}%`,
      color: stats.avgFunding >= 0 ? 'text-green-400' : 'text-red-400',
    },
    {
      label: 'Top Gainer',
      value: stats.topGainer.symbol,
      sub: `${stats.topGainer.change >= 0 ? '+' : ''}${stats.topGainer.change.toFixed(1)}%`,
      subColor: 'text-green-400',
    },
    {
      label: 'Top Loser',
      value: stats.topLoser.symbol,
      sub: `${stats.topLoser.change.toFixed(1)}%`,
      subColor: 'text-red-400',
    },
    { label: 'Markets', value: stats.activeMarkets.toString() },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 stagger-container">
      {statItems.map((item) => (
        <div key={item.label} className="card-hub rounded-lg px-3 py-2.5 stagger-item">
          <span className="text-neutral-600 text-[10px] uppercase tracking-wider">{item.label}</span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className={`text-sm font-bold font-mono ${item.color || 'text-white'}`}>
              {item.value}
            </span>
            {item.sub && (
              <span className={`text-[10px] font-mono ${item.subColor}`}>{item.sub}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
