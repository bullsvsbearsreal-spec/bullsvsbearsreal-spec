'use client';

import { GitCompareArrows, Percent, BarChart3, Layers } from 'lucide-react';
import type { PredictionArbitrage, PredictionMarketsResponse } from '@/lib/api/prediction-markets/types';

interface StatsCardsProps {
  arbitrage: PredictionArbitrage[];
  meta?: PredictionMarketsResponse['meta'];
}

export default function StatsCards({ arbitrage, meta }: StatsCardsProps) {
  const bestSpread = arbitrage.length > 0 ? arbitrage[0].spreadPercent : 0;
  const avgSpread = arbitrage.length > 0
    ? +(arbitrage.reduce((s, a) => s + a.spreadPercent, 0) / arbitrage.length).toFixed(2)
    : 0;
  const curatedCount = arbitrage.filter(a => a.matchType === 'curated').length;

  const totalMarkets = meta
    ? Object.values(meta.counts).reduce((s, n) => s + n, 0)
    : 0;
  const activePlatforms = meta
    ? Object.values(meta.counts).filter(c => c > 0).length
    : 0;

  const stats = [
    {
      label: 'Matched Pairs',
      value: String(arbitrage.length),
      sub: `${curatedCount} curated`,
      icon: GitCompareArrows,
      iconBg: 'bg-purple-500/10',
      iconColor: 'text-purple-400',
    },
    {
      label: 'Best Spread',
      value: `${bestSpread.toFixed(1)}%`,
      sub: arbitrage[0]?.question?.slice(0, 30) || '-',
      icon: Percent,
      iconBg: 'bg-green-500/10',
      iconColor: 'text-green-400',
    },
    {
      label: 'Avg Spread',
      value: `${avgSpread.toFixed(1)}%`,
      sub: 'across all pairs',
      icon: BarChart3,
      iconBg: 'bg-hub-yellow/10',
      iconColor: 'text-hub-yellow',
    },
    {
      label: 'Markets',
      value: String(totalMarkets),
      sub: `${activePlatforms} platforms`,
      icon: Layers,
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      {stats.map(s => {
        const Icon = s.icon;
        return (
          <div key={s.label} className="card-premium p-4">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${s.iconBg}`}>
                <Icon className={`w-4 h-4 ${s.iconColor}`} />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-0.5">{s.label}</div>
                <div className="text-xl font-bold text-white font-mono leading-tight">{s.value}</div>
                <div className="text-[11px] text-neutral-600 truncate">{s.sub}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
