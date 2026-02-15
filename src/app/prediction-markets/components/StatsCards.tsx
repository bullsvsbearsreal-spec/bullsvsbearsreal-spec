'use client';

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
    { label: 'Matched Pairs', value: String(arbitrage.length), sub: `${curatedCount} curated` },
    { label: 'Best Spread', value: `${bestSpread.toFixed(1)}%`, sub: arbitrage[0]?.question?.slice(0, 30) || '-' },
    { label: 'Avg Spread', value: `${avgSpread.toFixed(1)}%`, sub: 'across all pairs' },
    { label: 'Markets', value: String(totalMarkets), sub: `${activePlatforms} platforms` },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      {stats.map(s => (
        <div key={s.label} className="card-premium p-4">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">{s.label}</div>
          <div className="text-xl font-bold text-white font-mono">{s.value}</div>
          <div className="text-[11px] text-neutral-600 truncate">{s.sub}</div>
        </div>
      ))}
    </div>
  );
}
