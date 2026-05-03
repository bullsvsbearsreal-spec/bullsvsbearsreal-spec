'use client';

import { useMemo } from 'react';

export interface PnlSeries {
  label: string;       // e.g. "Hyperliquid", "GMX Arbitrum"
  color: string;       // stroke color (hex)
  points: number[];    // cumulative PnL values (oldest → newest)
}

/**
 * Multi-series cumulative-PnL chart for the cross-platform trader profile.
 * Each series is rendered as a line on a shared Y-axis (USD). Pure SVG,
 * no dependencies. The first point of each series is treated as the baseline
 * so the chart always opens at 0 and shows delta from there.
 */
export default function TraderHistoryChart({
  series,
  height = 180,
  days = 30,
}: {
  series: PnlSeries[];
  height?: number;
  days?: number;
}) {
  // Filter out series with <2 points — can't draw a line
  const valid = useMemo(() => series.filter(s => s.points.length >= 2), [series]);

  // Normalize: each series re-based to 0 at its own first point.
  // This makes them comparable even if their absolute PnL scales differ.
  const normalized = useMemo(() => {
    return valid.map(s => {
      const base = s.points[0];
      return { ...s, points: s.points.map(v => v - base) };
    });
  }, [valid]);

  const allValues = normalized.flatMap(s => s.points);
  const min = Math.min(...allValues, 0);
  const max = Math.max(...allValues, 0);
  const range = max - min || 1;
  const maxLen = Math.max(...normalized.map(s => s.points.length), 1);

  const W = 600;
  const H = height - 36; // reserve top 24 for legend, bottom 12 for axis
  const stepX = maxLen > 1 ? W / (maxLen - 1) : 0;
  const yOf = (v: number) => H - ((v - min) / range) * H;
  const zeroY = yOf(0);

  if (normalized.length === 0) {
    return (
      <div className="h-[180px] flex items-center justify-center text-[11px] text-neutral-600">
        No historical PnL data available for this wallet
      </div>
    );
  }

  // fmt dollar amounts compactly for axis labels + tooltip
  function fmt(n: number): string {
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '+';
    if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
    return `${sign}$${abs.toFixed(0)}`;
  }

  return (
    <div className="w-full">
      {/* Legend */}
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">
          {days}D cumulative PnL per venue
        </span>
        {normalized.map(s => {
          const last = s.points[s.points.length - 1];
          return (
            <span key={s.label} className="inline-flex items-center gap-1 text-[10px] font-mono">
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="text-neutral-400">{s.label}</span>
              <span className={last >= 0 ? 'text-green-400' : 'text-red-400'}>
                {fmt(last)}
              </span>
            </span>
          );
        })}
      </div>

      <svg viewBox={`0 0 ${W} ${H + 12}`} preserveAspectRatio="none" width="100%" height={H + 12} aria-label="PnL history">
        {/* Zero line if series crosses break-even */}
        {min < 0 && max > 0 && (
          <line
            x1={0}
            x2={W}
            y1={zeroY}
            y2={zeroY}
            stroke="rgba(148,163,184,0.25)"
            strokeDasharray="3,3"
            strokeWidth={0.6}
          />
        )}
        {/* Each series as a filled area + line */}
        {normalized.map(s => {
          const pts = s.points.map((v, i) => `${(i * stepX).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ');
          const area = `0,${H} ${pts} ${((s.points.length - 1) * stepX).toFixed(1)},${H}`;
          const last = s.points[s.points.length - 1];
          const isUp = last >= 0;
          const fillColor = isUp
            ? `${s.color}22` // ~13% alpha hex
            : `${s.color}22`;
          return (
            <g key={s.label}>
              <polygon points={area} fill={fillColor} />
              <polyline points={pts} fill="none" stroke={s.color} strokeWidth={1.5} />
            </g>
          );
        })}
        {/* X axis label */}
        <text x={0} y={H + 10} fontSize={9} fill="rgba(148,163,184,0.6)" fontFamily="monospace">
          {days}d ago
        </text>
        <text x={W} y={H + 10} fontSize={9} fill="rgba(148,163,184,0.6)" textAnchor="end" fontFamily="monospace">
          now
        </text>
      </svg>
    </div>
  );
}
