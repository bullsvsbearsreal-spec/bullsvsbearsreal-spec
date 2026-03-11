'use client';

import React, { useState, useMemo } from 'react';
import { TokenIconSimple } from '@/components/TokenIcon';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, X, TrendingUp, TrendingDown, Zap, Filter } from 'lucide-react';
import Pagination from './Pagination';
import { getExchangeTradeUrl } from '@/lib/constants';

const ROWS_PER_PAGE = 40;

interface BasisEntry {
  symbol: string;
  exchange: string;
  markPrice: number;
  indexPrice: number;
  basisPct: number;
  basisAnnualized: number;
  fundingRate: number;
  fundingInterval: string;
  oi: number;
  carryScore: number; // basis and funding alignment strength
}

interface SpotArbitrageViewProps {
  fundingRates: any[];
  oiMap: Map<string, number>;
}

type SortKey = 'basisPct' | 'basisAnnualized' | 'symbol' | 'exchange' | 'oi' | 'fundingRate' | 'carryScore';

function formatPrice(price: number): string {
  if (price >= 10000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(6)}`;
}

function formatOI(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

/** Annualize a basis percentage based on funding interval */
function annualizeBasis(basisPct: number, interval: string): number {
  // Basis resets roughly each funding period, so annualize by periods per year
  const periodsPerYear = interval === '1h' ? 8760 : interval === '4h' ? 2190 : 1095; // 8h default
  return basisPct * periodsPerYear;
}

/** Compute carry trade alignment score: basis and funding pointing same direction */
function computeCarryScore(basisPct: number, fundingRate: number, oi: number): number {
  // Both positive (premium + longs pay) or both negative (discount + shorts pay) = aligned carry trade
  const aligned = (basisPct > 0 && fundingRate > 0) || (basisPct < 0 && fundingRate < 0);
  if (!aligned) return 0;
  // Score = geometric mean of |basis| and |funding| * OI weight
  const raw = Math.sqrt(Math.abs(basisPct) * Math.abs(fundingRate));
  const oiBoost = oi > 1e6 ? 1.5 : oi > 100_000 ? 1.0 : 0.5;
  return raw * oiBoost;
}

export default function SpotArbitrageView({ fundingRates, oiMap }: SpotArbitrageViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>('carryScore');
  const [sortAsc, setSortAsc] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [basisFilter, setBasisFilter] = useState<'all' | 'premium' | 'discount' | 'carry'>('all');
  const [minOI, setMinOI] = useState(false); // filter to $100K+ OI only

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(key === 'symbol' || key === 'exchange'); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-neutral-600" />;
    return sortAsc ? <ArrowUp className="w-3 h-3 text-hub-yellow" /> : <ArrowDown className="w-3 h-3 text-hub-yellow" />;
  };

  // Build basis entries from funding data
  const entries = useMemo<BasisEntry[]>(() => {
    const result: BasisEntry[] = [];
    for (const fr of fundingRates) {
      if (!fr.markPrice || !fr.indexPrice || fr.markPrice <= 0 || fr.indexPrice <= 0) continue;
      const basisPct = ((fr.markPrice - fr.indexPrice) / fr.indexPrice) * 100;
      if (Math.abs(basisPct) < 0.005 || Math.abs(basisPct) > 5) continue;
      const oi = oiMap.get(`${fr.symbol}|${fr.exchange}`) || 0;
      const interval = fr.fundingInterval || '8h';
      const basisAnnualized = annualizeBasis(basisPct, interval);
      const carryScore = computeCarryScore(basisPct, fr.fundingRate, oi);
      result.push({
        symbol: fr.symbol,
        exchange: fr.exchange,
        markPrice: fr.markPrice,
        indexPrice: fr.indexPrice,
        basisPct,
        basisAnnualized,
        fundingRate: fr.fundingRate,
        fundingInterval: interval,
        oi,
        carryScore,
      });
    }
    return result;
  }, [fundingRates, oiMap]);

  const filtered = useMemo(() => {
    let items = entries;
    if (search) {
      const q = search.toUpperCase();
      items = items.filter(e => e.symbol.includes(q) || e.exchange.toLowerCase().includes(search.toLowerCase()));
    }
    if (basisFilter === 'premium') items = items.filter(e => e.basisPct > 0);
    else if (basisFilter === 'discount') items = items.filter(e => e.basisPct < 0);
    else if (basisFilter === 'carry') items = items.filter(e => e.carryScore > 0);
    if (minOI) items = items.filter(e => e.oi >= 100_000);
    return items;
  }, [entries, search, basisFilter, minOI]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let diff = 0;
      switch (sortKey) {
        case 'basisPct': diff = Math.abs(a.basisPct) - Math.abs(b.basisPct); break;
        case 'basisAnnualized': diff = Math.abs(a.basisAnnualized) - Math.abs(b.basisAnnualized); break;
        case 'symbol': diff = a.symbol.localeCompare(b.symbol); break;
        case 'exchange': diff = a.exchange.localeCompare(b.exchange); break;
        case 'oi': diff = a.oi - b.oi; break;
        case 'fundingRate': diff = a.fundingRate - b.fundingRate; break;
        case 'carryScore': diff = a.carryScore - b.carryScore; break;
      }
      return sortAsc ? diff : -diff;
    });
    return arr;
  }, [filtered, sortKey, sortAsc]);

  const totalPages = Math.ceil(sorted.length / ROWS_PER_PAGE);
  const page = Math.min(currentPage, totalPages || 1);
  const pageItems = sorted.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  // Stats
  const premiumCount = entries.filter(e => e.basisPct > 0).length;
  const discountCount = entries.filter(e => e.basisPct < 0).length;
  const carryCount = entries.filter(e => e.carryScore > 0).length;
  const avgBasis = entries.length > 0 ? entries.reduce((s, e) => s + e.basisPct, 0) / entries.length : 0;
  // Weighted average basis by OI
  const totalOI = entries.reduce((s, e) => s + e.oi, 0);
  const weightedAvgBasis = totalOI > 0
    ? entries.reduce((s, e) => s + e.basisPct * e.oi, 0) / totalOI
    : avgBasis;

  const basisColor = (pct: number) => {
    if (pct > 0.1) return 'text-green-400';
    if (pct > 0.03) return 'text-green-400/70';
    if (pct < -0.1) return 'text-red-400';
    if (pct < -0.03) return 'text-red-400/70';
    return 'text-neutral-400';
  };

  // Max basis for visual bar scaling
  const maxAbsBasis = useMemo(() => {
    if (pageItems.length === 0) return 0.5;
    return Math.max(...pageItems.map(e => Math.abs(e.basisPct)), 0.1);
  }, [pageItems]);

  return (
    <div className="space-y-3">
      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Pairs</span>
          <span className="text-sm font-bold text-white font-mono">{entries.length}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)' }}>
          <TrendingUp className="w-3.5 h-3.5 text-green-400" />
          <span className="text-[10px] text-green-400/70 uppercase tracking-wider font-semibold">Premium</span>
          <span className="text-sm font-bold text-green-400 font-mono">{premiumCount}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.12)' }}>
          <TrendingDown className="w-3.5 h-3.5 text-red-400" />
          <span className="text-[10px] text-red-400/70 uppercase tracking-wider font-semibold">Discount</span>
          <span className="text-sm font-bold text-red-400 font-mono">{discountCount}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(245,166,35,0.06)', border: '1px solid rgba(245,166,35,0.12)' }}>
          <Zap className="w-3.5 h-3.5 text-hub-yellow" />
          <span className="text-[10px] text-hub-yellow/70 uppercase tracking-wider font-semibold">Carry</span>
          <span className="text-sm font-bold text-hub-yellow font-mono">{carryCount}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">OI-Wt Basis</span>
          <span className={`text-sm font-bold font-mono ${basisColor(weightedAvgBasis)}`}>{weightedAvgBasis > 0 ? '+' : ''}{weightedAvgBasis.toFixed(4)}%</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 max-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-600 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
            placeholder="Search coin or exchange..."
            className="w-full pl-8 pr-7 py-2 rounded-lg text-[12px] text-white placeholder-neutral-600 outline-none transition-all focus:ring-1 focus:ring-hub-yellow/40"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
          />
          {search && (
            <button onClick={() => { setSearch(''); setCurrentPage(1); }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-neutral-500 hover:text-white hover:bg-white/[0.08] transition-colors">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="flex rounded-lg overflow-hidden ring-1 ring-white/[0.06]" style={{ background: 'rgba(255,255,255,0.02)' }}>
          {(['all', 'carry', 'premium', 'discount'] as const).map(f => (
            <button
              key={f}
              onClick={() => { setBasisFilter(f); setCurrentPage(1); }}
              className={`px-2.5 sm:px-3 py-[7px] text-[11px] font-semibold capitalize transition-all duration-200 ${
                basisFilter === f
                  ? f === 'carry' ? 'bg-hub-yellow text-black' : 'bg-hub-yellow text-black'
                  : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04]'
              }`}
            >
              {f === 'all' ? 'All' : f === 'carry' ? 'Carry' : f === 'premium' ? 'Premium' : 'Discount'}
            </button>
          ))}
        </div>
        <button
          onClick={() => { setMinOI(!minOI); setCurrentPage(1); }}
          className={`flex items-center gap-1.5 px-3 py-[7px] rounded-lg text-[11px] font-semibold transition-all duration-200 ring-1 ${
            minOI
              ? 'bg-hub-yellow/10 text-hub-yellow ring-hub-yellow/30'
              : 'text-neutral-500 hover:text-neutral-300 ring-white/[0.06] hover:bg-white/[0.04]'
          }`}
        >
          <Filter className="w-3 h-3" />
          $100K+ OI
        </button>
        {(search || basisFilter !== 'all' || minOI) && (
          <span className="text-[10px] text-neutral-600 font-mono">
            {filtered.length}{search || minOI ? `/${entries.length}` : ''} results
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]" style={{ borderCollapse: 'separate', borderSpacing: '0 2px' }}>
          <thead>
            <tr>
              <th className="text-left px-3 py-2 text-neutral-500 font-semibold text-[10px] uppercase tracking-wider">
                <button onClick={() => handleSort('symbol')} className="flex items-center gap-1 hover:text-white transition-colors">
                  Symbol <SortIcon col="symbol" />
                </button>
              </th>
              <th className="text-left px-3 py-2 text-neutral-500 font-semibold text-[10px] uppercase tracking-wider">
                <button onClick={() => handleSort('exchange')} className="flex items-center gap-1 hover:text-white transition-colors">
                  Exchange <SortIcon col="exchange" />
                </button>
              </th>
              <th className="text-right px-3 py-2 text-neutral-500 font-semibold text-[10px] uppercase tracking-wider hidden sm:table-cell">Spot</th>
              <th className="text-right px-3 py-2 text-neutral-500 font-semibold text-[10px] uppercase tracking-wider hidden sm:table-cell">Perp</th>
              <th className="text-right px-3 py-2 text-neutral-500 font-semibold text-[10px] uppercase tracking-wider">
                <button onClick={() => handleSort('basisPct')} className="flex items-center gap-1 hover:text-white transition-colors ml-auto">
                  Basis <SortIcon col="basisPct" />
                </button>
              </th>
              <th className="text-right px-3 py-2 text-neutral-500 font-semibold text-[10px] uppercase tracking-wider hidden md:table-cell">
                <button onClick={() => handleSort('basisAnnualized')} className="flex items-center gap-1 hover:text-white transition-colors ml-auto">
                  Ann. % <SortIcon col="basisAnnualized" />
                </button>
              </th>
              <th className="text-right px-3 py-2 text-neutral-500 font-semibold text-[10px] uppercase tracking-wider">
                <button onClick={() => handleSort('fundingRate')} className="flex items-center gap-1 hover:text-white transition-colors ml-auto">
                  Funding <SortIcon col="fundingRate" />
                </button>
              </th>
              <th className="text-right px-3 py-2 text-neutral-500 font-semibold text-[10px] uppercase tracking-wider">
                <button onClick={() => handleSort('oi')} className="flex items-center gap-1 hover:text-white transition-colors ml-auto">
                  OI <SortIcon col="oi" />
                </button>
              </th>
              <th className="text-center px-3 py-2 text-neutral-500 font-semibold text-[10px] uppercase tracking-wider hidden lg:table-cell">
                <button onClick={() => handleSort('carryScore')} className="flex items-center gap-1 hover:text-white transition-colors mx-auto">
                  Signal <SortIcon col="carryScore" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((entry, idx) => {
              const tradeUrl = getExchangeTradeUrl(entry.exchange, entry.symbol);
              const barWidth = maxAbsBasis > 0 ? Math.min(Math.abs(entry.basisPct) / maxAbsBasis * 100, 100) : 0;
              const isCarry = entry.carryScore > 0;
              return (
                <tr
                  key={`${entry.symbol}-${entry.exchange}-${idx}`}
                  className={`group transition-colors ${isCarry ? 'hover:bg-hub-yellow/[0.03]' : 'hover:bg-white/[0.02]'}`}
                >
                  <td className="px-3 py-2.5">
                    <a href={`/funding/${entry.symbol}`} className="flex items-center gap-2 no-underline">
                      <TokenIconSimple symbol={entry.symbol} size={20} />
                      <span className="font-bold text-white group-hover:text-hub-yellow transition-colors">{entry.symbol}</span>
                    </a>
                  </td>
                  <td className="px-3 py-2.5">
                    <a
                      href={tradeUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 no-underline"
                    >
                      <ExchangeLogo exchange={entry.exchange.toLowerCase()} size={16} />
                      <span className="text-neutral-300 group-hover:text-white transition-colors">{entry.exchange}</span>
                    </a>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-neutral-500 hidden sm:table-cell">
                    {formatPrice(entry.indexPrice)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-neutral-400 hidden sm:table-cell">
                    {formatPrice(entry.markPrice)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* Tiny visual bar */}
                      <div className="w-12 h-1.5 rounded-full bg-white/[0.04] overflow-hidden hidden sm:block">
                        <div
                          className={`h-full rounded-full transition-all ${entry.basisPct > 0 ? 'bg-green-400/60 ml-auto' : 'bg-red-400/60'}`}
                          style={{
                            width: `${barWidth}%`,
                            ...(entry.basisPct > 0 ? {} : {}),
                          }}
                        />
                      </div>
                      <span className={`font-mono tabular-nums font-bold ${basisColor(entry.basisPct)}`}>
                        {entry.basisPct > 0 ? '+' : ''}{entry.basisPct.toFixed(4)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right hidden md:table-cell">
                    <span className={`font-mono tabular-nums text-[11px] ${basisColor(entry.basisAnnualized)}`}>
                      {entry.basisAnnualized > 0 ? '+' : ''}{Math.abs(entry.basisAnnualized) >= 100 ? `${entry.basisAnnualized.toFixed(0)}%` : `${entry.basisAnnualized.toFixed(1)}%`}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={`font-mono tabular-nums ${entry.fundingRate > 0 ? 'text-green-400/80' : entry.fundingRate < 0 ? 'text-red-400/80' : 'text-neutral-500'}`}>
                      {entry.fundingRate > 0 ? '+' : ''}{entry.fundingRate.toFixed(4)}%
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-neutral-500">
                    {entry.oi > 0 ? formatOI(entry.oi) : '-'}
                  </td>
                  <td className="px-3 py-2.5 text-center hidden lg:table-cell">
                    {isCarry ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-hub-yellow/10 text-hub-yellow ring-1 ring-hub-yellow/20">
                        <Zap className="w-2.5 h-2.5" />
                        {entry.carryScore >= 0.1 ? 'Strong' : 'Weak'}
                      </span>
                    ) : (
                      <span className="text-neutral-700 text-[10px]">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {pageItems.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-12 text-neutral-600 text-sm">
                  No spot-perp basis opportunities found matching filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={sorted.length}
        rowsPerPage={ROWS_PER_PAGE}
        onPageChange={setCurrentPage}
        label="entries"
      />

      <p className="text-[10px] text-neutral-700 leading-relaxed px-1">
        <span className="text-green-400/60 font-medium">Premium</span> = perp above spot (longs pay).{' '}
        <span className="text-red-400/60 font-medium">Discount</span> = perp below spot (shorts pay).{' '}
        <span className="text-hub-yellow/60 font-medium">Carry</span> = basis and funding align (basis + funding same sign = potential carry trade).{' '}
        Ann. % extrapolates current basis over a year based on funding interval. OI-weighted basis reflects market-wide sentiment.
      </p>
    </div>
  );
}
