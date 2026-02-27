'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

// ── Types ──

type TimeRange = '7d' | '30d';

interface BulkFundingResponse {
  symbols: string[];
  days: number;
  data: Record<string, Array<{ day: string; rate: number }>>;
}

interface ChartPoint {
  time: number;
  [symbol: string]: number;
}

// ── Constants ──

const DEFAULT_SYMBOLS = ['BTC', 'ETH', 'SOL', 'DOGE', 'XRP', 'PEPE', 'WIF', 'ARB', 'AVAX', 'SUI'];

const SYMBOL_COLORS = [
  '#EAB308', // BTC  - yellow
  '#3B82F6', // ETH  - blue
  '#22D3EE', // SOL  - cyan
  '#F97316', // DOGE - orange
  '#A855F7', // XRP  - purple
  '#4ADE80', // PEPE - green
  '#EC4899', // WIF  - pink
  '#14B8A6', // ARB  - teal
  '#FB7185', // AVAX - rose
  '#60A5FA', // SUI  - light blue
];

// ── Custom tooltip ──

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      className="rounded-lg px-3 py-2.5 text-xs shadow-xl"
      style={{
        backgroundColor: '#1a1a1a',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <p className="text-neutral-400 mb-1.5 font-medium">
        {new Date(label).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </p>
      <div className="flex flex-col gap-1">
        {payload
          .filter((entry: any) => entry.value != null)
          .sort((a: any, b: any) => Math.abs(b.value) - Math.abs(a.value))
          .map((entry: any) => (
            <div key={entry.name} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-neutral-300 font-medium">{entry.name}</span>
              </div>
              <span
                className="font-mono tabular-nums font-semibold"
                style={{
                  color: entry.value >= 0
                    ? 'rgb(52, 211, 153)'
                    : 'rgb(251, 113, 133)',
                }}
              >
                {entry.value >= 0 ? '+' : ''}{entry.value.toFixed(4)}%
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

// ── Main component ──

export default function FundingHistoryChart() {
  const [isOpen, setIsOpen] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [rawData, setRawData] = useState<BulkFundingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState<Record<TimeRange, boolean>>({ '7d': false, '30d': false });

  // Fetch data when section opens or time range changes
  const fetchData = useCallback(async (days: number) => {
    setLoading(true);
    setError(null);
    try {
      const symbolsParam = DEFAULT_SYMBOLS.join(',');
      const res = await fetch(
        `/api/history/funding-bulk?symbols=${symbolsParam}&days=${days}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const json: BulkFundingResponse = await res.json();
      setRawData(json);
    } catch (err: any) {
      setError(err.message || 'Failed to load funding history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const days = timeRange === '7d' ? 7 : 30;
    // Re-fetch if we haven't fetched this range yet, or if switching ranges
    if (!hasFetched[timeRange]) {
      fetchData(days);
      setHasFetched(prev => ({ ...prev, [timeRange]: true }));
    }
  }, [isOpen, timeRange, fetchData, hasFetched]);

  // Build chart data from API response
  const { chartData, activeSymbols } = useMemo(() => {
    if (!rawData?.data) return { chartData: [], activeSymbols: [] };

    // Collect all unique day strings across all symbols
    const allDays = new Set<string>();
    const symsWithData: string[] = [];

    for (const sym of DEFAULT_SYMBOLS) {
      const points = rawData.data[sym];
      if (points && points.length > 0) {
        symsWithData.push(sym);
        points.forEach(p => allDays.add(p.day));
      }
    }

    if (allDays.size === 0) return { chartData: [], activeSymbols: [] };

    // Sort days chronologically
    const sortedDays = Array.from(allDays).sort();

    // Build chart points
    const points: ChartPoint[] = sortedDays.map(day => {
      const point: ChartPoint = { time: new Date(day).getTime() };
      for (const sym of symsWithData) {
        const match = rawData.data[sym]?.find(p => p.day === day);
        if (match) {
          point[sym] = match.rate;
        }
      }
      return point;
    });

    return { chartData: points, activeSymbols: symsWithData };
  }, [rawData]);

  const hasData = chartData.length > 0 && activeSymbols.length > 0;

  return (
    <div className="mt-3 mb-3 rounded-xl border border-white/[0.06] bg-[#0d0d0d]">
      {/* Toggle header */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
      >
        <BarChart3 className="w-4 h-4 text-neutral-500" />
        <span>Funding History</span>
        <span className="text-[10px] text-neutral-600 font-normal ml-1">
          Top 10 symbols
        </span>
        <span className="flex-1" />
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-neutral-600" />
        ) : (
          <ChevronDown className="w-4 h-4 text-neutral-600" />
        )}
      </button>

      {/* Collapsible content */}
      {isOpen && (
        <div className="px-4 pb-4">
          {/* Time range selector */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-neutral-600 text-xs">
              Average funding rate per symbol over time
            </p>
            <div className="flex rounded-lg overflow-hidden bg-white/[0.04] border border-white/[0.06]">
              {(['7d', '30d'] as TimeRange[]).map(range => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    timeRange === range
                      ? 'bg-hub-yellow text-black'
                      : 'text-neutral-600 hover:text-white'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-hub-yellow/30 border-t-hub-yellow rounded-full animate-spin" />
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-12 text-neutral-600">
              <BarChart3 className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">{error}</p>
              <button
                onClick={() => {
                  setHasFetched(prev => ({ ...prev, [timeRange]: false }));
                  const days = timeRange === '7d' ? 7 : 30;
                  fetchData(days);
                  setHasFetched(prev => ({ ...prev, [timeRange]: true }));
                }}
                className="mt-2 text-xs text-hub-yellow hover:underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && !hasData && rawData && (
            <div className="flex flex-col items-center justify-center py-12 text-neutral-600">
              <BarChart3 className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">No historical funding data available</p>
              <p className="text-xs mt-1 text-neutral-700">
                Data may take time to accumulate
              </p>
            </div>
          )}

          {/* Chart */}
          {!loading && !error && hasData && (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.04)"
                />
                <XAxis
                  dataKey="time"
                  tickFormatter={(t: number) =>
                    new Date(t).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })
                  }
                  stroke="transparent"
                  tick={{ fill: '#737373', fontSize: 11 }}
                />
                <YAxis
                  tickFormatter={(v: number) =>
                    `${v >= 0 ? '+' : ''}${v.toFixed(4)}%`
                  }
                  stroke="transparent"
                  tick={{ fill: '#737373', fontSize: 11 }}
                  width={72}
                />
                <RechartsTooltip
                  content={<CustomTooltip />}
                  cursor={{ stroke: 'rgba(255,255,255,0.06)' }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  iconType="line"
                  formatter={(value: string) => (
                    <span className="text-neutral-400">{value}</span>
                  )}
                />
                {activeSymbols.map((sym, i) => (
                  <Line
                    key={sym}
                    type="monotone"
                    dataKey={sym}
                    stroke={SYMBOL_COLORS[i % SYMBOL_COLORS.length]}
                    dot={chartData.length < 5}
                    strokeWidth={1.5}
                    connectNulls
                    activeDot={{ r: 3, strokeWidth: 0 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
}
