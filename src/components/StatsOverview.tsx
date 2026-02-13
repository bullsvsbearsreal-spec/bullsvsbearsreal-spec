'use client';

import { useState, useEffect } from 'react';
import { fetchAllTickers, fetchAllOpenInterest, fetchAllFundingRates } from '@/lib/api/aggregator';

function formatNumber(num: number | undefined | null): string {
  if (num === undefined || num === null || isNaN(num)) return '$0';
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  return `$${num.toLocaleString()}`;
}

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
        const [tickers, oiData, fundingRates] = await Promise.all([
          fetchAllTickers(),
          fetchAllOpenInterest(),
          fetchAllFundingRates(),
        ]);

        const totalVolume = tickers.reduce((sum, t) => sum + (t.quoteVolume24h || 0), 0);
        const totalOI = oiData.reduce((sum, o) => sum + (o.openInterestValue || 0), 0);

        const avgFunding = fundingRates.length > 0
          ? fundingRates.reduce((sum, f) => sum + (f.fundingRate || 0), 0) / fundingRates.length
          : 0;

        // Count exchanges per symbol to filter ghost/delisted pairs
        const exchangeCount = new Map<string, number>();
        tickers.forEach((t: any) => exchangeCount.set(t.symbol, (exchangeCount.get(t.symbol) || 0) + 1));

        // Filter for meaningful movers: volume, sane % change, listed on 2+ exchanges
        const meaningfulTickers = tickers.filter(t =>
          (t.quoteVolume24h || 0) >= 1_000_000 &&
          Math.abs(t.priceChangePercent24h || 0) <= 200 &&
          (exchangeCount.get(t.symbol) || 0) >= 2
        );
        const sortedByChange = [...(meaningfulTickers.length > 0 ? meaningfulTickers : tickers)].sort((a, b) =>
          (b.priceChangePercent24h || 0) - (a.priceChangePercent24h || 0)
        );

        const topGainer = sortedByChange[0];
        const topLoser = sortedByChange[sortedByChange.length - 1];

        setStats({
          totalVolume,
          totalOI,
          avgFunding,
          topGainer: {
            symbol: (topGainer?.symbol || '').replace('USDT', ''),
            change: topGainer?.priceChangePercent24h || 0,
          },
          topLoser: {
            symbol: (topLoser?.symbol || '').replace('USDT', ''),
            change: topLoser?.priceChangePercent24h || 0,
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
          <div key={i} className="bg-[#111] border border-white/[0.06] rounded-lg px-3 py-2.5 animate-pulse">
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
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
      {statItems.map((item) => (
        <div key={item.label} className="bg-[#111] border border-white/[0.06] rounded-lg px-3 py-2.5">
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
