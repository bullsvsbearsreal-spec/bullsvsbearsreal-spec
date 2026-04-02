'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ReferralBanner from '@/components/ReferralBanner';
import LiquidationTreemap from './components/LiquidationTreemap';
import LiquidationFeed from './components/LiquidationFeed';
import { isLiqCryptoSymbol, normalizeLiqSymbol } from '@/lib/liquidation-parsers';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { formatLiqValue } from '@/lib/utils/format';
import { Zap, TrendingDown, TrendingUp, Activity } from 'lucide-react';
import { useFlash } from '@/hooks/useFlash';
import { useMultiExchangeLiquidations, type Liquidation } from '@/hooks/useMultiExchangeLiquidations';
import dynamic from 'next/dynamic';

const LiquidationChart = dynamic(
  () => import('./components/LiquidationChart'),
  {
    ssr: false,
    loading: () => (
      <div className="h-[240px] bg-[#0a0a0a] border border-white/[0.06] rounded-xl flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-hub-yellow/30 border-t-hub-yellow rounded-full animate-spin" />
      </div>
    ),
  },
);

// ─── Types & Constants ──────────────────────────────
type Timeframe = '1h' | '4h' | '12h' | '24h';

const TIMEFRAME_HOURS: Record<Timeframe, number> = {
  '1h': 1,
  '4h': 4,
  '12h': 12,
  '24h': 24,
};

const TIMEFRAMES: Timeframe[] = ['1h', '4h', '12h', '24h'];

interface FeedItem {
  symbol: string;
  exchange: string;
  side: 'long' | 'short';
  price: number;
  quantity: number;
  valueUsd: number;
  ts: number;
}

interface TreemapItem {
  symbol: string;
  totalValue: number;
  longValue: number;
  shortValue: number;
  count: number;
}

// DEX exchanges for CEX/DEX filtering
const DEX_EXCHANGES = new Set(['gTrade', 'dYdX', 'Hyperliquid', 'GMX', 'Drift', 'Aevo', 'Lighter']);

// All WebSocket-supported exchanges
const WS_EXCHANGES = ['Binance', 'Bybit', 'OKX', 'Bitget', 'HTX', 'gTrade', 'dYdX', 'Bitfinex'];

const EXCHANGE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'cex', label: 'CEX' },
  { key: 'dex', label: 'DEX' },
] as const;

// ─── SWR Fetcher ────────────────────────────────────
const fetcher = (url: string) => fetch(url).then(r => r.ok ? r.json() : null);

// Convert WS Liquidation to FeedItem
function liqToFeedItem(liq: Liquidation): FeedItem {
  return {
    symbol: normalizeLiqSymbol(liq.symbol),
    exchange: liq.exchange,
    side: liq.side,
    price: liq.price,
    quantity: liq.quantity,
    valueUsd: liq.value,
    ts: liq.timestamp,
  };
}

/** Trader slang based on rekt volume */
function getRektSlang(total: number, longPct: number): string | null {
  if (total >= 1_000_000_000) return 'Unprecedented liquidation event';
  if (total >= 500_000_000) return 'Total bloodbath';
  if (total >= 200_000_000) return 'Absolute carnage';
  if (total >= 100_000_000) {
    if (longPct >= 75) return 'Longs destroyed';
    if (longPct <= 25) return 'Short squeeze';
    return 'Major liquidation wave';
  }
  if (total >= 50_000_000) {
    if (longPct >= 70) return 'Bulls getting rekt';
    if (longPct <= 30) return 'Bears squeezed';
    return 'Both sides rekt';
  }
  return null;
}

// ─── Page Component ─────────────────────────────────
export default function LiquidationsPage() {
  const [timeframe, setTimeframe] = useState<Timeframe>('4h');
  const [sideFilter, setSideFilter] = useState<'all' | 'long' | 'short'>('all');
  const [exchangeFilter, setExchangeFilter] = useState<string>('all');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const hours = TIMEFRAME_HOURS[timeframe];

  // ─── Real-time WebSocket Feed ───────────────────
  const { liquidations: wsLiqs, connections } = useMultiExchangeLiquidations({
    exchanges: WS_EXCHANGES,
    minValue: 100,
    maxItems: 1000,
    persistKey: 'ih-liq-page',
    persistTtlMs: hours * 3600000,
  });

  // ─── DB-backed Data ─────────────────────────────
  const treemapKey = `/api/history/liquidations?mode=treemap&hours=${hours}&limit=30`;
  const { data: treemapRaw, isLoading: treemapLoading } = useSWR(treemapKey, fetcher, {
    refreshInterval: 10000,
    revalidateOnFocus: false,
  });

  // ─── Merge WS liquidations into feed ────────────
  const allFeedItems: FeedItem[] = useMemo(() => {
    return wsLiqs
      .map(liqToFeedItem)
      .filter(i => isLiqCryptoSymbol(i.symbol))
      .sort((a, b) => b.ts - a.ts);
  }, [wsLiqs]);

  // Normalize + merge treemap symbols
  const treemapItems: TreemapItem[] = useMemo(() => {
    const raw: TreemapItem[] = treemapRaw?.data ?? [];
    const merged = new Map<string, TreemapItem>();
    for (const item of raw) {
      const sym = normalizeLiqSymbol(item.symbol);
      if (!isLiqCryptoSymbol(sym)) continue;
      const existing = merged.get(sym);
      if (existing) {
        existing.totalValue += item.totalValue;
        existing.longValue += item.longValue;
        existing.shortValue += item.shortValue;
        existing.count += item.count;
      } else {
        merged.set(sym, { ...item, symbol: sym });
      }
    }
    return Array.from(merged.values()).sort((a, b) => b.totalValue - a.totalValue);
  }, [treemapRaw]);

  // ─── Filtering ─────────────────────────────────
  const feedItems = useMemo(() => {
    if (exchangeFilter === 'all') return allFeedItems;
    if (exchangeFilter === 'dex') return allFeedItems.filter(i => DEX_EXCHANGES.has(i.exchange));
    return allFeedItems.filter(i => !DEX_EXCHANGES.has(i.exchange));
  }, [allFeedItems, exchangeFilter]);

  // Stats from treemap
  const stats = useMemo(() => {
    let longValue = 0, shortValue = 0, count = 0;
    for (const item of treemapItems) {
      longValue += item.longValue;
      shortValue += item.shortValue;
      count += item.count;
    }
    return { longValue, shortValue, total: longValue + shortValue, count };
  }, [treemapItems]);

  const connectedCount = connections.filter(c => c.connected).length;
  const longPct = stats.total > 0 ? (stats.longValue / stats.total) * 100 : 50;
  const shortPct = 100 - longPct;
  const totalFlash = useFlash(stats.total);
  const slang = getRektSlang(stats.total, longPct);

  // ─── Render ─────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-hub-black">
      <Header />

      {/* ─── Dashboard Header ──────────────────────── */}
      <div className="px-3 sm:px-4 lg:px-6 pt-3 pb-2">
        {/* Title row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-hub-yellow" />
            <h1 className="text-white font-bold text-lg tracking-tight">Liquidations</h1>
            {connectedCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-green-500/70 bg-green-500/10 px-1.5 py-0.5 rounded">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                {connectedCount} live
              </span>
            )}
            {slang && (
              <span className="hidden md:inline text-[10px] italic text-amber-500/70 ml-1">{slang}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Exchange filter */}
            <div className="hidden sm:flex items-center gap-0.5 bg-white/[0.03] rounded-lg p-0.5">
              {EXCHANGE_FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setExchangeFilter(f.key)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                    exchangeFilter === f.key
                      ? f.key === 'dex' ? 'bg-purple-500/20 text-purple-400' : 'bg-white/[0.08] text-white'
                      : 'text-neutral-600 hover:text-neutral-400'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {/* Timeframe pills */}
            <div className="flex items-center gap-0.5 bg-white/[0.03] rounded-lg p-0.5" role="tablist">
              {TIMEFRAMES.map(tf => (
                <button
                  key={tf}
                  role="tab"
                  aria-selected={timeframe === tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-2 sm:px-2.5 py-1 rounded text-[11px] font-mono font-bold transition-colors ${
                    timeframe === tf
                      ? 'bg-hub-yellow/20 text-hub-yellow'
                      : 'text-neutral-600 hover:text-neutral-400'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Stat Cards ────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {/* Total Volume */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Activity className="w-3 h-3 text-neutral-500" />
              <span className="text-[10px] text-neutral-500 font-medium uppercase tracking-wide">Total Volume</span>
            </div>
            <span className={`text-lg font-mono font-bold text-white ${totalFlash}`}>
              {formatLiqValue(stats.total)}
            </span>
          </div>

          {/* Liquidation Count */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="w-3 h-3 text-neutral-500" />
              <span className="text-[10px] text-neutral-500 font-medium uppercase tracking-wide">Liquidations</span>
            </div>
            <span className="text-lg font-mono font-bold text-white">
              {stats.count.toLocaleString()}
            </span>
          </div>

          {/* Longs Liquidated */}
          <div className="bg-red-500/[0.06] border border-red-500/10 rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingDown className="w-3 h-3 text-red-500/60" />
              <span className="text-[10px] text-red-400/60 font-medium uppercase tracking-wide">Longs Rekt</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-mono font-bold text-red-400">{formatLiqValue(stats.longValue)}</span>
              <span className="text-[10px] font-mono text-red-400/50">{longPct.toFixed(1)}%</span>
            </div>
          </div>

          {/* Shorts Liquidated */}
          <div className="bg-green-500/[0.06] border border-green-500/10 rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3 h-3 text-green-500/60" />
              <span className="text-[10px] text-green-400/60 font-medium uppercase tracking-wide">Shorts Rekt</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-mono font-bold text-green-400">{formatLiqValue(stats.shortValue)}</span>
              <span className="text-[10px] font-mono text-green-400/50">{shortPct.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Long/Short ratio bar */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-mono text-red-400 font-bold shrink-0">{longPct.toFixed(1)}% L</span>
          <div className="h-1.5 rounded-full overflow-hidden bg-white/[0.04] flex-1 flex">
            <div className="bg-red-500/70 h-full transition-all duration-700" style={{ width: `${longPct}%` }} />
            <div className="bg-green-500/70 h-full transition-all duration-700" style={{ width: `${shortPct}%` }} />
          </div>
          <span className="text-[10px] font-mono text-green-400 font-bold shrink-0">S {shortPct.toFixed(1)}%</span>
        </div>
      </div>

      {/* ─── Main Content ──────────────────────────── */}
      <div className="flex-1 px-3 sm:px-4 lg:px-6 pb-3">
        {/* Treemap — full width, dominant visual */}
        <div className="mb-3">
          <LiquidationTreemap
            data={treemapItems}
            isLoading={treemapLoading}
            onSymbolClick={setSelectedSymbol}
          />
        </div>

        {/* Chart + Feed side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-3">
          {/* Chart */}
          <LiquidationChart
            timeframeHours={hours}
            symbol={selectedSymbol}
            topSymbols={treemapItems.slice(0, 10).map(i => i.symbol)}
          />

          {/* Live Feed */}
          <div className="h-[360px] lg:h-auto">
            <LiquidationFeed
              data={feedItems}
              isLoading={allFeedItems.length === 0 && connectedCount === 0}
              sideFilter={sideFilter}
              onSideFilterChange={setSideFilter}
            />
          </div>
        </div>
      </div>

      {/* ─── Connection status (subtle footer) ─────── */}
      {connections.length > 0 && (
        <div className="flex items-center gap-1.5 px-3 sm:px-4 lg:px-6 py-1 border-t border-white/[0.04] overflow-x-auto scrollbar-hide">
          <span className="text-[9px] text-neutral-600 font-mono shrink-0">Sources:</span>
          {connections.map(c => (
            <span
              key={c.exchange}
              className={`text-[9px] font-mono flex items-center gap-0.5 shrink-0 ${
                c.connected ? (c.eventCount ? 'text-neutral-500' : 'text-neutral-600') : 'text-red-500/40'
              }`}
              title={c.connected ? `${c.eventCount || 0} events` : 'Disconnected'}
            >
              <ExchangeLogo exchange={c.exchange} size={10} />
              {c.exchange}
            </span>
          ))}
        </div>
      )}

      <ReferralBanner />
      <Footer />
    </div>
  );
}
