'use client';

import { useMemo } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';

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

function getMoodEmoji(rate: number): string {
  const abs = Math.abs(rate);
  if (abs < 0.002) return '';
  if (rate > 0.05) return '🔥';
  if (rate > 0.01) return '📈';
  if (rate < -0.05) return '💀';
  if (rate < -0.01) return '📉';
  return '';
}

function getMoodSlang(rate: number, hasOI: boolean): string {
  const abs = Math.abs(rate);
  if (abs < 0.002) return 'Dead flat — nobody paying';
  if (!hasOI) {
    return rate > 0 ? 'Longs paying shorts' : 'Shorts paying longs';
  }
  if (rate > 0.1) return 'Longs getting absolutely heemed';
  if (rate > 0.05) return 'Heavy premium — longs bleeding';
  if (rate > 0.01) return 'Longs paying — mild bullish pressure';
  if (rate > 0) return 'Slightly long-biased';
  if (rate < -0.1) return 'Shorts getting destroyed';
  if (rate < -0.05) return 'Shorts paying heavy — squeeze territory';
  if (rate < -0.01) return 'Shorts paying — bearish pressure';
  return 'Slightly short-biased';
}

export default function WeightedFundingIndex({ fundingRates }: WeightedFundingIndexProps) {
  const { weightedRate, positiveCount, negativeCount, distribution, hasOI, totalOI } = useMemo(() => {
    if (fundingRates.length === 0) {
      return { weightedRate: 0, positiveCount: 0, negativeCount: 0, distribution: [], hasOI: false, totalOI: 0 };
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

    return { weightedRate: avg, positiveCount: pos, negativeCount: neg, distribution: dist, hasOI: hasOIData, totalOI: sumOI };
  }, [fundingRates]);

  if (fundingRates.length === 0) return null;

  const isPositive = weightedRate > 0;
  const isNeutral = Math.abs(weightedRate) < 0.005;
  const isExtreme = Math.abs(weightedRate) >= 0.05;
  const rateColor = isNeutral
    ? 'text-neutral-300'
    : isPositive ? (isExtreme ? 'text-pump-hot' : 'text-emerald-400')
    : (isExtreme ? 'text-rekt-hot' : 'text-rose-400');

  const bgGradient = isNeutral
    ? 'rgba(255,255,255,0.03)'
    : isPositive ? 'rgba(16,185,129,0.04)'
    : 'rgba(244,63,94,0.04)';

  const borderColor = isNeutral
    ? 'rgba(255,255,255,0.06)'
    : isPositive ? 'rgba(16,185,129,0.12)'
    : 'rgba(244,63,94,0.12)';

  const abs = Math.abs(weightedRate);
  const decimals = abs >= 10 ? 2 : abs >= 1 ? 3 : 4;
  const formatted = weightedRate >= 0
    ? `+${weightedRate.toFixed(decimals)}%`
    : `${weightedRate.toFixed(decimals)}%`;

  const posRatio = positiveCount + negativeCount > 0
    ? Math.round((positiveCount / (positiveCount + negativeCount)) * 100)
    : 50;
  const negRatio = 100 - posRatio;

  const MoodIcon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;
  const moodSlang = getMoodSlang(weightedRate, hasOI);
  const moodEmoji = getMoodEmoji(weightedRate);

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: `linear-gradient(135deg, ${bgGradient} 0%, var(--hub-darker) 60%)`, border: `1px solid ${borderColor}` }}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-hub-yellow/50" />
            <span className="text-hub-yellow text-[10px] font-semibold uppercase tracking-[0.1em]">
              {hasOI ? 'OI-Weighted Avg Funding' : 'Avg Funding Rate'}
            </span>
          </div>
          {hasOI && totalOI > 0 && (
            <span className="text-[9px] text-neutral-700 font-mono">
              ${(totalOI / 1e9).toFixed(1)}B OI
            </span>
          )}
        </div>

        {/* Large weighted rate */}
        <div className="flex items-baseline gap-2">
          <span className={`text-3xl font-black font-mono tracking-tight ${rateColor}`}
            style={isExtreme ? { textShadow: isPositive ? '0 0 12px rgba(0, 230, 118, 0.3)' : '0 0 12px rgba(255, 23, 68, 0.3)' } : undefined}>
            {formatted}
          </span>
          {moodEmoji && <span className="text-lg">{moodEmoji}</span>}
        </div>

        {/* Market mood with icon */}
        <div className="flex items-center gap-2 mt-1.5">
          <MoodIcon className={`w-3.5 h-3.5 ${rateColor}`} />
          <span className={`text-xs font-semibold ${rateColor}`}>{moodSlang}</span>
        </div>

        {/* Long/Short ratio bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[9px] font-mono mb-1">
            <span className="text-emerald-400/70">{positiveCount.toLocaleString()} positive ({posRatio}%)</span>
            <span className="text-rose-400/70">{negativeCount.toLocaleString()} negative ({negRatio}%)</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden flex" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <div
              className="h-full rounded-l-full transition-all duration-500"
              style={{ width: `${posRatio}%`, background: 'linear-gradient(90deg, rgba(16,185,129,0.5), rgba(16,185,129,0.3))' }}
            />
            <div
              className="h-full rounded-r-full transition-all duration-500"
              style={{ width: `${negRatio}%`, background: 'linear-gradient(90deg, rgba(244,63,94,0.3), rgba(244,63,94,0.5))' }}
            />
          </div>
        </div>

        {/* Distribution chart */}
        <div className="mt-3 h-[56px]">
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
                  padding: '6px 10px',
                }}
                formatter={(value: number) => [`${value} pairs`, 'Count']}
                labelFormatter={(label: string) => `Rate: ${label}%`}
              />
              <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={28}>
                {distribution.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={entry.isNegative ? 'rgba(244,63,94,0.7)' : entry.isPositive ? 'rgba(16,185,129,0.7)' : 'rgba(115,115,115,0.4)'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
