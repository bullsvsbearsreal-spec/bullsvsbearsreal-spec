'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { RefreshCw, Building2, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCompact } from '@/lib/utils/format';

/* ─── Types ──────────────────────────────────────────────────────── */

interface ChainBreakdown {
  chain: string;
  value: number;
}

interface ExchangeReserve {
  name: string;
  slug: string;
  totalReserve: number;
  change1d: number | null;
  change7d: number | null;
  logo: string;
  chains: ChainBreakdown[];
}

interface ReservesResponse {
  totalReserves: number;
  exchangeCount: number;
  exchanges: ExchangeReserve[];
  updatedAt: number;
}

/* ─── Reserve Bar Chart (SVG) ───────────────────────────────────── */

function ReserveBarChart({ exchanges, width = 800, height = 300 }: { exchanges: ExchangeReserve[]; width?: number; height?: number }) {
  if (exchanges.length === 0) return null;

  const top = exchanges.slice(0, 15);
  const maxVal = Math.max(...top.map((e) => e.totalReserve), 1);
  const padding = { top: 8, bottom: 40, left: 4, right: 4 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const barW = chartW / top.length;
  const innerBarW = barW * 0.7;
  const gap = (barW - innerBarW) / 2;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      {top.map((ex, i) => {
        const x = padding.left + i * barW;
        const barH = (ex.totalReserve / maxVal) * chartH;
        const isPositiveChange = (ex.change1d ?? 0) >= 0;

        return (
          <g key={ex.slug}>
            {/* Bar */}
            <rect
              x={x + gap}
              y={padding.top + chartH - barH}
              width={innerBarW}
              height={barH}
              fill={isPositiveChange ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.4)'}
              rx={2}
            />
            {/* Value label on top */}
            {barH > 20 && (
              <text
                x={x + barW / 2}
                y={padding.top + chartH - barH - 4}
                textAnchor="middle"
                fontSize="7"
                fill="rgba(255,255,255,0.5)"
              >
                ${formatCompact(ex.totalReserve)}
              </text>
            )}
            {/* Exchange name */}
            <text
              x={x + barW / 2}
              y={height - 8}
              textAnchor="middle"
              fontSize="7"
              fill="rgba(255,255,255,0.4)"
              transform={`rotate(-35, ${x + barW / 2}, ${height - 8})`}
            >
              {ex.name.length > 10 ? ex.name.slice(0, 10) : ex.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Stacked Chain Bar ─────────────────────────────────────────── */

const CHAIN_COLORS: Record<string, string> = {
  Bitcoin: '#f7931a',
  Ethereum: '#627eea',
  Tron: '#ff0013',
  Solana: '#14f195',
  BSC: '#f0b90b',
  Arbitrum: '#28a0f0',
  Polygon: '#8247e5',
  Avalanche: '#e84142',
  Optimism: '#ff0420',
  Base: '#0052ff',
};

function getChainColor(chain: string, index: number): string {
  if (CHAIN_COLORS[chain]) return CHAIN_COLORS[chain];
  const fallback = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6', '#06b6d4', '#84cc16', '#f43f5e'];
  return fallback[index % fallback.length];
}

/* ─── Component ──────────────────────────────────────────────────── */

type SortKey = 'totalReserve' | 'change1d' | 'change7d' | 'name';

export default function ExchangeReservesPage() {
  const [data, setData] = useState<ReservesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('totalReserve');
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/reserves');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60_000); // 5-min refresh
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === 'name');
    }
  };

  const sorted = useMemo(() => {
    if (!data) return [];
    const list = [...data.exchanges];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'totalReserve':
          cmp = a.totalReserve - b.totalReserve;
          break;
        case 'change1d':
          cmp = (a.change1d ?? 0) - (b.change1d ?? 0);
          break;
        case 'change7d':
          cmp = (a.change7d ?? 0) - (b.change7d ?? 0);
          break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [data, sortKey, sortAsc]);

  // Top 5 exchange dominance
  const top5Pct = useMemo(() => {
    if (!data || data.exchanges.length === 0) return 0;
    const top5 = data.exchanges.slice(0, 5).reduce((s, e) => s + e.totalReserve, 0);
    return (top5 / data.totalReserves) * 100;
  }, [data]);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronDown className="w-3 h-3 text-neutral-700" />;
    return sortAsc ? <ChevronUp className="w-3 h-3 text-hub-yellow" /> : <ChevronDown className="w-3 h-3 text-hub-yellow" />;
  };

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="text-white">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6">
          {/* Title */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="heading-page flex items-center gap-2">
                <Building2 className="w-6 h-6 text-hub-yellow" />
                Exchange Reserves
              </h1>
              <p className="text-sm text-neutral-500 mt-1">
                Total assets held by major centralized exchanges — proof of reserves transparency
              </p>
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loading && !data && (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="w-6 h-6 animate-spin text-hub-yellow" />
              <span className="ml-3 text-neutral-400">Loading reserve data...</span>
            </div>
          )}

          {error && !data && (
            <div className="text-center py-12 text-red-400">
              <p>{error}</p>
              <button onClick={fetchData} className="mt-3 text-sm text-hub-yellow hover:underline">Retry</button>
            </div>
          )}

          {data && (
            <>
              {/* Key Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                <div className="bg-hub-darker border border-hub-yellow/20 rounded-xl px-4 py-3">
                  <p className="text-xs text-neutral-500">Total CEX Reserves</p>
                  <p className="text-xl font-bold text-hub-yellow">${formatCompact(data.totalReserves)}</p>
                  <p className="text-xs text-neutral-500">{data.exchangeCount} exchanges tracked</p>
                </div>
                <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                  <p className="text-xs text-neutral-500">Top 5 Dominance</p>
                  <p className="text-xl font-bold text-white">{top5Pct.toFixed(1)}%</p>
                  <p className="text-xs text-neutral-500">of total reserves</p>
                </div>
                <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3 col-span-2 sm:col-span-1">
                  <p className="text-xs text-neutral-500">#1 Exchange</p>
                  <p className="text-xl font-bold text-white">{data.exchanges[0]?.name ?? '-'}</p>
                  <p className="text-xs text-neutral-500">
                    ${formatCompact(data.exchanges[0]?.totalReserve ?? 0)}
                  </p>
                </div>
              </div>

              {/* Reserve Bar Chart */}
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-6">
                <h2 className="text-sm font-semibold text-white mb-1">Reserves by Exchange</h2>
                <p className="text-xs text-neutral-600 mb-3">Top 15 — green = positive 24h change, red = negative</p>
                <div className="h-[300px]">
                  <ReserveBarChart exchanges={data.exchanges} />
                </div>
              </div>

              {/* Dominance Stacked Bar */}
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-6">
                <h2 className="text-sm font-semibold text-white mb-3">Market Share</h2>
                <div className="h-10 rounded-lg overflow-hidden flex">
                  {data.exchanges.slice(0, 8).map((ex, i) => {
                    const pct = (ex.totalReserve / data.totalReserves) * 100;
                    return (
                      <div
                        key={ex.slug}
                        className="h-full relative group"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: getChainColor(ex.name, i),
                        }}
                        title={`${ex.name}: ${pct.toFixed(1)}%`}
                      >
                        {pct > 6 && (
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white/90 drop-shadow">
                            {ex.name}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {(() => {
                    const top8 = data.exchanges.slice(0, 8).reduce((s, e) => s + e.totalReserve, 0);
                    const othersPct = ((data.totalReserves - top8) / data.totalReserves) * 100;
                    return othersPct > 1 ? (
                      <div
                        className="h-full bg-neutral-600"
                        style={{ width: `${othersPct}%` }}
                        title={`Others: ${othersPct.toFixed(1)}%`}
                      />
                    ) : null;
                  })()}
                </div>
                <div className="flex flex-wrap gap-3 mt-3">
                  {data.exchanges.slice(0, 8).map((ex, i) => (
                    <div key={ex.slug} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: getChainColor(ex.name, i) }} />
                      <span className="text-[10px] text-neutral-400">
                        {ex.name} {((ex.totalReserve / data.totalReserves) * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Exchange Table */}
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden mb-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">#</th>
                        <th
                          className="text-left px-4 py-3 text-xs font-medium text-neutral-500 cursor-pointer hover:text-white transition-colors"
                          onClick={() => handleSort('name')}
                        >
                          <span className="flex items-center gap-1">Exchange <SortIcon col="name" /></span>
                        </th>
                        <th
                          className="text-right px-4 py-3 text-xs font-medium text-neutral-500 cursor-pointer hover:text-white transition-colors"
                          onClick={() => handleSort('totalReserve')}
                        >
                          <span className="flex items-center justify-end gap-1">Total Reserves <SortIcon col="totalReserve" /></span>
                        </th>
                        <th
                          className="text-right px-4 py-3 text-xs font-medium text-neutral-500 cursor-pointer hover:text-white transition-colors"
                          onClick={() => handleSort('change1d')}
                        >
                          <span className="flex items-center justify-end gap-1">24h Δ <SortIcon col="change1d" /></span>
                        </th>
                        <th
                          className="text-right px-4 py-3 text-xs font-medium text-neutral-500 cursor-pointer hover:text-white transition-colors"
                          onClick={() => handleSort('change7d')}
                        >
                          <span className="flex items-center justify-end gap-1">7d Δ <SortIcon col="change7d" /></span>
                        </th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Dominance</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Chain Distribution</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((ex, idx) => {
                        const pct = (ex.totalReserve / data.totalReserves) * 100;
                        const isExpanded = expandedRow === ex.slug;

                        return (
                          <tr key={ex.slug} className="border-b border-white/[0.03] last:border-0">
                            <td className="px-4 py-3">
                              <span className="text-xs text-neutral-600">{idx + 1}</span>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => setExpandedRow(isExpanded ? null : ex.slug)}
                                className="flex items-center gap-2 hover:text-hub-yellow transition-colors text-left"
                              >
                                {ex.logo && (
                                  <img
                                    src={ex.logo}
                                    alt=""
                                    className="w-5 h-5 rounded-full bg-white/10"
                                    loading="lazy"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                  />
                                )}
                                <span className="font-medium text-white text-sm">{ex.name}</span>
                                <ChevronDown className={`w-3 h-3 text-neutral-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </button>

                              {/* Expanded chain breakdown */}
                              {isExpanded && ex.chains.length > 0 && (
                                <div className="mt-2 ml-7 space-y-1.5">
                                  {ex.chains.map((c, ci) => {
                                    const chainPct = (c.value / ex.totalReserve) * 100;
                                    return (
                                      <div key={c.chain} className="flex items-center gap-2">
                                        <span className="text-[11px] text-neutral-500 w-20 truncate">{c.chain}</span>
                                        <div className="flex-1 h-3 bg-white/[0.04] rounded-full overflow-hidden max-w-[120px]">
                                          <div
                                            className="h-full rounded-full"
                                            style={{
                                              width: `${Math.max(chainPct, 1)}%`,
                                              backgroundColor: getChainColor(c.chain, ci),
                                            }}
                                          />
                                        </div>
                                        <span className="text-[10px] text-neutral-500 w-14 text-right">
                                          ${formatCompact(c.value)}
                                        </span>
                                        <span className="text-[10px] text-neutral-600 w-10 text-right">
                                          {chainPct.toFixed(1)}%
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-semibold text-white">${formatCompact(ex.totalReserve)}</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {ex.change1d != null ? (
                                <span className={`flex items-center justify-end gap-0.5 text-xs ${ex.change1d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {ex.change1d >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                  {ex.change1d >= 0 ? '+' : ''}{ex.change1d.toFixed(2)}%
                                </span>
                              ) : (
                                <span className="text-xs text-neutral-600">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {ex.change7d != null ? (
                                <span className={`text-xs ${ex.change7d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {ex.change7d >= 0 ? '+' : ''}{ex.change7d.toFixed(2)}%
                                </span>
                              ) : (
                                <span className="text-xs text-neutral-600">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-xs text-neutral-400">{pct.toFixed(1)}%</span>
                            </td>
                            <td className="px-4 py-3">
                              {/* Mini stacked bar for chain distribution */}
                              <div className="h-3 rounded-full overflow-hidden flex min-w-[100px] max-w-[160px] bg-white/[0.04]">
                                {ex.chains.slice(0, 5).map((c, ci) => (
                                  <div
                                    key={c.chain}
                                    className="h-full"
                                    style={{
                                      width: `${(c.value / ex.totalReserve) * 100}%`,
                                      backgroundColor: getChainColor(c.chain, ci),
                                    }}
                                    title={`${c.chain}: $${formatCompact(c.value)}`}
                                  />
                                ))}
                              </div>
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

          {/* Info footer */}
          <div className="mt-4 p-3 rounded-lg bg-hub-yellow/5 border border-hub-yellow/10">
            <p className="text-neutral-500 text-xs leading-relaxed">
              Exchange Reserves track total assets held by centralized exchanges, sourced from DefiLlama proof-of-reserves data. Declining reserves may indicate users withdrawing to self-custody (bullish for supply squeeze). Rising reserves can signal incoming sell pressure. Chain distribution shows where each exchange holds its assets. Updates every 5 minutes.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
