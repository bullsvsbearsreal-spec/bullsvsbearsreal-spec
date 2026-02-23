'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import UpdatedAgo from '@/components/UpdatedAgo';
import { formatUSD, formatCompact } from '@/lib/utils/format';
import {
  RefreshCw, Info, Bitcoin, ChevronUp, ChevronDown,
  DollarSign, Building2, Landmark, HardHat, TrendingUp,
  BarChart3, Hash, Filter,
} from 'lucide-react';

/* --- Types ---------------------------------------------------------------- */

interface Holder {
  name: string;
  ticker: string | null;
  type: 'company' | 'etf' | 'government' | 'miner';
  btcHoldings: number;
  estimatedValueUsd: number;
  country?: string;
}

interface TreasuryResponse {
  price: number;
  priceSource: string;
  totalBTC: number;
  totalValueUsd: number;
  holders: Holder[];
  entityCount: number;
  timestamp: number;
}

type SortKey = 'name' | 'btcHoldings' | 'estimatedValueUsd' | 'pctSupply';
type FilterType = 'all' | 'company' | 'etf' | 'government' | 'miner';

const MAX_SUPPLY = 21_000_000;

/* --- Badge colors --------------------------------------------------------- */

const TYPE_BADGE: Record<Holder['type'], { bg: string; text: string; label: string }> = {
  company: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Company' },
  etf: { bg: 'bg-green-500/10', text: 'text-green-400', label: 'ETF' },
  government: { bg: 'bg-orange-500/10', text: 'text-orange-400', label: 'Government' },
  miner: { bg: 'bg-purple-500/10', text: 'text-purple-400', label: 'Miner' },
};

const FILTER_TABS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'company', label: 'Companies' },
  { value: 'etf', label: 'ETFs' },
  { value: 'government', label: 'Governments' },
  { value: 'miner', label: 'Miners' },
];

/* --- Sort header ---------------------------------------------------------- */

function SortHeader({
  label,
  sortKey,
  currentKey,
  ascending,
  onSort,
  align = 'right',
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  ascending: boolean;
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
}) {
  const active = currentKey === sortKey;
  return (
    <th
      className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none transition-colors hover:text-white group ${
        align === 'left' ? 'text-left' : 'text-right'
      } ${active ? 'text-hub-yellow' : 'text-neutral-500'}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {align === 'right' && (
          <span className={`transition-opacity ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}>
            {ascending ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </span>
        )}
        {label}
        {align === 'left' && (
          <span className={`transition-opacity ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}>
            {ascending ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </span>
        )}
      </span>
    </th>
  );
}

/* --- Bar chart component -------------------------------------------------- */

function TopHoldersChart({ holders, maxBTC }: { holders: Holder[]; maxBTC: number }) {
  const barHeight = 32;
  const gap = 6;
  const labelWidth = 140;
  const valueWidth = 100;
  const chartPadding = 16;
  const totalHeight = holders.length * (barHeight + gap) - gap + chartPadding * 2;

  return (
    <svg
      viewBox={`0 0 800 ${totalHeight}`}
      className="w-full"
      style={{ maxHeight: 500 }}
      role="img"
      aria-label="Top 10 Bitcoin holders horizontal bar chart"
    >
      {holders.map((h, i) => {
        const y = chartPadding + i * (barHeight + gap);
        const barMaxWidth = 800 - labelWidth - valueWidth - chartPadding * 2;
        const barWidth = maxBTC > 0 ? (h.btcHoldings / maxBTC) * barMaxWidth : 0;
        const badge = TYPE_BADGE[h.type];
        const fillColor =
          h.type === 'etf' ? '#22c55e' :
          h.type === 'government' ? '#f97316' :
          h.type === 'miner' ? '#a855f7' :
          '#3b82f6';

        return (
          <g key={h.name}>
            {/* Label */}
            <text
              x={labelWidth - 8}
              y={y + barHeight / 2 + 1}
              textAnchor="end"
              fill="#d4d4d4"
              fontSize="12"
              fontFamily="system-ui, sans-serif"
              fontWeight="500"
              dominantBaseline="middle"
            >
              {h.name.length > 18 ? h.name.slice(0, 17) + '...' : h.name}
            </text>
            {/* Bar background */}
            <rect
              x={labelWidth}
              y={y}
              width={barMaxWidth}
              height={barHeight}
              rx={4}
              fill="rgba(255,255,255,0.02)"
            />
            {/* Bar fill */}
            <rect
              x={labelWidth}
              y={y}
              width={Math.max(barWidth, 2)}
              height={barHeight}
              rx={4}
              fill={fillColor}
              opacity={0.35}
            />
            <rect
              x={labelWidth}
              y={y}
              width={Math.max(barWidth, 2)}
              height={barHeight}
              rx={4}
              fill={fillColor}
              opacity={0.15}
            />
            {/* Value */}
            <text
              x={labelWidth + barMaxWidth + 8}
              y={y + barHeight / 2 + 1}
              textAnchor="start"
              fill="#a3a3a3"
              fontSize="12"
              fontFamily="'SF Mono', 'Fira Code', monospace"
              dominantBaseline="middle"
            >
              {formatCompact(h.btcHoldings)} BTC
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* --- Main component ------------------------------------------------------- */

export default function BitcoinTreasuriesPage() {
  const [data, setData] = useState<TreasuryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('btcHoldings');
  const [sortAsc, setSortAsc] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/treasuries');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setLastUpdate(new Date());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10 * 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  /* Sort handler */
  const handleSort = useCallback(
    (key: SortKey) => {
      if (key === sortKey) {
        setSortAsc(!sortAsc);
      } else {
        setSortKey(key);
        setSortAsc(key === 'name');
      }
    },
    [sortKey, sortAsc],
  );

  /* Filtered + sorted holders */
  const filteredHolders = useMemo(() => {
    if (!data) return [];
    let list = data.holders;
    if (filter !== 'all') {
      list = list.filter((h) => h.type === filter);
    }
    const sorted = [...list].sort((a, b) => {
      let va: number | string, vb: number | string;
      switch (sortKey) {
        case 'name':
          return sortAsc
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name);
        case 'btcHoldings':
          va = a.btcHoldings;
          vb = b.btcHoldings;
          break;
        case 'estimatedValueUsd':
          va = a.estimatedValueUsd;
          vb = b.estimatedValueUsd;
          break;
        case 'pctSupply':
          va = a.btcHoldings / MAX_SUPPLY;
          vb = b.btcHoldings / MAX_SUPPLY;
          break;
        default:
          return 0;
      }
      return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return sorted;
  }, [data, sortKey, sortAsc, filter]);

  /* Chart data: top 10 by BTC holdings */
  const chartHolders = useMemo(() => {
    if (!data) return [];
    return [...data.holders].sort((a, b) => b.btcHoldings - a.btcHoldings).slice(0, 10);
  }, [data]);

  const chartMaxBTC = chartHolders.length > 0 ? chartHolders[0].btcHoldings : 0;

  /* Filter counts */
  const filterCounts = useMemo(() => {
    if (!data) return {} as Record<FilterType, number>;
    return {
      all: data.holders.length,
      company: data.holders.filter((h) => h.type === 'company').length,
      etf: data.holders.filter((h) => h.type === 'etf').length,
      government: data.holders.filter((h) => h.type === 'government').length,
      miner: data.holders.filter((h) => h.type === 'miner').length,
    };
  }, [data]);

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
        {/* Title + Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-hub-yellow/10 flex items-center justify-center">
              <Bitcoin className="w-4 h-4 text-hub-yellow" />
            </div>
            <div>
              <h1 className="heading-page">Bitcoin Treasuries</h1>
              <p className="text-neutral-500 text-sm mt-0.5">
                Corporate, ETF, and government Bitcoin holdings
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <UpdatedAgo date={lastUpdate} />
          </div>
        </div>

        {/* Loading skeleton */}
        {loading && !data && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-hub-darker border border-white/[0.06] rounded-xl h-24 animate-pulse" />
              ))}
            </div>
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl h-[400px] animate-pulse" />
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl h-[500px] animate-pulse" />
          </div>
        )}

        {data && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {/* Total BTC Held */}
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <Bitcoin className="w-3.5 h-3.5 text-hub-yellow" />
                  <p className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold">
                    Total BTC Held
                  </p>
                </div>
                <p className="text-xl font-bold text-white font-mono">
                  {data.totalBTC.toLocaleString()}
                </p>
                <p className="text-xs text-neutral-600 mt-0.5">
                  {((data.totalBTC / MAX_SUPPLY) * 100).toFixed(2)}% of 21M supply
                </p>
              </div>

              {/* Total Value USD */}
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-3.5 h-3.5 text-green-400" />
                  <p className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold">
                    Total Value
                  </p>
                </div>
                <p className="text-xl font-bold text-white font-mono">
                  {formatUSD(data.totalValueUsd)}
                </p>
                <p className="text-xs text-neutral-600 mt-0.5">
                  At ${data.price.toLocaleString()} / BTC
                </p>
              </div>

              {/* BTC Price */}
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                  <p className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold">
                    BTC Price
                  </p>
                </div>
                <p className="text-xl font-bold text-white font-mono">
                  ${data.price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-neutral-600 mt-0.5">
                  Source: {data.priceSource === 'yahoo' ? 'Yahoo Finance' : 'Fallback'}
                </p>
              </div>

              {/* Entity Count */}
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <Hash className="w-3.5 h-3.5 text-purple-400" />
                  <p className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold">
                    Entities
                  </p>
                </div>
                <p className="text-xl font-bold text-white">{data.entityCount}</p>
                <p className="text-xs text-neutral-600 mt-0.5">
                  {filterCounts.company} companies, {filterCounts.etf} ETFs, {filterCounts.government} govts, {filterCounts.miner} miners
                </p>
              </div>
            </div>

            {/* Top 10 Bar Chart */}
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 sm:p-6 mb-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-hub-yellow/10 flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="w-4 h-4 text-hub-yellow" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">Top 10 Bitcoin Holders</h2>
                  <p className="text-xs text-neutral-600 mt-0.5">Largest known BTC holdings by entity</p>
                </div>
              </div>
              <TopHoldersChart holders={chartHolders} maxBTC={chartMaxBTC} />
              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 mt-4 pt-3 border-t border-white/[0.04]">
                {Object.entries(TYPE_BADGE).map(([type, badge]) => (
                  <div key={type} className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                    <div
                      className="w-3 h-3 rounded"
                      style={{
                        backgroundColor:
                          type === 'etf' ? 'rgba(34,197,94,0.35)' :
                          type === 'government' ? 'rgba(249,115,22,0.35)' :
                          type === 'miner' ? 'rgba(168,85,247,0.35)' :
                          'rgba(59,130,246,0.35)',
                      }}
                    />
                    {badge.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
              <Filter className="w-3.5 h-3.5 text-neutral-500 flex-shrink-0" />
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setFilter(tab.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    filter === tab.value
                      ? 'bg-hub-yellow text-black shadow-glow-sm'
                      : 'bg-white/[0.04] text-neutral-400 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  {tab.label}
                  {data && (
                    <span className={`ml-1.5 ${filter === tab.value ? 'text-black/60' : 'text-neutral-600'}`}>
                      {filterCounts[tab.value]}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Holdings Table */}
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden mb-6">
              <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    {filter === 'all' ? 'All' : TYPE_BADGE[filter as Holder['type']].label} Bitcoin Holdings
                  </h2>
                  <p className="text-xs text-neutral-600 mt-0.5">
                    {filteredHolders.length} entities — click headers to sort
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 text-left w-8">
                        #
                      </th>
                      <SortHeader label="Entity" sortKey="name" currentKey={sortKey} ascending={sortAsc} onSort={handleSort} align="left" />
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 text-left hidden sm:table-cell">
                        Type
                      </th>
                      <SortHeader label="BTC Holdings" sortKey="btcHoldings" currentKey={sortKey} ascending={sortAsc} onSort={handleSort} />
                      <SortHeader label="Est. Value (USD)" sortKey="estimatedValueUsd" currentKey={sortKey} ascending={sortAsc} onSort={handleSort} />
                      <SortHeader label="% of Supply" sortKey="pctSupply" currentKey={sortKey} ascending={sortAsc} onSort={handleSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHolders.map((holder, idx) => {
                      const badge = TYPE_BADGE[holder.type];
                      const pctSupply = (holder.btcHoldings / MAX_SUPPLY) * 100;
                      return (
                        <tr
                          key={holder.name}
                          className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="px-4 py-3 text-xs text-neutral-600 font-mono">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <TypeIcon type={holder.type} />
                              <div>
                                <span className="text-white font-semibold text-sm">{holder.name}</span>
                                {holder.ticker && (
                                  <span className="text-hub-yellow text-xs ml-2 font-mono">{holder.ticker}</span>
                                )}
                                {/* Show type badge inline on mobile */}
                                <span className={`sm:hidden ml-2 inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${badge.bg} ${badge.text}`}>
                                  {badge.label}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${badge.bg} ${badge.text}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm text-white font-semibold">
                            {holder.btcHoldings.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm text-neutral-400">
                            {formatUSD(holder.estimatedValueUsd)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="hidden lg:block w-16 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-hub-yellow/50 rounded-full"
                                  style={{ width: `${Math.min(pctSupply / 3 * 100, 100)}%` }}
                                />
                              </div>
                              <span className="font-mono text-sm text-neutral-400">
                                {pctSupply >= 0.01 ? pctSupply.toFixed(2) : pctSupply.toFixed(4)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filteredHolders.length === 0 && (
                <div className="py-12 text-center text-neutral-600 text-sm">
                  No entities match this filter.
                </div>
              )}
            </div>

            {/* Info footer */}
            <div className="bg-hub-yellow/5 border border-hub-yellow/10 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-hub-yellow mt-0.5 flex-shrink-0" />
                <div className="text-xs text-neutral-400 space-y-1">
                  <p>
                    <strong className="text-neutral-300">Bitcoin Treasuries</strong> tracks the largest known
                    Bitcoin holdings by corporations, ETFs, governments, and miners.
                  </p>
                  <p>
                    <strong>% of Supply</strong> is calculated against the 21 million BTC hard cap.
                    Estimated values use the current BTC price and update every 10 minutes.
                  </p>
                  <p>
                    Holdings data is based on publicly available disclosures and may not reflect
                    real-time changes. BTC price sourced from Yahoo Finance.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

/* --- Helper: type icon ---------------------------------------------------- */

function TypeIcon({ type }: { type: Holder['type'] }) {
  const iconClass = 'w-4 h-4 flex-shrink-0';
  switch (type) {
    case 'company':
      return <Building2 className={`${iconClass} text-blue-400`} />;
    case 'etf':
      return <TrendingUp className={`${iconClass} text-green-400`} />;
    case 'government':
      return <Landmark className={`${iconClass} text-orange-400`} />;
    case 'miner':
      return <HardHat className={`${iconClass} text-purple-400`} />;
  }
}
