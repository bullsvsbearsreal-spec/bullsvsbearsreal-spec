'use client';

import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { BarChart3 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const SYMBOLS = ['BTC', 'ETH', 'SOL'] as const;
type SymbolOption = (typeof SYMBOLS)[number];

interface LiquidationChartProps {
  timeframeHours: number;
  symbol?: string | null;
}

interface HistoryPoint {
  t: string | number;
  value?: number;
  count?: number;
  longValue: number;
  shortValue: number;
}

interface HistoryResponse {
  points: HistoryPoint[];
}

interface ChartDatum {
  time: string;
  long: number;
  short: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatVol(val: number): string {
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

function formatAxisTime(dateStr: string, timeframeHours: number): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  if (timeframeHours <= 4) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  return (
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
  );
}

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

async function fetcher(url: string): Promise<ChartDatum[]> {
  const res = await fetch(url);
  if (!res.ok) return [];
  const json: HistoryResponse = await res.json();
  const points = json.points ?? [];
  return points.map((p) => ({
    time: new Date(p.t).toISOString(),
    long: p.longValue ?? 0,
    short: p.shortValue ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// CustomTooltip
// ---------------------------------------------------------------------------

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const longEntry = payload.find((p) => p.dataKey === 'long');
  const shortEntry = payload.find((p) => p.dataKey === 'short');
  const longVal = longEntry?.value ?? 0;
  const shortVal = shortEntry?.value ?? 0;

  const d = label ? new Date(label) : null;
  const timeLabel =
    d && !isNaN(d.getTime())
      ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
        ' ' +
        d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
      : label ?? '';

  return (
    <div className="rounded-lg border border-white/[0.08] bg-[#141414] px-3 py-2 shadow-xl">
      <p className="text-[10px] text-neutral-500 mb-1.5">{timeLabel}</p>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-sm bg-[#ef4444]" />
          <span className="text-[11px] text-neutral-400">Long</span>
          <span className="text-[11px] font-mono text-red-400 ml-auto">{formatVol(longVal)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-sm bg-[#22c55e]" />
          <span className="text-[11px] text-neutral-400">Short</span>
          <span className="text-[11px] font-mono text-green-400 ml-auto">{formatVol(shortVal)}</span>
        </div>
        <div className="border-t border-white/[0.06] pt-1 mt-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-neutral-500">Total</span>
            <span className="text-[11px] font-mono text-white">{formatVol(longVal + shortVal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LiquidationChart
// ---------------------------------------------------------------------------

export default function LiquidationChart({ timeframeHours, symbol }: LiquidationChartProps) {
  const [selected, setSelected] = useState<SymbolOption>(
    symbol && SYMBOLS.includes(symbol as SymbolOption)
      ? (symbol as SymbolOption)
      : 'BTC',
  );

  // Sync with external symbol prop (e.g. treemap clicks)
  useEffect(() => {
    if (symbol && SYMBOLS.includes(symbol as SymbolOption)) {
      setSelected(symbol as SymbolOption);
    }
  }, [symbol]);

  // Always fetch 1 day of data, then filter to timeframe window
  const swrKey = `/api/history/liquidations?symbol=${selected}&days=1`;

  const { data: rawData, isLoading } = useSWR<ChartDatum[]>(swrKey, fetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: false,
  });

  // Filter to only show data within the selected timeframe
  const data = useMemo(() => {
    if (!rawData || rawData.length === 0) return rawData;
    const cutoff = new Date(Date.now() - timeframeHours * 60 * 60 * 1000).toISOString();
    return rawData.filter(d => d.time >= cutoff);
  }, [rawData, timeframeHours]);

  const hasData = data && data.length > 0;

  return (
    <div className="border border-white/[0.06] rounded-xl bg-[#0a0a0a] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5 text-neutral-500" />
          <span className="text-xs font-medium text-neutral-400">History</span>
        </div>
        <div className="flex items-center gap-1">
          {SYMBOLS.map((sym) => (
            <button
              key={sym}
              onClick={() => setSelected(sym)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                selected === sym
                  ? 'bg-white/[0.1] text-white'
                  : 'text-neutral-600 hover:text-neutral-400'
              }`}
            >
              {sym}
            </button>
          ))}
        </div>
      </div>

      {/* Chart area */}
      <div className="px-4 pt-3 pb-2">
        {isLoading ? (
          <div className="h-[200px] flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-hub-yellow/30 border-t-hub-yellow rounded-full animate-spin" />
          </div>
        ) : !hasData ? (
          <div className="h-[200px] flex flex-col items-center justify-center">
            <p className="text-xs text-neutral-600">No historical data</p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data} barCategoryGap="20%" barGap={1}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="time"
                  tickFormatter={(v: string) => formatAxisTime(v, timeframeHours)}
                  tick={{ fill: '#525252', fontSize: 10 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                  tickLine={false}
                  minTickGap={40}
                />
                <YAxis
                  tickFormatter={formatVol}
                  tick={{ fill: '#525252', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={50}
                />
                <RechartsTooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                />
                <Bar dataKey="long" stackId="liq" fill="#ef4444" radius={[2, 2, 0, 0]} />
                <Bar dataKey="short" stackId="liq" fill="#22c55e" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 mt-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-[#ef4444]" />
                <span className="text-[10px] text-neutral-600">Long Liquidations</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-[#22c55e]" />
                <span className="text-[10px] text-neutral-600">Short Liquidations</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
