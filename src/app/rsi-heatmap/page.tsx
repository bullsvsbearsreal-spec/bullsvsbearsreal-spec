'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Pagination from '@/components/Pagination';
import { TokenIconSimple } from '@/components/TokenIcon';
import { RefreshCw, Info, Search, Activity, Hash, BarChart3, TrendingUp, TrendingDown } from 'lucide-react';
import Link from 'next/link';

/* ─── Types ──────────────────────────────────────────────────────── */

interface RSIData {
  symbol: string;
  rsi1h: number | null;
  rsi4h: number | null;
  rsi1d: number | null;
  price: number;
  change24h: number;
}

type SortField = 'symbol' | 'rsi1h' | 'rsi4h' | 'rsi1d' | 'price' | 'change24h';
type SortDir = 'asc' | 'desc';
type FilterMode = 'all' | 'overbought' | 'oversold';

const ROWS_PER_PAGE = 50;

/* ─── RSI Color Helpers ──────────────────────────────────────────── */

function rsiColor(rsi: number | null): string {
  if (rsi === null) return 'bg-white/[0.02]';
  if (rsi >= 80) return 'bg-red-500/80';
  if (rsi >= 70) return 'bg-red-500/50';
  if (rsi >= 60) return 'bg-orange-500/30';
  if (rsi >= 40) return 'bg-white/[0.04]';
  if (rsi >= 30) return 'bg-emerald-500/30';
  if (rsi >= 20) return 'bg-emerald-500/50';
  return 'bg-emerald-500/80';
}

function rsiTextColor(rsi: number | null): string {
  if (rsi === null) return 'text-neutral-700';
  if (rsi >= 70) return 'text-red-300';
  if (rsi >= 60) return 'text-orange-300';
  if (rsi >= 40) return 'text-white/70';
  if (rsi >= 30) return 'text-emerald-300';
  return 'text-emerald-300';
}

function rsiLabel(rsi: number | null): string {
  if (rsi === null) return '';
  if (rsi >= 80) return 'Extreme OB';
  if (rsi >= 70) return 'Overbought';
  if (rsi >= 60) return 'Bullish';
  if (rsi >= 40) return 'Neutral';
  if (rsi >= 30) return 'Bearish';
  if (rsi >= 20) return 'Oversold';
  return 'Extreme OS';
}

function signalFromRSI(d: RSIData): { text: string; color: string } {
  if (d.rsi1d !== null && d.rsi1d >= 80) return { text: 'Extreme OB', color: 'text-red-400 bg-red-500/10' };
  if (d.rsi1d !== null && d.rsi1d >= 70) return { text: 'Overbought', color: 'text-red-400 bg-red-500/10' };
  if (d.rsi1d !== null && d.rsi1d <= 20) return { text: 'Extreme OS', color: 'text-emerald-400 bg-emerald-500/10' };
  if (d.rsi1d !== null && d.rsi1d <= 30) return { text: 'Oversold', color: 'text-emerald-400 bg-emerald-500/10' };
  if (d.rsi4h !== null && d.rsi4h >= 70) return { text: 'OB (4h)', color: 'text-orange-400 bg-orange-500/10' };
  if (d.rsi4h !== null && d.rsi4h <= 30) return { text: 'OS (4h)', color: 'text-teal-400 bg-teal-500/10' };
  return { text: '—', color: 'text-neutral-600' };
}

const fmtPrice = (p: number) => {
  if (!p && p !== 0) return '—';
  return p >= 1
    ? `$${p.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    : p >= 0.001 ? `$${p.toFixed(4)}` : `$${p.toFixed(6)}`;
};

/* ─── Component ──────────────────────────────────────────────────── */

export default function RSIHeatmapPage() {
  const [data, setData] = useState<RSIData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [sortField, setSortField] = useState<SortField>('rsi1d');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/rsi');
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const json = await res.json();
      setData(json.data || []);
      setLastUpdate(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load RSI data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortField(field); setSortDir('desc'); }
    setCurrentPage(1);
  };

  const filtered = useMemo(() => {
    let items = data;

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(d => d.symbol.toLowerCase().includes(q));
    }

    if (filterMode === 'overbought') {
      items = items.filter(d => (d.rsi1d !== null && d.rsi1d >= 70) || (d.rsi4h !== null && d.rsi4h >= 70));
    } else if (filterMode === 'oversold') {
      items = items.filter(d => (d.rsi1d !== null && d.rsi1d <= 30) || (d.rsi4h !== null && d.rsi4h <= 30));
    }

    return [...items].sort((a, b) => {
      let va: number, vb: number;
      switch (sortField) {
        case 'symbol': return sortDir === 'asc' ? a.symbol.localeCompare(b.symbol) : b.symbol.localeCompare(a.symbol);
        case 'rsi1h': va = a.rsi1h ?? -1; vb = b.rsi1h ?? -1; break;
        case 'rsi4h': va = a.rsi4h ?? -1; vb = b.rsi4h ?? -1; break;
        case 'rsi1d': va = a.rsi1d ?? -1; vb = b.rsi1d ?? -1; break;
        case 'price': va = a.price ?? 0; vb = b.price ?? 0; break;
        case 'change24h': va = a.change24h ?? 0; vb = b.change24h ?? 0; break;
        default: return 0;
      }
      return sortDir === 'desc' ? vb - va : va - vb;
    });
  }, [data, search, filterMode, sortField, sortDir]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIdx = (safeCurrentPage - 1) * ROWS_PER_PAGE;
  const pageItems = filtered.slice(startIdx, startIdx + ROWS_PER_PAGE);

  // Summary stats
  const stats = useMemo(() => {
    const valid1d = data.filter(d => d.rsi1d !== null);
    const avg1d = valid1d.length > 0 ? valid1d.reduce((s, d) => s + d.rsi1d!, 0) / valid1d.length : 0;
    const ob = data.filter(d => d.rsi1d !== null && d.rsi1d >= 70).length;
    const os = data.filter(d => d.rsi1d !== null && d.rsi1d <= 30).length;
    return { avg1d, overbought: ob, oversold: os, total: data.length };
  }, [data]);

  const SortHeader = ({ field, label, className = '' }: { field: SortField; label: string; className?: string }) => (
    <th
      className={`px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-white transition-colors ${
        sortField === field ? 'text-hub-yellow' : 'text-neutral-500'
      } ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className={`flex items-center gap-1 ${className.includes('text-left') ? '' : 'justify-center'}`}>
        {label}
        {sortField === field && (
          <span className="text-hub-yellow">{sortDir === 'desc' ? '↓' : '↑'}</span>
        )}
      </div>
    </th>
  );

  const RSICell = ({ rsi }: { rsi: number | null }) => (
    <td className="px-1 py-0.5">
      <div className={`${rsiColor(rsi)} rounded px-2 py-1.5 text-center`} title={rsi !== null ? `RSI ${rsi.toFixed(1)} — ${rsiLabel(rsi)}` : 'No data'}>
        <span className={`text-[11px] font-mono tabular-nums font-medium ${rsiTextColor(rsi)}`}>
          {rsi !== null ? rsi.toFixed(1) : '—'}
        </span>
      </div>
    </td>
  );

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
        {/* Page header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Activity className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <h1 className="heading-page">RSI Heatmap</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                {data.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]" />}
                <span className="text-neutral-500 text-sm">Relative Strength Index across multiple timeframes</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <span className="text-[10px] text-neutral-600 font-mono">
                {lastUpdate.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
          <div className="bg-hub-darker border border-white/[0.06] rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Hash className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <span className="text-neutral-500 text-[10px] uppercase tracking-wider">Symbols</span>
                <div className="text-lg font-bold text-white font-mono">{stats.total}</div>
              </div>
            </div>
          </div>
          <div className="bg-hub-darker border border-white/[0.06] rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-orange-400" />
              </div>
              <div>
                <span className="text-neutral-500 text-[10px] uppercase tracking-wider">Avg RSI (1D)</span>
                <div className={`text-lg font-bold font-mono ${stats.avg1d >= 60 ? 'text-orange-400' : stats.avg1d <= 40 ? 'text-emerald-400' : 'text-white'}`}>
                  {stats.avg1d.toFixed(1)}
                </div>
              </div>
            </div>
          </div>
          <div className="bg-hub-darker border border-red-500/10 rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <span className="text-red-500/60 text-[10px] uppercase tracking-wider">Overbought ≥70</span>
                <div className="text-lg font-bold text-red-400 font-mono">{stats.overbought}</div>
              </div>
            </div>
          </div>
          <div className="bg-hub-darker border border-emerald-500/10 rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <span className="text-emerald-500/60 text-[10px] uppercase tracking-wider">Oversold ≤30</span>
                <div className="text-lg font-bold text-emerald-400 font-mono">{stats.oversold}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="flex rounded-lg overflow-hidden border border-white/[0.06]">
            {(['all', 'overbought', 'oversold'] as FilterMode[]).map(m => (
              <button
                key={m}
                onClick={() => { setFilterMode(m); setCurrentPage(1); }}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  filterMode === m ? 'bg-hub-yellow text-black' : 'text-neutral-500 hover:text-white bg-white/[0.04]'
                }`}
              >
                {m === 'all' ? 'All' : m === 'overbought' ? `Overbought (${stats.overbought})` : `Oversold (${stats.oversold})`}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[150px] max-w-[240px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
            <input
              type="text"
              placeholder="Search symbol..."
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full pl-8 pr-3 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg text-white text-xs placeholder-neutral-500 focus:outline-none focus:border-hub-yellow/40"
            />
          </div>
          <span className="text-[11px] text-neutral-600 ml-auto">
            {filtered.length} symbol{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Content */}
        {loading && data.length === 0 ? (
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-12 text-center">
            <RefreshCw className="w-5 h-5 text-hub-yellow animate-spin mx-auto mb-2" />
            <span className="text-neutral-500 text-sm">Calculating RSI for 50 symbols across 3 timeframes...</span>
          </div>
        ) : error ? (
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-8 text-center">
            <p className="text-red-400 text-sm mb-3">{error}</p>
            <button onClick={fetchData} className="px-4 py-2 bg-hub-yellow text-black rounded-lg text-xs font-medium hover:bg-hub-yellow/90 transition-colors">
              Retry
            </button>
          </div>
        ) : (
          <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
            {/* Legend */}
            <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
              <span className="text-white font-semibold text-sm">RSI-14 across timeframes</span>
              <div className="flex items-center gap-2 text-[9px]">
                <div className="flex items-center gap-1"><div className="w-3 h-2 rounded-sm bg-emerald-500/80" /><span className="text-neutral-500">≤30 Oversold</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-2 rounded-sm bg-white/[0.04] border border-white/[0.06]" /><span className="text-neutral-500">Neutral</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-2 rounded-sm bg-red-500/80" /><span className="text-neutral-500">≥70 Overbought</span></div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    <SortHeader field="symbol" label="Symbol" className="text-left px-3 sticky left-0 bg-hub-darker z-10" />
                    <SortHeader field="price" label="Price" />
                    <SortHeader field="change24h" label="24h %" />
                    <SortHeader field="rsi1h" label="RSI 1H" />
                    <SortHeader field="rsi4h" label="RSI 4H" />
                    <SortHeader field="rsi1d" label="RSI 1D" />
                    <th className="px-2 py-2.5 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider text-center">Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-neutral-500 text-sm">
                        {search ? 'No symbols match your search.' : 'No RSI data available.'}
                      </td>
                    </tr>
                  ) : pageItems.map(d => {
                    const signal = signalFromRSI(d);
                    return (
                      <tr key={d.symbol} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors">
                        <td className="px-3 py-1.5 sticky left-0 bg-hub-darker z-10">
                          <Link href={`/funding/${d.symbol}`} className="flex items-center gap-1.5 no-underline group">
                            <TokenIconSimple symbol={d.symbol} size={18} />
                            <span className="text-white font-medium text-xs group-hover:text-hub-yellow transition-colors">{d.symbol}</span>
                          </Link>
                        </td>
                        <td className="px-2 py-1.5 text-center text-xs font-mono tabular-nums text-white/80">
                          {fmtPrice(d.price)}
                        </td>
                        <td className={`px-2 py-1.5 text-center text-xs font-mono tabular-nums ${
                          d.change24h >= 0 ? 'text-success' : 'text-danger'
                        }`}>
                          {d.change24h != null ? `${d.change24h >= 0 ? '+' : ''}${d.change24h.toFixed(2)}%` : '—'}
                        </td>
                        <RSICell rsi={d.rsi1h} />
                        <RSICell rsi={d.rsi4h} />
                        <RSICell rsi={d.rsi1d} />
                        <td className="px-2 py-1.5 text-center">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${signal.color}`}>
                            {signal.text}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              totalItems={filtered.length}
              rowsPerPage={ROWS_PER_PAGE}
              onPageChange={setCurrentPage}
              label="symbols"
            />
          </div>
        )}

        {/* Info footer */}
        <div className="mt-4 p-3 rounded-lg bg-hub-yellow/5 border border-hub-yellow/10">
          <p className="text-neutral-500 text-xs leading-relaxed flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-hub-yellow mt-0.5 flex-shrink-0" />
            <span>
              RSI (Relative Strength Index) measures momentum on a 0–100 scale. Values above <span className="text-red-400 font-medium">70</span> suggest overbought conditions (potential pullback).
              Below <span className="text-emerald-400 font-medium">30</span> suggests oversold (potential bounce). Data from Binance USDT perpetuals, RSI-14 period.
            </span>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
