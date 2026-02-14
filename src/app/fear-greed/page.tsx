'use client';

import { useState, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useApiData } from '@/hooks/useApiData';
import { RefreshCw, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface FearGreedEntry {
  value: number;
  classification: string;
  timestamp: number;
}

interface HistoryResponse {
  current: FearGreedEntry;
  history: FearGreedEntry[];
}

type Timeframe = '7' | '30' | '90' | '365';

const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  '7': '7d',
  '30': '30d',
  '90': '90d',
  '365': '1y',
};

function getClassification(value: number): { label: string; color: string; bgColor: string } {
  if (value <= 25) return { label: 'Extreme Fear', color: '#ef4444', bgColor: 'bg-red-500/10' };
  if (value <= 50) return { label: 'Fear', color: '#f97316', bgColor: 'bg-orange-500/10' };
  if (value <= 75) return { label: 'Greed', color: '#4ade80', bgColor: 'bg-green-400/10' };
  return { label: 'Extreme Greed', color: '#22c55e', bgColor: 'bg-green-500/10' };
}

function getValueColor(value: number): string {
  if (value <= 25) return '#ef4444';
  if (value <= 50) return '#f97316';
  if (value <= 75) return '#4ade80';
  return '#22c55e';
}

function GaugeCircle({ value, size = 200 }: { value: number; size?: number }) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (value / 100) * circumference;
  const center = size / 2;
  const color = getValueColor(value);
  const classification = getClassification(value);

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="10"
        />
        {/* Progress circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={`${progress} ${circumference - progress}`}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-4xl font-bold text-white">{value}</span>
        <span className="text-sm font-medium mt-1" style={{ color }}>{classification.label}</span>
      </div>
    </div>
  );
}

interface ChartDataPoint {
  date: string;
  value: number;
  fullDate: string;
  classification: string;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartDataPoint }> }) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  const cls = getClassification(data.value);

  return (
    <div className="bg-[#1a1a1a] border border-white/[0.12] rounded-xl px-4 py-3 shadow-xl">
      <p className="text-neutral-500 text-xs">{data.fullDate}</p>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-lg font-bold text-white">{data.value}</span>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ color: cls.color, backgroundColor: `${cls.color}20` }}>
          {cls.label}
        </span>
      </div>
    </div>
  );
}

export default function FearGreedPage() {
  const [timeframe, setTimeframe] = useState<Timeframe>('30');

  const fetcher = useCallback(async () => {
    const res = await fetch(`/api/fear-greed?history=true&limit=${timeframe}`);
    if (!res.ok) throw new Error('Failed to fetch fear & greed data');
    return res.json() as Promise<HistoryResponse>;
  }, [timeframe]);

  const { data, isLoading, isRefreshing, lastUpdate, refresh, error } = useApiData<HistoryResponse>({
    fetcher,
    refreshInterval: 60000,
  });

  const chartData: ChartDataPoint[] = useMemo(() => {
    if (!data?.history) return [];
    return [...data.history].reverse().map((entry) => {
      const d = new Date(entry.timestamp);
      return {
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' }),
        value: entry.value,
        classification: entry.classification,
      };
    });
  }, [data]);

  const stats = useMemo(() => {
    if (!data?.history || data.history.length === 0) {
      return { current: 50, avg7d: 0, avg30d: 0, trend: 0 };
    }
    const current = data.current.value;
    const last7 = data.history.slice(0, Math.min(7, data.history.length));
    const last30 = data.history.slice(0, Math.min(30, data.history.length));
    const avg7d = Math.round(last7.reduce((s, e) => s + e.value, 0) / last7.length);
    const avg30d = Math.round(last30.reduce((s, e) => s + e.value, 0) / last30.length);
    // Trend: compare current to 7d ago
    const weekAgo = last7.length >= 7 ? last7[6].value : last7[last7.length - 1].value;
    const trend = current - weekAgo;
    return { current, avg7d, avg30d, trend };
  }, [data]);

  const currentValue = data?.current?.value ?? 50;
  const currentClassification = getClassification(currentValue);

  return (
    <div className="min-h-screen bg-black">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 py-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-xl font-bold text-white">Fear & Greed Index</h1>
            <p className="text-neutral-600 text-xs mt-0.5">
              Crypto market sentiment over time
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <span className="text-neutral-600 text-xs">
                Updated {lastUpdate.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={refresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-neutral-500 hover:text-white transition-colors text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 mb-4 flex items-center gap-2 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {isLoading ? (
          <>
            {/* Skeleton: Gauge + Stats */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
              {/* Gauge skeleton */}
              <div className="md:col-span-2 bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-6 flex items-center justify-center animate-pulse">
                <div className="w-48 h-48 rounded-full bg-white/[0.06]" />
              </div>
              {/* Stat card skeletons */}
              <div className="md:col-span-3 grid grid-cols-2 md:grid-cols-3 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4 animate-pulse">
                    <div className="h-3 w-20 bg-white/[0.06] rounded mb-2" />
                    <div className="h-8 w-24 bg-white/[0.06] rounded" />
                  </div>
                ))}
              </div>
            </div>
            {/* Skeleton: Chart */}
            <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4 animate-pulse">
              <div className="h-4 w-40 bg-white/[0.06] rounded mb-4" />
              <div className="h-64 bg-white/[0.04] rounded-lg" />
            </div>
          </>
        ) : (
          <>
            {/* Current Value + Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
              {/* Gauge */}
              <div className="md:col-span-2 bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-6 flex items-center justify-center">
                <div className="relative flex items-center justify-center">
                  <GaugeCircle value={currentValue} size={200} />
                </div>
              </div>

              {/* Stats Cards */}
              <div className="md:col-span-3 grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-5">
                  <span className="text-neutral-500 text-sm">Current Value</span>
                  <div className="text-2xl font-bold font-mono mt-1" style={{ color: currentClassification.color }}>
                    {currentValue}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: currentClassification.color }}>
                    {currentClassification.label}
                  </div>
                </div>
                <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-5">
                  <span className="text-neutral-500 text-sm">7d Average</span>
                  <div className="text-2xl font-bold font-mono text-white mt-1">
                    {stats.avg7d}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: getValueColor(stats.avg7d) }}>
                    {getClassification(stats.avg7d).label}
                  </div>
                </div>
                <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-5">
                  <span className="text-neutral-500 text-sm">30d Average</span>
                  <div className="text-2xl font-bold font-mono text-white mt-1">
                    {stats.avg30d}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: getValueColor(stats.avg30d) }}>
                    {getClassification(stats.avg30d).label}
                  </div>
                </div>
                <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-5 col-span-2 md:col-span-1">
                  <span className="text-neutral-500 text-sm">7d Trend</span>
                  <div className="flex items-center gap-2 mt-1">
                    {stats.trend >= 0 ? (
                      <TrendingUp className="w-5 h-5 text-green-400" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-400" />
                    )}
                    <span className={`text-2xl font-bold font-mono ${stats.trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {stats.trend > 0 ? '+' : ''}{stats.trend}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-600 mt-0.5">
                    vs 7 days ago
                  </div>
                </div>

                {/* Classification Legend */}
                <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-5 col-span-2">
                  <span className="text-neutral-500 text-sm">Classification</span>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-xs text-neutral-400">0-25 Extreme Fear</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-orange-500" />
                      <span className="text-xs text-neutral-400">25-50 Fear</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-400" />
                      <span className="text-xs text-neutral-400">50-75 Greed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span className="text-xs text-neutral-400">75-100 Extreme Greed</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Timeframe Selector */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex rounded-xl overflow-hidden bg-hub-gray/20 border border-white/[0.06]">
                {(Object.entries(TIMEFRAME_LABELS) as [Timeframe, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setTimeframe(key)}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      timeframe === key ? 'bg-hub-yellow text-black' : 'text-neutral-600 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {isRefreshing && (
                <RefreshCw className="w-4 h-4 text-hub-yellow animate-spin" />
              )}
            </div>

            {/* Chart */}
            <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4 md:p-6 mb-8">
              <div className="mb-4">
                <h3 className="text-white font-semibold">Fear & Greed History</h3>
                <p className="text-neutral-600 text-sm">Last {TIMEFRAME_LABELS[timeframe]} sentiment values</p>
              </div>
              <div className="h-[400px]">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="fearGreedGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
                          <stop offset="50%" stopColor="#22c55e" stopOpacity={0.05} />
                          <stop offset="50%" stopColor="#ef4444" stopOpacity={0.05} />
                          <stop offset="100%" stopColor="#ef4444" stopOpacity={0.4} />
                        </linearGradient>
                        <linearGradient id="fearGreedStroke" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" />
                          <stop offset="50%" stopColor="#facc15" />
                          <stop offset="100%" stopColor="#ef4444" />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="date"
                        stroke="#404040"
                        tick={{ fill: '#737373', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                        minTickGap={40}
                      />
                      <YAxis
                        domain={[0, 100]}
                        stroke="#404040"
                        tick={{ fill: '#737373', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        ticks={[0, 25, 50, 75, 100]}
                      />
                      {/* Reference lines for classification zones */}
                      <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="url(#fearGreedStroke)"
                        strokeWidth={2}
                        fill="url(#fearGreedGradient)"
                        dot={false}
                        activeDot={{ r: 5, fill: '#fff', stroke: '#FFA500', strokeWidth: 2 }}
                        isAnimationActive={true}
                        animationDuration={500}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-neutral-600">
                    <p>No historical data available</p>
                  </div>
                )}
              </div>

              {/* Zone indicator bar */}
              <div className="mt-4 flex rounded-full overflow-hidden h-2">
                <div className="flex-1 bg-red-500" title="Extreme Fear (0-25)" />
                <div className="flex-1 bg-orange-500" title="Fear (25-50)" />
                <div className="flex-1 bg-green-400" title="Greed (50-75)" />
                <div className="flex-1 bg-green-500" title="Extreme Greed (75-100)" />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-red-400">Extreme Fear</span>
                <span className="text-[10px] text-orange-400">Fear</span>
                <span className="text-[10px] text-green-400">Greed</span>
                <span className="text-[10px] text-green-500">Extreme Greed</span>
              </div>
            </div>

            {/* History Table */}
            <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl overflow-hidden">
              <div className="p-4 border-b border-white/[0.06]">
                <h3 className="text-white font-semibold">Daily Values</h3>
                <p className="text-neutral-600 text-sm">Individual daily readings</p>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-[#0d0d0d] z-10">
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left text-neutral-500 text-xs font-medium px-4 py-3">Date</th>
                      <th className="text-right text-neutral-500 text-xs font-medium px-4 py-3">Value</th>
                      <th className="text-right text-neutral-500 text-xs font-medium px-4 py-3">Classification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {data?.history.map((entry, i) => {
                      const cls = getClassification(entry.value);
                      const d = new Date(entry.timestamp);
                      return (
                        <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3 text-sm text-neutral-400">
                            {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm font-mono font-semibold" style={{ color: cls.color }}>
                              {entry.value}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className="text-xs font-medium px-2.5 py-1 rounded-full inline-block"
                              style={{ color: cls.color, backgroundColor: `${cls.color}15` }}
                            >
                              {cls.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        <div className="mt-4 p-3 rounded-lg bg-hub-yellow/5 border border-hub-yellow/10">
          <p className="text-neutral-500 text-xs leading-relaxed">
            The Fear & Greed Index measures crypto market sentiment on a scale of 0-100. It combines volatility (25%), market volume (25%), social media sentiment (15%), surveys (15%), Bitcoin dominance (10%), and Google Trends (10%). Values below 25 indicate Extreme Fear (potential buying opportunity), while values above 75 suggest Extreme Greed (potential correction risk). Data updates daily.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
