'use client';

import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

/* ─── Types ──────────────────────────────────────────────────────── */

interface DepthPoint {
  exchange: string;
  priceOffset: number;
  cumulativeUsd: number;
}

interface VenueDepth {
  exchange: string;
  available: boolean;
  midPrice: number;
  bidCurve?: DepthPoint[];
  askCurve?: DepthPoint[];
}

interface MultiDepthChartProps {
  venues: VenueDepth[];
}

/* ─── Constants ──────────────────────────────────────────────────── */

const EXCHANGE_COLORS: Record<string, string> = {
  'Binance': '#EAB308',
  'Bybit': '#F97316',
  'OKX': '#FFFFFF',
  'Bitget': '#22D3EE',
  'Hyperliquid': '#4ADE80',
  'dYdX': '#A855F7',
  'Drift': '#A78BFA',
  'Aster': '#EC4899',
  'Aevo': '#FB7185',
  'Lighter': '#34D399',
};

const FALLBACK_COLOR = '#6B7280';

// Standard offset buckets (%) for normalizing across exchanges
const BUCKETS = [0, 0.01, 0.02, 0.05, 0.1, 0.15, 0.2, 0.3, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 5.0];

/* ─── Helpers ────────────────────────────────────────────────────── */

function formatUsd(v: number): string {
  if (Math.abs(v) >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
  if (Math.abs(v) >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
  if (Math.abs(v) >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
  return '$' + v.toFixed(0);
}

/** Interpolate cumulative USD at a given offset from a sorted curve */
function interpolate(curve: DepthPoint[], targetOffset: number): number {
  if (curve.length === 0) return 0;
  if (targetOffset <= curve[0].priceOffset) return 0;
  for (let i = 1; i < curve.length; i++) {
    if (curve[i].priceOffset >= targetOffset) {
      const prev = curve[i - 1];
      const curr = curve[i];
      const denom = curr.priceOffset - prev.priceOffset;
      if (denom === 0) return curr.cumulativeUsd;
      const ratio = (targetOffset - prev.priceOffset) / denom;
      return prev.cumulativeUsd + ratio * (curr.cumulativeUsd - prev.cumulativeUsd);
    }
  }
  return curve[curve.length - 1].cumulativeUsd;
}

/* ─── Component ──────────────────────────────────────────────────── */

export default function MultiDepthChart({ venues }: MultiDepthChartProps) {
  const { chartData, exchanges } = useMemo(() => {
    const activeVenues = venues.filter(v => v.available && (v.bidCurve?.length || v.askCurve?.length));
    if (activeVenues.length === 0) return { chartData: [], exchanges: [] };

    const exNames = activeVenues.map(v => v.exchange);
    const rows: Record<string, any>[] = [];

    // Build bid side (negative offsets)
    for (let i = BUCKETS.length - 1; i >= 0; i--) {
      const offset = BUCKETS[i];
      const row: Record<string, any> = { offset: -offset, label: offset === 0 ? 'Mid' : `-${offset}%` };
      for (const v of activeVenues) {
        row[v.exchange] = v.bidCurve ? interpolate(v.bidCurve, offset) : 0;
      }
      rows.push(row);
    }

    // Build ask side (positive offsets, skip 0 to avoid duplicate)
    for (let i = 1; i < BUCKETS.length; i++) {
      const offset = BUCKETS[i];
      const row: Record<string, any> = { offset, label: `+${offset}%` };
      for (const v of activeVenues) {
        row[v.exchange] = v.askCurve ? interpolate(v.askCurve, offset) : 0;
      }
      rows.push(row);
    }

    return { chartData: rows, exchanges: exNames };
  }, [venues]);

  if (chartData.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-neutral-600 text-sm">
        No depth data available
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-hub-darker p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Combined Orderbook Depth</h3>
          <p className="text-xs text-neutral-600 mt-0.5">Cumulative liquidity across {exchanges.length} exchanges</p>
        </div>
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {exchanges.map(ex => (
            <div key={ex} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: EXCHANGE_COLORS[ex] || FALLBACK_COLOR, opacity: 0.8 }} />
              <span className="text-[10px] text-neutral-500">{ex}</span>
            </div>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <AreaChart data={chartData} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis
            dataKey="offset"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(v: number) => v === 0 ? 'Mid' : `${v > 0 ? '+' : ''}${v}%`}
            tick={{ fill: '#737373', fontSize: 10 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
          />
          <YAxis
            tickFormatter={(v: number) => formatUsd(v)}
            tick={{ fill: '#737373', fontSize: 10 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
            width={65}
          />
          <Tooltip
            contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#fff', marginBottom: 4 }}
            labelFormatter={(v: number) => v === 0 ? 'Mid Price' : `${v > 0 ? '+' : ''}${v}% from mid`}
            formatter={(value: number, name: string) => [formatUsd(value), name]}
          />
          <ReferenceLine x={0} stroke="#eab308" strokeWidth={1.5} strokeDasharray="4 4" />

          {/* Bid side label */}
          <ReferenceLine x={-2} stroke="transparent" label={{ value: 'BIDS', fill: 'rgba(34,197,94,0.3)', fontSize: 11, fontWeight: 'bold' }} />
          {/* Ask side label */}
          <ReferenceLine x={2} stroke="transparent" label={{ value: 'ASKS', fill: 'rgba(239,68,68,0.3)', fontSize: 11, fontWeight: 'bold' }} />

          {exchanges.map((ex) => (
            <Area
              key={ex}
              type="monotone"
              dataKey={ex}
              stackId="depth"
              stroke={EXCHANGE_COLORS[ex] || FALLBACK_COLOR}
              fill={EXCHANGE_COLORS[ex] || FALLBACK_COLOR}
              fillOpacity={0.15}
              strokeWidth={1.5}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
