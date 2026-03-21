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

type TimeRange = '1h' | '4h' | '1d' | '7d' | '30d';

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
  'Others': '#525252',
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

const TIME_RANGE_DAYS: Record<TimeRange, number> = {
  '1h': 0.04,
  '4h': 0.17,
  '1d': 1,
  '7d': 7,
  '30d': 30,
};

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  '1h': '1H',
  '4h': '4H',
  '1d': '1D',
  '7d': '7D',
  '30d': '30D',
};

function formatDateAxis(ts: number, range: TimeRange): string {
  const d = new Date(ts);
  if (range === '1h' || range === '4h' || range === '1d') {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
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
  const sorted = [...payload]
    .filter((p) => (p.value || 0) > 0)
    .sort((a, b) => (b.value || 0) - (a.value || 0));
  const shown = sorted.slice(0, 8);
  const othersCount = sorted.length - shown.length;
  const othersValue = sorted.slice(8).reduce((s, p) => s + (p.value || 0), 0);

  return (
    <div
      style={{
        backgroundColor: '#1a1a1a',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 11,
        maxWidth: 240,
      }}
    >
      <p className="text-zinc-400 mb-1">
        {label ? new Date(label).toLocaleString('en-US', {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        }) : ''}
      </p>
      <p className="text-white font-medium mb-1.5">Total: {formatOI(total)}</p>
      {shown.map((entry) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-3 py-[1px]">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-zinc-300 truncate">{entry.dataKey}</span>
          </span>
          <span className="text-zinc-100 font-mono text-[10px]">{formatOI(entry.value || 0)}</span>
        </div>
      ))}
      {othersCount > 0 && (
        <div className="flex items-center justify-between gap-3 py-[1px] border-t border-white/[0.06] mt-1 pt-1">
          <span className="text-zinc-500">+{othersCount} more</span>
          <span className="text-zinc-400 font-mono text-[10px]">{formatOI(othersValue)}</span>
        </div>
      )}
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
      const days = TIME_RANGE_DAYS[timeRange];
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

    // Bucket timestamps to 10-minute intervals to align across exchanges
    const BUCKET_MS = 10 * 60 * 1000; // 10 minutes
    const bucket = (ts: number) => Math.round(ts / BUCKET_MS) * BUCKET_MS;

    // Build lookup maps per exchange (bucketed)
    const lookups: Record<string, Map<number, number>> = {};
    const allBuckets = new Set<number>();
    for (const ex of exchangeNames) {
      const map = new Map<number, number>();
      for (const pt of rawData[ex]) {
        const b = bucket(new Date(pt.t).getTime());
        // Keep latest value per bucket
        const existing = map.get(b);
        if (!existing || pt.oi > 0) map.set(b, pt.oi);
        allBuckets.add(b);
      }
      lookups[ex] = map;
    }

    const sortedTimes = Array.from(allBuckets).sort((a, b) => a - b);

    // Build rows with forward-fill (carry last known value)
    const lastKnown: Record<string, number> = {};
    const rows: ChartRow[] = sortedTimes.map((ts) => {
      const row: ChartRow = { time: ts };
      for (const ex of exchangeNames) {
        const val = lookups[ex].get(ts);
        if (val !== undefined && val > 0) {
          lastKnown[ex] = val;
          row[ex] = val;
        } else {
          row[ex] = lastKnown[ex] ?? 0;
        }
      }
      return row;
    });

    // Sort exchanges by total OI descending (for stacking order)
    const totals = exchangeNames.map((ex) => ({
      ex,
      total: rows.reduce((s, r) => s + ((r[ex] as number) || 0), 0),
    }));
    totals.sort((a, b) => b.total - a.total);

    // Group smaller exchanges into "Others" for cleaner chart
    const MAX_SHOWN = 10;
    const topExchanges = totals.slice(0, MAX_SHOWN).map(t => t.ex);
    const otherExchanges = totals.slice(MAX_SHOWN).map(t => t.ex);

    if (otherExchanges.length > 0) {
      for (const row of rows) {
        let othersSum = 0;
        for (const ex of otherExchanges) {
          othersSum += (row[ex] as number) || 0;
          delete row[ex];
        }
        row['Others'] = othersSum;
      }
      topExchanges.push('Others');
    }

    return {
      chartData: rows,
      exchanges: topExchanges,
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
          {(['1h', '4h', '1d', '7d', '30d'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                timeRange === range
                  ? 'bg-white/10 text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {TIME_RANGE_LABELS[range]}
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
