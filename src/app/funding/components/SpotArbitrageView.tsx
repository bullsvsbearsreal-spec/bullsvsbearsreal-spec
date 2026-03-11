'use client';

import React, { useState, useMemo } from 'react';
import { TokenIconSimple } from '@/components/TokenIcon';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, X, Filter, ArrowRightLeft } from 'lucide-react';
import Pagination from './Pagination';
import { getExchangeTradeUrl } from '@/lib/constants';

const ROWS_PER_PAGE = 40;

interface SpotArbEntry {
  symbol: string;
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  spreadPct: number;      // (sell - buy) / buy * 100
  avgOI: number;           // average OI across exchanges for this symbol
  exchangeCount: number;   // how many exchanges list this symbol
}

interface SpotArbitrageViewProps {
  fundingRates: any[];
  oiMap: Map<string, number>;
}

type SortKey = 'spreadPct' | 'symbol' | 'avgOI' | 'exchangeCount';

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

export default function SpotArbitrageView({ fundingRates, oiMap }: SpotArbitrageViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>('spreadPct');
  const [sortAsc, setSortAsc] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [minOI, setMinOI] = useState(false);
  const [minSpread, setMinSpread] = useState<'all' | '0.1' | '0.5' | '1'>('all');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(key === 'symbol'); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-neutral-600" />;
    return sortAsc ? <ArrowUp className="w-3 h-3 text-hub-yellow" /> : <ArrowDown className="w-3 h-3 text-hub-yellow" />;
  };

  // Build spot arb entries: group by symbol, compare index prices across exchanges
  const entries = useMemo<SpotArbEntry[]>(() => {
    // Collect mark prices (actual tradeable perp prices) per symbol per exchange
    const symbolMap = new Map<string, { exchange: string; price: number }[]>();
    for (const fr of fundingRates) {
      const price = fr.markPrice;
      if (!price || !isFinite(price) || price <= 0) continue;
      if (!symbolMap.has(fr.symbol)) symbolMap.set(fr.symbol, []);
      // Deduplicate: only keep one price per exchange per symbol (first seen)
      const existing = symbolMap.get(fr.symbol)!;
      if (!existing.some(e => e.exchange === fr.exchange)) {
        existing.push({ exchange: fr.exchange, price });
      }
    }

    const result: SpotArbEntry[] = [];
    symbolMap.forEach((prices, symbol) => {
      if (prices.length < 2) return; // Need at least 2 exchanges to compare

      // Find cheapest and most expensive
      let minIdx = 0, maxIdx = 0;
      for (let i = 1; i < prices.length; i++) {
        if (prices[i].price < prices[minIdx].price) minIdx = i;
        if (prices[i].price > prices[maxIdx].price) maxIdx = i;
      }

      const buyPrice = prices[minIdx].price;
      const sellPrice = prices[maxIdx].price;
      const spreadPct = ((sellPrice - buyPrice) / buyPrice) * 100;

      // Filter out negligible spreads and extreme outliers
      if (spreadPct < 0.005 || spreadPct > 20) return;
      // Skip if buy and sell are the same exchange (shouldn't happen but safety)
      if (minIdx === maxIdx) return;

      // Average OI across exchanges that list this symbol
      let totalOI = 0;
      let oiCount = 0;
      for (const p of prices) {
        const oi = oiMap.get(`${symbol}|${p.exchange}`) || 0;
        if (oi > 0) { totalOI += oi; oiCount++; }
      }

      result.push({
        symbol,
        buyExchange: prices[minIdx].exchange,
        sellExchange: prices[maxIdx].exchange,
        buyPrice,
        sellPrice,
        spreadPct,
        avgOI: oiCount > 0 ? totalOI / oiCount : 0,
        exchangeCount: prices.length,
      });
    });
    return result;
  }, [fundingRates, oiMap]);

  const filtered = useMemo(() => {
    let items = entries;
    if (search) {
      const q = search.toUpperCase();
      items = items.filter(e =>
        e.symbol.includes(q) ||
        e.buyExchange.toLowerCase().includes(search.toLowerCase()) ||
        e.sellExchange.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (minOI) items = items.filter(e => e.avgOI >= 100_000);
    if (minSpread === '0.1') items = items.filter(e => e.spreadPct >= 0.1);
    else if (minSpread === '0.5') items = items.filter(e => e.spreadPct >= 0.5);
    else if (minSpread === '1') items = items.filter(e => e.spreadPct >= 1);
    return items;
  }, [entries, search, minOI, minSpread]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let diff = 0;
      switch (sortKey) {
        case 'spreadPct': diff = a.spreadPct - b.spreadPct; break;
        case 'symbol': diff = a.symbol.localeCompare(b.symbol); break;
        case 'avgOI': diff = a.avgOI - b.avgOI; break;
        case 'exchangeCount': diff = a.exchangeCount - b.exchangeCount; break;
      }
      return sortAsc ? diff : -diff;
    });
    return arr;
  }, [filtered, sortKey, sortAsc]);

  const totalPages = Math.ceil(sorted.length / ROWS_PER_PAGE);
  const page = Math.min(currentPage, totalPages || 1);
  const pageItems = sorted.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  // Stats
  const avgSpread = entries.length > 0 ? entries.reduce((s, e) => s + e.spreadPct, 0) / entries.length : 0;
  const maxSpread = entries.length > 0 ? Math.max(...entries.map(e => e.spreadPct)) : 0;
  const above1Pct = entries.filter(e => e.spreadPct >= 1).length;

  const spreadColor = (pct: number) => {
    if (pct >= 1) return 'text-green-400';
    if (pct >= 0.5) return 'text-green-400/80';
    if (pct >= 0.1) return 'text-emerald-400/70';
    return 'text-neutral-400';
  };

  return (
    <div className="space-y-3">
      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Pairs</span>
          <span className="text-sm font-bold text-white font-mono">{entries.length}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Avg Spread</span>
          <span className={`text-sm font-bold font-mono ${spreadColor(avgSpread)}`}>{avgSpread.toFixed(3)}%</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)' }}>
          <span className="text-[10px] text-green-400/70 uppercase tracking-wider font-semibold">Max Spread</span>
          <span className="text-sm font-bold text-green-400 font-mono">{maxSpread.toFixed(3)}%</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)' }}>
          <span className="text-[10px] text-green-400/70 uppercase tracking-wider font-semibold">&gt;1%</span>
          <span className="text-sm font-bold text-green-400 font-mono">{above1Pct}</span>
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
          {(['all', '0.1', '0.5', '1'] as const).map(f => (
            <button
              key={f}
              onClick={() => { setMinSpread(f); setCurrentPage(1); }}
              className={`px-2.5 sm:px-3 py-[7px] text-[11px] font-semibold transition-all duration-200 ${
                minSpread === f
                  ? 'bg-hub-yellow text-black'
                  : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04]'
              }`}
            >
              {f === 'all' ? 'All' : `≥${f}%`}
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
        {(search || minSpread !== 'all' || minOI) && (
          <span className="text-[10px] text-neutral-600 font-mono">
            {filtered.length}{search || minOI || minSpread !== 'all' ? `/${entries.length}` : ''} results
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
              <th className="text-left px-3 py-2 text-neutral-500 font-semibold text-[10px] uppercase tracking-wider">Buy on</th>
              <th className="text-right px-3 py-2 text-neutral-500 font-semibold text-[10px] uppercase tracking-wider hidden sm:table-cell">Buy Price</th>
              <th className="text-center px-3 py-2 text-neutral-500 font-semibold text-[10px] uppercase tracking-wider w-8"><ArrowRightLeft className="w-3 h-3 mx-auto text-neutral-600" /></th>
              <th className="text-left px-3 py-2 text-neutral-500 font-semibold text-[10px] uppercase tracking-wider">Sell on</th>
              <th className="text-right px-3 py-2 text-neutral-500 font-semibold text-[10px] uppercase tracking-wider hidden sm:table-cell">Sell Price</th>
              <th className="text-right px-3 py-2 text-neutral-500 font-semibold text-[10px] uppercase tracking-wider">
                <button onClick={() => handleSort('spreadPct')} className="flex items-center gap-1 hover:text-white transition-colors ml-auto">
                  Spread <SortIcon col="spreadPct" />
                </button>
              </th>
              <th className="text-right px-3 py-2 text-neutral-500 font-semibold text-[10px] uppercase tracking-wider hidden md:table-cell">
                <button onClick={() => handleSort('exchangeCount')} className="flex items-center gap-1 hover:text-white transition-colors ml-auto">
                  Exch <SortIcon col="exchangeCount" />
                </button>
              </th>
              <th className="text-right px-3 py-2 text-neutral-500 font-semibold text-[10px] uppercase tracking-wider">
                <button onClick={() => handleSort('avgOI')} className="flex items-center gap-1 hover:text-white transition-colors ml-auto">
                  Avg OI <SortIcon col="avgOI" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((entry, idx) => {
              const buyUrl = getExchangeTradeUrl(entry.buyExchange, entry.symbol);
              const sellUrl = getExchangeTradeUrl(entry.sellExchange, entry.symbol);
              return (
                <tr
                  key={`${entry.symbol}-${idx}`}
                  className="group transition-colors hover:bg-white/[0.02]"
                >
                  <td className="px-3 py-2.5">
                    <a href={`/funding/${entry.symbol}`} className="flex items-center gap-2 no-underline">
                      <TokenIconSimple symbol={entry.symbol} size={20} />
                      <span className="font-bold text-white group-hover:text-hub-yellow transition-colors">{entry.symbol}</span>
                    </a>
                  </td>
                  <td className="px-3 py-2.5">
                    <a
                      href={buyUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 no-underline"
                    >
                      <ExchangeLogo exchange={entry.buyExchange.toLowerCase()} size={16} />
                      <span className="text-neutral-300 group-hover:text-white transition-colors">{entry.buyExchange}</span>
                    </a>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-neutral-500 hidden sm:table-cell">
                    {formatPrice(entry.buyPrice)}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <ArrowRightLeft className="w-3 h-3 mx-auto text-neutral-700" />
                  </td>
                  <td className="px-3 py-2.5">
                    <a
                      href={sellUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 no-underline"
                    >
                      <ExchangeLogo exchange={entry.sellExchange.toLowerCase()} size={16} />
                      <span className="text-neutral-300 group-hover:text-white transition-colors">{entry.sellExchange}</span>
                    </a>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-neutral-400 hidden sm:table-cell">
                    {formatPrice(entry.sellPrice)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={`font-mono tabular-nums font-bold ${spreadColor(entry.spreadPct)}`}>
                      +{entry.spreadPct.toFixed(4)}%
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-neutral-500 hidden md:table-cell">
                    {entry.exchangeCount}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-neutral-500">
                    {entry.avgOI > 0 ? formatOI(entry.avgOI) : '-'}
                  </td>
                </tr>
              );
            })}
            {pageItems.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-12 text-neutral-600 text-sm">
                  No spot price arbitrage opportunities found matching filters
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
        Cross-exchange arbitrage compares perp mark prices across exchanges for the same symbol.{' '}
        <span className="text-green-400/60 font-medium">Spread</span> = price difference between cheapest and most expensive exchange.{' '}
        Buy the perp on one exchange, sell on another. Larger spreads = bigger potential profit.{' '}
        <span className="text-neutral-500">Exch</span> = number of exchanges listing this symbol.
      </p>
    </div>
  );
}
