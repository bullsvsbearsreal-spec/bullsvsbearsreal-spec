'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { TokenIconSimple } from '@/components/TokenIcon';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import {
  ArrowUpDown, ArrowUp, ArrowDown, Search, X, Filter,
  ArrowRightLeft, AlertTriangle, Clock, Wifi, WifiOff,
  ChevronDown, ChevronUp, Info, Zap, Calculator, DollarSign,
} from 'lucide-react';
import Pagination from './Pagination';
import { getExchangeTradeUrl, EXCHANGE_FEES } from '@/lib/constants';
import {
  getSpotTakerFee, getWithdrawalInfo, getVolumeLevel,
  SPOT_TAKER_FEES, type WithdrawalInfo, type VolumeLevel,
} from '@/lib/spot-withdrawal-fees';
import type { SpotPriceEntry, CurrencyStatusMap } from '@/lib/api/aggregator';

const ROWS_PER_PAGE = 40;
const AUTO_REFRESH_MS = 30_000;

// Exchanges that have public deposit/withdrawal status APIs
const STATUS_EXCHANGES = new Set(['OKX', 'KuCoin', 'Gate.io']);

interface SpotArbEntry {
  symbol: string;
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  spreadPct: number;
  netSpreadPct: number;    // spread minus trading fees
  netAfterWdPct: number;   // net spread minus withdrawal fee
  netAfterWdUsd: number;   // net profit in USD after all costs
  buyFee: number;          // buy exchange taker fee %
  sellFee: number;         // sell exchange taker fee %
  withdrawal: WithdrawalInfo;
  avgVolume: number;
  volumeLevel: VolumeLevel;
  exchangeCount: number;
  allPrices: { exchange: string; price: number; volume24h: number }[];
}

interface SpotArbitrageViewProps {
  spotPrices: SpotPriceEntry[];
  onRefresh?: () => void;
  currencyStatus?: CurrencyStatusMap;
}

/** Tiny dot indicator for deposit/withdrawal status */
function StatusDot({ canDo, label }: { canDo: boolean | undefined; label: string }) {
  if (canDo === undefined) return null;
  return (
    <span
      title={`${label}: ${canDo ? 'Open' : 'Suspended'}`}
      className={`inline-block w-1.5 h-1.5 rounded-full ${canDo ? 'bg-green-500' : 'bg-red-500'}`}
    />
  );
}

/** Get deposit/withdrawal status for an exchange+symbol pair */
function getStatus(currencyStatus: CurrencyStatusMap | undefined, exchange: string, symbol: string) {
  if (!currencyStatus) return { canDeposit: undefined as boolean | undefined, canWithdraw: undefined as boolean | undefined, hasStatus: false };
  const key = `${exchange}:${symbol}`;
  const status = currencyStatus[key];
  return {
    canDeposit: status?.canDeposit,
    canWithdraw: status?.canWithdraw,
    hasStatus: !!status,
  };
}

type SortKey = 'spreadPct' | 'netAfterWdPct' | 'symbol' | 'avgVolume' | 'exchangeCount';

function formatPrice(price: number): string {
  if (price >= 10000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(6)}`;
}

function formatVolume(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export default function SpotArbitrageView({ spotPrices, onRefresh, currencyStatus }: SpotArbitrageViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>('netAfterWdPct');
  const [sortAsc, setSortAsc] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [minVolume, setMinVolume] = useState(false);
  const [minSpread, setMinSpread] = useState<'all' | '0.1' | '0.5' | '1'>('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [tradeSize, setTradeSize] = useState(1000);
  const [showSimulator, setShowSimulator] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [flashKeys, setFlashKeys] = useState<Set<string>>(new Set());
  const prevPricesRef = useRef<Map<string, number>>(new Map());
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !onRefresh) return;
    refreshTimerRef.current = setInterval(() => {
      onRefresh();
      setLastRefresh(Date.now());
    }, AUTO_REFRESH_MS);
    return () => { if (refreshTimerRef.current) clearInterval(refreshTimerRef.current); };
  }, [autoRefresh, onRefresh]);

  // Flash animation on price changes
  useEffect(() => {
    const newFlash = new Set<string>();
    const prevMap = prevPricesRef.current;

    for (const sp of spotPrices) {
      const key = `${sp.symbol}-${sp.exchange}`;
      const prev = prevMap.get(key);
      if (prev !== undefined && prev !== sp.price) {
        newFlash.add(sp.symbol);
      }
      prevMap.set(key, sp.price);
    }

    if (newFlash.size > 0) {
      setFlashKeys(newFlash);
      const timer = setTimeout(() => setFlashKeys(new Set()), 1500);
      return () => clearTimeout(timer);
    }
  }, [spotPrices]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(key === 'symbol'); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-neutral-600" />;
    return sortAsc ? <ArrowUp className="w-3 h-3 text-hub-yellow" /> : <ArrowDown className="w-3 h-3 text-hub-yellow" />;
  };

  // Build spot arb entries with withdrawal fees and volume warnings
  const entries = useMemo<SpotArbEntry[]>(() => {
    const symbolMap = new Map<string, { exchange: string; price: number; volume24h: number }[]>();
    for (const sp of spotPrices) {
      if (!sp.price || !isFinite(sp.price) || sp.price <= 0) continue;
      if (!symbolMap.has(sp.symbol)) symbolMap.set(sp.symbol, []);
      const existing = symbolMap.get(sp.symbol)!;
      if (!existing.some(e => e.exchange === sp.exchange)) {
        existing.push({ exchange: sp.exchange, price: sp.price, volume24h: sp.volume24h || 0 });
      }
    }

    const result: SpotArbEntry[] = [];
    symbolMap.forEach((prices, symbol) => {
      if (prices.length < 2) return;

      // Denomination mismatch filter
      const sortedPrices = prices.map(p => p.price).sort((a, b) => a - b);
      const median = sortedPrices[Math.floor(sortedPrices.length / 2)];
      const filtered = prices.filter(p => {
        const ratio = p.price > median ? p.price / median : median / p.price;
        return ratio <= 3;
      });
      if (filtered.length < 2) return;

      let minIdx = 0, maxIdx = 0;
      for (let i = 1; i < filtered.length; i++) {
        if (filtered[i].price < filtered[minIdx].price) minIdx = i;
        if (filtered[i].price > filtered[maxIdx].price) maxIdx = i;
      }

      const buyPrice = filtered[minIdx].price;
      const sellPrice = filtered[maxIdx].price;
      const spreadPct = ((sellPrice - buyPrice) / buyPrice) * 100;

      if (spreadPct < 0.005 || spreadPct > 20) return;
      if (minIdx === maxIdx) return;

      // Per-exchange spot fees
      const buyFee = getSpotTakerFee(filtered[minIdx].exchange);
      const sellFee = getSpotTakerFee(filtered[maxIdx].exchange);
      const netSpreadPct = spreadPct - buyFee - sellFee;

      // Withdrawal info
      const withdrawal = getWithdrawalInfo(symbol);
      const tradeSize = 1000; // $1000 reference size for USD calculations
      const wdFeePct = (withdrawal.feeUsd / tradeSize) * 100;
      const netAfterWdPct = netSpreadPct - wdFeePct;
      const netAfterWdUsd = (netAfterWdPct / 100) * tradeSize;

      // Volume
      let totalVol = 0, volCount = 0;
      for (const p of filtered) {
        if (p.volume24h > 0) { totalVol += p.volume24h; volCount++; }
      }
      const avgVolume = volCount > 0 ? totalVol / volCount : 0;

      const allSorted = [...filtered].sort((a, b) => a.price - b.price);

      result.push({
        symbol,
        buyExchange: filtered[minIdx].exchange,
        sellExchange: filtered[maxIdx].exchange,
        buyPrice, sellPrice,
        spreadPct, netSpreadPct, netAfterWdPct, netAfterWdUsd,
        buyFee, sellFee,
        withdrawal,
        avgVolume,
        volumeLevel: getVolumeLevel(avgVolume),
        exchangeCount: filtered.length,
        allPrices: allSorted,
      });
    });
    return result;
  }, [spotPrices]);

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
    if (minVolume) items = items.filter(e => e.avgVolume >= 100_000);
    if (minSpread === '0.1') items = items.filter(e => e.spreadPct >= 0.1);
    else if (minSpread === '0.5') items = items.filter(e => e.spreadPct >= 0.5);
    else if (minSpread === '1') items = items.filter(e => e.spreadPct >= 1);
    return items;
  }, [entries, search, minVolume, minSpread]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let diff = 0;
      switch (sortKey) {
        case 'spreadPct': diff = a.spreadPct - b.spreadPct; break;
        case 'netAfterWdPct': diff = a.netAfterWdPct - b.netAfterWdPct; break;
        case 'symbol': diff = a.symbol.localeCompare(b.symbol); break;
        case 'avgVolume': diff = a.avgVolume - b.avgVolume; break;
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
  const profitableCount = entries.filter(e => e.netAfterWdPct > 0).length;

  const spreadColor = (pct: number) => {
    if (pct >= 1) return 'text-green-400';
    if (pct >= 0.5) return 'text-green-400/80';
    if (pct >= 0.1) return 'text-emerald-400/70';
    return 'text-neutral-400';
  };

  const volumeIcon = (level: VolumeLevel) => {
    if (level === 'danger') return <AlertTriangle className="w-3 h-3 text-red-400" />;
    if (level === 'warning') return <AlertTriangle className="w-3 h-3 text-yellow-400" />;
    if (level === 'caution') return <Info className="w-3 h-3 text-neutral-500" />;
    return null;
  };

  const volumeTooltip = (level: VolumeLevel) => {
    if (level === 'danger') return 'Very low liquidity — high slippage risk';
    if (level === 'warning') return 'Low liquidity — may not fill at displayed price';
    if (level === 'caution') return 'Moderate liquidity';
    return '';
  };

  /** Calculate profit breakdown for a given trade size */
  const calcProfit = useCallback((entry: SpotArbEntry, size: number) => {
    const buyTotal = size; // spend this much buying
    const buyFeeUsd = buyTotal * (entry.buyFee / 100);
    const coinsBought = (buyTotal - buyFeeUsd) / entry.buyPrice;
    const wdFeeCoins = entry.withdrawal.feeUsd / entry.buyPrice; // approximate WD fee in coins
    const coinsArrived = Math.max(0, coinsBought - wdFeeCoins);
    const sellRevenue = coinsArrived * entry.sellPrice;
    const sellFeeUsd = sellRevenue * (entry.sellFee / 100);
    const netRevenue = sellRevenue - sellFeeUsd;
    const netProfit = netRevenue - buyTotal;
    const netProfitPct = (netProfit / buyTotal) * 100;
    return { buyTotal, buyFeeUsd, coinsBought, wdFeeCoins, coinsArrived, sellRevenue, sellFeeUsd, netRevenue, netProfit, netProfitPct };
  }, []);

  const TRADE_PRESETS = [100, 250, 500, 1000, 2500, 5000, 10000];

  const secondsAgo = Math.floor((Date.now() - lastRefresh) / 1000);

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
          <span className="text-[10px] text-green-400/70 uppercase tracking-wider font-semibold">Max</span>
          <span className="text-sm font-bold text-green-400 font-mono">{maxSpread.toFixed(3)}%</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)' }}>
          <span className="text-[10px] text-green-400/70 uppercase tracking-wider font-semibold">&gt;1%</span>
          <span className="text-sm font-bold text-green-400 font-mono">{above1Pct}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: profitableCount > 0 ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.03)', border: `1px solid ${profitableCount > 0 ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.06)'}` }}>
          <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Profitable</span>
          <span className={`text-sm font-bold font-mono ${profitableCount > 0 ? 'text-green-400' : 'text-neutral-500'}`}>{profitableCount}</span>
        </div>
        {/* Auto-refresh toggle */}
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[10px] font-semibold transition-all ml-auto ${
            autoRefresh
              ? 'text-green-400/80 ring-1 ring-green-400/20'
              : 'text-neutral-600 ring-1 ring-white/[0.06]'
          }`}
          style={{ background: autoRefresh ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.02)' }}
          title={autoRefresh ? 'Auto-refresh ON (30s)' : 'Auto-refresh OFF'}
        >
          {autoRefresh ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          <span className="hidden sm:inline">{autoRefresh ? 'LIVE' : 'PAUSED'}</span>
        </button>
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
              {f === 'all' ? 'All' : `\u2265${f}%`}
            </button>
          ))}
        </div>
        <button
          onClick={() => { setMinVolume(!minVolume); setCurrentPage(1); }}
          className={`flex items-center gap-1.5 px-3 py-[7px] rounded-lg text-[11px] font-semibold transition-all duration-200 ring-1 ${
            minVolume
              ? 'bg-hub-yellow/10 text-hub-yellow ring-hub-yellow/30'
              : 'text-neutral-500 hover:text-neutral-300 ring-white/[0.06] hover:bg-white/[0.04]'
          }`}
        >
          <Filter className="w-3 h-3" />
          $100K+ Vol
        </button>
        {(search || minSpread !== 'all' || minVolume) && (
          <span className="text-[10px] text-neutral-600 font-mono">
            {filtered.length}{search || minVolume || minSpread !== 'all' ? `/${entries.length}` : ''} results
          </span>
        )}
      </div>

      {/* Profit Simulator */}
      <div className="rounded-lg overflow-hidden" style={{ background: 'rgba(255,165,0,0.03)', border: '1px solid rgba(255,165,0,0.10)' }}>
        <button
          onClick={() => setShowSimulator(!showSimulator)}
          className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2">
            <Calculator className="w-3.5 h-3.5 text-hub-yellow" />
            <span className="text-[11px] font-semibold text-hub-yellow/90 uppercase tracking-wider">Profit Simulator</span>
            <span className="text-[10px] text-neutral-500 font-mono">${tradeSize.toLocaleString()}</span>
          </div>
          {showSimulator ? <ChevronUp className="w-3.5 h-3.5 text-neutral-500" /> : <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />}
        </button>
        {showSimulator && (
          <div className="px-3 pb-3 space-y-2.5 border-t border-white/[0.04]">
            <div className="pt-2.5 flex items-center gap-3">
              <DollarSign className="w-3.5 h-3.5 text-neutral-500 flex-shrink-0" />
              <input
                type="range"
                min={50}
                max={50000}
                step={50}
                value={tradeSize}
                onChange={e => setTradeSize(Number(e.target.value))}
                className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                style={{ background: `linear-gradient(to right, rgba(255,165,0,0.5) ${((tradeSize - 50) / (50000 - 50)) * 100}%, rgba(255,255,255,0.08) ${((tradeSize - 50) / (50000 - 50)) * 100}%)` }}
              />
              <input
                type="number"
                value={tradeSize}
                onChange={e => { const v = Number(e.target.value); if (v >= 1 && v <= 1000000) setTradeSize(v); }}
                className="w-20 px-2 py-1 rounded text-[12px] text-white font-mono text-right outline-none focus:ring-1 focus:ring-hub-yellow/40"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TRADE_PRESETS.map(p => (
                <button
                  key={p}
                  onClick={() => setTradeSize(p)}
                  className={`px-2.5 py-1 rounded text-[10px] font-semibold font-mono transition-all ${
                    tradeSize === p
                      ? 'bg-hub-yellow text-black'
                      : 'text-neutral-500 hover:text-white hover:bg-white/[0.06]'
                  }`}
                  style={tradeSize !== p ? { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' } : {}}
                >
                  ${p >= 1000 ? `${p / 1000}K` : p}
                </button>
              ))}
            </div>
            <p className="text-[9px] text-neutral-600">
              All Net profit/loss values below update to reflect your trade size. Expand any row for a step-by-step breakdown.
            </p>
          </div>
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-[12px]" style={{ borderCollapse: 'separate', borderSpacing: '0 2px' }}>
          <thead>
            <tr>
              <th className="text-left px-3 py-2 text-neutral-500 font-semibold text-[10px] uppercase tracking-wider">
                <button onClick={() => handleSort('symbol')} className="flex items-center gap-1 hover:text-white transition-colors">
                  Symbol <SortIcon col="symbol" />
                </button>
              </th>
              <th className="text-left px-3 py-2 text-neutral-500 font-semibold text-[10px] uppercase tracking-wider">Buy on</th>
              <th className="text-right px-3 py-2 text-neutral-500 font-semibold text-[10px] uppercase tracking-wider hidden lg:table-cell">Buy Price</th>
              <th className="text-center px-3 py-2 text-neutral-500 font-semibold text-[10px] uppercase tracking-wider w-8"><ArrowRightLeft className="w-3 h-3 mx-auto text-neutral-600" /></th>
              <th className="text-left px-3 py-2 text-neutral-500 font-semibold text-[10px] uppercase tracking-wider">Sell on</th>
              <th className="text-right px-3 py-2 text-neutral-500 font-semibold text-[10px] uppercase tracking-wider hidden lg:table-cell">Sell Price</th>
              <th className="text-right px-3 py-2 text-neutral-500 font-semibold text-[10px] uppercase tracking-wider">
                <button onClick={() => handleSort('spreadPct')} className="flex items-center gap-1 hover:text-white transition-colors ml-auto">
                  Spread <SortIcon col="spreadPct" />
                </button>
              </th>
              <th className="text-right px-3 py-2 text-neutral-500 font-semibold text-[10px] uppercase tracking-wider">
                <button onClick={() => handleSort('netAfterWdPct')} className="flex items-center gap-1 hover:text-white transition-colors ml-auto">
                  Net <SortIcon col="netAfterWdPct" />
                </button>
              </th>
              <th className="text-center px-3 py-2 text-neutral-500 font-semibold text-[10px] uppercase tracking-wider hidden md:table-cell">
                Network
              </th>
              <th className="text-right px-3 py-2 text-neutral-500 font-semibold text-[10px] uppercase tracking-wider">
                <button onClick={() => handleSort('avgVolume')} className="flex items-center gap-1 hover:text-white transition-colors ml-auto">
                  Vol <SortIcon col="avgVolume" />
                </button>
              </th>
              <th className="text-center px-3 py-2 text-neutral-500 font-semibold text-[10px] uppercase tracking-wider hidden md:table-cell w-8">
                <button onClick={() => handleSort('exchangeCount')} className="flex items-center gap-1 hover:text-white transition-colors">
                  <SortIcon col="exchangeCount" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((entry, idx) => {
              const buyUrl = getExchangeTradeUrl(entry.buyExchange, entry.symbol);
              const sellUrl = getExchangeTradeUrl(entry.sellExchange, entry.symbol);
              const isFlashing = flashKeys.has(entry.symbol);
              return (
                <React.Fragment key={`${entry.symbol}-${idx}`}>
                <tr
                  className={`group transition-all hover:bg-white/[0.02] ${isFlashing ? 'animate-flash' : ''}`}
                >
                  <td className="px-3 py-2.5">
                    <a href={`/funding/${entry.symbol}`} className="flex items-center gap-2 no-underline">
                      <TokenIconSimple symbol={entry.symbol} size={20} />
                      <span className="font-bold text-white group-hover:text-hub-yellow transition-colors">{entry.symbol}</span>
                    </a>
                  </td>
                  <td className="px-3 py-2.5">
                    {(() => { const s = getStatus(currencyStatus, entry.buyExchange, entry.symbol); return (
                    <a href={buyUrl || '#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 no-underline">
                      <ExchangeLogo exchange={entry.buyExchange.toLowerCase()} size={16} />
                      <div className="min-w-0 flex items-center gap-1">
                        <span className="text-neutral-300 group-hover:text-white transition-colors text-[12px]">{entry.buyExchange}</span>
                        <span className="text-[9px] text-neutral-600">{entry.buyFee.toFixed(2)}%</span>
                        {s.hasStatus && <StatusDot canDo={s.canWithdraw} label="Withdraw" />}
                      </div>
                    </a>
                    ); })()}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-neutral-500 hidden lg:table-cell">
                    {formatPrice(entry.buyPrice)}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <ArrowRightLeft className="w-3 h-3 text-neutral-700" />
                      <span className="text-[8px] text-neutral-600">{entry.withdrawal.confirmMins}m</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    {(() => { const s = getStatus(currencyStatus, entry.sellExchange, entry.symbol); return (
                    <a href={sellUrl || '#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 no-underline">
                      <ExchangeLogo exchange={entry.sellExchange.toLowerCase()} size={16} />
                      <div className="min-w-0 flex items-center gap-1">
                        <span className="text-neutral-300 group-hover:text-white transition-colors text-[12px]">{entry.sellExchange}</span>
                        <span className="text-[9px] text-neutral-600">{entry.sellFee.toFixed(2)}%</span>
                        {s.hasStatus && <StatusDot canDo={s.canDeposit} label="Deposit" />}
                      </div>
                    </a>
                    ); })()}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-neutral-400 hidden lg:table-cell">
                    {formatPrice(entry.sellPrice)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={`font-mono tabular-nums font-bold ${spreadColor(entry.spreadPct)}`}>
                      +{entry.spreadPct.toFixed(3)}%
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {(() => { const sim = calcProfit(entry, tradeSize); return (
                    <div className="flex flex-col items-end">
                      <span className={`font-mono tabular-nums font-bold ${sim.netProfitPct > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {sim.netProfitPct > 0 ? '+' : ''}{sim.netProfitPct.toFixed(3)}%
                      </span>
                      <span className={`text-[9px] font-mono ${sim.netProfit > 0 ? 'text-green-400/60' : 'text-red-400/60'}`}>
                        {sim.netProfit > 0 ? '+' : ''}${sim.netProfit.toFixed(2)}
                      </span>
                    </div>
                    ); })()}
                  </td>
                  <td className="px-3 py-2.5 text-center hidden md:table-cell">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[10px] text-neutral-400">{entry.withdrawal.network}</span>
                      <span className="text-[9px] text-neutral-600">${entry.withdrawal.feeUsd.toFixed(2)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      {volumeIcon(entry.volumeLevel)}
                      <span className={`font-mono tabular-nums ${entry.volumeLevel === 'danger' ? 'text-red-400' : entry.volumeLevel === 'warning' ? 'text-yellow-400' : 'text-neutral-500'}`}
                        title={volumeTooltip(entry.volumeLevel)}>
                        {entry.avgVolume > 0 ? formatVolume(entry.avgVolume) : '-'}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center font-mono tabular-nums text-neutral-500 hidden md:table-cell">
                    <button
                      onClick={() => setExpandedRow(expandedRow === entry.symbol ? null : entry.symbol)}
                      className="hover:text-hub-yellow transition-colors cursor-pointer flex items-center gap-0.5 mx-auto"
                      title="Show all exchange prices and fee details"
                    >
                      {entry.exchangeCount}
                      {expandedRow === entry.symbol ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </td>
                </tr>
                {expandedRow === entry.symbol && (
                  <tr>
                    <td colSpan={11} className="px-3 pb-3 pt-0">
                      <div className="rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        {/* Profit Simulator Breakdown */}
                        {(() => { const sim = calcProfit(entry, tradeSize); return (
                        <div className="border-b border-white/[0.04]">
                          <div className="px-3 py-2 flex items-center gap-2 border-b border-white/[0.04]">
                            <Calculator className="w-3 h-3 text-hub-yellow" />
                            <span className="text-[10px] text-hub-yellow/80 font-semibold uppercase tracking-wider">Profit Simulator — ${tradeSize.toLocaleString()} Trade</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-px" style={{ background: 'rgba(255,255,255,0.03)' }}>
                            {[
                              { label: '1. Buy on ' + entry.buyExchange, value: `$${sim.buyTotal.toFixed(2)}`, sub: `${sim.coinsBought.toFixed(6)} ${entry.symbol}`, color: 'text-white' },
                              { label: '2. Buy Fee (' + entry.buyFee.toFixed(2) + '%)', value: `-$${sim.buyFeeUsd.toFixed(2)}`, sub: entry.buyExchange, color: 'text-red-400' },
                              { label: '3. Withdraw via ' + entry.withdrawal.network, value: `-$${entry.withdrawal.feeUsd.toFixed(2)}`, sub: `~${entry.withdrawal.confirmMins}min`, color: 'text-red-400' },
                              { label: '4. Coins Arrive', value: `${sim.coinsArrived.toFixed(6)}`, sub: `${entry.symbol} on ${entry.sellExchange}`, color: 'text-white' },
                              { label: '5. Sell Revenue', value: `$${sim.sellRevenue.toFixed(2)}`, sub: `@ ${formatPrice(entry.sellPrice)}`, color: 'text-white' },
                              { label: '6. Sell Fee (' + entry.sellFee.toFixed(2) + '%)', value: `-$${sim.sellFeeUsd.toFixed(2)}`, sub: entry.sellExchange, color: 'text-red-400' },
                              { label: '7. Net Profit', value: `${sim.netProfit > 0 ? '+' : ''}$${sim.netProfit.toFixed(2)}`, sub: `${sim.netProfitPct > 0 ? '+' : ''}${sim.netProfitPct.toFixed(3)}%`, color: sim.netProfit > 0 ? 'text-green-400' : 'text-red-400' },
                            ].map((step, i) => (
                              <div key={i} className="px-3 py-2" style={{ background: i === 6 ? (sim.netProfit > 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)') : 'rgba(10,10,10,0.6)' }}>
                                <div className="text-[9px] text-neutral-500 truncate">{step.label}</div>
                                <div className={`text-[12px] font-mono font-bold ${step.color}`}>{step.value}</div>
                                <div className="text-[8px] text-neutral-600 truncate">{step.sub}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                        ); })()}
                        {/* All exchange prices */}
                        <div className="px-3 py-2 border-b border-white/[0.04]">
                          <span className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider">All prices ({entry.allPrices.length} exchanges)</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-px" style={{ background: 'rgba(255,255,255,0.04)' }}>
                          {entry.allPrices.map(p => {
                            const isBuy = p.exchange === entry.buyExchange;
                            const isSell = p.exchange === entry.sellExchange;
                            const fee = getSpotTakerFee(p.exchange);
                            const makerFee = EXCHANGE_FEES[p.exchange]?.maker ?? fee;
                            return (
                              <div key={p.exchange} className="flex items-center gap-2 px-3 py-2" style={{ background: isBuy ? 'rgba(34,197,94,0.06)' : isSell ? 'rgba(249,115,22,0.06)' : 'rgba(10,10,10,0.8)' }}>
                                <ExchangeLogo exchange={p.exchange.toLowerCase()} size={14} />
                                <div className="min-w-0 flex-1">
                                  <div className="text-[11px] text-neutral-400 truncate flex items-center gap-1">
                                    {p.exchange}
                                    {(() => { const s = getStatus(currencyStatus, p.exchange, entry.symbol); return s.hasStatus ? (
                                      <span className="flex items-center gap-0.5" title={`D:${s.canDeposit ? 'Open' : 'Closed'} W:${s.canWithdraw ? 'Open' : 'Closed'}`}>
                                        <StatusDot canDo={s.canDeposit} label="Deposit" />
                                        <StatusDot canDo={s.canWithdraw} label="Withdraw" />
                                      </span>
                                    ) : null; })()}
                                  </div>
                                  <div className="text-[12px] font-mono tabular-nums text-white">{formatPrice(p.price)}</div>
                                  <div className="text-[9px] text-neutral-600 font-mono">
                                    T:{fee.toFixed(2)}% M:{makerFee.toFixed(2)}%
                                  </div>
                                </div>
                                {isBuy && <span className="text-[9px] font-bold text-green-400 uppercase">Buy</span>}
                                {isSell && <span className="text-[9px] font-bold text-orange-400 uppercase">Sell</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              );
            })}
            {pageItems.length === 0 && (
              <tr>
                <td colSpan={11} className="text-center py-12 text-neutral-600 text-sm">
                  No spot price arbitrage opportunities found matching filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Layout */}
      <div className="sm:hidden space-y-2">
        {pageItems.map((entry, idx) => {
          const buyUrl = getExchangeTradeUrl(entry.buyExchange, entry.symbol);
          const sellUrl = getExchangeTradeUrl(entry.sellExchange, entry.symbol);
          const isFlashing = flashKeys.has(entry.symbol);
          const isExpanded = expandedRow === entry.symbol;
          return (
            <div
              key={`m-${entry.symbol}-${idx}`}
              className={`rounded-lg transition-all ${isFlashing ? 'animate-flash' : ''}`}
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              {/* Card header */}
              <div className="flex items-center justify-between px-3 py-2.5">
                <a href={`/funding/${entry.symbol}`} className="flex items-center gap-2 no-underline">
                  <TokenIconSimple symbol={entry.symbol} size={22} />
                  <span className="font-bold text-white text-[13px]">{entry.symbol}</span>
                </a>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className={`font-mono tabular-nums font-bold text-[13px] ${spreadColor(entry.spreadPct)}`}>
                      +{entry.spreadPct.toFixed(3)}%
                    </div>
                    {(() => { const sim = calcProfit(entry, tradeSize); return (
                    <div className={`font-mono tabular-nums text-[10px] ${sim.netProfitPct > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      Net: {sim.netProfitPct > 0 ? '+' : ''}{sim.netProfitPct.toFixed(3)}% ({sim.netProfit > 0 ? '+' : ''}${sim.netProfit.toFixed(2)})
                    </div>
                    ); })()}
                  </div>
                  {volumeIcon(entry.volumeLevel)}
                </div>
              </div>

              {/* Buy → Sell row */}
              <div className="flex items-center gap-2 px-3 pb-2">
                <a href={buyUrl || '#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 no-underline flex-1 min-w-0">
                  <ExchangeLogo exchange={entry.buyExchange.toLowerCase()} size={14} />
                  <span className="text-[11px] text-green-400 truncate">{entry.buyExchange}</span>
                  {(() => { const s = getStatus(currencyStatus, entry.buyExchange, entry.symbol); return s.hasStatus ? <StatusDot canDo={s.canWithdraw} label="Withdraw" /> : null; })()}
                  <span className="text-[10px] font-mono text-neutral-500">{formatPrice(entry.buyPrice)}</span>
                </a>
                <div className="flex flex-col items-center flex-shrink-0">
                  <ArrowRightLeft className="w-3 h-3 text-neutral-700" />
                  <span className="text-[8px] text-neutral-600">{entry.withdrawal.confirmMins}m</span>
                </div>
                <a href={sellUrl || '#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 no-underline flex-1 min-w-0 justify-end">
                  <span className="text-[10px] font-mono text-neutral-500">{formatPrice(entry.sellPrice)}</span>
                  <span className="text-[11px] text-orange-400 truncate">{entry.sellExchange}</span>
                  {(() => { const s = getStatus(currencyStatus, entry.sellExchange, entry.symbol); return s.hasStatus ? <StatusDot canDo={s.canDeposit} label="Deposit" /> : null; })()}
                  <ExchangeLogo exchange={entry.sellExchange.toLowerCase()} size={14} />
                </a>
              </div>

              {/* Info bar */}
              <div className="flex items-center justify-between px-3 py-1.5 border-t border-white/[0.04]">
                <div className="flex items-center gap-3 text-[9px] text-neutral-500">
                  <span>{entry.withdrawal.network} ${entry.withdrawal.feeUsd.toFixed(2)}</span>
                  <span>Vol: {entry.avgVolume > 0 ? formatVolume(entry.avgVolume) : '-'}</span>
                  <span>Fees: {entry.buyFee.toFixed(1)}%+{entry.sellFee.toFixed(1)}%</span>
                </div>
                <button
                  onClick={() => setExpandedRow(isExpanded ? null : entry.symbol)}
                  className="text-[9px] text-neutral-500 hover:text-hub-yellow flex items-center gap-0.5"
                >
                  {entry.exchangeCount} exch
                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t border-white/[0.04]">
                  {(() => { const sim = calcProfit(entry, tradeSize); return (
                  <div className="px-3 py-2 border-b border-white/[0.04]">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Calculator className="w-3 h-3 text-hub-yellow" />
                      <span className="text-[9px] text-hub-yellow/70 font-semibold uppercase tracking-wider">${tradeSize.toLocaleString()} Trade</span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-[9px] text-neutral-400">
                      <span>Buy fee: <span className="text-red-400 font-mono">-${sim.buyFeeUsd.toFixed(2)}</span></span>
                      <span>WD: <span className="text-red-400 font-mono">-${entry.withdrawal.feeUsd.toFixed(2)}</span></span>
                      <span>Sell fee: <span className="text-red-400 font-mono">-${sim.sellFeeUsd.toFixed(2)}</span></span>
                      <span>Profit: <span className={`font-mono font-bold ${sim.netProfit > 0 ? 'text-green-400' : 'text-red-400'}`}>{sim.netProfit > 0 ? '+' : ''}${sim.netProfit.toFixed(2)}</span></span>
                    </div>
                  </div>
                  ); })()}
                  <div className="grid grid-cols-2 gap-px" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    {entry.allPrices.map(p => {
                      const isBuy = p.exchange === entry.buyExchange;
                      const isSell = p.exchange === entry.sellExchange;
                      return (
                        <div key={p.exchange} className="flex items-center gap-2 px-3 py-1.5" style={{ background: isBuy ? 'rgba(34,197,94,0.06)' : isSell ? 'rgba(249,115,22,0.06)' : 'rgba(10,10,10,0.8)' }}>
                          <ExchangeLogo exchange={p.exchange.toLowerCase()} size={12} />
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] text-neutral-400 truncate flex items-center gap-1">
                              {p.exchange}
                              {(() => { const s = getStatus(currencyStatus, p.exchange, entry.symbol); return s.hasStatus ? (
                                <span className="flex items-center gap-0.5">
                                  <StatusDot canDo={s.canDeposit} label="Deposit" />
                                  <StatusDot canDo={s.canWithdraw} label="Withdraw" />
                                </span>
                              ) : null; })()}
                            </div>
                            <div className="text-[11px] font-mono text-white">{formatPrice(p.price)}</div>
                          </div>
                          {isBuy && <span className="text-[8px] font-bold text-green-400">BUY</span>}
                          {isSell && <span className="text-[8px] font-bold text-orange-400">SELL</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {pageItems.length === 0 && (
          <div className="text-center py-12 text-neutral-600 text-sm">
            No spot arbitrage opportunities found
          </div>
        )}
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
        Spot arbitrage across 15 CEX exchanges with real taker fees and withdrawal costs.{' '}
        <span className="text-green-400/60 font-medium">Spread</span> = price difference.{' '}
        <span className="text-green-400/60 font-medium">Net</span> = spread minus buy fee + sell fee + withdrawal fee (on ${tradeSize.toLocaleString()} trade).{' '}
        <span className="text-yellow-400/60"><AlertTriangle className="w-2.5 h-2.5 inline" /></span> = low liquidity warning.{' '}
        Use the <span className="text-hub-yellow/60 font-medium">Profit Simulator</span> to set your trade size. Click exchange count for step-by-step breakdown.
      </p>
    </div>
  );
}
