'use client';

import { useMemo } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface FundingEntry {
  symbol: string;
  exchange: string;
  rate: number;
  openInterest?: number;
}

interface WeightedFundingIndexProps {
  fundingRates: FundingEntry[];
}

/** Bucket boundaries for the distribution chart */
const BUCKETS = [
  { label: '< -0.1', min: -Infinity, max: -0.1 },
  { label: '-0.1 to -0.01', min: -0.1, max: -0.01 },
  { label: '-0.01 to 0', min: -0.01, max: 0 },
  { label: '0 to 0.01', min: 0, max: 0.01 },
  { label: '0.01 to 0.1', min: 0.01, max: 0.1 },
  { label: '> 0.1', min: 0.1, max: Infinity },
];

export default function WeightedFundingIndex({ fundingRates }: WeightedFundingIndexProps) {
  const { weightedRate, positiveCount, negativeCount, distribution, hasOI } = useMemo(() => {
    if (fundingRates.length === 0) {
      return { weightedRate: 0, positiveCount: 0, negativeCount: 0, distribution: [], hasOI: false };
    }

    // Compute OI-weighted average
    let sumWeighted = 0;
    let sumOI = 0;
    let sumSimple = 0;
    let pos = 0;
    let neg = 0;

    for (const fr of fundingRates) {
      const oi = fr.openInterest ?? 0;
      if (oi > 0) {
        sumWeighted += fr.rate * oi;
        sumOI += oi;
      }
      sumSimple += fr.rate;
      if (fr.rate > 0) pos++;
      else if (fr.rate < 0) neg++;
    }

    const hasOIData = sumOI > 0;
    const avg = hasOIData ? sumWeighted / sumOI : sumSimple / fundingRates.length;

    // Build distribution buckets
    const counts = new Array(BUCKETS.length).fill(0);
    for (const fr of fundingRates) {
      for (let i = 0; i < BUCKETS.length; i++) {
        const b = BUCKETS[i];
        if (fr.rate >= b.min && fr.rate < b.max) {
          counts[i]++;
          break;
        }
        // Last bucket is inclusive on max
        if (i === BUCKETS.length - 1) {
          counts[i]++;
        }
      }
    }

    const dist = BUCKETS.map((b, i) => ({
      label: b.label,
      count: counts[i],
      isNegative: b.max <= 0,
      isPositive: b.min >= 0,
    }));

    return { weightedRate: avg, positiveCount: pos, negativeCount: neg, distribution: dist, hasOI: hasOIData };
  }, [fundingRates]);

  if (fundingRates.length === 0) return null;

  const isPositive = weightedRate > 0;
  const isNeutral = Math.abs(weightedRate) < 0.005;
  const moodLabel = isNeutral ? 'Neutral' : isPositive ? 'Longs paying' : 'Shorts paying';
  const moodColor = isNeutral ? 'text-neutral-400' : isPositive ? 'text-emerald-400' : 'text-rose-400';
  const rateColor = isNeutral ? 'text-neutral-300' : isPositive ? 'text-emerald-400' : 'text-rose-400';

  const abs = Math.abs(weightedRate);
  const decimals = abs >= 10 ? 2 : abs >= 1 ? 3 : 4;
  const formatted = weightedRate >= 0
    ? `+${weightedRate.toFixed(decimals)}%`
    : `${weightedRate.toFixed(decimals)}%`;

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
      {/* Label */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-hub-yellow text-[10px] font-semibold uppercase tracking-[0.1em]">
          {hasOI ? 'OI-Weighted Avg Funding' : 'Avg Funding Rate'}
        </span>
      </div>

      {/* Large weighted rate */}
      <div className={`text-2xl font-bold font-mono tracking-tight ${rateColor}`}>
        {formatted}
      </div>

      {/* Market mood */}
      <div className="flex items-center gap-2 mt-1">
        <span className={`text-xs font-semibold ${moodColor}`}>{moodLabel}</span>
        <span className="text-neutral-600 text-[10px]">
          {positiveCount} positive / {negativeCount} negative
        </span>
      </div>

      {/* Mini distribution chart */}
      <div className="mt-3 h-[60px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={distribution} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="label" hide />
            <YAxis hide />
            <Tooltip
              cursor={false}
              contentStyle={{
                background: '#1a1a1a',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                fontSize: '11px',
                color: '#ccc',
              }}
              formatter={(value: number) => [`${value} pairs`, 'Count']}
              labelFormatter={(label: string) => `Rate: ${label}%`}
            />
            <Bar dataKey="count" radius={[2, 2, 0, 0]} maxBarSize={24}>
              {distribution.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={entry.isNegative ? 'rgba(244,63,94,0.6)' : entry.isPositive ? 'rgba(16,185,129,0.6)' : 'rgba(115,115,115,0.4)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
