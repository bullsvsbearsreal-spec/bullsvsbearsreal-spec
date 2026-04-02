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

const DEFAULT_SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'PEPE', 'WIF', 'SUI', 'AVAX', 'LINK'];

interface LiquidationChartProps {
  timeframeHours: number;
  symbol?: string | null;
  topSymbols?: string[];
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
    <div className="rounded-xl border border-hub-subtle bg-hub-dark px-3.5 py-2.5 shadow-xl">
      <p className="text-[11px] text-neutral-500 mb-2 font-medium">{timeLabel}</p>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-sm bg-red-500/70" />
          <span className="text-[11px] text-neutral-400">Long</span>
          <span className="text-[11px] font-mono text-red-400 ml-auto font-semibold">{formatVol(longVal)}</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-sm bg-green-500/70" />
          <span className="text-[11px] text-neutral-400">Short</span>
          <span className="text-[11px] font-mono text-green-400 ml-auto font-semibold">{formatVol(shortVal)}</span>
        </div>
        <div className="border-t border-hub-subtle pt-1.5 mt-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-neutral-500">Total</span>
            <span className="text-[11px] font-mono text-white font-bold">{formatVol(longVal + shortVal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LiquidationChart
// ---------------------------------------------------------------------------

export default function LiquidationChart({ timeframeHours, symbol, topSymbols }: LiquidationChartProps) {
  const symbols = useMemo(() => {
    const set = new Set(DEFAULT_SYMBOLS);
    if (topSymbols) topSymbols.forEach(s => set.add(s));
    if (symbol) set.add(symbol);
    return Array.from(set).slice(0, 15);
  }, [topSymbols, symbol]);

  const [selected, setSelected] = useState<string>(symbol || 'BTC');

  useEffect(() => {
    if (symbol) setSelected(symbol);
  }, [symbol]);

  const swrKey = `/api/history/liquidations?symbol=${selected}&days=1`;

  const { data: rawData, isLoading } = useSWR<ChartDatum[]>(swrKey, fetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: false,
  });

  const data = useMemo(() => {
    if (!rawData || rawData.length === 0) return rawData;
    const cutoff = new Date(Date.now() - timeframeHours * 60 * 60 * 1000).toISOString();
    return rawData.filter(d => d.time >= cutoff);
  }, [rawData, timeframeHours]);

  const hasData = data && data.length > 0;

  return (
    <div className="border border-hub-subtle rounded-2xl bg-hub-dark/30 overflow-hidden">
      {/* Header with symbol picker */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-hub-subtle">
        <div className="flex items-center gap-2.5 shrink-0">
          <BarChart3 className="w-4 h-4 text-neutral-500" />
          <span className="text-sm font-medium text-neutral-300">History</span>
        </div>
        <div className="flex-1 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-0.5">
            {symbols.map((sym) => (
              <button
                key={sym}
                onClick={() => setSelected(sym)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all ${
                  selected === sym
                    ? 'bg-white/[0.08] text-white shadow-sm'
                    : 'text-neutral-600 hover:text-neutral-300 hover:bg-white/[0.03]'
                }`}
              >
                {sym}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="px-3 pt-4 pb-3">
        {isLoading ? (
          <div className="h-[200px] flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-hub-yellow/30 border-t-hub-yellow rounded-full animate-spin" />
          </div>
        ) : !hasData ? (
          <div className="h-[200px] flex flex-col items-center justify-center gap-2">
            <BarChart3 className="w-7 h-7 text-neutral-800" />
            <p className="text-sm text-neutral-500">No historical data for {selected}</p>
            <p className="text-xs text-neutral-600">Try a different token or longer timeframe</p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data} barCategoryGap="20%" barGap={1}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis
                  dataKey="time"
                  tickFormatter={(v: string) => formatAxisTime(v, timeframeHours)}
                  tick={{ fill: '#525252', fontSize: 10 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
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
                  cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                />
                <Bar dataKey="long" stackId="liq" fill="#ef4444" fillOpacity={0.7} radius={[3, 3, 0, 0]} />
                <Bar dataKey="short" stackId="liq" fill="#22c55e" fillOpacity={0.7} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex items-center justify-center gap-5 mt-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-red-500/60" />
                <span className="text-[11px] text-neutral-500 font-medium">Long</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-green-500/60" />
                <span className="text-[11px] text-neutral-500 font-medium">Short</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
