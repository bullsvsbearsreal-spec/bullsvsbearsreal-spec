'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ReferralBanner from '@/components/ReferralBanner';
import FeatureHint from '@/components/FeatureHint';
import RelatedPages from '@/components/RelatedPages';
import LiquidationTreemap from './components/LiquidationTreemap';
import LiquidationFeed from './components/LiquidationFeed';
import { isLiqCryptoSymbol, normalizeLiqSymbol } from '@/lib/liquidation-parsers';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { formatLiqValue } from '@/lib/utils/format';
import { Zap, TrendingDown, TrendingUp, Activity, Flame } from 'lucide-react';
import { useFlash } from '@/hooks/useFlash';
import { useMultiExchangeLiquidations, type Liquidation } from '@/hooks/useMultiExchangeLiquidations';
import dynamic from 'next/dynamic';

const LiquidationChart = dynamic(
  () => import('./components/LiquidationChart'),
  {
    ssr: false,
    loading: () => (
      <div className="h-[280px] bg-hub-dark/50 border border-hub-subtle rounded-2xl flex items-center justify-center">
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

const DEX_EXCHANGES = new Set(['gTrade', 'dYdX', 'Hyperliquid', 'GMX', 'Drift', 'Aevo', 'Lighter']);
const WS_EXCHANGES = ['Binance', 'Bybit', 'OKX', 'Bitget', 'Deribit', 'HTX', 'gTrade', 'dYdX', 'Bitfinex', 'Hyperliquid'];

type ExchangeFilterKey = 'all' | 'cex' | 'dex';

const EXCHANGE_FILTERS: { key: ExchangeFilterKey; label: string }[] = [
  { key: 'all', label: 'All Venues' },
  { key: 'cex', label: 'CEX' },
  { key: 'dex', label: 'DEX' },
];

// ─── SWR Fetcher ────────────────────────────────────
const fetcher = (url: string) => fetch(url).then(r => r.ok ? r.json() : null);

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

/** Market sentiment label based on liquidation volume */
function getMarketLabel(total: number, longPct: number): { text: string; color: string } | null {
  if (total >= 1_000_000_000) return { text: 'Unprecedented liquidation event', color: 'text-red-400' };
  if (total >= 500_000_000) return { text: 'Extreme market turbulence', color: 'text-red-400' };
  if (total >= 200_000_000) return { text: 'Heavy liquidation activity', color: 'text-orange-400' };
  if (total >= 100_000_000) {
    if (longPct >= 75) return { text: 'Long positions under pressure', color: 'text-red-400' };
    if (longPct <= 25) return { text: 'Short squeeze in progress', color: 'text-green-400' };
    return { text: 'Significant liquidation wave', color: 'text-amber-400' };
  }
  if (total >= 50_000_000) {
    if (longPct >= 70) return { text: 'Longs getting liquidated', color: 'text-red-400/80' };
    if (longPct <= 30) return { text: 'Shorts getting squeezed', color: 'text-green-400/80' };
    return { text: 'Elevated liquidation activity', color: 'text-amber-400/80' };
  }
  return null;
}

// ─── Page Component ─────────────────────────────────
export default function LiquidationsPage() {
  const [timeframe, setTimeframe] = useState<Timeframe>('4h');
  const [sideFilter, setSideFilter] = useState<'all' | 'long' | 'short'>('all');
  const [exchangeFilter, setExchangeFilter] = useState<ExchangeFilterKey>('all');
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
  const marketLabel = getMarketLabel(stats.total, longPct);

  // ─── Render ─────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-hub-black">
      <Header />

      <main id="main-content" className="flex-1">
        <div className="px-4 sm:px-6 lg:px-8 pt-4">
          <FeatureHint page="/liquidations" />
        </div>
        {/* ─── Page Header ──────────────────────────── */}
        <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-4">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-5">
            {/* Title & status */}
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Liquidations
                </h1>
                {connectedCount > 0 && (
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-green-400/90 bg-green-500/10 border border-green-500/15 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    {connectedCount} live
                  </span>
                )}
              </div>
              <p className="text-sm text-neutral-500">
                Real-time liquidation data across {WS_EXCHANGES.length} exchanges
                {marketLabel && (
                  <span className={`ml-2 ${marketLabel.color}`}>
                    &mdash; {marketLabel.text}
                  </span>
                )}
              </p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Exchange filter */}
              <div className="flex items-center bg-hub-dark/60 border border-hub-subtle rounded-lg p-0.5">
                {EXCHANGE_FILTERS.map(f => (
                  <button
                    key={f.key}
                    onClick={() => setExchangeFilter(f.key)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      exchangeFilter === f.key
                        ? f.key === 'dex'
                          ? 'bg-purple-500/15 text-purple-400 shadow-sm'
                          : 'bg-white/[0.08] text-white shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Timeframe pills */}
              <div className="flex items-center bg-hub-dark/60 border border-hub-subtle rounded-lg p-0.5" role="tablist">
                {TIMEFRAMES.map(tf => (
                  <button
                    key={tf}
                    role="tab"
                    aria-selected={timeframe === tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition-all ${
                      timeframe === tf
                        ? 'bg-hub-yellow/15 text-hub-yellow shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ─── Stats Overview ────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {/* Total Volume */}
            <div className="group bg-hub-dark/40 border border-hub-subtle rounded-xl p-4 hover:border-hub-hover transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-white/[0.04]">
                  <Activity className="w-3.5 h-3.5 text-neutral-400" />
                </div>
                <span className="text-xs text-neutral-500 font-medium">Total Volume</span>
              </div>
              <span className={`text-xl font-mono font-bold text-white tracking-tight ${totalFlash}`}>
                {formatLiqValue(stats.total)}
              </span>
              <div className="mt-1.5 text-[11px] text-neutral-600 font-medium">
                {timeframe} window
              </div>
            </div>

            {/* Liquidation Count */}
            <div className="group bg-hub-dark/40 border border-hub-subtle rounded-xl p-4 hover:border-hub-hover transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-white/[0.04]">
                  <Flame className="w-3.5 h-3.5 text-neutral-400" />
                </div>
                <span className="text-xs text-neutral-500 font-medium">Liquidations</span>
              </div>
              <span className="text-xl font-mono font-bold text-white tracking-tight">
                {stats.count.toLocaleString()}
              </span>
              <div className="mt-1.5 text-[11px] text-neutral-600 font-medium">
                total events
              </div>
            </div>

            {/* Longs Liquidated */}
            <div className="group bg-hub-dark/40 border border-hub-subtle rounded-xl p-4 hover:border-hub-hover transition-colors relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/[0.04] to-transparent pointer-events-none" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-lg bg-red-500/10">
                    <TrendingDown className="w-3.5 h-3.5 text-red-400/80" />
                  </div>
                  <span className="text-xs text-neutral-500 font-medium">Longs Liquidated</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-mono font-bold text-red-400 tracking-tight">
                    {formatLiqValue(stats.longValue)}
                  </span>
                </div>
                <div className="mt-1.5 text-[11px] text-red-400/50 font-mono font-medium">
                  {longPct.toFixed(1)}% of total
                </div>
              </div>
            </div>

            {/* Shorts Liquidated */}
            <div className="group bg-hub-dark/40 border border-hub-subtle rounded-xl p-4 hover:border-hub-hover transition-colors relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/[0.04] to-transparent pointer-events-none" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-lg bg-green-500/10">
                    <TrendingUp className="w-3.5 h-3.5 text-green-400/80" />
                  </div>
                  <span className="text-xs text-neutral-500 font-medium">Shorts Liquidated</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-mono font-bold text-green-400 tracking-tight">
                    {formatLiqValue(stats.shortValue)}
                  </span>
                </div>
                <div className="mt-1.5 text-[11px] text-green-400/50 font-mono font-medium">
                  {shortPct.toFixed(1)}% of total
                </div>
              </div>
            </div>
          </div>

          {/* Long/Short ratio bar */}
          <div className="flex items-center gap-3 mb-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-red-500/70" />
              <span className="text-[11px] font-mono text-red-400/80 font-semibold">{longPct.toFixed(1)}% Long</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden bg-white/[0.04] flex-1 flex">
              <div
                className="bg-gradient-to-r from-red-500/60 to-red-500/80 h-full transition-all duration-700 rounded-l-full"
                style={{ width: `${longPct}%` }}
              />
              <div
                className="bg-gradient-to-r from-green-500/80 to-green-500/60 h-full transition-all duration-700 rounded-r-full"
                style={{ width: `${shortPct}%` }}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-green-400/80 font-semibold">{shortPct.toFixed(1)}% Short</span>
              <span className="w-2 h-2 rounded-sm bg-green-500/70" />
            </div>
          </div>
        </div>

        {/* ─── Main Content ──────────────────────────── */}
        <div className="px-4 sm:px-6 lg:px-8 pb-6 space-y-4">
          {/* Treemap */}
          <LiquidationTreemap
            data={treemapItems}
            isLoading={treemapLoading}
            onSymbolClick={setSelectedSymbol}
          />

          {/* Chart + Feed side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4">
            <LiquidationChart
              timeframeHours={hours}
              symbol={selectedSymbol}
              topSymbols={treemapItems.slice(0, 10).map(i => i.symbol)}
            />

            <div className="h-[460px]">
              <LiquidationFeed
                data={feedItems}
                isLoading={allFeedItems.length === 0 && connectedCount === 0}
                sideFilter={sideFilter}
                onSideFilterChange={setSideFilter}
              />
            </div>
          </div>
        </div>

        {/* ─── Connection Status ─────────────────────── */}
        {connections.length > 0 && (
          <div className="px-4 sm:px-6 lg:px-8 pb-4">
            <div className="flex items-center gap-2 py-2 px-3 bg-hub-dark/30 border border-hub-subtle rounded-lg overflow-x-auto scrollbar-hide">
              <span className="text-[10px] text-neutral-600 font-medium shrink-0 uppercase tracking-wider">Sources</span>
              <div className="w-px h-3 bg-white/[0.06] shrink-0" />
              {connections.map(c => (
                <span
                  key={c.exchange}
                  className={`flex items-center gap-1 text-[10px] font-medium shrink-0 px-1.5 py-0.5 rounded ${
                    c.connected
                      ? c.eventCount ? 'text-neutral-400 bg-white/[0.02]' : 'text-neutral-600'
                      : 'text-red-500/50'
                  }`}
                  title={c.connected ? `${c.eventCount || 0} events` : 'Disconnected'}
                >
                  <ExchangeLogo exchange={c.exchange} size={11} />
                  {c.exchange}
                  {c.connected && c.eventCount ? (
                    <span className="text-[8px] text-neutral-600 ml-0.5">{c.eventCount}</span>
                  ) : null}
                </span>
              ))}
            </div>
          </div>
        )}
      </main>

      <RelatedPages />
      <ReferralBanner />
      <Footer />
    </div>
  );
}
