'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Percent, Activity } from 'lucide-react';
import { fetchAllTickers, fetchAllOpenInterest, fetchAllFundingRates } from '@/lib/api/aggregator';

interface StatCardProps {
  title: string;
  value: string;
  change?: number;
  icon: React.ReactNode;
  delay?: number;
}

function StatCard({ title, value, change, icon, delay = 0 }: StatCardProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={`bg-hub-gray/30 rounded-xl p-4 transition-all duration-300 hover:bg-hub-gray/40 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-hub-gray-text text-xs uppercase tracking-wide">{title}</span>
        {change !== undefined && (
          <span className={`text-xs font-semibold ${change >= 0 ? 'text-success' : 'text-danger'}`}>
            {change >= 0 ? '+' : ''}{change.toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  );
}

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

        // Find top gainer and loser
        const sortedByChange = [...tickers].sort((a, b) =>
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
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="stat-card">
            <div className="skeleton h-10 w-10 rounded-xl mb-4" />
            <div className="skeleton h-4 w-20 mb-2" />
            <div className="skeleton h-8 w-32" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <StatCard
        title="24h Volume"
        value={formatNumber(stats.totalVolume)}
        icon={<DollarSign className="w-5 h-5 text-hub-yellow" />}
        delay={0}
      />
      <StatCard
        title="Open Interest"
        value={formatNumber(stats.totalOI)}
        icon={<BarChart3 className="w-5 h-5 text-hub-yellow" />}
        delay={100}
      />
      <StatCard
        title="Avg Funding"
        value={`${(stats.avgFunding >= 0 ? '+' : '')}${stats.avgFunding.toFixed(4)}%`}
        icon={<Percent className="w-5 h-5 text-hub-yellow" />}
        delay={200}
      />
      <StatCard
        title="Top Gainer"
        value={stats.topGainer.symbol}
        change={stats.topGainer.change}
        icon={<TrendingUp className="w-5 h-5 text-success" />}
        delay={300}
      />
      <StatCard
        title="Top Loser"
        value={stats.topLoser.symbol}
        change={stats.topLoser.change}
        icon={<TrendingDown className="w-5 h-5 text-danger" />}
        delay={400}
      />
      <StatCard
        title="Active Markets"
        value={stats.activeMarkets.toString()}
        icon={<Activity className="w-5 h-5 text-hub-yellow" />}
        delay={500}
      />
    </div>
  );
}
