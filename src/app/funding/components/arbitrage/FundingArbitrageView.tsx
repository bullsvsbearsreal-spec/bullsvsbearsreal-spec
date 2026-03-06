'use client';

import React, { useState, useMemo } from 'react';
import { TokenIconSimple } from '@/components/TokenIcon';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { formatRateAdaptive, PERIOD_HOURS, PERIOD_LABELS } from '../../utils';
import { isExchangeDex, getArbRoundTripFee } from '@/lib/constants';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronRight, TrendingUp, BarChart3, DollarSign, Activity, Filter, AlertTriangle, Shield, TrendingDown, Download, Link2, Check, GitCompareArrows } from 'lucide-react';
import Pagination from '../Pagination';

import type { FundingArbitrageViewProps, SortKey, VenueFilterType, FeasibilityGrade, EnrichedArb } from './types';
import { computeGrade, GRADE_COLORS, ROWS_PER_PAGE, formatUSD, formatPnl, formatPrice } from './utils';
import { GradeBadge } from './GradeBadge';
import { ComparisonDrawer } from './ComparisonDrawer';
import { ExchangeSide, ExpandedPanel } from './ExpandedPanel';

export default function FundingArbitrageView({ arbitrageData, oiMap, markPrices, indexPrices, intervalMap, fundingPeriod, historicalSpreads }: FundingArbitrageViewProps) {
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
  const [sortKey, setSortKey] = useState<SortKey>('grade');
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [minSpread, setMinSpread] = useState(0);
  const [venueFilter, setVenueFilter] = useState<VenueFilterType>('all');
  const [exchangeFilter, setExchangeFilter] = useState<string>('');
  const [minOI, setMinOI] = useState(0);
  const [hideOutliers, setHideOutliers] = useState(true);
  const [gradeFilter, setGradeFilter] = useState<FeasibilityGrade | 'all'>('all');
  const [linkCopied, setLinkCopied] = React.useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareItems, setCompareItems] = useState<Set<string>>(new Set());

  const toggleCompare = (symbol: string) => {
    setCompareItems(prev => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else if (next.size < 3) next.add(symbol);
      return next;
    });
  };

  const handlePortfolioChange = (val: number) => {
    setPortfolio(val);
    if (typeof window !== 'undefined') localStorage.setItem('ih_arb_portfolio', String(val));
  };

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const g = params.get('grade');
    if (g && ['A', 'B', 'C', 'D'].includes(g)) setGradeFilter(g as FeasibilityGrade);
    const v = params.get('venue');
    if (v && ['all', 'cex-dex', 'cex-cex'].includes(v)) setVenueFilter(v as VenueFilterType);
    const ex = params.get('exchange');
    if (ex) setExchangeFilter(ex);
    const ms = params.get('minSpread');
    if (ms) setMinSpread(parseFloat(ms) || 0);
    const mo = params.get('minOI');
    if (mo) setMinOI(parseInt(mo) || 0);
    const ho = params.get('hideOutliers');
    if (ho === 'false') setHideOutliers(false);
    if (ho === 'true') setHideOutliers(true);
    const sk = params.get('sort');
    if (sk && ['spread', 'annualized', 'dailyPnl', 'symbol', 'oi', 'grade'].includes(sk)) setSortKey(sk as SortKey);
    const sd = params.get('sortDir');
    if (sd === 'asc') setSortAsc(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      // Per-exchange OI + min side OI
      let totalOI = 0;
      let highOI = 0;
      let lowOI = 0;
      let minSideOI = Infinity;
      if (oiMap) {
        highOI = oiMap.get(`${item.symbol}|${high.exchange}`) || 0;
        lowOI = oiMap.get(`${item.symbol}|${low.exchange}`) || 0;
        minSideOI = Math.min(highOI, lowOI);
        item.exchanges.forEach(ex => {
          const oi = oiMap.get(`${item.symbol}|${ex.exchange}`);
          if (oi) totalOI += oi;
        });
      }
      if (!isFinite(minSideOI)) minSideOI = 0;

      const price = markPrices?.get(item.symbol) || (item.markPrices?.[0]?.price ?? 0);
      const highIsDex = isExchangeDex(high.exchange);
      const lowIsDex = isExchangeDex(low.exchange);

      // Outlier flags
      const isOutlier = grossSpread8h > 1;
      const isLowLiq = minSideOI > 0 && minSideOI < 50_000;

      // Basis: mark vs index premium
      const idxPrice = indexPrices?.get(item.symbol);
      const basis = (idxPrice && idxPrice > 0 && price > 0) ? ((price - idxPrice) / idxPrice) * 100 : null;

      // Historical stability & trend
      const hist = historicalSpreads?.get(item.symbol);
      let stability: 'stable' | 'volatile' | 'new' | null = null;
      let trend: 'widening' | 'narrowing' | 'flat' | null = null;
      if (hist) {
        const deviation = hist.avg7d > 0 ? Math.abs(grossSpread8h - hist.avg7d) / hist.avg7d : 0;
        stability = deviation <= 0.3 ? 'stable' : 'volatile';
        if (hist.avg6d > 0) {
          const trendRatio = hist.avg24h / hist.avg6d;
          trend = trendRatio > 1.1 ? 'widening' : trendRatio < 0.9 ? 'narrowing' : 'flat';
        }
      } else {
        stability = 'new';
      }

      // Per-side intervals and daily rate breakdown
      const highInterval = item.intervals?.[high.exchange] || '8h';
      const lowInterval = item.intervals?.[low.exchange] || '8h';
      const intervalMismatch = highInterval !== lowInterval;
      const highSettlementsPerDay = highInterval === '1h' ? 24 : highInterval === '4h' ? 6 : 3;
      const lowSettlementsPerDay = lowInterval === '1h' ? 24 : lowInterval === '4h' ? 6 : 3;
      // Original (non-normalized) per-settlement rates
      const highRatePerSettlement = high.rate / (highInterval === '1h' ? 8 : highInterval === '4h' ? 2 : 1);
      const lowRatePerSettlement = low.rate / (lowInterval === '1h' ? 8 : lowInterval === '4h' ? 2 : 1);
      // Daily income from shorting high-rate exchange (positive = earn)
      const shortDailyRate = highRatePerSettlement * highSettlementsPerDay;
      // Daily cost from longing low-rate exchange (negative = earn, positive = pay)
      const longDailyRate = lowRatePerSettlement * lowSettlementsPerDay;
      // Fee impact as percentage of gross spread
      const feeImpactPct = grossSpread8h > 0 ? (roundTripFee / grossSpread8h) * 100 : 100;

      // Feasibility grade with enhanced scoring
      const { grade, score: gradeScore, flags: gradeFlags } = computeGrade(grossSpread8h, minSideOI, stability, roundTripFee, {
        highOI, lowOI, highInterval, lowInterval, netAnnualized,
      });
      const maxPractical = minSideOI > 0 ? minSideOI * 0.05 : 0;

      return {
        ...item,
        sorted, high, low,
        grossSpread, grossSpread8h, netSpread, roundTripFee,
        annualized, netAnnualized, dailyPnl, monthlyPnl,
        totalOI, highOI, lowOI, minSideOI, price, highIsDex, lowIsDex,
        isCexDex: (highIsDex && !lowIsDex) || (!highIsDex && lowIsDex),
        isOutlier, isLowLiq, basis, stability, trend,
        grade, gradeScore, gradeFlags, maxPractical,
        shortDailyRate, longDailyRate,
        highInterval, lowInterval, intervalMismatch, feeImpactPct,
      };
    }).filter((item): item is NonNullable<typeof item> => item !== null);
  }, [arbitrageData, oiMap, markPrices, indexPrices, historicalSpreads, portfolio, periodScale]);

  const compareData = useMemo(() => {
    return enriched.filter(item => compareItems.has(item.symbol));
  }, [enriched, compareItems]);

  const gradeCounts = useMemo(() => {
    const counts = { A: 0, B: 0, C: 0, D: 0 };
    for (const item of enriched) counts[item.grade]++;
    return counts;
  }, [enriched]);

  // Apply filters
  const filtered = useMemo(() => {
    return enriched.filter(item => {
      if (item.grossSpread < minSpread * periodScale) return false;
      if (venueFilter === 'cex-dex' && !item.isCexDex) return false;
      if (venueFilter === 'cex-cex' && item.isCexDex) return false;
      if (exchangeFilter && !item.exchanges.some(ex => ex.exchange.toLowerCase().includes(exchangeFilter.toLowerCase()))) return false;
      if (minOI > 0 && item.totalOI < minOI) return false;
      if (hideOutliers && (item.isOutlier || item.isLowLiq)) return false;
      if (gradeFilter !== 'all' && item.grade !== gradeFilter) return false;
      return true;
    });
  }, [enriched, minSpread, venueFilter, exchangeFilter, minOI, hideOutliers, gradeFilter, periodScale]);

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
        case 'grade': cmp = a.gradeScore - b.gradeScore; break;
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

  const exportCSV = () => {
    const headers = ['Symbol', 'Grade', 'Price', 'Spread/8h', 'Net Spread/8h', 'Ann. %', 'Short Exchange', 'Short Rate', 'Long Exchange', 'Long Rate', 'Daily PnL', '30d PnL', 'OI', 'Stability', 'Trend'];
    const rows = sortedData.map(item => [
      item.symbol, item.grade,
      item.price > 0 ? item.price.toString() : '',
      item.grossSpread8h.toFixed(4),
      (item.grossSpread8h - item.roundTripFee).toFixed(4),
      item.netAnnualized.toFixed(1),
      item.high.exchange, (item.high.rate * periodScale).toFixed(4),
      item.low.exchange, (item.low.rate * periodScale).toFixed(4),
      item.dailyPnl.toFixed(2), item.monthlyPnl.toFixed(2),
      item.totalOI > 0 ? item.totalOI.toFixed(0) : '',
      item.stability || '', item.trend || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `infohub-arb-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyShareLink = () => {
    const params = new URLSearchParams();
    if (gradeFilter !== 'all') params.set('grade', gradeFilter);
    if (venueFilter !== 'all') params.set('venue', venueFilter);
    if (exchangeFilter) params.set('exchange', exchangeFilter);
    if (minSpread > 0) params.set('minSpread', String(minSpread));
    if (minOI > 0) params.set('minOI', String(minOI));
    if (!hideOutliers) params.set('hideOutliers', 'false');
    if (sortKey !== 'grade') params.set('sort', sortKey);
    if (sortAsc) params.set('sortDir', 'asc');
    const base = window.location.origin + window.location.pathname;
    const qs = params.toString();
    const url = qs ? `${base}?${qs}#arbitrage` : `${base}#arbitrage`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  // Summary stats
  const summary = useMemo(() => {
    if (enriched.length === 0) return null;
    const realistic = enriched.filter(i => !i.isOutlier && !i.isLowLiq);
    const best = realistic.length > 0
      ? realistic.reduce((a, b) => b.grossSpread > a.grossSpread ? b : a, realistic[0])
      : enriched.reduce((a, b) => b.grossSpread > a.grossSpread ? b : a, enriched[0]);
    const profitable = enriched.filter(i => i.netAnnualized > 0);
    const avgNet = profitable.length > 0 ? profitable.reduce((s, i) => s + i.netAnnualized, 0) / profitable.length : 0;
    const totalOI = enriched.reduce((s, i) => s + i.totalOI, 0);
    const aGrade = enriched.filter(i => i.grade === 'A');
    const aGradeAvg = aGrade.length > 0 ? aGrade.reduce((s, i) => s + i.netAnnualized, 0) / aGrade.length : 0;
    const topPick = aGrade.length > 0
      ? aGrade.reduce((a, b) => b.netAnnualized > a.netAnnualized ? b : a, aGrade[0])
      : enriched.filter(i => i.grade === 'B').reduce<typeof enriched[0] | null>((a, b) => !a ? b : (b.netAnnualized > a.netAnnualized ? b : a), null);
    return { count: enriched.length, profitableCount: profitable.length, best, avgNet, totalOI, aGradeAvg, aGradeCount: aGrade.length, topPick };
  }, [enriched]);

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortAsc ? <ArrowUp className="w-3 h-3 text-hub-yellow" /> : <ArrowDown className="w-3 h-3 text-hub-yellow" />;
  };

  const hasOI = oiMap && oiMap.size > 0;

  return (
    <div className={`space-y-3 ${compareMode && compareData.length > 0 ? 'pb-80' : ''}`}>
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <div className="bg-hub-darker border border-white/[0.06] rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Activity className="w-3.5 h-3.5 text-hub-yellow" />
              <span className="text-neutral-500 text-[10px] uppercase tracking-wider">Opportunities</span>
            </div>
            <div className="text-white text-lg font-bold font-mono">{summary.count}</div>
            <div className="text-neutral-600 text-[10px]">
              <span className="text-green-400">{gradeCounts.A}A</span>{' \u00b7 '}
              <span className="text-blue-400">{gradeCounts.B}B</span>{' \u00b7 '}
              <span className="text-amber-400">{gradeCounts.C}C</span>{' \u00b7 '}
              <span className="text-red-400">{gradeCounts.D}D</span>
            </div>
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
            <div className={`text-lg font-bold font-mono ${(summary.aGradeCount > 0 ? summary.aGradeAvg : summary.avgNet) > 0 ? 'text-green-400' : 'text-neutral-500'}`}>
              {(summary.aGradeCount > 0 ? summary.aGradeAvg : summary.avgNet) > 0 ? '+' : ''}{(summary.aGradeCount > 0 ? summary.aGradeAvg : summary.avgNet).toFixed(1)}%
            </div>
            <div className="text-neutral-600 text-[10px]">
              {summary.aGradeCount > 0 ? `A-grade avg (${summary.aGradeCount} opps)` : `across ${summary.profitableCount} profitable`}
            </div>
          </div>
          <div className="bg-hub-darker border border-white/[0.06] rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-neutral-500 text-[10px] uppercase tracking-wider">Total OI</span>
            </div>
            <div className="text-white text-lg font-bold font-mono">{summary.totalOI > 0 ? formatUSD(summary.totalOI) : '-'}</div>
            <div className="text-neutral-600 text-[10px]">addressable liquidity</div>
          </div>
          <div className="bg-hub-darker border border-green-500/20 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Shield className="w-3.5 h-3.5 text-green-400" />
              <span className="text-neutral-500 text-[10px] uppercase tracking-wider">Top Pick</span>
            </div>
            {summary.topPick ? (
              <>
                <div className="flex items-center gap-1.5">
                  <TokenIconSimple symbol={summary.topPick.symbol} size={16} />
                  <span className="text-white text-sm font-bold">{summary.topPick.symbol}</span>
                  <span className={`px-1 py-0.5 rounded text-[8px] font-bold border ${GRADE_COLORS[summary.topPick.grade]}`}>{summary.topPick.grade}</span>
                </div>
                <div className="text-green-400 font-mono text-xs mt-0.5">+{summary.topPick.netAnnualized.toFixed(1)}% ann.</div>
                <div className="text-neutral-600 text-[10px]">{summary.topPick.high.exchange} / {summary.topPick.low.exchange}</div>
              </>
            ) : (
              <div className="text-neutral-600 text-sm">-</div>
            )}
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
            <button onClick={exportCSV} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-neutral-500 hover:text-white bg-white/[0.04] transition-colors">
              <Download className="w-3 h-3" /> Export
            </button>
            <button onClick={copyShareLink} className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${linkCopied ? 'bg-green-500/20 text-green-400' : 'text-neutral-500 hover:text-white bg-white/[0.04]'}`}>
              {linkCopied ? <Check className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
              {linkCopied ? 'Copied!' : 'Share'}
            </button>
            <button
              onClick={() => { setCompareMode(!compareMode); if (compareMode) setCompareItems(new Set()); }}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${compareMode ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/20' : 'text-neutral-500 hover:text-white bg-white/[0.04]'}`}
            >
              <GitCompareArrows className="w-3 h-3" />
              Compare {compareItems.size > 0 && `(${compareItems.size})`}
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
            <button
              onClick={() => { setHideOutliers(!hideOutliers); setCurrentPage(1); }}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${hideOutliers ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/20' : 'text-neutral-600 bg-white/[0.04]'}`}
            >
              <AlertTriangle className="w-3 h-3" />
              Hide Outliers
            </button>
          </div>
        )}

        {/* Grade Filter Tabs */}
        <div className="px-4 py-2 border-b border-white/[0.06] flex items-center gap-1.5">
          <span className="text-neutral-500 text-[10px] mr-1">Grade:</span>
          {(['all', 'A', 'B', 'C', 'D'] as const).map(g => {
            const count = g === 'all' ? enriched.length : gradeCounts[g];
            const isActive = gradeFilter === g;
            const colors = g === 'all' ? (isActive ? 'bg-hub-yellow text-black' : 'text-neutral-500 bg-white/[0.04]')
              : isActive ? GRADE_COLORS[g] + ' ring-1' : 'text-neutral-600 bg-white/[0.04]';
            return (
              <button
                key={g}
                onClick={() => { setGradeFilter(g); setCurrentPage(1); }}
                className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${colors}`}
              >
                {g === 'all' ? 'All' : g} <span className="opacity-60">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Table — Desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500 w-8">#</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500 cursor-pointer hover:text-white" onClick={() => handleSort('symbol')}>
                  <div className="flex items-center gap-1">Symbol <SortIcon k="symbol" /></div>
                </th>
                <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-neutral-500 cursor-pointer hover:text-white" onClick={() => handleSort('grade')}>
                  <div className="flex items-center gap-1 justify-center">Grade <SortIcon k="grade" /></div>
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
                    <div className="flex items-center gap-1 justify-end">OI (S/L) <SortIcon k="oi" /></div>
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
                        {compareMode ? (
                          <input
                            type="checkbox"
                            checked={compareItems.has(item.symbol)}
                            onChange={() => toggleCompare(item.symbol)}
                            onClick={e => e.stopPropagation()}
                            className="w-3 h-3 accent-blue-400"
                          />
                        ) : (
                          expandedRow === item.symbol ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
                        )}
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
                    <td className="px-3 py-2 text-center">
                      <GradeBadge grade={item.grade} isOutlier={item.isOutlier} isLowLiq={item.isLowLiq} score={item.gradeScore} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div>
                        <span className="text-neutral-400 font-mono text-xs">
                          {item.price > 0 ? formatPrice(item.price) : '-'}
                        </span>
                        {item.basis !== null && (
                          <div className={`font-mono text-[9px] ${item.basis > 0 ? 'text-green-400' : item.basis < 0 ? 'text-red-400' : 'text-neutral-600'}`} title="Mark vs Index basis">
                            {item.basis > 0 ? '+' : ''}{item.basis.toFixed(3)}%
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div>
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-hub-yellow font-bold font-mono text-sm">{item.grossSpread.toFixed(4)}%</span>
                          {item.trend === 'widening' && <span title="Spread widening (last 24h > prior 6d)"><TrendingUp className="w-3 h-3 text-green-400" /></span>}
                          {item.trend === 'narrowing' && <span title="Spread narrowing (last 24h < prior 6d)"><TrendingDown className="w-3 h-3 text-red-400" /></span>}
                        </div>
                        <div className="flex items-center justify-end gap-1.5 text-[10px]">
                          {item.netSpread < item.grossSpread && (
                            <span className="text-neutral-600 font-mono" title={`Round-trip fees: ${item.roundTripFee.toFixed(3)}%`}>net {item.netSpread.toFixed(4)}%</span>
                          )}
                          {item.stability === 'stable' && <span className="text-green-400/70">Stable</span>}
                          {item.stability === 'volatile' && <span className="text-amber-400/70">Volatile</span>}
                          {item.stability === 'new' && <span className="text-neutral-600">New</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={`font-mono text-xs font-semibold ${item.netAnnualized > 0 ? 'text-green-400' : 'text-neutral-500'}`}>
                        {item.netAnnualized > 0 ? '+' : ''}{item.netAnnualized.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <ExchangeSide exchange={item.high.exchange} rate={item.high.rate} symbol={item.symbol} periodScale={periodScale} item={item} intervalMap={intervalMap} side="short" />
                      {item.intervalMismatch && (
                        <div className="text-amber-400/60 text-[8px] font-mono mt-0.5" title="Funding intervals differ between exchanges — settlement timing risk">
                          ⚠ {item.highInterval} interval
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <ExchangeSide exchange={item.low.exchange} rate={item.low.rate} symbol={item.symbol} periodScale={periodScale} item={item} intervalMap={intervalMap} side="long" />
                      {item.intervalMismatch && (
                        <div className="text-amber-400/60 text-[8px] font-mono mt-0.5" title="Funding intervals differ between exchanges — settlement timing risk">
                          ⚠ {item.lowInterval} interval
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div>
                        <span className={`font-mono text-xs font-semibold ${item.dailyPnl > 0 ? 'text-green-400' : 'text-neutral-500'}`}>
                          {formatPnl(item.dailyPnl)}
                        </span>
                        {item.feeImpactPct > 30 && (
                          <div className="text-[8px] text-red-400/60 font-mono" title={`Fees consume ${item.feeImpactPct.toFixed(0)}% of gross spread`}>
                            {item.feeImpactPct.toFixed(0)}% fees
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={`font-mono text-xs ${item.monthlyPnl > 0 ? 'text-green-400' : 'text-neutral-500'}`}>
                        {formatPnl(item.monthlyPnl)}
                      </span>
                    </td>
                    {hasOI && (
                      <td className="px-3 py-2 text-right">
                        {item.highOI > 0 || item.lowOI > 0 ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-neutral-600 text-[9px]">S</span>
                              <span className={`font-mono text-[11px] ${item.highOI < 100_000 ? 'text-red-400' : item.highOI < 500_000 ? 'text-amber-400' : 'text-neutral-300'}`}>
                                {formatUSD(item.highOI)}
                              </span>
                            </div>
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-neutral-600 text-[9px]">L</span>
                              <span className={`font-mono text-[11px] ${item.lowOI < 100_000 ? 'text-red-400' : item.lowOI < 500_000 ? 'text-amber-400' : 'text-neutral-300'}`}>
                                {formatUSD(item.lowOI)}
                              </span>
                            </div>
                            {/* OI imbalance warning */}
                            {item.highOI > 0 && item.lowOI > 0 && Math.min(item.highOI, item.lowOI) / Math.max(item.highOI, item.lowOI) < 0.1 && (
                              <div className="text-[8px] text-red-400/60" title="OI heavily imbalanced — rate on thin side may shift quickly">⚠ imbalanced</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-neutral-600 font-mono text-xs">-</span>
                        )}
                      </td>
                    )}
                  </tr>
                  {/* Expanded Detail Panel */}
                  {expandedRow === item.symbol && (
                    <tr key={`${item.symbol}-expanded`}>
                      <td colSpan={hasOI ? 11 : 10} className="px-4 py-3 bg-white/[0.01] border-b border-white/[0.06]">
                        <ExpandedPanel item={item} periodScale={periodScale} intervalMap={intervalMap} oiMap={oiMap} />
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
          {pageData.map((item) => (
            <div key={item.symbol}>
              <div
                className="px-3 py-3 cursor-pointer active:bg-white/[0.02]"
                onClick={() => setExpandedRow(expandedRow === item.symbol ? null : item.symbol)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <GradeBadge grade={item.grade} isOutlier={item.isOutlier} isLowLiq={item.isLowLiq} score={item.gradeScore} />
                    <TokenIconSimple symbol={item.symbol} size={18} />
                    <span className="text-white font-semibold text-sm">{item.symbol}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {item.trend === 'widening' && <TrendingUp className="w-3 h-3 text-green-400" />}
                    {item.trend === 'narrowing' && <TrendingDown className="w-3 h-3 text-red-400" />}
                    <div className="text-right">
                      <div className="text-hub-yellow font-bold font-mono text-sm">{item.grossSpread.toFixed(4)}%</div>
                      {item.netSpread < item.grossSpread && (
                        <div className="text-neutral-600 font-mono text-[9px]">net {item.netSpread.toFixed(4)}%</div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-neutral-600 text-[9px] mb-0.5">Short side</div>
                    <div className="flex items-center gap-1">
                      <ExchangeLogo exchange={item.high.exchange.toLowerCase()} size={12} />
                      <span className="text-neutral-300 text-[11px]">{item.high.exchange}</span>
                      <span className="text-red-400 font-mono text-[11px] ml-auto">{formatRateAdaptive(item.high.rate * periodScale)}</span>
                    </div>
                    {item.highOI > 0 && (
                      <div className={`font-mono text-[9px] mt-0.5 ${item.highOI < 100_000 ? 'text-red-400' : 'text-neutral-600'}`}>OI: {formatUSD(item.highOI)}</div>
                    )}
                  </div>
                  <div>
                    <div className="text-neutral-600 text-[9px] mb-0.5">Long side</div>
                    <div className="flex items-center gap-1">
                      <ExchangeLogo exchange={item.low.exchange.toLowerCase()} size={12} />
                      <span className="text-neutral-300 text-[11px]">{item.low.exchange}</span>
                      <span className="text-green-400 font-mono text-[11px] ml-auto">{formatRateAdaptive(item.low.rate * periodScale)}</span>
                    </div>
                    {item.lowOI > 0 && (
                      <div className={`font-mono text-[9px] mt-0.5 ${item.lowOI < 100_000 ? 'text-red-400' : 'text-neutral-600'}`}>OI: {formatUSD(item.lowOI)}</div>
                    )}
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
                {/* Accuracy warnings */}
                {(item.intervalMismatch || item.feeImpactPct > 30) && (
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {item.intervalMismatch && (
                      <span className="text-amber-400/60 text-[8px] font-mono">⚠ {item.highInterval}/{item.lowInterval} mismatch</span>
                    )}
                    {item.feeImpactPct > 30 && (
                      <span className="text-red-400/60 text-[8px] font-mono">⚠ {item.feeImpactPct.toFixed(0)}% fees</span>
                    )}
                  </div>
                )}
              </div>
              {expandedRow === item.symbol && (
                <div className="px-3 pb-3">
                  <ExpandedPanel item={item} periodScale={periodScale} intervalMap={intervalMap} oiMap={oiMap} />
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
      {compareMode && compareData.length > 0 && (
        <ComparisonDrawer
          items={compareData}
          periodScale={periodScale}
          onClear={() => { setCompareMode(false); setCompareItems(new Set()); }}
        />
      )}
    </div>
  );
}
