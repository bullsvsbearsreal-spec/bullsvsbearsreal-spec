'use client';

import { GitCompareArrows, Zap, DollarSign, TrendingUp, Droplets } from 'lucide-react';
import type { PredictionArbitrage, PredictionMarketsResponse } from '@/lib/api/prediction-markets/types';

interface StatsCardsProps {
  arbitrage: PredictionArbitrage[];
  meta?: PredictionMarketsResponse['meta'];
}

function fmtVol(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export default function StatsCards({ arbitrage, meta }: StatsCardsProps) {
  const bestSpread = arbitrage.length > 0 ? arbitrage[0].spreadPercent : 0;
  const avgSpread = arbitrage.length > 0
    ? +(arbitrage.reduce((s, a) => s + a.spreadPercent, 0) / arbitrage.length).toFixed(2)
    : 0;
  const curatedCount = arbitrage.filter(a => a.matchType === 'curated').length;
  const actionable = arbitrage.filter(a => a.spreadPercent >= 2).length;
  const totalVol24h = arbitrage.reduce((s, a) => s + (a.platformA.volume24h || 0) + (a.platformB.volume24h || 0), 0);

  // Liquidity stats — count pairs where BOTH sides have depth signals
  const withDepth = arbitrage.filter(a => {
    const hasA = a.platformA.liquidity > 0 || a.platformA.volume24h > 1000 || a.platformA.openInterest > 1000;
    const hasB = a.platformB.liquidity > 0 || a.platformB.volume24h > 1000 || a.platformB.openInterest > 1000;
    return hasA && hasB;
  });
  const totalLiq = arbitrage.reduce((s, a) => s + (a.platformA.liquidity || 0) + (a.platformB.liquidity || 0), 0);

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
      sub: `${curatedCount} curated · ${arbitrage.length - curatedCount} auto-matched`,
      icon: GitCompareArrows,
      iconBg: 'bg-purple-500/10',
      iconColor: 'text-purple-400',
      ring: 'ring-purple-500/20',
    },
    {
      label: 'Best Spread',
      value: `${bestSpread.toFixed(1)}%`,
      sub: arbitrage[0]?.question?.slice(0, 35) || 'No data yet',
      icon: TrendingUp,
      iconBg: 'bg-green-500/10',
      iconColor: 'text-green-400',
      ring: 'ring-green-500/20',
      highlight: bestSpread >= 5,
    },
    {
      label: 'Liquid Pairs',
      value: String(withDepth.length),
      sub: `${actionable} with 2%+ spread · ${fmtVol(totalLiq)} depth`,
      icon: Droplets,
      iconBg: 'bg-hub-yellow/10',
      iconColor: 'text-hub-yellow',
      ring: 'ring-hub-yellow/20',
      highlight: withDepth.length > 0,
    },
    {
      label: '24h Volume',
      value: fmtVol(totalVol24h),
      sub: `${totalMarkets} markets · ${activePlatforms} platforms`,
      icon: DollarSign,
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-400',
      ring: 'ring-blue-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      {stats.map(s => {
        const Icon = s.icon;
        return (
          <div key={s.label} className="card-premium p-4 group">
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${s.iconBg} ring-1 ${s.ring}`}>
                <Icon className={`w-4 h-4 ${s.iconColor}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">{s.label}</div>
                <div className={`text-xl font-bold font-mono leading-tight tabular-nums ${
                  s.highlight ? 'text-hub-yellow' : 'text-white'
                }`}>
                  {s.value}
                </div>
                <div className="text-[10px] text-neutral-600 truncate mt-0.5">{s.sub}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
