'use client';

import { useState, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  RefreshCw,
  AlertTriangle,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Users,
  DollarSign,
  BarChart3,
  Wallet,
  Plus,
  X,
} from 'lucide-react';
import { useApiData } from '@/hooks/useApiData';
import { formatNumber } from '@/lib/utils/format';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface WhalePosition {
  coin: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  positionValue: number;
  unrealizedPnl: number;
  roe: number;
  leverage: number;
  liquidationPrice: number | null;
  marginUsed: number;
  cumulativeFunding: number;
}

interface WhaleData {
  address: string;
  label: string;
  accountValue: number;
  totalNotional: number;
  marginUsed: number;
  withdrawable: number;
  positionCount: number;
  positions: WhalePosition[];
  lastUpdated: number;
  // Leaderboard performance data
  allTimePnl?: number;
  allTimeRoi?: number;
  dayPnl?: number;
  weekPnl?: number;
  monthPnl?: number;
  volume?: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

type SortField = 'accountValue' | 'totalNotional' | 'positionCount' | 'label';
type SortOrder = 'asc' | 'desc';

function truncAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function fmtUSD(n: number): string {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtPnl(n: number): string {
  const sign = n >= 0 ? '+' : '';
  if (Math.abs(n) >= 1e6) return `${sign}$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `${sign}$${(n / 1e3).toFixed(1)}K`;
  return `${sign}$${n.toFixed(0)}`;
}

function fmtPct(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${(n * 100).toFixed(1)}%`;
}

function fmtSize(n: number, coin: string): string {
  if (coin === 'BTC') return n.toFixed(4);
  if (coin === 'ETH' || coin === 'SOL') return n.toFixed(2);
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(2);
}

function fmtPrice(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
}

/* ------------------------------------------------------------------ */
/*  Skeleton loaders                                                   */
/* ------------------------------------------------------------------ */

function StatSkeleton() {
  return (
    <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4 animate-pulse">
      <div className="h-3 w-20 bg-white/[0.06] rounded mb-3" />
      <div className="h-7 w-28 bg-white/[0.06] rounded" />
    </div>
  );
}

function WhaleCardSkeleton() {
  return (
    <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/[0.06]" />
          <div>
            <div className="h-4 w-24 bg-white/[0.06] rounded mb-2" />
            <div className="h-3 w-32 bg-white/[0.06] rounded" />
          </div>
        </div>
        <div className="h-6 w-20 bg-white/[0.06] rounded" />
      </div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="h-12 bg-white/[0.04] rounded" />
        <div className="h-12 bg-white/[0.04] rounded" />
        <div className="h-12 bg-white/[0.04] rounded" />
      </div>
      <div className="space-y-2">
        <div className="h-8 bg-white/[0.04] rounded" />
        <div className="h-8 bg-white/[0.04] rounded" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Position row                                                       */
/* ------------------------------------------------------------------ */

function PositionRow({ pos }: { pos: WhalePosition }) {
  const isLong = pos.side === 'long';
  const pnlColor = pos.unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400';
  const sideColor = isLong ? 'text-green-400' : 'text-red-400';
  const sideBg = isLong ? 'bg-green-500/10' : 'bg-red-500/10';

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors text-xs">
      <div className="w-16 sm:w-20 flex items-center gap-1.5">
        <span className="font-semibold text-white">{pos.coin}</span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${sideBg} ${sideColor}`}>
          {pos.side}
        </span>
      </div>
      <div className="w-16 sm:w-20 text-right font-mono text-neutral-300">
        {fmtSize(pos.size, pos.coin)}
      </div>
      <div className="w-20 sm:w-24 text-right font-mono text-neutral-400">
        {fmtUSD(pos.positionValue)}
      </div>
      <div className="hidden sm:block w-20 text-right font-mono text-neutral-500">
        {fmtPrice(pos.entryPrice)}
      </div>
      <div className={`flex-1 text-right font-mono ${pnlColor}`}>
        {fmtPnl(pos.unrealizedPnl)}
      </div>
      <div className={`w-14 text-right font-mono text-[11px] ${pnlColor}`}>
        {fmtPct(pos.roe)}
      </div>
      <div className="hidden sm:block w-10 text-right font-mono text-neutral-600">
        {pos.leverage}x
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Whale card                                                         */
/* ------------------------------------------------------------------ */

function WhaleCard({ whale }: { whale: WhaleData }) {
  const [expanded, setExpanded] = useState(false);

  const totalPnl = useMemo(
    () => whale.positions.reduce((s, p) => s + p.unrealizedPnl, 0),
    [whale.positions],
  );

  const longNotional = useMemo(
    () => whale.positions.filter((p) => p.side === 'long').reduce((s, p) => s + p.positionValue, 0),
    [whale.positions],
  );

  const shortNotional = useMemo(
    () => whale.positions.filter((p) => p.side === 'short').reduce((s, p) => s + p.positionValue, 0),
    [whale.positions],
  );

  const pnlColor = totalPnl >= 0 ? 'text-green-400' : 'text-red-400';

  return (
    <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl overflow-hidden transition-all duration-200 hover:border-white/[0.1]">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="w-full px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-hub-yellow/30 to-hub-orange/30 border border-hub-yellow/20 flex items-center justify-center flex-shrink-0">
            <span className="text-hub-yellow font-bold text-sm">
              {whale.label.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold text-sm truncate">{whale.label}</span>
              <span className="text-neutral-600 text-xs font-mono">{truncAddr(whale.address)}</span>
              <a
                href={`https://app.hyperliquid.xyz/explorer/address/${whale.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-600 hover:text-hub-yellow transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <span className="text-neutral-500 text-xs">
                {whale.positionCount} position{whale.positionCount !== 1 ? 's' : ''}
              </span>
              <span className={`text-xs font-mono ${pnlColor}`}>
                uPnL {fmtPnl(totalPnl)}
              </span>
              {whale.allTimePnl != null && (
                <span className={`text-xs font-mono ${whale.allTimePnl >= 0 ? 'text-green-500/60' : 'text-red-500/60'}`}>
                  AT {fmtPnl(whale.allTimePnl)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <div className="text-white font-bold font-mono text-sm">{fmtUSD(whale.accountValue)}</div>
            <div className="text-neutral-600 text-[10px] uppercase tracking-wider">Account</div>
          </div>
          <div className="text-right sm:hidden">
            <div className="text-white font-bold font-mono text-sm">{fmtUSD(whale.accountValue)}</div>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-neutral-600" />
          ) : (
            <ChevronDown className="w-4 h-4 text-neutral-600" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-white/[0.04] animate-slide-down">
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-4 py-3">
            <div className="bg-white/[0.03] rounded-lg px-3 py-2">
              <span className="text-neutral-600 text-[10px] uppercase tracking-wider">Notional</span>
              <div className="text-white font-mono text-sm font-bold mt-0.5">{fmtUSD(whale.totalNotional)}</div>
            </div>
            <div className="bg-white/[0.03] rounded-lg px-3 py-2">
              <span className="text-neutral-600 text-[10px] uppercase tracking-wider">Margin Used</span>
              <div className="text-white font-mono text-sm font-bold mt-0.5">{fmtUSD(whale.marginUsed)}</div>
            </div>
            <div className="bg-green-500/5 rounded-lg px-3 py-2">
              <span className="text-green-500/60 text-[10px] uppercase tracking-wider">Long Exposure</span>
              <div className="text-green-400 font-mono text-sm font-bold mt-0.5">{fmtUSD(longNotional)}</div>
            </div>
            <div className="bg-red-500/5 rounded-lg px-3 py-2">
              <span className="text-red-500/60 text-[10px] uppercase tracking-wider">Short Exposure</span>
              <div className="text-red-400 font-mono text-sm font-bold mt-0.5">{fmtUSD(shortNotional)}</div>
            </div>
          </div>

          {/* Leaderboard performance row */}
          {(whale.allTimePnl != null || whale.dayPnl != null) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-4 pb-3">
              {whale.allTimePnl != null && (
                <div className={`${whale.allTimePnl >= 0 ? 'bg-green-500/5' : 'bg-red-500/5'} rounded-lg px-3 py-2`}>
                  <span className="text-neutral-600 text-[10px] uppercase tracking-wider">All-Time PnL</span>
                  <div className={`font-mono text-sm font-bold mt-0.5 ${whale.allTimePnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {fmtPnl(whale.allTimePnl)}
                  </div>
                </div>
              )}
              {whale.dayPnl != null && (
                <div className={`${whale.dayPnl >= 0 ? 'bg-green-500/5' : 'bg-red-500/5'} rounded-lg px-3 py-2`}>
                  <span className="text-neutral-600 text-[10px] uppercase tracking-wider">24h PnL</span>
                  <div className={`font-mono text-sm font-bold mt-0.5 ${whale.dayPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {fmtPnl(whale.dayPnl)}
                  </div>
                </div>
              )}
              {whale.weekPnl != null && (
                <div className={`${whale.weekPnl >= 0 ? 'bg-green-500/5' : 'bg-red-500/5'} rounded-lg px-3 py-2`}>
                  <span className="text-neutral-600 text-[10px] uppercase tracking-wider">7d PnL</span>
                  <div className={`font-mono text-sm font-bold mt-0.5 ${whale.weekPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {fmtPnl(whale.weekPnl)}
                  </div>
                </div>
              )}
              {whale.volume != null && whale.volume > 0 && (
                <div className="bg-white/[0.03] rounded-lg px-3 py-2">
                  <span className="text-neutral-600 text-[10px] uppercase tracking-wider">All-Time Volume</span>
                  <div className="text-white font-mono text-sm font-bold mt-0.5">{fmtUSD(whale.volume)}</div>
                </div>
              )}
            </div>
          )}

          {/* Positions header */}
          <div className="flex items-center gap-2 px-4 py-1 text-[10px] uppercase tracking-wider text-neutral-600">
            <div className="w-16 sm:w-20">Asset</div>
            <div className="w-16 sm:w-20 text-right">Size</div>
            <div className="w-20 sm:w-24 text-right">Value</div>
            <div className="hidden sm:block w-20 text-right">Entry</div>
            <div className="flex-1 text-right">uPnL</div>
            <div className="w-14 text-right">ROE</div>
            <div className="hidden sm:block w-10 text-right">Lev</div>
          </div>

          {/* Position rows */}
          <div className="px-3 pb-3 space-y-1">
            {whale.positions.map((pos) => (
              <PositionRow key={`${pos.coin}-${pos.side}`} pos={pos} />
            ))}
            {whale.positions.length === 0 && (
              <div className="text-center text-neutral-600 text-xs py-4">No open positions</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function HLWhalesPage() {
  /* ---- state -------------------------------------------------------- */
  const [sortField, setSortField] = useState<SortField>('accountValue');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [search, setSearch] = useState('');
  const [customAddress, setCustomAddress] = useState('');
  const [showAddCustom, setShowAddCustom] = useState(false);

  /* ---- data fetching ------------------------------------------------ */
  const whaleFetcher = useCallback(
    () => fetch('/api/hl-whales').then((r) => r.json()) as Promise<WhaleData[]>,
    [],
  );

  const {
    data: whales,
    error,
    isLoading,
    isRefreshing,
    lastUpdate,
    refresh,
  } = useApiData<WhaleData[]>({
    fetcher: whaleFetcher,
    refreshInterval: 60_000,
  });

  /* ---- custom whale lookup ----------------------------------------- */
  const [customWhale, setCustomWhale] = useState<WhaleData | null>(null);
  const [customLoading, setCustomLoading] = useState(false);
  const [customError, setCustomError] = useState('');

  const handleAddCustom = async () => {
    const addr = customAddress.trim().toLowerCase();
    if (!addr || !addr.startsWith('0x') || addr.length !== 42) {
      setCustomError('Enter a valid 0x address (42 characters)');
      return;
    }
    setCustomError('');
    setCustomLoading(true);
    try {
      const res = await fetch(`/api/hl-whales?address=${addr}&label=Custom`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to fetch');
      }
      setCustomWhale(json as WhaleData);
      setShowAddCustom(false);
      setCustomAddress('');
    } catch (err) {
      setCustomError(err instanceof Error ? err.message : 'Failed to fetch wallet');
    } finally {
      setCustomLoading(false);
    }
  };

  /* ---- derived values ----------------------------------------------- */
  const allWhales = useMemo(() => {
    const list = [...(whales ?? [])];
    if (customWhale) {
      // Add custom whale if not already in the list
      const exists = list.some((w) => w.address.toLowerCase() === customWhale.address.toLowerCase());
      if (!exists) list.push(customWhale);
    }
    return list;
  }, [whales, customWhale]);

  const filtered = useMemo(() => {
    let list = allWhales;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (w) =>
          w.label.toLowerCase().includes(q) ||
          w.address.toLowerCase().includes(q) ||
          w.positions.some((p) => p.coin.toLowerCase().includes(q)),
      );
    }
    return list.sort((a, b) => {
      const mul = sortOrder === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'accountValue':
          return mul * (a.accountValue - b.accountValue);
        case 'totalNotional':
          return mul * (a.totalNotional - b.totalNotional);
        case 'positionCount':
          return mul * (a.positionCount - b.positionCount);
        case 'label':
          return mul * a.label.localeCompare(b.label);
        default:
          return 0;
      }
    });
  }, [allWhales, search, sortField, sortOrder]);

  const stats = useMemo(() => {
    if (!allWhales.length) return null;
    const totalAV = allWhales.reduce((s, w) => s + w.accountValue, 0);
    const totalNotional = allWhales.reduce((s, w) => s + w.totalNotional, 0);
    const totalPositions = allWhales.reduce((s, w) => s + w.positionCount, 0);
    const totalPnl = allWhales.reduce(
      (s, w) => s + w.positions.reduce((ps, p) => ps + p.unrealizedPnl, 0),
      0,
    );
    return { totalAV, totalNotional, totalPositions, totalPnl };
  }, [allWhales]);

  /* ---- sorting ------------------------------------------------------ */
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-hub-yellow" />
    ) : (
      <ArrowDown className="w-3 h-3 text-hub-yellow" />
    );
  };

  /* ---- render ------------------------------------------------------- */
  return (
    <div className="min-h-screen bg-black">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <img src="/exchanges/hyperliquid.png" alt="" className="w-6 h-6 rounded" />
              Hyperliquid Whale Tracker
            </h1>
            <p className="text-neutral-600 text-xs mt-0.5">
              Live positions of top traders ($5M+) from the Hyperliquid leaderboard
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <span className="text-neutral-600 text-[11px]">
                Updated {lastUpdate.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={refresh}
              disabled={isLoading || isRefreshing}
              className="p-1.5 text-neutral-500 hover:text-white transition-colors disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading || isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 mb-4 flex items-center gap-2 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Stats cards */}
        {isLoading && !whales ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <StatSkeleton key={i} />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="bg-[#111] border border-white/[0.06] rounded-lg px-4 py-3">
              <span className="text-neutral-500 text-[11px] uppercase tracking-wider flex items-center gap-1">
                <Users className="w-3 h-3" />
                Tracked Whales
              </span>
              <div className="text-lg font-bold text-white font-mono mt-0.5">{allWhales.length}</div>
            </div>
            <div className="bg-[#111] border border-white/[0.06] rounded-lg px-4 py-3">
              <span className="text-neutral-500 text-[11px] uppercase tracking-wider flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                Total Account Value
              </span>
              <div className="text-lg font-bold text-white font-mono mt-0.5">{fmtUSD(stats.totalAV)}</div>
            </div>
            <div className="bg-[#111] border border-white/[0.06] rounded-lg px-4 py-3">
              <span className="text-neutral-500 text-[11px] uppercase tracking-wider flex items-center gap-1">
                <BarChart3 className="w-3 h-3" />
                Total Notional
              </span>
              <div className="text-lg font-bold text-white font-mono mt-0.5">{fmtUSD(stats.totalNotional)}</div>
            </div>
            <div className={`bg-[#111] border ${stats.totalPnl >= 0 ? 'border-green-500/10' : 'border-red-500/10'} rounded-lg px-4 py-3`}>
              <span className={`${stats.totalPnl >= 0 ? 'text-green-500/60' : 'text-red-500/60'} text-[11px] uppercase tracking-wider flex items-center gap-1`}>
                {stats.totalPnl >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                Total uPnL
              </span>
              <div className={`text-lg font-bold font-mono mt-0.5 ${stats.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {fmtPnl(stats.totalPnl)}
              </div>
            </div>
          </div>
        ) : null}

        {/* Controls bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-600" />
            <input
              type="text"
              placeholder="Search by name, address, or coin..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white/[0.04] border border-white/[0.06] rounded-lg text-white text-xs placeholder:text-neutral-600 focus:outline-none focus:border-hub-yellow/30"
            />
          </div>

          {/* Sort buttons */}
          <div className="flex items-center gap-1">
            {([
              { field: 'accountValue' as SortField, label: 'Value' },
              { field: 'totalNotional' as SortField, label: 'Notional' },
              { field: 'positionCount' as SortField, label: 'Positions' },
            ]).map(({ field, label }) => (
              <button
                key={field}
                onClick={() => toggleSort(field)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  sortField === field
                    ? 'bg-hub-yellow text-black'
                    : 'text-neutral-500 hover:text-white bg-white/[0.04] hover:bg-white/[0.08]'
                }`}
              >
                {label}
                <SortIcon field={field} />
              </button>
            ))}
          </div>

          {/* Track custom wallet */}
          <button
            onClick={() => setShowAddCustom(!showAddCustom)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-neutral-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Track Wallet
          </button>
        </div>

        {/* Add custom wallet panel */}
        {showAddCustom && (
          <div className="bg-[#111] border border-white/[0.06] rounded-lg p-4 mb-4 animate-slide-down">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white text-sm font-medium">Track a Hyperliquid Wallet</span>
              <button onClick={() => setShowAddCustom(false)} className="text-neutral-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="0x... (42 character address)"
                value={customAddress}
                onChange={(e) => {
                  setCustomAddress(e.target.value);
                  setCustomError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustom()}
                className="flex-1 px-3 py-2 bg-white/[0.04] border border-white/[0.06] rounded-lg text-white text-xs font-mono placeholder:text-neutral-600 focus:outline-none focus:border-hub-yellow/30"
              />
              <button
                onClick={handleAddCustom}
                disabled={customLoading}
                className="px-4 py-2 bg-hub-yellow text-black rounded-lg text-xs font-semibold hover:bg-hub-yellow-light transition-colors disabled:opacity-50"
              >
                {customLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  'Track'
                )}
              </button>
            </div>
            {customError && (
              <p className="text-red-400 text-xs mt-2">{customError}</p>
            )}
            <p className="text-neutral-600 text-[11px] mt-2">
              Paste any Hyperliquid wallet address to see their live positions. All data is public on-chain.
            </p>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && !whales ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <WhaleCardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 && !isLoading ? (
          /* Empty state */
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-12 text-center">
            <Wallet className="w-8 h-8 text-neutral-700 mx-auto mb-3" />
            <div className="text-neutral-500 text-sm mb-1">No whales found</div>
            <p className="text-neutral-700 text-xs">
              {search ? 'Try a different search term.' : 'No active whale positions at the moment.'}
            </p>
          </div>
        ) : (
          /* Whale cards */
          <div className="space-y-3">
            {filtered.map((whale) => (
              <WhaleCard key={whale.address} whale={whale} />
            ))}
          </div>
        )}

        {/* Info callout */}
        <div className="mt-4 p-3 rounded-lg bg-hub-yellow/5 border border-hub-yellow/10">
          <p className="text-neutral-500 text-xs leading-relaxed">
            <span className="text-hub-yellow font-medium">Hyperliquid Whale Tracker</span> dynamically tracks the
            top traders from the Hyperliquid leaderboard. Whale addresses are fetched from the public leaderboard,
            then live positions are queried via the{' '}
            <code className="text-neutral-400 bg-white/[0.04] px-1 rounded">clearinghouseState</code> API — no
            authentication needed. <span className="text-green-400">Long</span> = betting on price increase.{' '}
            <span className="text-red-400">Short</span> = betting on price decrease.{' '}
            <span className="text-white">uPnL</span> = unrealized profit/loss.{' '}
            <span className="text-white">AT PnL</span> = all-time realized + unrealized PnL from leaderboard.{' '}
            <span className="text-white">ROE</span> = return on equity (margin).
            Use the &quot;Track Wallet&quot; button to add any Hyperliquid address.
            Data refreshes every 90 seconds. Leaderboard updates every 5 minutes.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
