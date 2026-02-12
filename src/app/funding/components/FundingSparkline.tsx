'use client';

import { useMemo, useState } from 'react';
import type { HistoryPoint } from '@/lib/storage/fundingHistory';

interface FundingSparklineProps {
  history: HistoryPoint[];
  width?: number;
  height?: number;
}

export default function FundingSparkline({ history, width = 80, height = 24 }: FundingSparklineProps) {
  const [tooltip, setTooltip] = useState<{ x: number; rate: number; time: number } | null>(null);

  const { path, color, points } = useMemo(() => {
    if (history.length < 2) {
      return { path: '', color: '#525252', points: [] };
    }

    const rates = history.map(h => h.rate);
    const minRate = Math.min(...rates);
    const maxRate = Math.max(...rates);
    const range = maxRate - minRate || 0.001; // Avoid division by zero

    const padding = 2;
    const w = width - padding * 2;
    const h = height - padding * 2;

    const pts = history.map((p, i) => ({
      x: padding + (i / (history.length - 1)) * w,
      y: padding + h - ((p.rate - minRate) / range) * h,
      rate: p.rate,
      time: p.t,
    }));

    const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

    // Color based on trend direction
    const first = rates[0];
    const last = rates[rates.length - 1];
    const c = last > first ? '#4ade80' : last < first ? '#f87171' : '#737373';

    return { path: d, color: c, points: pts };
  }, [history, width, height]);

  if (history.length < 2) {
    return (
      <span className="text-neutral-700 text-[9px] italic" title="History builds as you visit">
        —
      </span>
    );
  }

  return (
    <div className="relative inline-block" style={{ width, height }}>
      <svg
        width={width}
        height={height}
        className="overflow-visible"
        onMouseLeave={() => setTooltip(null)}
      >
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.8}
        />
        {/* Invisible wider hit area for hover */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={4}
            fill="transparent"
            onMouseEnter={() => setTooltip({ x: p.x, rate: p.rate, time: p.time })}
          />
        ))}
        {/* Hover dot */}
        {tooltip && (
          <circle
            cx={tooltip.x}
            cy={points.find(p => p.x === tooltip.x)?.y || 0}
            r={2}
            fill={color}
          />
        )}
      </svg>
      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-white/10 rounded px-1.5 py-0.5 whitespace-nowrap z-10 pointer-events-none"
          style={{ fontSize: '9px' }}
        >
          <span className={tooltip.rate >= 0 ? 'text-green-400' : 'text-red-400'}>
            {tooltip.rate >= 0 ? '+' : ''}{tooltip.rate.toFixed(4)}%
          </span>
          <span className="text-neutral-600 ml-1">
            {new Date(tooltip.time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}
    </div>
  );
}
