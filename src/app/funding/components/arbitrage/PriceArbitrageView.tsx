'use client';

import React, { useState, useMemo } from 'react';
import { TokenIconSimple } from '@/components/TokenIcon';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { isExchangeDex } from '@/lib/constants';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronRight, Search, ArrowRightLeft } from 'lucide-react';
import Pagination from '../Pagination';
import type { PriceArb } from '@/lib/arbitrage-detector';
import { formatUSD, formatPrice, ROWS_PER_PAGE } from './utils';

type SortKey = 'netPct' | 'spreadPct' | 'symbol' | 'volume' | 'spreadUsd';

interface PriceArbitrageViewProps {
  priceArbs: PriceArb[];
}

export default function PriceArbitrageView({ priceArbs }: PriceArbitrageViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>('netPct');
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [venueFilter, setVenueFilter] = useState<'all' | 'cex-cex' | 'cex-dex'>('all');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-neutral-600" />;
    return sortAsc ? <ArrowUp className="w-3 h-3 text-hub-yellow" /> : <ArrowDown className="w-3 h-3 text-hub-yellow" />;
  };

  const filtered = useMemo(() => {
    // Filter out obvious stale-data outliers (>20% spread is almost never a real arb)
    let items = priceArbs.filter(a => a.spreadPct <= 20);
    if (search) {
      const q = search.toUpperCase();
      items = items.filter(a => a.symbol.includes(q) || a.lowExchange.toLowerCase().includes(search.toLowerCase()) || a.highExchange.toLowerCase().includes(search.toLowerCase()));
    }
    if (venueFilter !== 'all') {
      items = items.filter(a => {
        const lowDex = isExchangeDex(a.lowExchange);
        const highDex = isExchangeDex(a.highExchange);
        const isCexDex = lowDex !== highDex;
        return venueFilter === 'cex-dex' ? isCexDex : !isCexDex;
      });
    }
    return items;
  }, [priceArbs, search, venueFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let diff = 0;
      switch (sortKey) {
        case 'netPct': diff = a.netPct - b.netPct; break;
        case 'spreadPct': diff = a.spreadPct - b.spreadPct; break;
        case 'spreadUsd': diff = a.spreadUsd - b.spreadUsd; break;
        case 'symbol': diff = a.symbol.localeCompare(b.symbol); break;
        case 'volume': diff = Math.min(a.lowVolume, a.highVolume) - Math.min(b.lowVolume, b.highVolume); break;
      }
      return sortAsc ? diff : -diff;
    });
    return arr;
  }, [filtered, sortKey, sortAsc]);

  const totalPages = Math.ceil(sorted.length / ROWS_PER_PAGE);
  const page = Math.min(currentPage, totalPages || 1);
  const pageItems = sorted.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  const spreadColor = (pct: number) => {
    if (pct >= 1) return 'text-green-400';
    if (pct >= 0.5) return 'text-hub-yellow';
    return 'text-neutral-400';
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Header */}
      <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-hub-yellow/10 flex items-center justify-center">
            <ArrowRightLeft className="w-3.5 h-3.5 text-hub-yellow" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">Cross-Exchange Price Arbitrage</h3>
            <p className="text-neutral-600 text-[10px]">{sorted.length} opportunities • min $500K volume per side • net of 0.10% round-trip fees</p>
          </div>
        </div>

        <div className="flex-1" />

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-600" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
            placeholder="Search symbol..."
            className="pl-7 pr-3 py-1.5 rounded-lg text-xs text-white placeholder:text-neutral-600 bg-white/[0.04] border border-white/[0.06] focus:border-hub-yellow/30 focus:outline-none w-36"
          />
        </div>

        {/* Venue filter */}
        <div className="flex rounded-lg overflow-hidden ring-1 ring-white/[0.06]" style={{ background: 'rgba(255,255,255,0.02)' }}>
          {(['all', 'cex-cex', 'cex-dex'] as const).map(v => (
            <button
              key={v}
              onClick={() => { setVenueFilter(v); setCurrentPage(1); }}
              className={`px-2.5 py-[5px] text-[10px] font-semibold transition-all ${
                venueFilter === v
                  ? 'bg-hub-yellow text-black'
                  : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04]'
              }`}
            >
              {v === 'all' ? 'All' : v === 'cex-cex' ? 'CEX↔CEX' : 'CEX↔DEX'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {sorted.length === 0 ? (
        <div className="p-12 text-center">
          <ArrowRightLeft className="w-6 h-6 text-neutral-700 mx-auto mb-2" />
          <p className="text-neutral-600 text-sm">No price arbitrage opportunities found</p>
          <p className="text-neutral-700 text-xs mt-1">Spread must exceed 0.10% round-trip fees with $500K+ volume on both sides</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-neutral-500 text-[10px] uppercase tracking-wider" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <th className="text-left px-4 py-2.5 font-semibold">
                    <button onClick={() => handleSort('symbol')} className="flex items-center gap-1 hover:text-white transition-colors">
                      Symbol <SortIcon col="symbol" />
                    </button>
                  </th>
                  <th className="text-left px-3 py-2.5 font-semibold">Buy (Low)</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Buy Price</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Sell (High)</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Sell Price</th>
                  <th className="text-right px-3 py-2.5 font-semibold">
                    <button onClick={() => handleSort('spreadPct')} className="flex items-center gap-1 ml-auto hover:text-white transition-colors">
                      Spread % <SortIcon col="spreadPct" />
                    </button>
                  </th>
                  <th className="text-right px-3 py-2.5 font-semibold">
                    <button onClick={() => handleSort('netPct')} className="flex items-center gap-1 ml-auto hover:text-white transition-colors">
                      Net % <SortIcon col="netPct" />
                    </button>
                  </th>
                  <th className="text-right px-3 py-2.5 font-semibold">
                    <button onClick={() => handleSort('spreadUsd')} className="flex items-center gap-1 ml-auto hover:text-white transition-colors">
                      Spread $ <SortIcon col="spreadUsd" />
                    </button>
                  </th>
                  <th className="text-right px-4 py-2.5 font-semibold">
                    <button onClick={() => handleSort('volume')} className="flex items-center gap-1 ml-auto hover:text-white transition-colors">
                      Min Vol <SortIcon col="volume" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((arb) => {
                  const isExpanded = expandedRow === arb.symbol;
                  const minVol = Math.min(arb.lowVolume, arb.highVolume);
                  return (
                    <React.Fragment key={arb.symbol}>
                      <tr
                        onClick={() => setExpandedRow(isExpanded ? null : arb.symbol)}
                        className="hover:bg-white/[0.02] cursor-pointer transition-colors"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronDown className="w-3 h-3 text-neutral-500" /> : <ChevronRight className="w-3 h-3 text-neutral-600" />}
                            <TokenIconSimple symbol={arb.symbol} size={18} />
                            <span className="text-white font-semibold">{arb.symbol}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <ExchangeLogo exchange={arb.lowExchange.toLowerCase()} size={14} />
                            <span className="text-neutral-300">{arb.lowExchange}</span>
                            {isExchangeDex(arb.lowExchange) && <span className="text-[8px] text-purple-400 bg-purple-500/10 px-1 rounded font-bold">DEX</span>}
                          </div>
                        </td>
                        <td className="text-right px-3 py-2.5 font-mono text-green-400">{formatPrice(arb.lowPrice)}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <ExchangeLogo exchange={arb.highExchange.toLowerCase()} size={14} />
                            <span className="text-neutral-300">{arb.highExchange}</span>
                            {isExchangeDex(arb.highExchange) && <span className="text-[8px] text-purple-400 bg-purple-500/10 px-1 rounded font-bold">DEX</span>}
                          </div>
                        </td>
                        <td className="text-right px-3 py-2.5 font-mono text-red-400">{formatPrice(arb.highPrice)}</td>
                        <td className={`text-right px-3 py-2.5 font-mono font-semibold ${spreadColor(arb.spreadPct)}`}>
                          {arb.spreadPct.toFixed(3)}%
                        </td>
                        <td className={`text-right px-3 py-2.5 font-mono font-bold ${spreadColor(arb.netPct)}`}>
                          {arb.netPct.toFixed(3)}%
                        </td>
                        <td className="text-right px-3 py-2.5 font-mono text-neutral-400">
                          {formatPrice(arb.spreadUsd)}
                        </td>
                        <td className="text-right px-4 py-2.5 font-mono text-neutral-500">
                          {formatUSD(minVol)}
                        </td>
                      </tr>

                      {/* Expanded details */}
                      {isExpanded && (
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td colSpan={9} className="px-4 py-3" style={{ background: 'rgba(255,255,255,0.015)' }}>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                              <div>
                                <span className="text-neutral-600 block mb-1">Buy Side Volume</span>
                                <span className="text-white font-mono">{formatUSD(arb.lowVolume)}</span>
                                <span className="text-neutral-600 ml-1">on {arb.lowExchange}</span>
                              </div>
                              <div>
                                <span className="text-neutral-600 block mb-1">Sell Side Volume</span>
                                <span className="text-white font-mono">{formatUSD(arb.highVolume)}</span>
                                <span className="text-neutral-600 ml-1">on {arb.highExchange}</span>
                              </div>
                              <div>
                                <span className="text-neutral-600 block mb-1">Round-trip Fee</span>
                                <span className="text-neutral-400 font-mono">0.10%</span>
                                <span className="text-neutral-600 ml-1">(taker+maker)</span>
                              </div>
                              <div>
                                <span className="text-neutral-600 block mb-1">Profit per $10K</span>
                                <span className="text-green-400 font-mono font-semibold">
                                  ${(arb.netPct / 100 * 10000).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-white/[0.04]">
            {pageItems.map((arb) => {
              const isExpanded = expandedRow === arb.symbol;
              return (
                <div
                  key={arb.symbol}
                  onClick={() => setExpandedRow(isExpanded ? null : arb.symbol)}
                  className="px-4 py-3 hover:bg-white/[0.02] cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <TokenIconSimple symbol={arb.symbol} size={20} />
                      <span className="text-white font-semibold text-sm">{arb.symbol}</span>
                    </div>
                    <span className={`font-mono font-bold text-sm ${spreadColor(arb.netPct)}`}>
                      {arb.netPct.toFixed(3)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <div className="flex items-center gap-1">
                      <ExchangeLogo exchange={arb.lowExchange.toLowerCase()} size={12} />
                      <span className="text-green-400 font-mono">{formatPrice(arb.lowPrice)}</span>
                    </div>
                    <ArrowRightLeft className="w-3 h-3 text-neutral-600" />
                    <div className="flex items-center gap-1">
                      <ExchangeLogo exchange={arb.highExchange.toLowerCase()} size={12} />
                      <span className="text-red-400 font-mono">{formatPrice(arb.highPrice)}</span>
                    </div>
                    <span className="flex-1" />
                    <span className="text-neutral-600 font-mono">{formatUSD(Math.min(arb.lowVolume, arb.highVolume))}</span>
                  </div>
                  {isExpanded && (
                    <div className="mt-2 pt-2 border-t border-white/[0.04] grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-neutral-600">Gross spread</span>
                        <span className="text-white font-mono ml-1">{arb.spreadPct.toFixed(3)}%</span>
                      </div>
                      <div>
                        <span className="text-neutral-600">Spread $</span>
                        <span className="text-white font-mono ml-1">{formatPrice(arb.spreadUsd)}</span>
                      </div>
                      <div>
                        <span className="text-neutral-600">Buy vol</span>
                        <span className="text-white font-mono ml-1">{formatUSD(arb.lowVolume)}</span>
                      </div>
                      <div>
                        <span className="text-neutral-600">Sell vol</span>
                        <span className="text-white font-mono ml-1">{formatUSD(arb.highVolume)}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={sorted.length}
            rowsPerPage={ROWS_PER_PAGE}
            onPageChange={setCurrentPage}
            label="opportunities"
          />
        </>
      )}
    </div>
  );
}
