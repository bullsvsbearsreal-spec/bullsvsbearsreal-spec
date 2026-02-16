'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useApiData } from '@/hooks/useApiData';
import { RefreshCw, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface LSPoint {
  longRatio: number;
  shortRatio: number;
  timestamp: number;
}

interface LSHistoryData {
  symbol: string;
  period: string;
  points: LSPoint[];
}

type Period = '5m' | '15m' | '30m' | '1h' | '4h' | '1d';

const SYMBOLS = [
  { label: 'BTC', value: 'BTCUSDT' },
  { label: 'ETH', value: 'ETHUSDT' },
  { label: 'SOL', value: 'SOLUSDT' },
  { label: 'XRP', value: 'XRPUSDT' },
  { label: 'DOGE', value: 'DOGEUSDT' },
  { label: 'BNB', value: 'BNBUSDT' },
  { label: 'ADA', value: 'ADAUSDT' },
  { label: 'AVAX', value: 'AVAXUSDT' },
];

const PERIODS: { label: string; value: Period }[] = [
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '30m', value: '30m' },
  { label: '1h', value: '1h' },
  { label: '4h', value: '4h' },
  { label: '1d', value: '1d' },
];

const MULTI_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT', 'BNBUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT'];

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const long = payload.find((p: any) => p.dataKey === 'longRatio')?.value ?? 0;
  const short = payload.find((p: any) => p.dataKey === 'shortRatio')?.value ?? 0;
  return (
    <div className="bg-hub-gray border border-white/[0.1] rounded-lg p-2.5 shadow-xl text-xs">
      <div className="text-neutral-500 mb-1.5">{formatTime(label)}</div>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <span className="text-green-400 font-mono">{long.toFixed(2)}% Long</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-red-500" />
        <span className="text-red-400 font-mono">{short.toFixed(2)}% Short</span>
      </div>
      <div className="mt-1.5 pt-1.5 border-t border-white/[0.06] text-neutral-500">
        L/S Ratio: {short > 0 ? (long / short).toFixed(3) : 'N/A'}
      </div>
    </div>
  );
}

export default function LongShortPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [period, setPeriod] = useState<Period>('5m');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Main chart data
  const { data, error, isLoading, lastUpdate, refresh, isRefreshing } = useApiData<LSHistoryData>({
    fetcher: useCallback(async () => {
      const res = await fetch(`/api/longshort?symbol=${symbol}&period=${period}&limit=100`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }, [symbol, period]),
    refreshInterval: autoRefresh ? 10000 : undefined,
  });

  // Multi-symbol table data
  const [multiData, setMultiData] = useState<Record<string, { longRatio: number; shortRatio: number }>>({});

  useEffect(() => {
    async function fetchMulti() {
      const results: Record<string, { longRatio: number; shortRatio: number }> = {};
      const promises = MULTI_SYMBOLS.map(async (sym) => {
        try {
          const res = await fetch(`/api/longshort?symbol=${sym}&limit=1`);
          if (!res.ok) return;
          const d = await res.json();
          results[sym] = { longRatio: d.longRatio, shortRatio: d.shortRatio };
        } catch { /* skip */ }
      });
      await Promise.all(promises);
      setMultiData(results);
    }
    fetchMulti();
    const interval = setInterval(fetchMulti, 60000); // 60s (was 30s)
    return () => clearInterval(interval);
  }, []);

  const chartData = useMemo(() => {
    if (!data) return [];
    // Handle historical array response
    if (data.points && data.points.length > 0) {
      return data.points.map(p => ({
        timestamp: p.timestamp,
        longRatio: p.longRatio,
        shortRatio: p.shortRatio,
      }));
    }
    // Handle single-point fallback response (no points array)
    if ((data as any).longRatio != null) {
      return [{
        timestamp: (data as any).timestamp || Date.now(),
        longRatio: (data as any).longRatio,
        shortRatio: (data as any).shortRatio,
      }];
    }
    return [];
  }, [data]);

  const latest = chartData.length > 0 ? chartData[chartData.length - 1] : null;
  const prev = chartData.length > 1 ? chartData[chartData.length - 2] : null;
  const trend = latest && prev ? latest.longRatio - prev.longRatio : 0;

  const symbolLabel = SYMBOLS.find(s => s.value === symbol)?.label || symbol.replace('USDT', '');

  return (
    <div className="min-h-screen bg-hub-black text-white">
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-lg font-bold text-white">Long/Short Ratio</h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Binance Global Long/Short Account Ratio
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <span className="text-[11px] text-neutral-600">
                Updated {lastUpdate.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                autoRefresh
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-white/[0.04] text-neutral-500 border border-white/[0.06]'
              }`}
            >
              {autoRefresh ? 'Live' : 'Paused'}
            </button>
            <button
              onClick={refresh}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {/* Symbol selector */}
          <div className="flex rounded-lg overflow-hidden bg-white/[0.04] border border-white/[0.06]">
            {SYMBOLS.map(s => (
              <button
                key={s.value}
                onClick={() => setSymbol(s.value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  symbol === s.value
                    ? 'bg-hub-yellow text-black'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Period selector */}
          <div className="flex rounded-lg overflow-hidden bg-white/[0.04] border border-white/[0.06]">
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  period === p.value
                    ? 'bg-hub-yellow text-black'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Row */}
        {latest && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-3">
              <div className="text-[11px] text-neutral-500 mb-1">Long</div>
              <div className="text-lg font-bold text-green-400 font-mono">{latest.longRatio.toFixed(2)}%</div>
            </div>
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-3">
              <div className="text-[11px] text-neutral-500 mb-1">Short</div>
              <div className="text-lg font-bold text-red-400 font-mono">{latest.shortRatio.toFixed(2)}%</div>
            </div>
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-3">
              <div className="text-[11px] text-neutral-500 mb-1">L/S Ratio</div>
              <div className="text-lg font-bold text-white font-mono">
                {latest.shortRatio > 0 ? (latest.longRatio / latest.shortRatio).toFixed(3) : 'N/A'}
              </div>
            </div>
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-3">
              <div className="text-[11px] text-neutral-500 mb-1">Trend</div>
              <div className="flex items-center gap-1">
                {trend >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-400" />
                )}
                <span className={`text-lg font-bold font-mono ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {trend >= 0 ? '+' : ''}{trend.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-400">{error}</span>
          </div>
        )}

        {/* Chart */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 text-neutral-500 animate-spin" />
          </div>
        )}

        {!isLoading && chartData.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-16 mb-6">
            <div className="text-neutral-500 text-sm mb-2">No chart data available</div>
            <div className="text-neutral-600 text-xs">Binance Long/Short data may be temporarily unavailable</div>
          </div>
        )}

        {!isLoading && chartData.length > 0 && (
          <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-6">
            <div className="text-sm font-medium text-neutral-400 mb-3">
              {symbolLabel}/USDT Long/Short Ratio History ({period})
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="longGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="shortGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatTime}
                  tick={{ fill: '#525252', fontSize: 10 }}
                  axisLine={{ stroke: '#262626' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[40, 60]}
                  tick={{ fill: '#525252', fontSize: 10 }}
                  axisLine={{ stroke: '#262626' }}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={50} stroke="#525252" strokeDasharray="3 3" />
                <Area
                  type="monotone"
                  dataKey="longRatio"
                  stroke="#22c55e"
                  fill="url(#longGrad)"
                  strokeWidth={2}
                  dot={false}
                  animationDuration={300}
                />
                <Area
                  type="monotone"
                  dataKey="shortRatio"
                  stroke="#ef4444"
                  fill="url(#shortGrad)"
                  strokeWidth={2}
                  dot={false}
                  animationDuration={300}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Multi-symbol table */}
        <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <h2 className="text-sm font-medium text-neutral-400">All Symbols — Current Ratio</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-4 py-2 text-neutral-500 font-medium">Symbol</th>
                  <th className="text-right px-4 py-2 text-neutral-500 font-medium">Long %</th>
                  <th className="text-right px-4 py-2 text-neutral-500 font-medium">Short %</th>
                  <th className="text-right px-4 py-2 text-neutral-500 font-medium">L/S Ratio</th>
                  <th className="px-4 py-2 text-neutral-500 font-medium">Distribution</th>
                </tr>
              </thead>
              <tbody>
                {MULTI_SYMBOLS.map(sym => {
                  const d = multiData[sym];
                  const label = sym.replace('USDT', '');
                  if (!d) {
                    return (
                      <tr key={sym} className="border-b border-white/[0.04]">
                        <td className="px-4 py-2.5 font-medium text-white">{label}</td>
                        <td colSpan={4} className="px-4 py-2.5 text-neutral-600">Loading...</td>
                      </tr>
                    );
                  }
                  const ratio = d.shortRatio > 0 ? (d.longRatio / d.shortRatio).toFixed(3) : 'N/A';
                  const isActive = sym === symbol;
                  return (
                    <tr
                      key={sym}
                      onClick={() => setSymbol(sym)}
                      className={`border-b border-white/[0.04] cursor-pointer transition-colors ${
                        isActive ? 'bg-hub-yellow/5' : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <td className={`px-4 py-2.5 font-medium ${isActive ? 'text-hub-yellow' : 'text-white'}`}>
                        {label}
                      </td>
                      <td className="text-right px-4 py-2.5 text-green-400 font-mono">{d.longRatio.toFixed(2)}%</td>
                      <td className="text-right px-4 py-2.5 text-red-400 font-mono">{d.shortRatio.toFixed(2)}%</td>
                      <td className="text-right px-4 py-2.5 text-white font-mono">{ratio}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex h-2 rounded-full overflow-hidden bg-white/[0.04]">
                          <div
                            className="bg-green-500 transition-all"
                            style={{ width: `${d.longRatio}%` }}
                          />
                          <div
                            className="bg-red-500 transition-all"
                            style={{ width: `${d.shortRatio}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
