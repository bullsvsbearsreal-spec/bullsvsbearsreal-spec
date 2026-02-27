'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';

const SYMBOLS = ['BTC', 'ETH', 'SOL'] as const;
type SymbolOption = (typeof SYMBOLS)[number];

interface BucketRaw {
  symbol: string;
  hour: string;
  long_vol: number;
  short_vol: number;
}

interface ChartBucket {
  time: string;
  long: number;
  short: number;
}

function formatVol(val: number): string {
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

function formatAxisTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
}

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

  return (
    <div className="rounded-lg border border-white/[0.08] bg-[#141414] px-3 py-2 shadow-xl">
      <p className="text-[10px] text-neutral-500 mb-1.5">{label ? formatAxisTime(label) : ''}</p>
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

interface LiquidationHistoryChartProps {
  symbol?: string;
}

export default function LiquidationHistoryChart({ symbol: initialSymbol }: LiquidationHistoryChartProps) {
  const [selected, setSelected] = useState<SymbolOption>(
    (SYMBOLS.includes(initialSymbol as SymbolOption) ? initialSymbol : 'BTC') as SymbolOption,
  );
  const [data, setData] = useState<ChartBucket[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async (sym: string) => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/history/liquidations?symbol=${sym}&days=7`);
      if (!res.ok) {
        setData([]);
        setLoading(false);
        return;
      }
      const json = await res.json();
      const raw: BucketRaw[] = Array.isArray(json) ? json : json.data || [];
      const buckets: ChartBucket[] = raw.map((b) => ({
        time: b.hour,
        long: b.long_vol ?? 0,
        short: b.short_vol ?? 0,
      }));
      setData(buckets);
    } catch {
      setError(true);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(selected);
  }, [selected, fetchData]);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0d0d0d] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-zinc-400">Liquidation History (7d)</span>
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
      {loading ? (
        <div className="h-[250px] flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-hub-yellow/30 border-t-hub-yellow rounded-full animate-spin" />
        </div>
      ) : error || !data || data.length === 0 ? (
        <div className="h-[250px] flex flex-col items-center justify-center">
          <p className="text-xs text-neutral-600">No historical data yet</p>
          <p className="text-[10px] text-neutral-700 mt-1">
            Data will appear once the liquidation history API is populated.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data} barCategoryGap="20%" barGap={1}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="time"
              tickFormatter={formatAxisTime}
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
            <Bar dataKey="long" fill="#ef4444" radius={[2, 2, 0, 0]} />
            <Bar dataKey="short" fill="#22c55e" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Legend */}
      {data && data.length > 0 && !loading && (
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
      )}
    </div>
  );
}
