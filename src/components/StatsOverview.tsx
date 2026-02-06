'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { fetchAllTickers, fetchAllOpenInterest, fetchAllFundingRates } from '@/lib/api/aggregator';

function formatNumber(num: number | undefined | null): string {
  if (num === undefined || num === null || isNaN(num)) return '$0';
  if (num >= 1e12) return `$${(num / 1e12).toFixed(1)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(0)}M`;
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
      <div className="flex flex-wrap gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-12 w-32 bg-hub-gray/30 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3 py-4 px-5 bg-hub-gray/20 rounded-xl border border-hub-gray/20">
      {/* Volume */}
      <div>
        <div className="text-hub-gray-text text-xs mb-0.5">24h Volume</div>
        <div className="text-white text-lg font-semibold">{formatNumber(stats.totalVolume)}</div>
      </div>

      {/* OI */}
      <div>
        <div className="text-hub-gray-text text-xs mb-0.5">Open Interest</div>
        <div className="text-white text-lg font-semibold">{formatNumber(stats.totalOI)}</div>
      </div>

      {/* Avg Funding */}
      <div>
        <div className="text-hub-gray-text text-xs mb-0.5">Avg Funding</div>
        <div className={`text-lg font-semibold ${stats.avgFunding >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {stats.avgFunding >= 0 ? '+' : ''}{stats.avgFunding.toFixed(4)}%
        </div>
      </div>

      {/* Top Gainer */}
      <div>
        <div className="text-hub-gray-text text-xs mb-0.5">Top Gainer</div>
        <div className="flex items-center gap-1.5">
          <span className="text-white text-lg font-semibold">{stats.topGainer.symbol}</span>
          <span className="text-green-400 text-sm flex items-center">
            <TrendingUp className="w-3 h-3 mr-0.5" />
            +{stats.topGainer.change.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Top Loser */}
      <div>
        <div className="text-hub-gray-text text-xs mb-0.5">Top Loser</div>
        <div className="flex items-center gap-1.5">
          <span className="text-white text-lg font-semibold">{stats.topLoser.symbol}</span>
          <span className="text-red-400 text-sm flex items-center">
            <TrendingDown className="w-3 h-3 mr-0.5" />
            {stats.topLoser.change.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Markets count */}
      <div>
        <div className="text-hub-gray-text text-xs mb-0.5">Markets</div>
        <div className="text-white text-lg font-semibold">{stats.activeMarkets}</div>
      </div>
    </div>
  );
}
