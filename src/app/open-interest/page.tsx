'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ReferralBanner from '@/components/ReferralBanner';
import FeatureHint from '@/components/FeatureHint';
import RelatedPages from '@/components/RelatedPages';
import { fetchAllOpenInterest, aggregateOpenInterestBySymbol, aggregateOpenInterestByExchange } from '@/lib/api/aggregator';
import { OpenInterestData } from '@/lib/api/types';
import { RefreshCw, ArrowUpDown, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { getExchangeBadgeColor } from '@/lib/constants';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { getExchangeReferralUrl } from '@/lib/referralLinks';
import { formatUSD } from '@/lib/utils/format';
import DataFreshness from '@/components/DataFreshness';
import WatchlistStar from '@/components/WatchlistStar';
import { useFlash } from '@/hooks/useFlash';
import SoftAuthGate, { useAuthLimit } from '@/components/SoftAuthGate';
import ShowMoreToggle from '@/components/ShowMoreToggle';
import MobileCard from '@/components/MobileCard';
import dynamic from 'next/dynamic';

const OIHistoryChart = dynamic(() => import('./components/OIHistoryChart'), { ssr: false });

type SortField = 'symbol' | 'openInterestValue' | 'exchange' | 'change1h' | 'change4h' | 'change24h';
type SortOrder = 'asc' | 'desc';

interface OIDelta {
  symbol: string;
  currentOI: number;
  change1h: number | null;
  change4h: number | null;
  change24h: number | null;
}

export default function OpenInterestPage() {
  const authLimit = useAuthLimit(20);
  // Read ?symbol= from /chart's OI tool. Defer to a useEffect that
  // runs once on mount to avoid SSR / window-mismatch; the searchTerm
  // state starts blank and gets seeded after hydration. Using
  // useSearchParams directly would also work but this matches the
  // post-hydration pattern used elsewhere on this page.
  const [openInterest, setOpenInterest] = useState<OpenInterestData[]>([]);
  const [oiDeltas, setOiDeltas] = useState<Map<string, OIDelta>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [sortField, setSortField] = useState<SortField>('openInterestValue');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [exchangeFilter, setExchangeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams(window.location.search);
    const sym = (p.get('symbol') || '').toUpperCase().trim().slice(0, 16);
    if (sym) setSearchTerm(sym);
  }, []);
  const [viewMode, setViewMode] = useState<'all' | 'aggregated'>('all');
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const PAGE_SIZE = 100;

  // Wrapped in useCallback so the setInterval below captures the latest
  // reference rather than a stale closure. Previously `fetchData` was a
  // plain async function declared in the component body, and the useEffect
  // had `[]` deps — meaning the version of fetchData captured by
  // setInterval was the initial-render one, which would silently call a
  // stale closure if any state used inside fetchData ever started being
  // referenced. Defensive fix even though current fetchData reads no
  // closed-over state.
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch OI data first (fast, ~0.2s cached)
      const data = await fetchAllOpenInterest();
      setOpenInterest(data);
      setLastUpdate(new Date());
      setLoading(false);
      // Fetch deltas in background (can be slow/timeout — don't block UI)
      fetch('/api/oi-delta')
        .then(r => r.ok ? r.json() : null)
        .then(deltaRes => {
          if (Array.isArray(deltaRes?.data)) {
            const map = new Map<string, OIDelta>();
            deltaRes.data.forEach((d: OIDelta) => map.set(d.symbol, d));
            setOiDeltas(map);
          }
        })
        .catch(() => {}); // silently fail — deltas are optional
    } catch (err) {
      setError('Unable to reach exchange APIs — check your connection or try again shortly.');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // 60s (server caches for 2 min)
    return () => clearInterval(interval);
  }, [fetchData]);

  // Get unique exchanges
  const exchanges = useMemo(() => Array.from(new Set(openInterest.map(oi => oi.exchange))), [openInterest]);

  // Aggregate data
  const symbolAggregated = useMemo(() => aggregateOpenInterestBySymbol(openInterest), [openInterest]);
  const exchangeAggregated = useMemo(() => aggregateOpenInterestByExchange(openInterest), [openInterest]);

  // Filter and sort data
  const filteredAndSorted = useMemo(() => openInterest
    .filter(oi => {
      if (exchangeFilter !== 'all' && oi.exchange !== exchangeFilter) return false;
      if (searchTerm && !oi.symbol.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'symbol':
          comparison = a.symbol.localeCompare(b.symbol);
          break;
        case 'openInterestValue':
          comparison = a.openInterestValue - b.openInterestValue;
          break;
        case 'exchange':
          comparison = a.exchange.localeCompare(b.exchange);
          break;
        case 'change1h':
        case 'change4h':
        case 'change24h': {
          const dA = oiDeltas.get(a.symbol);
          const dB = oiDeltas.get(b.symbol);
          const vA = dA?.[sortField] ?? -Infinity;
          const vB = dB?.[sortField] ?? -Infinity;
          comparison = vA - vB;
          break;
        }
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    }), [openInterest, exchangeFilter, searchTerm, sortField, sortOrder, oiDeltas]);

  const displayData = authLimit ? filteredAndSorted.slice(0, authLimit) : filteredAndSorted;

  // Aggregated by symbol, sorted
  const aggregatedSorted = useMemo(() => Array.from(symbolAggregated.entries())
    .filter(([symbol]) => !searchTerm || symbol.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'symbol':
          comparison = a[0].localeCompare(b[0]);
          break;
        case 'change1h':
        case 'change4h':
        case 'change24h': {
          const dA = oiDeltas.get(a[0]);
          const dB = oiDeltas.get(b[0]);
          const vA = dA?.[sortField] ?? -Infinity;
          const vB = dB?.[sortField] ?? -Infinity;
          comparison = vA - vB;
          break;
        }
        default:
          comparison = a[1] - b[1];
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    }), [symbolAggregated, searchTerm, sortField, sortOrder, oiDeltas]);

  const AGGREGATED_DEFAULT = 20;
  const displayedAggregated = expanded ? aggregatedSorted : aggregatedSorted.slice(0, AGGREGATED_DEFAULT);

  // Calculate total OI
  const totalOI = useMemo(() => openInterest.reduce((sum, oi) => sum + oi.openInterestValue, 0), [openInterest]);
  const totalOIFlash = useFlash(totalOI);

  // Compute biggest OI movers (24h) from deltas
  const oiMovers = (() => {
    if (oiDeltas.size === 0) return { gainers: [] as { symbol: string; change: number }[], losers: [] as { symbol: string; change: number }[] };
    const withChange: { symbol: string; change: number }[] = [];
    oiDeltas.forEach((d, symbol) => {
      if (d.change24h != null) withChange.push({ symbol, change: d.change24h });
    });
    withChange.sort((a, b) => b.change - a.change);
    return {
      gainers: withChange.filter(m => m.change > 0).slice(0, 5),
      losers: withChange.filter(m => m.change < 0).slice(-5).reverse(),
    };
  })();

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };


  return (
    <div className="min-h-screen bg-hub-black">
      <Header />

      <main id="main-content" className="max-w-[1400px] mx-auto px-4 py-6">
        <FeatureHint page="/open-interest" />
        {/* Hero — workflow vocabulary. */}
        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 mb-2">
              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-hub-yellow/20 to-hub-yellow/[0.04] border border-hub-yellow/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-hub-yellow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3v18h18" /><path d="M7 14l4-4 4 4 5-5" />
                </svg>
              </div>
              <span className="text-[10px] uppercase tracking-[0.18em] text-neutral-500 font-bold">Market · derivatives</span>
            </div>
            <h1 className="text-3xl sm:text-[34px] font-extrabold tracking-tight text-white leading-[1.05]">
              Open <span className="text-hub-yellow">interest</span>
            </h1>
            <p className="text-[13px] text-neutral-400 mt-2 max-w-xl leading-relaxed">
              Aggregate OI across <span className="text-white font-medium">{exchanges.length} exchanges</span>,
              with 1h / 4h / 24h change deltas and per-venue dominance breakdowns.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-end">
            <DataFreshness exchangeCount={exchanges.length} lastUpdated={lastUpdate} />
            <button
              onClick={fetchData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] rounded-xl text-neutral-300 hover:text-white text-xs font-semibold transition-colors disabled:opacity-50 border border-white/[0.06]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </header>

        {/* Stats Cards — PH-scale numbers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
          <div className="bg-hub-darker border border-white/[0.06] rounded-lg px-3 py-2.5">
            <span className="text-neutral-600 text-[10px] uppercase tracking-wider font-semibold">Total OI</span>
            <div className={`text-xl font-black text-white font-mono tabular-nums mt-0.5 tracking-tight ${totalOIFlash}`}>{formatUSD(totalOI)}</div>
          </div>
          <div className="bg-hub-darker border border-white/[0.06] rounded-lg px-3 py-2.5">
            <span className="text-neutral-600 text-[10px] uppercase tracking-wider font-semibold">Symbols</span>
            <div className="text-xl font-black text-white font-mono tabular-nums mt-0.5 tracking-tight">{symbolAggregated.size.toLocaleString()}</div>
          </div>
          <div className="bg-hub-darker border border-white/[0.06] rounded-lg px-3 py-2.5">
            <span className="text-neutral-600 text-[10px] uppercase tracking-wider font-semibold">Exchanges</span>
            <div className="text-xl font-black text-white font-mono tabular-nums mt-0.5 tracking-tight">{exchanges.length}</div>
          </div>
        </div>

        {/* Biggest OI Movers (24h) */}
        {(oiMovers.gainers.length > 0 || oiMovers.losers.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
            {oiMovers.gainers.length > 0 && (
              <div className="bg-hub-darker border border-white/[0.06] rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <TrendingUp className="w-3 h-3 text-green-400" />
                  <span className="text-neutral-600 text-[10px] uppercase tracking-wider">Biggest OI Increase 24h</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {oiMovers.gainers.map(m => {
                    const isExtreme = m.change >= 20;
                    return (
                      <Link
                        key={m.symbol}
                        href={`/symbol/${m.symbol}`}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 transition-colors"
                      >
                        <span className="text-white text-[10px] font-medium">{m.symbol}</span>
                        <span className={`delta-badge text-[10px] ${isExtreme ? 'delta-badge-extreme-up' : 'delta-badge-up'}`}>
                          +{m.change.toFixed(1)}%
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
            {oiMovers.losers.length > 0 && (
              <div className="bg-hub-darker border border-white/[0.06] rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <TrendingDown className="w-3 h-3 text-red-400" />
                  <span className="text-neutral-600 text-[10px] uppercase tracking-wider">Biggest OI Decrease 24h</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {oiMovers.losers.map(m => {
                    const isExtreme = Math.abs(m.change) >= 20;
                    return (
                      <Link
                        key={m.symbol}
                        href={`/symbol/${m.symbol}`}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                      >
                        <span className="text-white text-[10px] font-medium">{m.symbol}</span>
                        <span className={`delta-badge text-[10px] ${isExtreme ? 'delta-badge-extreme-down' : 'delta-badge-down'}`}>
                          {m.change.toFixed(1)}%
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* OI Distribution Bar Chart */}
        {(() => {
          const exchangeBarColors = [
            '#FACC15', '#F59E0B', '#FB923C', '#F97316',
            '#EAB308', '#D97706', '#CA8A04', '#A16207',
          ];
          const top8 = Array.from(exchangeAggregated.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8);
          const maxVal = top8.length > 0 ? top8[0][1] : 1;
          const barHeight = 28;
          const gap = 6;
          const labelWidth = 90;
          const valueWidth = 90;
          const chartHeight = top8.length * (barHeight + gap) - gap + 8;
          return (
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-4">
              <h3 className="text-white font-semibold text-sm mb-3">OI Distribution by Exchange</h3>
              <svg width="100%" height={chartHeight} viewBox={`0 0 700 ${chartHeight}`} preserveAspectRatio="xMinYMid meet" className="overflow-visible" role="img" aria-label="Open interest distribution by exchange">
                {top8.map(([exchange, value], i) => {
                  const pct = totalOI > 0 ? (value / totalOI) * 100 : 0;
                  const barW = maxVal > 0 ? (value / maxVal) * (700 - labelWidth - valueWidth - 16) : 0;
                  const y = i * (barHeight + gap);
                  return (
                    <g key={exchange}>
                      <text x={0} y={y + barHeight / 2 + 4} fill="#a3a3a3" fontSize="11" fontFamily="monospace">
                        {exchange}
                      </text>
                      <rect
                        x={labelWidth}
                        y={y}
                        width={barW}
                        height={barHeight}
                        rx={4}
                        fill={exchangeBarColors[i] || '#FACC15'}
                        opacity={0.85}
                      />
                      <text
                        x={labelWidth + barW + 8}
                        y={y + barHeight / 2 + 4}
                        fill="#e5e5e5"
                        fontSize="11"
                        fontFamily="monospace"
                        fontWeight="600"
                      >
                        {formatUSD(value)} ({pct.toFixed(1)}%)
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          );
        })()}

        {/* OI History Chart */}
        <OIHistoryChart symbol={searchTerm.toUpperCase() || 'BTC'} />

        {/* View Toggle & Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="flex rounded-md overflow-hidden bg-white/[0.04]" role="tablist" aria-label="View mode">
            <button
              role="tab"
              aria-selected={viewMode === 'all'}
              onClick={() => setViewMode('all')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'all' ? 'bg-hub-yellow text-black' : 'text-neutral-500 hover:text-white'
              }`}
            >
              All Data
            </button>
            <button
              role="tab"
              aria-selected={viewMode === 'aggregated'}
              onClick={() => setViewMode('aggregated')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'aggregated' ? 'bg-hub-yellow text-black' : 'text-neutral-500 hover:text-white'
              }`}
            >
              By Symbol
            </button>
          </div>
          <input
            type="text"
            placeholder="Search symbol..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 min-w-[160px] px-3 py-1.5 bg-hub-darker border border-white/[0.06] rounded-md text-white text-xs placeholder-neutral-600 focus:outline-none focus:border-hub-yellow/30"
          />
          {viewMode === 'all' && (
            <select
              aria-label="Filter by exchange"
              value={exchangeFilter}
              onChange={(e) => setExchangeFilter(e.target.value)}
              className="px-3 py-1.5 bg-hub-darker border border-white/[0.06] rounded-md text-white text-xs focus:outline-none focus:border-hub-yellow/30"
            >
              <option value="all">All Exchanges</option>
              {exchanges.map(ex => (
                <option key={ex} value={ex}>{ex}</option>
              ))}
            </select>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-500/10 border border-red-400/30 rounded-xl p-4 mb-6 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="text-red-400">{error}</span>
          </div>
        )}

        {/* Loading State */}
        {loading && openInterest.length === 0 ? (
          <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-8">
            <div className="flex items-center justify-center gap-3">
              <RefreshCw className="w-6 h-6 text-hub-yellow animate-spin" />
              <div className="flex flex-col">
                <span className="text-white">Aggregating OI{exchanges.length ? ` from ${exchanges.length} exchanges` : ''}...</span>
                <span className="text-neutral-600 text-xs mt-1">Fetching open interest data and historical deltas</span>
              </div>
            </div>
          </div>
        ) : viewMode === 'aggregated' ? (
          /* Aggregated View */
          <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
            {/* Mobile cards (below md) */}
            <div className="md:hidden space-y-2 p-3">
              {displayedAggregated.map(([symbol, value]) => {
                const delta = oiDeltas.get(symbol);
                const fmtMobile = (v: number | null) => {
                  if (v == null) return <span className="text-neutral-700">--</span>;
                  const color = v > 0 ? 'text-green-400 pip-up' : v < 0 ? 'text-red-400 pip-down' : 'text-neutral-500';
                  return <span className={`${color} font-mono tabular-nums`}>{v > 0 ? '+' : ''}{v.toFixed(2)}%</span>;
                };
                const percentage = totalOI > 0 ? (value / totalOI) * 100 : 0;
                return (
                  <MobileCard
                    key={symbol}
                    symbol={symbol}
                    href={`/symbol/${symbol}`}
                    rows={[
                      { label: 'Total OI', value: <span className="text-white">{formatUSD(value)}</span> },
                      { label: '24h Δ', value: fmtMobile(delta?.change24h ?? null) },
                    ]}
                    expandedRows={[
                      { label: '1h Δ', value: fmtMobile(delta?.change1h ?? null) },
                      { label: '4h Δ', value: fmtMobile(delta?.change4h ?? null) },
                      { label: '% of Total', value: <span className="text-neutral-400">{percentage.toFixed(2)}%</span> },
                    ]}
                    actions={<WatchlistStar symbol={symbol} />}
                  />
                );
              })}
            </div>
            {/* Desktop table (md and above) */}
            <div className="hidden md:block overflow-x-auto scrollbar-accent">
              <table className="w-full" aria-label="Open interest by symbol">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-4 py-2 text-left text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Rank</th>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Symbol</th>
                    <th
                      className="px-4 py-2 text-right text-[11px] font-semibold text-neutral-500 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                      role="button" tabIndex={0} onClick={() => handleSort('openInterestValue')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('openInterestValue'); } }}
                    >
                      <div className="flex items-center gap-1 justify-end">
                        Total OI Value
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-2 text-right text-[11px] font-semibold text-neutral-500 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                      role="button" tabIndex={0} onClick={() => handleSort('change1h')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('change1h'); } }}
                    >
                      <div className="flex items-center gap-1 justify-end">
                        1h Δ
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-2 text-right text-[11px] font-semibold text-neutral-500 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                      role="button" tabIndex={0} onClick={() => handleSort('change4h')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('change4h'); } }}
                    >
                      <div className="flex items-center gap-1 justify-end">
                        4h Δ
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-2 text-right text-[11px] font-semibold text-neutral-500 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                      role="button" tabIndex={0} onClick={() => handleSort('change24h')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('change24h'); } }}
                    >
                      <div className="flex items-center gap-1 justify-end">
                        24h Δ
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="px-4 py-2 text-right text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">% of Total</th>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Distribution</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedAggregated.map(([symbol, value], index) => {
                    const percentage = totalOI > 0 ? (value / totalOI) * 100 : 0;
                    const delta = oiDeltas.get(symbol);
                    const fmt = (v: number | null) => {
                      if (v == null) return <span className="text-neutral-700">—</span>;
                      const color = v > 0 ? 'text-green-400 pip-up' : v < 0 ? 'text-red-400 pip-down' : 'text-neutral-500';
                      return <span className={`${color} font-mono tabular-nums`}>{v > 0 ? '+' : ''}{v.toFixed(2)}%</span>;
                    };
                    return (
                      <tr
                        key={symbol}
                        className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-4 py-2">
                          <span className="text-neutral-600">#{index + 1}</span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <WatchlistStar symbol={symbol} />
                            <Link href={`/symbol/${symbol}`} className="text-white font-semibold hover:text-hub-yellow transition-colors">{symbol}</Link>
                            <span className="text-neutral-600 text-sm">/USDT</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <span className="text-white font-mono tabular-nums font-semibold">{formatUSD(value)}</span>
                        </td>
                        <td className="px-4 py-2 text-right text-xs">{fmt(delta?.change1h ?? null)}</td>
                        <td className="px-4 py-2 text-right text-xs">{fmt(delta?.change4h ?? null)}</td>
                        <td className="px-4 py-2 text-right text-xs">{fmt(delta?.change24h ?? null)}</td>
                        <td className="px-4 py-2 text-right">
                          <span className="text-neutral-600">{percentage.toFixed(2)}%</span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="w-32 h-2 bg-white/[0.04] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-hub-yellow to-hub-orange rounded-full"
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ShowMoreToggle
              expanded={expanded}
              onToggle={() => setExpanded(!expanded)}
              totalCount={aggregatedSorted.length}
              visibleCount={AGGREGATED_DEFAULT}
            />
          </div>
        ) : (
          /* All Data View */
          <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full" aria-label="Open interest by exchange">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th
                      className="px-4 py-2 text-left text-[11px] font-semibold text-neutral-500 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                      role="button" tabIndex={0} onClick={() => handleSort('symbol')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('symbol'); } }}
                    >
                      <div className="flex items-center gap-2">
                        Symbol
                        <ArrowUpDown className="w-4 h-4" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-2 text-left text-[11px] font-semibold text-neutral-500 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                      role="button" tabIndex={0} onClick={() => handleSort('exchange')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('exchange'); } }}
                    >
                      <div className="flex items-center gap-2">
                        Exchange
                        <ArrowUpDown className="w-4 h-4" />
                      </div>
                    </th>
                    <th className="px-4 py-2 text-right text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                      Open Interest
                    </th>
                    <th
                      className="px-4 py-2 text-right text-[11px] font-semibold text-neutral-500 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                      role="button" tabIndex={0} onClick={() => handleSort('openInterestValue')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('openInterestValue'); } }}
                    >
                      <div className="flex items-center gap-2 justify-end">
                        OI Value
                        <ArrowUpDown className="w-4 h-4" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-2 text-right text-[11px] font-semibold text-neutral-500 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                      role="button" tabIndex={0} onClick={() => handleSort('change1h')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('change1h'); } }}
                    >
                      <div className="flex items-center gap-1 justify-end">
                        1h Δ
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-2 text-right text-[11px] font-semibold text-neutral-500 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                      role="button" tabIndex={0} onClick={() => handleSort('change4h')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('change4h'); } }}
                    >
                      <div className="flex items-center gap-1 justify-end">
                        4h Δ
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-2 text-right text-[11px] font-semibold text-neutral-500 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                      role="button" tabIndex={0} onClick={() => handleSort('change24h')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('change24h'); } }}
                    >
                      <div className="flex items-center gap-1 justify-end">
                        24h Δ
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayData.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((oi, index) => (
                    <tr
                      key={`${oi.symbol}-${oi.exchange}-${index}`}
                      className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-semibold">{oi.symbol}</span>
                          <span className="text-neutral-500 text-sm">/USDT</span>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5">
                          <ExchangeLogo exchange={oi.exchange.toLowerCase()} size={16} />
                          {(() => { const ref = getExchangeReferralUrl(oi.exchange); return ref ? (
                            <a href={ref} target="_blank" rel="noopener noreferrer" className={`text-xs font-medium ${getExchangeBadgeColor(oi.exchange)} hover:text-hub-yellow transition`}>{oi.exchange}</a>
                          ) : (
                            <span className={`text-xs font-medium ${getExchangeBadgeColor(oi.exchange)}`}>{oi.exchange}</span>
                          ); })()}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className="text-neutral-500 font-mono tabular-nums">
                          {oi.openInterest.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className="text-white font-mono tabular-nums font-semibold">{formatUSD(oi.openInterestValue)}</span>
                      </td>
                      {(() => {
                        const delta = oiDeltas.get(oi.symbol);
                        const fmtDelta = (v: number | null | undefined) => {
                          if (v == null) return <span className="text-neutral-700">—</span>;
                          const color = v > 0 ? 'text-green-400' : v < 0 ? 'text-red-400' : 'text-neutral-500';
                          return <span className={`${color} font-mono tabular-nums`}>{v > 0 ? '+' : ''}{v.toFixed(2)}%</span>;
                        };
                        return (
                          <>
                            <td className="px-4 py-2 text-right text-xs">{fmtDelta(delta?.change1h)}</td>
                            <td className="px-4 py-2 text-right text-xs">{fmtDelta(delta?.change4h)}</td>
                            <td className="px-4 py-2 text-right text-xs">{fmtDelta(delta?.change24h)}</td>
                          </>
                        );
                      })()}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {displayData.length > PAGE_SIZE && (
              <div className="px-4 py-2.5 border-t border-white/[0.06] flex items-center justify-between">
                <span className="text-neutral-500 text-xs">
                  Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, displayData.length)} of {displayData.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-2.5 py-1 rounded text-xs text-neutral-400 hover:text-white bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Prev
                  </button>
                  <span className="text-neutral-500 text-xs px-2">
                    {page + 1} / {Math.ceil(displayData.length / PAGE_SIZE)}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(Math.ceil(displayData.length / PAGE_SIZE) - 1, p + 1))}
                    disabled={(page + 1) * PAGE_SIZE >= displayData.length}
                    className="px-2.5 py-1 rounded text-xs text-neutral-400 hover:text-white bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {filteredAndSorted.length === 0 && !loading && (
              <div className="p-8 text-center">
                <span className="text-neutral-500">
                  {searchTerm ? 'No symbols match — try a different search' : 'No open interest data for this filter — try broadening your criteria'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Auth gate */}
        <SoftAuthGate freeLimit={20} totalCount={filteredAndSorted.length} dataLabel="pairs" />

        {/* Legend */}
        <div className="mt-6 text-sm text-neutral-600">
          Data refreshes automatically every 60 seconds
        </div>
      </main>
      <RelatedPages />
      <ReferralBanner />
      <Footer />
    </div>
  );
}
