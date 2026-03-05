'use client';

import React, { useState, useMemo } from 'react';
import { TokenIconSimple } from '@/components/TokenIcon';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { formatRateAdaptive, type FundingPeriod, PERIOD_HOURS, PERIOD_LABELS } from '../utils';
import { isExchangeDex, EXCHANGE_FEES, getArbRoundTripFee, getExchangeTradeUrl } from '@/lib/constants';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronRight, ExternalLink, TrendingUp, BarChart3, DollarSign, Activity, Filter, Calculator } from 'lucide-react';
import Pagination from './Pagination';

interface ArbitrageItem {
  symbol: string;
  spread: number;
  exchanges: { exchange: string; rate: number }[];
  markPrices?: { exchange: string; price: number }[];
  intervals?: Record<string, string>;
}

interface FundingArbitrageViewProps {
  arbitrageData: ArbitrageItem[];
  oiMap?: Map<string, number>;
  markPrices?: Map<string, number>;
  intervalMap?: Map<string, string>;
  fundingPeriod: FundingPeriod;
}

type SortKey = 'spread' | 'annualized' | 'dailyPnl' | 'symbol' | 'oi';
type VenueFilterType = 'all' | 'cex-dex' | 'cex-cex';

const ROWS_PER_PAGE = 30;

function formatUSD(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toFixed(2)}`;
}

function formatPnl(value: number): string {
  const prefix = value >= 0 ? '+' : '';
  if (Math.abs(value) >= 1000) return `${prefix}$${(value / 1000).toFixed(1)}K`;
  return `${prefix}$${value.toFixed(2)}`;
}

function formatPrice(price: number): string {
  if (price >= 10000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(6)}`;
}

function IntervalBadge({ interval }: { interval?: string }) {
  if (interval === '1h') return <span className="text-amber-400 text-[8px] font-bold ml-0.5" title="1h payout">*</span>;
  if (interval === '4h') return <span className="text-blue-400 text-[8px] font-bold ml-0.5" title="4h payout">**</span>;
  return null;
}

function getIntervalForExchange(item: ArbitrageItem, exchange: string, intervalMap?: Map<string, string>): string | undefined {
  // Prefer intervals from arb data (new format), fall back to intervalMap (legacy)
  return item.intervals?.[exchange] || intervalMap?.get(`${item.symbol}|${exchange}`);
}

// --- Profit Calculator Sub-Component ---
function ProfitCalculator({ grossSpread8h, roundTripFee, highExchange, lowExchange }: {
  grossSpread8h: number; roundTripFee: number; highExchange: string; lowExchange: string;
}) {
  const [size, setSize] = useState(10000);
  const [leverage, setLeverage] = useState(5);
  const [duration, setDuration] = useState<number>(30);

  // Fee model: round-trip fee is ONE-TIME (open + close), funding income accumulates daily
  const dailyGross = (grossSpread8h / 100) * size * 3; // 3 × 8h periods per day
  const feeCost = (roundTripFee / 100) * size;          // one-time entry+exit cost
  const grossIncome = dailyGross * duration;
  const periodNet = grossIncome - feeCost;               // net = gross - one-time fees
  const requiredMargin = (size / leverage) * 2; // both sides
  const roiOnMargin = requiredMargin > 0 ? (periodNet / requiredMargin) * 100 : 0;
  const breakEvenDays = dailyGross > 0 ? feeCost / dailyGross : Infinity;

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 mt-2">
      <div className="flex items-center gap-2 mb-3">
        <Calculator className="w-3.5 h-3.5 text-hub-yellow" />
        <span className="text-white text-xs font-semibold">Profit Calculator</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <div>
          <label className="text-neutral-500 text-[10px] block mb-1">Position Size</label>
          <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1">
            <span className="text-neutral-400 text-xs">$</span>
            <input type="number" value={size} onChange={e => setSize(Math.max(100, parseInt(e.target.value) || 100))} className="bg-transparent text-white text-xs font-mono w-full outline-none" />
          </div>
          <div className="flex gap-1 mt-1">
            {[1000, 5000, 10000, 50000, 100000].map(v => (
              <button key={v} onClick={() => setSize(v)} className={`px-1.5 py-0.5 rounded text-[9px] ${size === v ? 'bg-hub-yellow text-black' : 'text-neutral-600 bg-white/[0.04]'}`}>
                {v >= 1000 ? `${v / 1000}K` : v}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-neutral-500 text-[10px] block mb-1">Leverage</label>
          <div className="flex items-center gap-2">
            <input type="range" min={1} max={20} value={leverage} onChange={e => setLeverage(parseInt(e.target.value))} className="w-full h-1 accent-hub-yellow" />
            <span className="text-white text-xs font-mono w-8">{leverage}x</span>
          </div>
        </div>
        <div>
          <label className="text-neutral-500 text-[10px] block mb-1">Duration</label>
          <div className="flex gap-1">
            {[{ d: 1, l: '1D' }, { d: 7, l: '7D' }, { d: 30, l: '30D' }, { d: 90, l: '90D' }, { d: 365, l: '1Y' }].map(({ d, l }) => (
              <button key={d} onClick={() => setDuration(d)} className={`px-2 py-1 rounded text-[10px] font-medium ${duration === d ? 'bg-hub-yellow text-black' : 'text-neutral-600 bg-white/[0.04]'}`}>{l}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-neutral-500 text-[10px] block mb-1">Fees ({highExchange} + {lowExchange})</label>
          <span className="text-neutral-400 font-mono text-xs">{roundTripFee.toFixed(3)}% round-trip</span>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[
          { label: 'Gross Income', value: formatPnl(grossIncome), color: 'text-neutral-300' },
          { label: 'Fee Cost', value: `-$${feeCost.toFixed(2)}`, color: 'text-red-400' },
          { label: `Net (${duration}d)`, value: formatPnl(periodNet), color: periodNet > 0 ? 'text-green-400' : 'text-red-400' },
          { label: 'ROI on Margin', value: `${roiOnMargin.toFixed(1)}%`, color: roiOnMargin > 0 ? 'text-green-400' : 'text-neutral-500' },
          { label: 'Break-even', value: breakEvenDays === Infinity ? '-' : `${breakEvenDays.toFixed(1)}d`, color: 'text-neutral-300' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white/[0.02] rounded px-2 py-1.5">
            <div className="text-neutral-600 text-[9px]">{label}</div>
            <div className={`font-mono text-xs font-semibold ${color}`}>{value}</div>
          </div>
        ))}
      </div>
      <div className="text-neutral-700 text-[9px] mt-2">
        Margin required: {formatUSD(requiredMargin)} ({leverage}x on ${formatUSD(size)} × 2 sides)
      </div>
    </div>
  );
}

export default function FundingArbitrageView({ arbitrageData, oiMap, markPrices, intervalMap, fundingPeriod }: FundingArbitrageViewProps) {
  const periodScale = PERIOD_HOURS[fundingPeriod] / 8;
  const periodLabel = PERIOD_LABELS[fundingPeriod];

  // State
  const [portfolio, setPortfolio] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ih_arb_portfolio');
      return saved ? parseInt(saved, 10) : 10000;
    }
    return 10000;
  });
  const [sortKey, setSortKey] = useState<SortKey>('spread');
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [minSpread, setMinSpread] = useState(0);
  const [venueFilter, setVenueFilter] = useState<VenueFilterType>('all');
  const [exchangeFilter, setExchangeFilter] = useState<string>('');
  const [minOI, setMinOI] = useState(0);

  const handlePortfolioChange = (val: number) => {
    setPortfolio(val);
    if (typeof window !== 'undefined') localStorage.setItem('ih_arb_portfolio', String(val));
  };

  // Enrich data with calculations
  const enriched = useMemo(() => {
    return arbitrageData.map(item => {
      const sorted = [...item.exchanges].sort((a, b) => b.rate - a.rate);
      if (sorted.length === 0) return null;
      const high = sorted[0];
      const low = sorted[sorted.length - 1];
      const grossSpread8h = item.spread;
      const roundTripFee = getArbRoundTripFee(high.exchange, low.exchange);
      const netSpread8h = Math.max(0, grossSpread8h - roundTripFee);
      const grossSpread = grossSpread8h * periodScale;
      const netSpread = netSpread8h * periodScale;
      const annualized = grossSpread8h * 3 * 365;
      const netAnnualized = netSpread8h * 3 * 365;
      const dailyPnl = (netSpread8h / 100) * portfolio * 3;
      const monthlyPnl = dailyPnl * 30;

      let totalOI = 0;
      if (oiMap) {
        item.exchanges.forEach(ex => {
          const oi = oiMap.get(`${item.symbol}|${ex.exchange}`);
          if (oi) totalOI += oi;
        });
      }

      const price = markPrices?.get(item.symbol) || (item.markPrices?.[0]?.price ?? 0);
      const highIsDex = isExchangeDex(high.exchange);
      const lowIsDex = isExchangeDex(low.exchange);

      return {
        ...item,
        sorted,
        high,
        low,
        grossSpread,
        grossSpread8h,
        netSpread,
        roundTripFee,
        annualized,
        netAnnualized,
        dailyPnl,
        monthlyPnl,
        totalOI,
        price,
        highIsDex,
        lowIsDex,
        isCexDex: (highIsDex && !lowIsDex) || (!highIsDex && lowIsDex),
      };
    }).filter((item): item is NonNullable<typeof item> => item !== null);
  }, [arbitrageData, oiMap, markPrices, portfolio, periodScale]);

  // Apply filters
  const filtered = useMemo(() => {
    return enriched.filter(item => {
      if (item.grossSpread < minSpread * periodScale) return false;
      if (venueFilter === 'cex-dex' && !item.isCexDex) return false;
      if (venueFilter === 'cex-cex' && item.isCexDex) return false;
      if (exchangeFilter && !item.exchanges.some(ex => ex.exchange.toLowerCase().includes(exchangeFilter.toLowerCase()))) return false;
      if (minOI > 0 && item.totalOI < minOI) return false;
      return true;
    });
  }, [enriched, minSpread, venueFilter, exchangeFilter, minOI, periodScale]);

  // Sort
  const sortedData = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'spread': cmp = a.grossSpread - b.grossSpread; break;
        case 'annualized': cmp = a.netAnnualized - b.netAnnualized; break;
        case 'dailyPnl': cmp = a.dailyPnl - b.dailyPnl; break;
        case 'symbol': cmp = a.symbol.localeCompare(b.symbol); break;
        case 'oi': cmp = a.totalOI - b.totalOI; break;
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortAsc]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedData.length / ROWS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIdx = (safeCurrentPage - 1) * ROWS_PER_PAGE;
  const pageData = sortedData.slice(startIdx, startIdx + ROWS_PER_PAGE);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  // Summary stats — use filtered data so cards reflect what's visible in the table
  const summary = useMemo(() => {
    const source = filtered.length > 0 ? filtered : enriched;
    if (source.length === 0) return null;
    const best = source.reduce((a, b) => b.grossSpread > a.grossSpread ? b : a, source[0]);
    const avgNet = source.reduce((s, i) => s + i.netAnnualized, 0) / source.length;
    const totalOI = source.reduce((s, i) => s + i.totalOI, 0);
    return { count: source.length, best, avgNet, totalOI };
  }, [enriched, filtered]);

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortAsc ? <ArrowUp className="w-3 h-3 text-hub-yellow" /> : <ArrowDown className="w-3 h-3 text-hub-yellow" />;
  };

  const hasOI = oiMap && oiMap.size > 0;

  return (
    <div className="space-y-3">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="bg-hub-darker border border-white/[0.06] rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Activity className="w-3.5 h-3.5 text-hub-yellow" />
              <span className="text-neutral-500 text-[10px] uppercase tracking-wider">Opportunities</span>
            </div>
            <div className="text-white text-lg font-bold font-mono">{summary.count}</div>
            <div className="text-neutral-600 text-[10px]">with 2+ exchanges</div>
          </div>
          <div className="bg-hub-darker border border-white/[0.06] rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-green-400" />
              <span className="text-neutral-500 text-[10px] uppercase tracking-wider">Best Spread</span>
            </div>
            <div className="text-hub-yellow text-lg font-bold font-mono">{(summary.best.grossSpread).toFixed(4)}%</div>
            <div className="text-neutral-500 text-[10px]">{summary.best.symbol} &middot; {summary.best.high.exchange} / {summary.best.low.exchange}</div>
          </div>
          <div className="bg-hub-darker border border-white/[0.06] rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="w-3.5 h-3.5 text-green-400" />
              <span className="text-neutral-500 text-[10px] uppercase tracking-wider">Avg Net Ann.</span>
            </div>
            <div className={`text-lg font-bold font-mono ${summary.avgNet > 0 ? 'text-green-400' : 'text-neutral-500'}`}>
              {summary.avgNet > 0 ? '+' : ''}{summary.avgNet.toFixed(1)}%
            </div>
            <div className="text-neutral-600 text-[10px]">across all pairs</div>
          </div>
          <div className="bg-hub-darker border border-white/[0.06] rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-neutral-500 text-[10px] uppercase tracking-wider">Total OI</span>
            </div>
            <div className="text-white text-lg font-bold font-mono">{summary.totalOI > 0 ? formatUSD(summary.totalOI) : '-'}</div>
            <div className="text-neutral-600 text-[10px]">addressable liquidity</div>
          </div>
        </div>
      )}

      {/* Main Table Container */}
      <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-white font-semibold text-sm">Arbitrage Opportunities</h3>
            <p className="text-neutral-600 text-xs">Cross-exchange funding rate spreads &middot; Net of real per-exchange taker fees</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${showFilters ? 'bg-hub-yellow text-black' : 'text-neutral-500 hover:text-white bg-white/[0.04]'}`}>
              <Filter className="w-3 h-3" /> Filters
            </button>
            <span className="text-neutral-500 text-xs">Portfolio:</span>
            <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1">
              <span className="text-neutral-400 text-xs">$</span>
              <input
                type="number"
                value={portfolio}
                onChange={(e) => handlePortfolioChange(Math.max(100, parseInt(e.target.value) || 100))}
                className="bg-transparent text-white text-xs font-mono w-20 outline-none"
                min={100}
                step={1000}
              />
            </div>
            <div className="hidden sm:flex items-center gap-1">
              {[1000, 10000, 50000, 100000].map(v => (
                <button
                  key={v}
                  onClick={() => handlePortfolioChange(v)}
                  className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                    portfolio === v ? 'bg-hub-yellow text-black' : 'text-neutral-600 hover:text-white bg-white/[0.04]'
                  }`}
                >
                  {v >= 1000 ? `${v / 1000}K` : v}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.01] flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-neutral-500 text-[10px]">Min Spread:</span>
              <input
                type="number"
                value={minSpread}
                onChange={e => { setMinSpread(parseFloat(e.target.value) || 0); setCurrentPage(1); }}
                className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-0.5 text-white text-xs font-mono w-16 outline-none"
                step={0.01}
                min={0}
              />
              <span className="text-neutral-600 text-[10px]">%</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-neutral-500 text-[10px]">Venue:</span>
              {[
                { key: 'all' as VenueFilterType, label: 'All' },
                { key: 'cex-dex' as VenueFilterType, label: 'CEX↔DEX' },
                { key: 'cex-cex' as VenueFilterType, label: 'CEX↔CEX' },
              ].map(({ key, label }) => (
                <button key={key} onClick={() => { setVenueFilter(key); setCurrentPage(1); }}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium ${venueFilter === key ? 'bg-hub-yellow text-black' : 'text-neutral-600 bg-white/[0.04]'}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-neutral-500 text-[10px]">Exchange:</span>
              <input
                type="text"
                value={exchangeFilter}
                onChange={e => { setExchangeFilter(e.target.value); setCurrentPage(1); }}
                placeholder="Filter..."
                className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-0.5 text-white text-xs w-24 outline-none placeholder:text-neutral-700"
              />
            </div>
            {hasOI && (
              <div className="flex items-center gap-2">
                <span className="text-neutral-500 text-[10px]">Min OI:</span>
                <select value={minOI} onChange={e => { setMinOI(parseInt(e.target.value)); setCurrentPage(1); }}
                  className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-0.5 text-white text-xs outline-none">
                  <option value={0}>Any</option>
                  <option value={100000}>$100K+</option>
                  <option value={1000000}>$1M+</option>
                  <option value={10000000}>$10M+</option>
                </select>
              </div>
            )}
          </div>
        )}

        {/* Table — Desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500 w-8">#</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500 cursor-pointer hover:text-white" onClick={() => handleSort('symbol')}>
                  <div className="flex items-center gap-1">Symbol <SortIcon k="symbol" /></div>
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Price</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-neutral-500 cursor-pointer hover:text-white" onClick={() => handleSort('spread')}>
                  <div className="flex items-center gap-1 justify-end">Spread /{periodLabel} <SortIcon k="spread" /></div>
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-neutral-500 cursor-pointer hover:text-white" onClick={() => handleSort('annualized')}>
                  <div className="flex items-center gap-1 justify-end">Net Ann.% <SortIcon k="annualized" /></div>
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Short Side</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Long Side</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-neutral-500 cursor-pointer hover:text-white" onClick={() => handleSort('dailyPnl')}>
                  <div className="flex items-center gap-1 justify-end">Daily PnL <SortIcon k="dailyPnl" /></div>
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-neutral-500">30d PnL</th>
                {hasOI && (
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-neutral-500 cursor-pointer hover:text-white" onClick={() => handleSort('oi')}>
                    <div className="flex items-center gap-1 justify-end">OI <SortIcon k="oi" /></div>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {pageData.map((item, index) => (
                <React.Fragment key={item.symbol}>
                  <tr
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() => setExpandedRow(expandedRow === item.symbol ? null : item.symbol)}
                  >
                    <td className="px-3 py-2 text-neutral-600 text-xs font-mono">
                      <div className="flex items-center gap-1">
                        {expandedRow === item.symbol ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        {startIdx + index + 1}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <TokenIconSimple symbol={item.symbol} size={20} />
                        <span className="text-white font-semibold text-sm">{item.symbol}</span>
                        <span className="text-neutral-600 text-[10px]">{item.exchanges.length} exch</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="text-neutral-400 font-mono text-xs">
                        {item.price > 0 ? formatPrice(item.price) : '-'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div>
                        <span className="text-hub-yellow font-bold font-mono text-sm">{item.grossSpread.toFixed(4)}%</span>
                        {item.netSpread < item.grossSpread && (
                          <div className="text-neutral-600 text-[10px] font-mono" title={`Round-trip fees: ${item.roundTripFee.toFixed(3)}%`}>net {item.netSpread.toFixed(4)}%</div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={`font-mono text-xs font-semibold ${item.netAnnualized > 0 ? 'text-green-400' : 'text-neutral-500'}`}>
                        {item.netAnnualized > 0 ? '+' : ''}{item.netAnnualized.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <ExchangeSide exchange={item.high.exchange} rate={item.high.rate} symbol={item.symbol} periodScale={periodScale} item={item} intervalMap={intervalMap} side="short" />
                    </td>
                    <td className="px-3 py-2">
                      <ExchangeSide exchange={item.low.exchange} rate={item.low.rate} symbol={item.symbol} periodScale={periodScale} item={item} intervalMap={intervalMap} side="long" />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={`font-mono text-xs font-semibold ${item.dailyPnl > 0 ? 'text-green-400' : 'text-neutral-500'}`}>
                        {formatPnl(item.dailyPnl)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={`font-mono text-xs ${item.monthlyPnl > 0 ? 'text-green-400' : 'text-neutral-500'}`}>
                        {formatPnl(item.monthlyPnl)}
                      </span>
                    </td>
                    {hasOI && (
                      <td className="px-3 py-2 text-right">
                        <span className="text-neutral-400 font-mono text-xs">{item.totalOI > 0 ? formatUSD(item.totalOI) : '-'}</span>
                      </td>
                    )}
                  </tr>
                  {/* Expanded Detail Panel */}
                  {expandedRow === item.symbol && (
                    <tr key={`${item.symbol}-expanded`}>
                      <td colSpan={hasOI ? 10 : 9} className="px-4 py-3 bg-white/[0.01] border-b border-white/[0.06]">
                        <ExpandedPanel item={item} periodScale={periodScale} intervalMap={intervalMap} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card Layout */}
        <div className="md:hidden divide-y divide-white/[0.04]">
          {pageData.map((item, index) => (
            <div key={item.symbol}>
              <div
                className="px-3 py-3 cursor-pointer active:bg-white/[0.02]"
                onClick={() => setExpandedRow(expandedRow === item.symbol ? null : item.symbol)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {expandedRow === item.symbol ? <ChevronDown className="w-3.5 h-3.5 text-neutral-500" /> : <ChevronRight className="w-3.5 h-3.5 text-neutral-500" />}
                    <TokenIconSimple symbol={item.symbol} size={18} />
                    <span className="text-white font-semibold text-sm">{item.symbol}</span>
                    <span className="text-neutral-600 text-[10px]">#{startIdx + index + 1}</span>
                  </div>
                  <span className="text-hub-yellow font-bold font-mono text-sm">{item.grossSpread.toFixed(4)}%</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-neutral-600 text-[9px] mb-0.5">Short (earn)</div>
                    <div className="flex items-center gap-1">
                      <ExchangeLogo exchange={item.high.exchange.toLowerCase()} size={12} />
                      <span className="text-neutral-300 text-[11px]">{item.high.exchange}</span>
                      <span className="text-red-400 font-mono text-[11px] ml-auto">{formatRateAdaptive(item.high.rate * periodScale)}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-neutral-600 text-[9px] mb-0.5">Long (pay)</div>
                    <div className="flex items-center gap-1">
                      <ExchangeLogo exchange={item.low.exchange.toLowerCase()} size={12} />
                      <span className="text-neutral-300 text-[11px]">{item.low.exchange}</span>
                      <span className="text-green-400 font-mono text-[11px] ml-auto">{formatRateAdaptive(item.low.rate * periodScale)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 text-[10px]">
                  <span className={`font-mono ${item.netAnnualized > 0 ? 'text-green-400' : 'text-neutral-500'}`}>
                    Ann: {item.netAnnualized > 0 ? '+' : ''}{item.netAnnualized.toFixed(1)}%
                  </span>
                  <span className={`font-mono ${item.dailyPnl > 0 ? 'text-green-400' : 'text-neutral-500'}`}>
                    Daily: {formatPnl(item.dailyPnl)}
                  </span>
                  {item.price > 0 && <span className="text-neutral-500 font-mono">{formatPrice(item.price)}</span>}
                </div>
              </div>
              {expandedRow === item.symbol && (
                <div className="px-3 pb-3">
                  <ExpandedPanel item={item} periodScale={periodScale} intervalMap={intervalMap} />
                </div>
              )}
            </div>
          ))}
        </div>

        {arbitrageData.length === 0 && (
          <div className="p-8 text-center text-neutral-600 text-sm">No arbitrage opportunities found.</div>
        )}

        <Pagination
          currentPage={safeCurrentPage}
          totalPages={totalPages}
          totalItems={sortedData.length}
          rowsPerPage={ROWS_PER_PAGE}
          onPageChange={setCurrentPage}
          label="opportunities"
        />

        {/* Footer */}
        <div className="px-4 py-2 border-t border-white/[0.06] space-y-1">
          <div className="flex items-center gap-3 text-[10px]">
            <span className="text-neutral-600">Payout interval:</span>
            <span className="text-neutral-500">No mark = 8h</span>
            <span className="text-amber-400 font-bold">*</span><span className="text-neutral-500 -ml-2">= 1h</span>
            <span className="text-blue-400 font-bold">**</span><span className="text-neutral-500 -ml-2">= 4h</span>
          </div>
          <p className="text-neutral-700 text-[10px]">
            PnL estimates assume equal position size on short &amp; long sides. Fees use real base-tier taker rates per exchange (open+close on each side). Actual fees vary by VIP tier. Not financial advice.
          </p>
        </div>
      </div>
    </div>
  );
}

// --- Exchange Side Cell ---
function ExchangeSide({ exchange, rate, symbol, periodScale, item, intervalMap, side }: {
  exchange: string; rate: number; symbol: string; periodScale: number; item: ArbitrageItem; intervalMap?: Map<string, string>; side: 'short' | 'long';
}) {
  const tradeUrl = getExchangeTradeUrl(exchange, symbol);
  const interval = getIntervalForExchange(item, exchange, intervalMap);
  const color = side === 'short' ? 'text-red-400' : 'text-green-400';
  return (
    <div className="flex items-center gap-1.5">
      <ExchangeLogo exchange={exchange.toLowerCase()} size={14} />
      <span className="text-xs text-neutral-300">{exchange}</span>
      {isExchangeDex(exchange) && <span className="px-1 py-0.5 rounded text-[8px] font-bold bg-purple-500/20 text-purple-400 leading-none">DEX</span>}
      <span className={`${color} font-mono text-[11px] ml-auto`}>
        {formatRateAdaptive(rate * periodScale)}<IntervalBadge interval={interval} />
      </span>
      {tradeUrl && (
        <a href={tradeUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-neutral-600 hover:text-hub-yellow transition-colors" title={`Trade on ${exchange}`}>
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

// --- Expanded Panel ---
function ExpandedPanel({ item, periodScale, intervalMap }: {
  item: any; periodScale: number; intervalMap?: Map<string, string>;
}) {
  const [showCalc, setShowCalc] = useState(false);
  const exchangePrices = item.markPrices as Array<{ exchange: string; price: number }> | undefined;
  const hasPrices = exchangePrices && exchangePrices.length > 0;
  const avgPrice = hasPrices ? exchangePrices.reduce((s: number, p: { price: number }) => s + p.price, 0) / exchangePrices.length : 0;

  return (
    <div className="space-y-3">
      {/* All Exchange Rates */}
      <div>
        <div className="text-neutral-500 text-[10px] font-semibold uppercase tracking-wider mb-1.5">All Exchange Rates</div>
        <div className="flex flex-wrap gap-1.5">
          {item.sorted.map((ex: { exchange: string; rate: number }) => {
            const tradeUrl = getExchangeTradeUrl(ex.exchange, item.symbol);
            const interval = getIntervalForExchange(item, ex.exchange, intervalMap);
            return (
              <div key={ex.exchange} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.03] border border-white/[0.04]">
                <ExchangeLogo exchange={ex.exchange.toLowerCase()} size={14} />
                <span className="text-neutral-400 text-[11px]">{ex.exchange}</span>
                {isExchangeDex(ex.exchange) && <span className="px-0.5 py-0.5 rounded text-[8px] font-bold bg-purple-500/20 text-purple-400 leading-none">DEX</span>}
                <span className={`font-mono text-[11px] font-semibold ${ex.rate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatRateAdaptive(ex.rate * periodScale)}<IntervalBadge interval={interval} />
                </span>
                {tradeUrl && (
                  <a href={tradeUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-neutral-600 hover:text-hub-yellow transition-colors">
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-Exchange Price Comparison */}
      {hasPrices && (
        <div>
          <div className="text-neutral-500 text-[10px] font-semibold uppercase tracking-wider mb-1.5">Price Comparison</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5">
            {[...exchangePrices]
              .sort((a: { price: number }, b: { price: number }) => b.price - a.price)
              .map((ep: { exchange: string; price: number }) => {
                const deviation = avgPrice > 0 ? ((ep.price - avgPrice) / avgPrice) * 100 : 0;
                const isHighest = ep.price === Math.max(...exchangePrices.map((p: { price: number }) => p.price));
                const isLowest = ep.price === Math.min(...exchangePrices.map((p: { price: number }) => p.price));
                return (
                  <div key={ep.exchange} className={`px-2 py-1.5 rounded-md border ${isHighest ? 'bg-green-500/5 border-green-500/20' : isLowest ? 'bg-red-500/5 border-red-500/20' : 'bg-white/[0.02] border-white/[0.04]'}`}>
                    <div className="flex items-center gap-1 mb-0.5">
                      <ExchangeLogo exchange={ep.exchange.toLowerCase()} size={12} />
                      <span className="text-neutral-400 text-[10px]">{ep.exchange}</span>
                    </div>
                    <div className="text-white font-mono text-xs">{formatPrice(ep.price)}</div>
                    <div className={`font-mono text-[9px] ${deviation > 0 ? 'text-green-400' : deviation < 0 ? 'text-red-400' : 'text-neutral-600'}`}>
                      {deviation > 0 ? '+' : ''}{deviation.toFixed(3)}%
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Profit Calculator Toggle */}
      <div>
        <button onClick={() => setShowCalc(!showCalc)} className="flex items-center gap-1.5 text-neutral-500 hover:text-white text-[11px] transition-colors">
          <Calculator className="w-3.5 h-3.5" />
          <span>{showCalc ? 'Hide' : 'Show'} Profit Calculator</span>
          {showCalc ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
        {showCalc && (
          <ProfitCalculator
            grossSpread8h={item.grossSpread8h}
            roundTripFee={item.roundTripFee}
            highExchange={item.high.exchange}
            lowExchange={item.low.exchange}
          />
        )}
      </div>
    </div>
  );
}
