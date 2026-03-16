'use client';

import { useState, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Pagination from '@/components/Pagination';
import { TokenIconSimple } from '@/components/TokenIcon';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import UpdatedAgo from '@/components/UpdatedAgo';
import {
  RefreshCw, TrendingUp, TrendingDown, ArrowUpDown, AlertTriangle,
  Search, Info, Layers, BarChart3, Activity, Globe, ChevronRight,
  Zap, DollarSign, ArrowLeftRight,
} from 'lucide-react';
import { formatPrice, formatFundingRate } from '@/lib/utils/format';
import { useApi } from '@/hooks/useSWRApi';
import { fetchAllFundingRates } from '@/lib/api/aggregator';

/* ─── Types ──────────────────────────────────────────────────────── */

type SortField = 'symbol' | 'exchange' | 'markPrice' | 'indexPrice' | 'basis' | 'fundingRate';
type SortOrder = 'asc' | 'desc';
type BasisTab = 'all' | 'premium' | 'discount';

const ROWS_PER_PAGE = 50;

interface BasisEntry {
  symbol: string;
  exchange: string;
  markPrice: number;
  indexPrice: number;
  basis: number;
  fundingRate: number;
  fundingInterval?: string;
}

function formatBasis(basis: number): string {
  if (!isFinite(basis)) return '—';
  return basis > 0 ? '+' + basis.toFixed(4) + '%' : basis.toFixed(4) + '%';
}

/* ─── Section wrapper ────────────────────────────────────────────── */

function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-hub-darker border border-white/[0.06] rounded-2xl p-5 ${className}`}>
      {children}
    </div>
  );
}

function SectionHeader({ icon, title, subtitle, right }: {
  icon: React.ReactNode; title: string; subtitle?: string; right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center">
          {icon}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {subtitle && <p className="text-[11px] text-neutral-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

/* ─── Metric Card ────────────────────────────────────────────────── */

function MetricCard({ icon, label, value, sub, accent, className = '' }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: React.ReactNode;
  accent?: string;
  className?: string;
}) {
  return (
    <div className={`relative overflow-hidden bg-hub-darker border border-white/[0.06] rounded-2xl px-4 py-4 ${className}`}>
      {accent && (
        <div className="absolute inset-0 opacity-[0.04]" style={{ background: `radial-gradient(circle at top right, ${accent}, transparent 70%)` }} />
      )}
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-[11px] text-neutral-500 uppercase tracking-wider font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white font-mono leading-none">{value}</p>
      {sub && <div className="mt-2">{sub}</div>}
    </div>
  );
}

/* ─── Basis Distribution Chart (SVG) ─────────────────────────────── */

function BasisDistributionChart({ data }: { data: BasisEntry[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  // Bucket basis values into ranges
  const buckets = useMemo(() => {
    const ranges = [
      { min: -Infinity, max: -1, label: '< -1%' },
      { min: -1, max: -0.5, label: '-1% to -0.5%' },
      { min: -0.5, max: -0.1, label: '-0.5% to -0.1%' },
      { min: -0.1, max: 0, label: '-0.1% to 0%' },
      { min: 0, max: 0.1, label: '0% to +0.1%' },
      { min: 0.1, max: 0.5, label: '+0.1% to +0.5%' },
      { min: 0.5, max: 1, label: '+0.5% to +1%' },
      { min: 1, max: Infinity, label: '> +1%' },
    ];

    return ranges.map(r => ({
      ...r,
      count: data.filter(d => d.basis >= r.min && d.basis < r.max).length,
    }));
  }, [data]);

  const maxCount = Math.max(...buckets.map(b => b.count), 1);

  const width = 800;
  const height = 180;
  const pad = { top: 8, bottom: 28, left: 4, right: 4 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const groupW = chartW / buckets.length;
  const barW = groupW * 0.7;

  const hoveredBucket = hovered !== null ? buckets[hovered] : null;

  return (
    <div className="relative" onMouseLeave={() => setHovered(null)}>
      {hoveredBucket && hovered !== null && (
        <div
          className="absolute z-20 pointer-events-none bg-[#1a1a2e]/95 border border-white/10 rounded-xl px-4 py-3 shadow-2xl backdrop-blur-md"
          style={{
            left: `${((pad.left + hovered * groupW + groupW / 2) / width) * 100}%`,
            top: 0,
            transform: `translateX(${hovered > buckets.length * 0.7 ? '-100%' : hovered < buckets.length * 0.3 ? '0%' : '-50%'})`,
          }}
        >
          <p className="text-xs font-bold text-white mb-1">{hoveredBucket.label}</p>
          <p className="text-[11px] text-neutral-400">
            <span className="text-white font-mono font-medium">{hoveredBucket.count}</span> entries ({((hoveredBucket.count / data.length) * 100).toFixed(1)}%)
          </p>
        </div>
      )}

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map(pct => (
          <line
            key={pct}
            x1={pad.left} y1={pad.top + chartH * (1 - pct)}
            x2={width - pad.right} y2={pad.top + chartH * (1 - pct)}
            stroke="rgba(255,255,255,0.04)" strokeWidth={0.5}
          />
        ))}

        {/* Zero line */}
        <line
          x1={pad.left + 4 * groupW} y1={pad.top}
          x2={pad.left + 4 * groupW} y2={pad.top + chartH}
          stroke="rgba(255,255,255,0.08)" strokeWidth={1} strokeDasharray="3,3"
        />

        {buckets.map((b, i) => {
          const x = pad.left + i * groupW + (groupW - barW) / 2;
          const barH = (b.count / maxCount) * chartH;
          const isNeg = i < 4;
          const isHovered = i === hovered;
          const color = isNeg ? '#ef4444' : '#22c55e';

          return (
            <g key={b.label} onMouseEnter={() => setHovered(i)}>
              <rect x={pad.left + i * groupW} y={pad.top} width={groupW} height={chartH} fill="transparent" />
              <rect
                x={x}
                y={pad.top + chartH - barH}
                width={barW}
                height={Math.max(barH, 1)}
                fill={color}
                opacity={isHovered ? 0.9 : 0.55}
                rx={3}
              />
              {b.count > 0 && (
                <text
                  x={x + barW / 2}
                  y={pad.top + chartH - barH - 4}
                  textAnchor="middle"
                  fontSize="8"
                  fill={isHovered ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.35)'}
                  fontFamily="monospace"
                  fontWeight={isHovered ? 'bold' : 'normal'}
                >
                  {b.count}
                </text>
              )}
              <text
                x={pad.left + i * groupW + groupW / 2}
                y={height - 6}
                textAnchor="middle"
                fontSize="7"
                fill={isHovered ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)'}
                fontFamily="monospace"
              >
                {b.label.replace(' to ', '→')}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ─── Top 5 Premium/Discount Bar Chart (SVG) ────────────────────── */

function TopBasisChart({ entries, direction }: { entries: BasisEntry[]; direction: 'premium' | 'discount' }) {
  const [hovered, setHovered] = useState<number | null>(null);
  if (entries.length === 0) return null;

  const maxAbs = Math.max(...entries.map(e => Math.abs(e.basis)), 0.01);
  const width = 600;
  const height = entries.length * 36 + 8;
  const pad = { left: 130, right: 80 };
  const chartW = width - pad.left - pad.right;
  const barH = 22;

  const isGreen = direction === 'premium';

  return (
    <div className="relative" onMouseLeave={() => setHovered(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        {entries.map((e, i) => {
          const y = 4 + i * 36;
          const barW = (Math.abs(e.basis) / maxAbs) * chartW;
          const isHov = i === hovered;

          return (
            <g key={`${e.symbol}-${e.exchange}`} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
              {/* Hit area */}
              <rect x={0} y={y} width={width} height={36} fill="transparent" />

              {/* Hover bg */}
              {isHov && (
                <rect x={0} y={y} width={width} height={36} fill="rgba(255,255,255,0.02)" rx={6} />
              )}

              {/* Symbol + Exchange */}
              <text x={4} y={y + 14} fontSize="10" fill="rgba(255,255,255,0.8)" fontWeight="600" fontFamily="monospace">
                {e.symbol}
              </text>
              <text x={4} y={y + 27} fontSize="8" fill="rgba(255,255,255,0.3)">
                {e.exchange}
              </text>

              {/* Bar */}
              <rect
                x={pad.left}
                y={y + 7}
                width={Math.max(barW, 3)}
                height={barH}
                fill={isGreen ? '#22c55e' : '#ef4444'}
                opacity={isHov ? 0.8 : 0.45}
                rx={4}
              />

              {/* Value */}
              <text
                x={pad.left + barW + 8}
                y={y + 22}
                fontSize="10"
                fill={isGreen ? '#22c55e' : '#ef4444'}
                fontWeight="bold"
                fontFamily="monospace"
              >
                {formatBasis(e.basis)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ─── Premium / Discount Split Bar ───────────────────────────────── */

function PremiumDiscountSplit({ premiumCount, discountCount, avgBasis }: {
  premiumCount: number; discountCount: number; avgBasis: number;
}) {
  const total = premiumCount + discountCount || 1;
  const premPct = (premiumCount / total) * 100;
  const discPct = (discountCount / total) * 100;
  const sentiment = avgBasis > 0.05
    ? 'Bullish — market paying premium for futures'
    : avgBasis < -0.05
    ? 'Bearish — futures trading at discount'
    : 'Neutral — futures near fair value';

  return (
    <div>
      <div className="flex justify-between text-sm mb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-green-500/70" />
          <span className="text-green-400 font-medium">Premium</span>
          <span className="text-white font-mono font-semibold">{premiumCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white font-mono font-semibold">{discountCount}</span>
          <span className="text-red-400 font-medium">Discount</span>
          <div className="w-3 h-3 rounded bg-red-500/70" />
        </div>
      </div>
      <div className="h-6 rounded-lg overflow-hidden flex bg-white/[0.04]">
        <div
          className="h-full bg-gradient-to-r from-green-500/80 to-green-500/60 transition-all duration-500"
          style={{ width: `${premPct}%` }}
        />
        <div
          className="h-full bg-gradient-to-r from-red-500/60 to-red-500/80 transition-all duration-500"
          style={{ width: `${discPct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-neutral-500 mt-2 font-mono">
        <span>{premPct.toFixed(1)}%</span>
        <span className="text-neutral-600 italic font-sans text-[11px]">{sentiment}</span>
        <span>{discPct.toFixed(1)}%</span>
      </div>
    </div>
  );
}

/* ─── Per-Exchange Basis Summary ─────────────────────────────────── */

function ExchangeBasisCard({ exchange, entries, isActive, onClick }: {
  exchange: string; entries: BasisEntry[]; isActive: boolean; onClick: () => void;
}) {
  const avg = entries.reduce((s, e) => s + e.basis, 0) / (entries.length || 1);
  const premCount = entries.filter(e => e.basis > 0).length;
  const premPct = entries.length > 0 ? (premCount / entries.length) * 100 : 50;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl px-4 py-3 transition-all border ${
        isActive
          ? 'bg-hub-yellow/[0.08] border-hub-yellow/25 shadow-glow-sm'
          : 'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08]'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ExchangeLogo exchange={exchange.toLowerCase()} size={18} />
          <span className="text-white text-xs font-semibold">{exchange}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono font-bold ${avg > 0 ? 'text-success' : avg < 0 ? 'text-danger' : 'text-neutral-400'}`}>
            {formatBasis(avg)}
          </span>
          <ChevronRight className={`w-3 h-3 transition-transform ${isActive ? 'rotate-90 text-hub-yellow' : 'text-neutral-600'}`} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden flex">
          <div className="h-full bg-green-500/60 rounded-l-full" style={{ width: `${premPct}%` }} />
          <div className="h-full bg-red-500/60 rounded-r-full" style={{ width: `${100 - premPct}%` }} />
        </div>
        <span className="text-[10px] text-neutral-500 font-mono">{entries.length}</span>
      </div>
    </button>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────── */

export default function BasisPage() {
  const [sortField, setSortField] = useState<SortField>('basis');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [exchangeFilter, setExchangeFilter] = useState<string>('all');
  const [basisTab, setBasisTab] = useState<BasisTab>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const fetcher = useCallback(async () => {
    const data = await fetchAllFundingRates();
    return data;
  }, []);

  const { data: fundingRates, error, isLoading: loading, lastUpdate, refresh: fetchData } = useApi({
    key: 'basis',
    fetcher,
    refreshInterval: 60000,
  });

  const rawData = fundingRates ?? [];

  const MAX_BASIS_PCT = 10; // Filter entries with >10% basis (stale/incorrect prices on illiquid exchanges)

  const basisData: BasisEntry[] = useMemo(() => {
    return rawData
      .filter(fr => {
        const mp = fr.markPrice;
        const ip = fr.indexPrice;
        return typeof mp === 'number' && isFinite(mp) && mp > 0 &&
               typeof ip === 'number' && isFinite(ip) && ip > 0;
      })
      .map(fr => {
        const markPrice = fr.markPrice as number;
        const indexPrice = fr.indexPrice as number;
        const basis = ((markPrice - indexPrice) / indexPrice) * 100;
        return {
          symbol: fr.symbol,
          exchange: fr.exchange,
          markPrice,
          indexPrice,
          basis: isFinite(basis) ? basis : 0,
          fundingRate: fr.fundingRate,
          fundingInterval: fr.fundingInterval,
        };
      })
      .filter(entry => Math.abs(entry.basis) <= MAX_BASIS_PCT);
  }, [rawData]);

  const exchanges = useMemo(() => {
    return Array.from(new Set(basisData.map(b => b.exchange))).sort();
  }, [basisData]);

  // Per-exchange grouping
  const exchangeGroups = useMemo(() => {
    const map = new Map<string, BasisEntry[]>();
    basisData.forEach(b => {
      if (!map.has(b.exchange)) map.set(b.exchange, []);
      map.get(b.exchange)!.push(b);
    });
    return map;
  }, [basisData]);

  const filteredAndSorted = useMemo(() => {
    return basisData
      .filter(b => {
        if (exchangeFilter !== 'all' && b.exchange !== exchangeFilter) return false;
        if (searchTerm && !b.symbol.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        if (basisTab === 'premium' && b.basis <= 0) return false;
        if (basisTab === 'discount' && b.basis >= 0) return false;
        return true;
      })
      .sort((a, b) => {
        let comparison = 0;
        switch (sortField) {
          case 'symbol': comparison = a.symbol.localeCompare(b.symbol); break;
          case 'exchange': comparison = a.exchange.localeCompare(b.exchange); break;
          case 'markPrice': comparison = a.markPrice - b.markPrice; break;
          case 'indexPrice': comparison = a.indexPrice - b.indexPrice; break;
          case 'basis': comparison = Math.abs(a.basis) - Math.abs(b.basis); break;
          case 'fundingRate': comparison = Math.abs(a.fundingRate) - Math.abs(b.fundingRate); break;
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [basisData, exchangeFilter, searchTerm, basisTab, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / ROWS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIdx = (safeCurrentPage - 1) * ROWS_PER_PAGE;
  const pageItems = filteredAndSorted.slice(startIdx, startIdx + ROWS_PER_PAGE);

  const premiumCount = useMemo(() => basisData.filter(b => b.basis > 0).length, [basisData]);
  const discountCount = useMemo(() => basisData.filter(b => b.basis < 0).length, [basisData]);

  const stats = useMemo(() => {
    if (basisData.length === 0) return { avg: 0, highest: null as BasisEntry | null, deepest: null as BasisEntry | null, count: 0, median: 0 };
    const avg = basisData.reduce((sum, b) => sum + b.basis, 0) / basisData.length;
    const highest = basisData.reduce((max, b) => b.basis > max.basis ? b : max, basisData[0]);
    const deepest = basisData.reduce((min, b) => b.basis < min.basis ? b : min, basisData[0]);
    const uniqueSymbols = new Set(basisData.map(b => b.symbol)).size;
    const sorted = [...basisData.map(b => b.basis)].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] || 0;
    return { avg, highest, deepest, count: uniqueSymbols, median };
  }, [basisData]);

  const topPremiums = useMemo(() =>
    [...basisData].sort((a, b) => b.basis - a.basis).slice(0, 5),
    [basisData]
  );
  const topDiscounts = useMemo(() =>
    [...basisData].sort((a, b) => a.basis - b.basis).slice(0, 5),
    [basisData]
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <ArrowUpDown className={`w-3 h-3 inline-block ml-1 ${sortField === field ? 'text-hub-yellow' : 'text-neutral-600'}`} />
  );

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-5">

        {/* ─── Page Header ─── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-hub-yellow/20 to-hub-yellow/5 flex items-center justify-center border border-hub-yellow/20">
                <ArrowUpDown className="w-4.5 h-4.5 text-hub-yellow" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Basis / Premium</h1>
            </div>
            <p className="text-neutral-500 text-sm ml-12">
              Futures-spot price spread across {exchanges.length} exchanges
              {basisData.length > 0 && (
                <span className="inline-flex items-center gap-1.5 ml-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]" />
                  <span className="text-neutral-600">{basisData.length} pairs</span>
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <UpdatedAgo date={lastUpdate} />
          </div>
        </div>

        {/* ─── Loading skeleton ─── */}
        {loading && basisData.length === 0 && (
          <div className="space-y-4 animate-fade-in">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-hub-darker border border-white/[0.06] rounded-2xl h-24 animate-pulse" />
              ))}
            </div>
            <div className="bg-hub-darker border border-white/[0.06] rounded-2xl h-[340px] animate-pulse" />
          </div>
        )}

        {/* ─── Error ─── */}
        {error && basisData.length === 0 && (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <Zap className="w-5 h-5 text-red-400" />
            </div>
            <p className="text-red-400 text-sm mb-3">{error}</p>
            <button onClick={fetchData} className="text-sm text-hub-yellow hover:underline font-medium">
              Try again
            </button>
          </div>
        )}

        {/* ─── Inline error banner (when data exists) ─── */}
        {error && basisData.length > 0 && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 mb-4 flex items-center gap-2 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
            <button onClick={fetchData} className="ml-auto text-xs text-red-400 hover:text-white underline">Retry</button>
          </div>
        )}

        {basisData.length > 0 && (
          <div className="space-y-4">

            {/* ─── Key Metrics ─── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricCard
                icon={<BarChart3 className="w-4 h-4 text-hub-yellow" />}
                label="Avg Basis"
                value={formatBasis(stats.avg)}
                accent={stats.avg > 0 ? '#22c55e' : '#ef4444'}
                className={stats.avg > 0 ? 'border-green-500/15' : 'border-red-500/15'}
                sub={
                  <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                    <span>Median:</span>
                    <span className={`font-mono ${stats.median > 0 ? 'text-green-400' : stats.median < 0 ? 'text-red-400' : 'text-neutral-400'}`}>
                      {formatBasis(stats.median)}
                    </span>
                  </div>
                }
              />

              <MetricCard
                icon={<TrendingUp className="w-4 h-4 text-green-400" />}
                label="Highest Premium"
                value={stats.highest ? formatBasis(stats.highest.basis) : '—'}
                accent="#22c55e"
                sub={stats.highest && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-neutral-400">{stats.highest.symbol}</span>
                    <span className="text-neutral-600">{stats.highest.exchange}</span>
                  </div>
                )}
              />

              <MetricCard
                icon={<TrendingDown className="w-4 h-4 text-red-400" />}
                label="Deepest Discount"
                value={stats.deepest ? formatBasis(stats.deepest.basis) : '—'}
                accent="#ef4444"
                sub={stats.deepest && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-neutral-400">{stats.deepest.symbol}</span>
                    <span className="text-neutral-600">{stats.deepest.exchange}</span>
                  </div>
                )}
              />

              <MetricCard
                icon={<Layers className="w-4 h-4 text-blue-400" />}
                label="Coverage"
                value={`${stats.count}`}
                accent="#3b82f6"
                sub={
                  <span className="text-xs text-neutral-500">
                    symbols across {exchanges.length} exchanges
                  </span>
                }
              />
            </div>

            {/* ─── Premium/Discount Split ─── */}
            <Section>
              <SectionHeader
                icon={<ArrowLeftRight className="w-4 h-4 text-purple-400" />}
                title="Premium / Discount Split"
                subtitle="Market-wide futures vs spot positioning"
                right={<span className="text-xs text-neutral-500 font-mono">{basisData.length} pairs</span>}
              />
              <div className="flex items-center gap-6">
                {/* Donut */}
                {(() => {
                  const total = premiumCount + discountCount || 1;
                  const premPct = (premiumCount / total) * 100;
                  const r = 44;
                  const c = 2 * Math.PI * r;
                  const premDash = (premPct / 100) * c;

                  return (
                    <svg width="120" height="120" viewBox="0 0 120 120" className="flex-shrink-0">
                      <circle cx="60" cy="60" r={r} fill="none" stroke="#ef4444" strokeWidth="14" opacity="0.5" />
                      <circle
                        cx="60" cy="60" r={r} fill="none"
                        stroke="#22c55e" strokeWidth="14"
                        strokeDasharray={`${premDash} ${c - premDash}`}
                        strokeDashoffset={c / 4}
                        strokeLinecap="round"
                        opacity="0.75"
                        style={{ transform: 'rotate(-90deg)', transformOrigin: '60px 60px' }}
                      />
                      <text x="60" y="56" textAnchor="middle" fontSize="16" fontWeight="bold" fill="white" fontFamily="monospace">
                        {premPct.toFixed(0)}%
                      </text>
                      <text x="60" y="72" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.35)">
                        Premium
                      </text>
                    </svg>
                  );
                })()}
                <div className="flex-1 min-w-0">
                  <PremiumDiscountSplit premiumCount={premiumCount} discountCount={discountCount} avgBasis={stats.avg} />
                </div>
              </div>
            </Section>

            {/* ─── Top Premiums + Discounts ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Section>
                <SectionHeader
                  icon={<TrendingUp className="w-4 h-4 text-green-400" />}
                  title="Top Premiums"
                  subtitle="Highest futures mark-up over spot"
                />
                <TopBasisChart entries={topPremiums} direction="premium" />
              </Section>

              <Section>
                <SectionHeader
                  icon={<TrendingDown className="w-4 h-4 text-red-400" />}
                  title="Top Discounts"
                  subtitle="Deepest futures discount to spot"
                />
                <TopBasisChart entries={topDiscounts} direction="discount" />
              </Section>
            </div>

            {/* ─── Basis Distribution ─── */}
            <Section>
              <SectionHeader
                icon={<Activity className="w-4 h-4 text-hub-yellow" />}
                title="Basis Distribution"
                subtitle="How basis values are spread across all pairs"
              />
              <div className="h-[180px]">
                <BasisDistributionChart data={basisData} />
              </div>
            </Section>

            {/* ─── Exchange Breakdown + Table ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">

              {/* Exchange sidebar */}
              <Section className="lg:sticky lg:top-4 lg:self-start">
                <SectionHeader
                  icon={<Globe className="w-4 h-4 text-hub-yellow" />}
                  title="By Exchange"
                  subtitle="Click to filter table"
                />
                <div className="space-y-2">
                  <button
                    onClick={() => { setExchangeFilter('all'); setCurrentPage(1); }}
                    className={`w-full text-left rounded-xl px-4 py-2.5 transition-all border ${
                      exchangeFilter === 'all'
                        ? 'bg-hub-yellow/[0.08] border-hub-yellow/25 shadow-glow-sm'
                        : 'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-neutral-400" />
                        <span className="text-white text-xs font-semibold">All Exchanges</span>
                      </div>
                      <span className="text-[10px] text-neutral-500 font-mono">{basisData.length}</span>
                    </div>
                  </button>
                  {exchanges.map(ex => (
                    <ExchangeBasisCard
                      key={ex}
                      exchange={ex}
                      entries={exchangeGroups.get(ex) || []}
                      isActive={exchangeFilter === ex}
                      onClick={() => { setExchangeFilter(ex); setCurrentPage(1); }}
                    />
                  ))}
                </div>
              </Section>

              {/* Table section */}
              <div>
                {/* Controls */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {/* Basis tabs */}
                  <div className="flex rounded-xl overflow-hidden border border-white/[0.06]">
                    {([
                      { key: 'all' as BasisTab, label: 'All', count: basisData.length },
                      { key: 'premium' as BasisTab, label: 'Premium', count: premiumCount },
                      { key: 'discount' as BasisTab, label: 'Discount', count: discountCount },
                    ]).map(({ key, label, count }) => (
                      <button
                        key={key}
                        onClick={() => { setBasisTab(key); setCurrentPage(1); }}
                        className={`px-3.5 py-2 text-xs font-medium transition-colors ${
                          basisTab === key ? 'bg-hub-yellow text-black font-bold' : 'text-neutral-500 hover:text-white bg-white/[0.04]'
                        }`}
                      >
                        {label}
                        {basisTab === key && (
                          <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-black/20">
                            {count}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Search */}
                  <div className="relative flex-1 min-w-[150px] max-w-[240px]">
                    <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search symbol..."
                      value={searchTerm}
                      onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                      className="w-full pl-9 pr-3 py-2 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white text-xs placeholder-neutral-500 focus:outline-none focus:border-hub-yellow/40 transition-colors"
                    />
                  </div>

                  <span className="text-[11px] text-neutral-600 ml-auto">
                    {filteredAndSorted.length} entr{filteredAndSorted.length !== 1 ? 'ies' : 'y'}
                  </span>
                </div>

                {/* Table */}
                <Section className="p-0 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/[0.06]">
                          {([
                            { field: 'symbol' as SortField, label: 'Symbol', align: 'left' },
                            { field: 'exchange' as SortField, label: 'Exchange', align: 'left' },
                            { field: 'markPrice' as SortField, label: 'Mark Price', align: 'right' },
                            { field: 'indexPrice' as SortField, label: 'Index Price', align: 'right' },
                            { field: 'basis' as SortField, label: 'Basis %', align: 'right' },
                            { field: 'fundingRate' as SortField, label: 'Funding Rate', align: 'right' },
                          ]).map(col => (
                            <th
                              key={col.field}
                              onClick={() => handleSort(col.field)}
                              className={`${col.align === 'right' ? 'text-right' : 'text-left'} px-4 py-3 text-[10px] font-semibold uppercase tracking-wider cursor-pointer hover:text-white transition-colors ${sortField === col.field ? 'text-hub-yellow' : 'text-neutral-500'}`}
                            >
                              {col.label}
                              <SortIcon field={col.field} />
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pageItems.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-12 text-neutral-500 text-sm">
                              {searchTerm ? 'No matching entries.' : 'No entries for selected filters.'}
                            </td>
                          </tr>
                        ) : (
                          pageItems.map((entry, idx) => (
                            <tr
                              key={`${entry.symbol}-${entry.exchange}-${startIdx + idx}`}
                              className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors group"
                            >
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <TokenIconSimple symbol={entry.symbol} size={20} />
                                  <span className="text-white font-medium text-xs">{entry.symbol}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-1.5">
                                  <ExchangeLogo exchange={entry.exchange.toLowerCase()} size={16} />
                                  <span className="text-neutral-400 text-xs">{entry.exchange}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <span className="text-white font-mono tabular-nums text-xs">{formatPrice(entry.markPrice)}</span>
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <span className="text-neutral-400 font-mono tabular-nums text-xs">{formatPrice(entry.indexPrice)}</span>
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                {Math.abs(entry.basis) >= 0.1 ? (
                                  <span className={`h-5 rounded-md px-1.5 inline-flex items-center ${entry.basis > 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                                    <span className={`font-mono tabular-nums text-xs font-semibold ${
                                      entry.basis > 0 ? 'text-success' : 'text-danger'
                                    }`}>
                                      {formatBasis(entry.basis)}
                                    </span>
                                  </span>
                                ) : (
                                  <span className={`font-mono tabular-nums text-xs font-semibold ${
                                    entry.basis > 0 ? 'text-success' : entry.basis < 0 ? 'text-danger' : 'text-neutral-500'
                                  }`}>
                                    {formatBasis(entry.basis)}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <span className={`font-mono tabular-nums text-xs ${
                                  entry.fundingRate > 0 ? 'text-success' : entry.fundingRate < 0 ? 'text-danger' : 'text-neutral-500'
                                }`}>
                                  {formatFundingRate(entry.fundingRate)}
                                </span>
                                {entry.fundingInterval && entry.fundingInterval !== '8h' && (
                                  <span className="text-neutral-600 text-[10px] ml-1">/{entry.fundingInterval}</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <Pagination
                    currentPage={safeCurrentPage}
                    totalPages={totalPages}
                    totalItems={filteredAndSorted.length}
                    rowsPerPage={ROWS_PER_PAGE}
                    onPageChange={setCurrentPage}
                    label="entries"
                  />
                </Section>
              </div>
            </div>

            {/* Info box */}
            <div className="p-4 rounded-2xl bg-hub-yellow/5 border border-hub-yellow/10">
              <p className="text-neutral-500 text-xs leading-relaxed flex items-start gap-2.5">
                <Info className="w-4 h-4 text-hub-yellow mt-0.5 flex-shrink-0" />
                <span>
                  <span className="text-success font-medium">Positive basis (premium)</span> = futures trading above spot; traders are bullish.{' '}
                  <span className="text-danger font-medium">Negative basis (discount)</span> = futures trading below spot; traders are bearish.{' '}
                  Basis is calculated as <span className="text-neutral-400 font-mono">(markPrice - indexPrice) / indexPrice x 100</span>.
                  Large premiums often precede funding rate increases.
                </span>
              </p>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
