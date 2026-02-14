'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { RefreshCw, Calendar, Info } from 'lucide-react';
import { TokenIconSimple } from '@/components/TokenIcon';

/* ─── Types ──────────────────────────────────────────────────────── */

interface DayPoint {
  day: string; // YYYY-MM-DD
  rate: number;
}

interface HeatmapResponse {
  symbols: string[];
  days: number;
  data: Record<string, DayPoint[]>;
}

type SortMode = 'default' | 'avg-desc' | 'avg-asc' | 'latest-desc' | 'latest-asc';

/* ─── Color helpers ──────────────────────────────────────────────── */

function getHeatColor(rate: number | undefined): string {
  if (rate === undefined) return 'bg-neutral-800/40';
  // Rate is typically -0.1% to +0.3%, in decimal like 0.01 = 0.01%
  const r = rate * 100; // convert to basis points style for thresholding
  if (r > 10) return 'bg-green-400';
  if (r > 5) return 'bg-green-500';
  if (r > 2) return 'bg-green-600/90';
  if (r > 0.5) return 'bg-green-700/70';
  if (r > 0) return 'bg-green-800/50';
  if (r > -0.5) return 'bg-red-900/40';
  if (r > -2) return 'bg-red-700/70';
  if (r > -5) return 'bg-red-600/90';
  if (r > -10) return 'bg-red-500';
  return 'bg-red-400';
}

function formatRate(rate: number | undefined): string {
  if (rate === undefined) return '-';
  return `${rate >= 0 ? '+' : ''}${rate.toFixed(4)}%`;
}

function formatDay(day: string): string {
  const d = new Date(day + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ─── Component ──────────────────────────────────────────────────── */

export default function FundingHeatmapPage() {
  const [data, setData] = useState<HeatmapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('default');
  const [hoveredCell, setHoveredCell] = useState<{ symbol: string; day: string; rate: number } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/history/funding-heatmap?days=${days}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setLastUpdate(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000); // 5 min refresh
    return () => clearInterval(interval);
  }, [fetchData]);

  // Build uniform day columns across all symbols
  const allDays = useMemo(() => {
    if (!data?.data) return [];
    const daySet = new Set<string>();
    Object.values(data.data).forEach((points) => {
      points.forEach((p) => daySet.add(p.day));
    });
    const sorted = Array.from(daySet).sort();
    return sorted;
  }, [data]);

  // Build lookup: symbol -> day -> rate
  const rateLookup = useMemo(() => {
    if (!data?.data) return new Map<string, Map<string, number>>();
    const map = new Map<string, Map<string, number>>();
    Object.entries(data.data).forEach(([sym, points]) => {
      const dayMap = new Map<string, number>();
      points.forEach((p) => dayMap.set(p.day, p.rate));
      map.set(sym, dayMap);
    });
    return map;
  }, [data]);

  // Average rate per symbol (for sorting)
  const avgRates = useMemo(() => {
    const avg = new Map<string, number>();
    rateLookup.forEach((dayMap, sym) => {
      let sum = 0;
      let count = 0;
      dayMap.forEach((rate) => { sum += rate; count++; });
      avg.set(sym, count > 0 ? sum / count : 0);
    });
    return avg;
  }, [rateLookup]);

  // Latest rate per symbol
  const latestRates = useMemo(() => {
    const latest = new Map<string, number>();
    if (allDays.length === 0) return latest;
    const lastDay = allDays[allDays.length - 1];
    rateLookup.forEach((dayMap, sym) => {
      const r = dayMap.get(lastDay);
      if (r !== undefined) latest.set(sym, r);
    });
    return latest;
  }, [rateLookup, allDays]);

  // Sort symbols
  const sortedSymbols = useMemo(() => {
    if (!data?.symbols) return [];
    const syms = [...data.symbols];
    switch (sortMode) {
      case 'avg-desc':
        syms.sort((a, b) => (avgRates.get(b) || 0) - (avgRates.get(a) || 0));
        break;
      case 'avg-asc':
        syms.sort((a, b) => (avgRates.get(a) || 0) - (avgRates.get(b) || 0));
        break;
      case 'latest-desc':
        syms.sort((a, b) => (latestRates.get(b) || 0) - (latestRates.get(a) || 0));
        break;
      case 'latest-asc':
        syms.sort((a, b) => (latestRates.get(a) || 0) - (latestRates.get(b) || 0));
        break;
      default:
        break;
    }
    return syms;
  }, [data, sortMode, avgRates, latestRates]);

  // Stats
  const stats = useMemo(() => {
    if (!data || allDays.length === 0) return null;
    let totalPositive = 0;
    let totalNegative = 0;
    let count = 0;
    let sum = 0;
    rateLookup.forEach((dayMap) => {
      dayMap.forEach((rate) => {
        count++;
        sum += rate;
        if (rate > 0) totalPositive++;
        else if (rate < 0) totalNegative++;
      });
    });
    return {
      symbols: data.symbols.length,
      avgRate: count > 0 ? sum / count : 0,
      positivePct: count > 0 ? (totalPositive / count) * 100 : 0,
      negativePct: count > 0 ? (totalNegative / count) * 100 : 0,
      dataPoints: count,
    };
  }, [data, allDays, rateLookup]);

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#0a0a0a] text-white page-enter">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
          {/* Title */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                <Calendar className="w-6 h-6 text-hub-yellow" />
                Funding Rate Heatmap
              </h1>
              <p className="text-sm text-neutral-500 mt-1">
                Daily average funding rates across top symbols — spot trends and regime shifts
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Day selector */}
              <div className="flex bg-white/[0.04] rounded-lg p-0.5 gap-0.5">
                {[7, 14, 30].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDays(d)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      days === d
                        ? 'bg-hub-yellow text-black'
                        : 'text-neutral-400 hover:text-white hover:bg-white/[0.06]'
                    }`}
                  >
                    {d}D
                  </button>
                ))}
              </div>
              <button
                onClick={fetchData}
                disabled={loading}
                className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Stats bar */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl px-4 py-3">
                <p className="text-xs text-neutral-500">Symbols</p>
                <p className="text-lg font-bold text-white">{stats.symbols}</p>
              </div>
              <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl px-4 py-3">
                <p className="text-xs text-neutral-500">Avg Rate</p>
                <p className={`text-lg font-bold ${stats.avgRate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatRate(stats.avgRate)}
                </p>
              </div>
              <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl px-4 py-3">
                <p className="text-xs text-neutral-500">Positive Rates</p>
                <p className="text-lg font-bold text-green-400">{stats.positivePct.toFixed(1)}%</p>
              </div>
              <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl px-4 py-3">
                <p className="text-xs text-neutral-500">Negative Rates</p>
                <p className="text-lg font-bold text-red-400">{stats.negativePct.toFixed(1)}%</p>
              </div>
            </div>
          )}

          {/* Sort controls */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-xs text-neutral-500">Sort:</span>
            {([
              ['default', 'Default'],
              ['avg-desc', 'Avg ↓'],
              ['avg-asc', 'Avg ↑'],
              ['latest-desc', 'Latest ↓'],
              ['latest-asc', 'Latest ↑'],
            ] as [SortMode, string][]).map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => setSortMode(mode)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  sortMode === mode
                    ? 'bg-hub-yellow/20 text-hub-yellow border border-hub-yellow/30'
                    : 'bg-white/[0.04] text-neutral-400 hover:text-white border border-transparent'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Tooltip */}
          {hoveredCell && (
            <div className="fixed z-50 pointer-events-none bg-[#1a1a1a] border border-white/[0.1] rounded-lg px-3 py-2 shadow-xl text-xs"
              style={{ top: 'var(--tooltip-y, 0px)', left: 'var(--tooltip-x, 0px)' }}
            >
              <p className="font-semibold text-white">{hoveredCell.symbol}</p>
              <p className="text-neutral-400">{formatDay(hoveredCell.day)}</p>
              <p className={hoveredCell.rate >= 0 ? 'text-green-400' : 'text-red-400'}>
                {formatRate(hoveredCell.rate)}
              </p>
            </div>
          )}

          {/* Loading / Error */}
          {loading && !data && (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="w-6 h-6 animate-spin text-hub-yellow" />
              <span className="ml-3 text-neutral-400">Loading heatmap data...</span>
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-red-400">
              <p>{error}</p>
              <button onClick={fetchData} className="mt-3 text-sm text-hub-yellow hover:underline">
                Retry
              </button>
            </div>
          )}

          {/* Heatmap Grid */}
          {data && allDays.length > 0 && (
            <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="sticky left-0 z-10 bg-[#0d0d0d] px-3 py-2.5 text-left text-xs font-semibold text-neutral-400 w-[120px]">
                        Symbol
                      </th>
                      <th className="px-2 py-2.5 text-center text-xs font-semibold text-neutral-500 w-[70px]">
                        Avg
                      </th>
                      {allDays.map((day) => (
                        <th key={day} className="px-1 py-2.5 text-center text-[10px] font-medium text-neutral-500 min-w-[44px]">
                          {formatDay(day)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSymbols.map((symbol) => {
                      const dayMap = rateLookup.get(symbol);
                      const avg = avgRates.get(symbol) || 0;

                      return (
                        <tr key={symbol} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                          <td className="sticky left-0 z-10 bg-[#0d0d0d] px-3 py-1.5">
                            <div className="flex items-center gap-2">
                              <TokenIconSimple symbol={symbol} size={18} />
                              <span className="text-xs font-semibold text-white">{symbol}</span>
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <span className={`text-[10px] font-mono ${avg >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {formatRate(avg)}
                            </span>
                          </td>
                          {allDays.map((day) => {
                            const rate = dayMap?.get(day);
                            return (
                              <td
                                key={day}
                                className="px-0.5 py-1"
                                onMouseEnter={(e) => {
                                  if (rate !== undefined) {
                                    const rect = (e.target as HTMLElement).getBoundingClientRect();
                                    document.documentElement.style.setProperty('--tooltip-x', `${rect.left}px`);
                                    document.documentElement.style.setProperty('--tooltip-y', `${rect.bottom + 4}px`);
                                    setHoveredCell({ symbol, day, rate });
                                  }
                                }}
                                onMouseLeave={() => setHoveredCell(null)}
                              >
                                <div
                                  className={`w-full h-7 rounded-sm ${getHeatColor(rate)} transition-colors cursor-default`}
                                  title={rate !== undefined ? `${symbol} ${formatDay(day)}: ${formatRate(rate)}` : undefined}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Empty state */}
          {data && allDays.length === 0 && !loading && (
            <div className="text-center py-16 text-neutral-500">
              <p>No historical funding data available yet.</p>
              <p className="text-xs mt-1">Data accumulates from periodic snapshots.</p>
            </div>
          )}

          {/* Legend */}
          <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-neutral-500">Negative</span>
              <div className="flex gap-0.5">
                <div className="w-5 h-4 rounded-sm bg-red-400" />
                <div className="w-5 h-4 rounded-sm bg-red-500" />
                <div className="w-5 h-4 rounded-sm bg-red-600/90" />
                <div className="w-5 h-4 rounded-sm bg-red-700/70" />
                <div className="w-5 h-4 rounded-sm bg-red-900/40" />
                <div className="w-5 h-4 rounded-sm bg-green-800/50" />
                <div className="w-5 h-4 rounded-sm bg-green-700/70" />
                <div className="w-5 h-4 rounded-sm bg-green-600/90" />
                <div className="w-5 h-4 rounded-sm bg-green-500" />
                <div className="w-5 h-4 rounded-sm bg-green-400" />
              </div>
              <span className="text-xs text-neutral-500">Positive</span>
            </div>
            {lastUpdate && (
              <p className="text-xs text-neutral-600">
                Updated {lastUpdate.toLocaleTimeString()}
              </p>
            )}
          </div>

          {/* Info footer */}
          <div className="mt-8 bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4 border-l-2 border-l-hub-yellow">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-hub-yellow mt-0.5 flex-shrink-0" />
              <div className="text-xs text-neutral-400 space-y-1">
                <p>
                  <strong className="text-neutral-300">Funding Rate Heatmap</strong> shows daily-average
                  funding rates for the top {data?.symbols.length || 40} symbols by exchange coverage.
                </p>
                <p>
                  Green cells indicate positive funding (longs pay shorts) — bullish bias.
                  Red cells indicate negative funding (shorts pay longs) — bearish bias.
                </p>
                <p>
                  Look for regime shifts: rows transitioning from green to red (or vice versa) signal
                  changing market sentiment. Persistent deep green may indicate overcrowded longs.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
