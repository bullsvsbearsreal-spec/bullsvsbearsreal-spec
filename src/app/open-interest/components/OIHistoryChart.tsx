'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OIHistoryChartProps {
  symbol: string;
}

interface RawPoint {
  t: string;
  oi: number;
}

interface ChartRow {
  time: number;
  [exchange: string]: number;
}

type TimeRange = '7d' | '30d';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXCHANGE_COLORS: Record<string, string> = {
  'Binance': '#EAB308',
  'Bybit': '#F97316',
  'OKX': '#FFFFFF',
  'Bitget': '#22D3EE',
  'MEXC': '#14B8A6',
  'Hyperliquid': '#4ADE80',
  'dYdX': '#A855F7',
  'Kraken': '#8B5CF6',
  'BingX': '#3B82F6',
  'KuCoin': '#22C55E',
  'HTX': '#60A5FA',
  'Coinbase': '#2563EB',
  'Phemex': '#84CC16',
  'Aster': '#EC4899',
  'Lighter': '#34D399',
  'Aevo': '#FB7185',
  'Deribit': '#60A5FA',
  'Bitfinex': '#16A34A',
  'WhiteBIT': '#D1D5DB',
  'CoinEx': '#2DD4BF',
  'gTrade': '#14B8A6',
  'Bitunix': '#F59E0B',
  'GMX': '#3B82F6',
  'Drift': '#A78BFA',
};

const FALLBACK_COLOR = '#6B7280';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatOI(val: number): string {
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

function formatDateAxis(ts: number, range: TimeRange): string {
  const d = new Date(ts);
  if (range === '7d') {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

interface TooltipPayloadEntry {
  dataKey: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: number;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const total = payload.reduce((sum, p) => sum + (p.value || 0), 0);
  const sorted = [...payload].sort((a, b) => (b.value || 0) - (a.value || 0));

  return (
    <div
      style={{
        backgroundColor: '#1a1a1a',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 11,
      }}
    >
      <p className="text-zinc-400 mb-1">
        {label ? new Date(label).toLocaleString('en-US', {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        }) : ''}
      </p>
      <p className="text-white font-medium mb-1">Total: {formatOI(total)}</p>
      {sorted.map((entry) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-zinc-300">{entry.dataKey}</span>
          </span>
          <span className="text-zinc-100 font-mono">{formatOI(entry.value || 0)}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function OIHistoryChart({ symbol }: OIHistoryChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [rawData, setRawData] = useState<Record<string, RawPoint[]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data when symbol or timeRange changes
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const days = timeRange === '30d' ? 30 : 7;
      const res = await fetch(`/api/history/oi-multi?symbol=${encodeURIComponent(symbol)}&days=${days}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setRawData(json.exchanges ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load OI history');
      setRawData(null);
    } finally {
      setLoading(false);
    }
  }, [symbol, timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Transform API data into Recharts-compatible rows
  const { chartData, exchanges } = useMemo(() => {
    if (!rawData) return { chartData: [] as ChartRow[], exchanges: [] as string[] };

    const exchangeNames = Object.keys(rawData).filter(
      (ex) => rawData[ex] && rawData[ex].length > 0,
    );

    // Collect all unique timestamps
    const timeSet = new Set<number>();
    for (const ex of exchangeNames) {
      for (const pt of rawData[ex]) {
        timeSet.add(new Date(pt.t).getTime());
      }
    }

    const sortedTimes = Array.from(timeSet).sort((a, b) => a - b);

    // Build lookup maps per exchange
    const lookups: Record<string, Map<number, number>> = {};
    for (const ex of exchangeNames) {
      const map = new Map<number, number>();
      for (const pt of rawData[ex]) {
        map.set(new Date(pt.t).getTime(), pt.oi);
      }
      lookups[ex] = map;
    }

    // Build rows
    const rows: ChartRow[] = sortedTimes.map((ts) => {
      const row: ChartRow = { time: ts };
      for (const ex of exchangeNames) {
        row[ex] = lookups[ex].get(ts) ?? 0;
      }
      return row;
    });

    // Sort exchanges by total OI descending (for stacking order)
    const totals = exchangeNames.map((ex) => ({
      ex,
      total: rows.reduce((s, r) => s + ((r[ex] as number) || 0), 0),
    }));
    totals.sort((a, b) => b.total - a.total);

    return {
      chartData: rows,
      exchanges: totals.map((t) => t.ex),
    };
  }, [rawData]);

  // ---- Render ----

  if (loading) {
    return (
      <div className="mt-2 rounded-xl border border-white/[0.06] bg-[#0d0d0d] p-4">
        <div className="text-xs font-medium text-zinc-400 mb-3">OI History by Exchange</div>
        <div className="flex items-center justify-center h-[250px]">
          <div className="text-xs text-zinc-500 animate-pulse">Loading OI history...</div>
        </div>
      </div>
    );
  }

  if (error || chartData.length === 0) {
    return (
      <div className="mt-2 rounded-xl border border-white/[0.06] bg-[#0d0d0d] p-4">
        <div className="text-xs font-medium text-zinc-400 mb-3">OI History by Exchange</div>
        <div className="flex items-center justify-center h-[250px]">
          <span className="text-xs text-zinc-600">
            {error ? `Error: ${error}` : 'No OI history available for this symbol'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-white/[0.06] bg-[#0d0d0d] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-zinc-400">OI History by Exchange</span>

        {/* Time range toggle */}
        <div className="flex gap-1">
          {(['7d', '30d'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                timeRange === range
                  ? 'bg-white/10 text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis
            dataKey="time"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(ts: number) => formatDateAxis(ts, timeRange)}
            tick={{ fill: '#737373', fontSize: 11 }}
            stroke="transparent"
            minTickGap={40}
          />
          <YAxis
            tickFormatter={formatOI}
            tick={{ fill: '#737373', fontSize: 11 }}
            stroke="transparent"
            width={58}
          />
          <RechartsTooltip content={<CustomTooltip />} />
          {exchanges.map((ex) => (
            <Area
              key={ex}
              type="monotone"
              dataKey={ex}
              stackId="oi"
              stroke={EXCHANGE_COLORS[ex] || FALLBACK_COLOR}
              fill={EXCHANGE_COLORS[ex] || FALLBACK_COLOR}
              fillOpacity={0.15}
              strokeWidth={1.5}
              dot={false}
              activeDot={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
