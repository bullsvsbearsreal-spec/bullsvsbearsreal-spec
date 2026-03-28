'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ReferralBanner from '@/components/ReferralBanner';
import LiquidationTopBar from './components/LiquidationTopBar';
import LiquidationTreemap from './components/LiquidationTreemap';
import LiquidationFeed from './components/LiquidationFeed';
import LiquidationBottomBar from './components/LiquidationBottomBar';
import { isLiqCryptoSymbol, normalizeLiqSymbol } from '@/lib/liquidation-parsers';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { useMultiExchangeLiquidations, type Liquidation } from '@/hooks/useMultiExchangeLiquidations';
import dynamic from 'next/dynamic';

const LiquidationChart = dynamic(
  () => import('./components/LiquidationChart'),
  {
    ssr: false,
    loading: () => (
      <div className="h-[280px] bg-[#0a0a0a] border border-white/[0.06] rounded-xl flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-hub-yellow/30 border-t-hub-yellow rounded-full animate-spin" />
      </div>
    ),
  },
);

// ─── Types & Constants ──────────────────────────────
type Timeframe = '4h' | '8h' | '12h' | '24h';

const TIMEFRAME_HOURS: Record<Timeframe, number> = {
  '4h': 4,
  '8h': 8,
  '12h': 12,
  '24h': 24,
};

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

// All 9 WebSocket-supported exchanges (BingX/MEXC removed — no public liquidation WS)
const WS_EXCHANGES = ['Binance', 'Bybit', 'OKX', 'Bitget', 'HTX', 'gTrade', 'dYdX', 'Bitfinex'];

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

// ─── Page Component ─────────────────────────────────
export default function LiquidationsPage() {
  // State
  const [timeframe, setTimeframe] = useState<Timeframe>('4h');
  const [sideFilter, setSideFilter] = useState<'all' | 'long' | 'short'>('all');
  const [exchangeFilter, setExchangeFilter] = useState<string>('all');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const hours = TIMEFRAME_HOURS[timeframe];

  // ─── Real-time WebSocket Feed (8 exchanges) ─────
  const { liquidations: wsLiqs, connections } = useMultiExchangeLiquidations({
    exchanges: WS_EXCHANGES,
    minValue: 100, // $100 minimum — show all meaningful liqs from every exchange
    maxItems: 1000,
    persistKey: 'ih-liq-page',
    persistTtlMs: hours * 3600000,
  });

  // ─── DB-backed Data (historical aggregation) ─────
  // Treemap data (polls every 10s) — DB is authoritative for historical aggregation
  const treemapKey = `/api/history/liquidations?mode=treemap&hours=${hours}&limit=30`;
  const { data: treemapRaw, isLoading: treemapLoading } = useSWR(treemapKey, fetcher, {
    refreshInterval: 10000,
    revalidateOnFocus: false,
  });

  // ─── Merge WS liquidations into feed ─────────────
  const allFeedItems: FeedItem[] = useMemo(() => {
    const wsItems = wsLiqs
      .map(liqToFeedItem)
      .filter(i => isLiqCryptoSymbol(i.symbol));
    // Sort by timestamp descending (newest first)
    return wsItems.sort((a, b) => b.ts - a.ts);
  }, [wsLiqs]);

  // Normalize + merge treemap symbols (e.g. BTCUSD-SWAP → BTC)
  const treemapItems: TreemapItem[] = useMemo(() => {
    const raw: TreemapItem[] = treemapRaw?.data ?? [];
    const merged = new Map<string, TreemapItem>();
    for (const item of raw) {
      const sym = normalizeLiqSymbol(item.symbol);
      if (!isLiqCryptoSymbol(sym)) continue; // skip stocks/forex/commodities
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

  // ─── Exchange Filter ────────────────────────────
  const feedItems = useMemo(() => {
    if (exchangeFilter === 'all') return allFeedItems;
    if (exchangeFilter === 'dex') return allFeedItems.filter(i => DEX_EXCHANGES.has(i.exchange));
    return allFeedItems.filter(i => !DEX_EXCHANGES.has(i.exchange)); // 'cex'
  }, [allFeedItems, exchangeFilter]);

  // Stats from treemap (DB-aggregated, not capped by feed limit)
  const stats = useMemo(() => {
    let longValue = 0;
    let shortValue = 0;
    let count = 0;
    for (const item of treemapItems) {
      longValue += item.longValue;
      shortValue += item.shortValue;
      count += item.count;
    }
    return { longValue, shortValue, total: longValue + shortValue, count };
  }, [treemapItems]);

  // Stats filtered by CEX/DEX (for bottom bar)
  const filteredStats = useMemo(() => {
    if (exchangeFilter === 'all') return stats;
    // Compute from feed items when filtered (feed has exchange info)
    let longValue = 0, shortValue = 0, count = 0;
    for (const item of feedItems) {
      const val = item.valueUsd || 0;
      if (item.side === 'long') longValue += val;
      else shortValue += val;
      count++;
    }
    return { longValue, shortValue, total: longValue + shortValue, count };
  }, [stats, exchangeFilter, feedItems]);

  // Connection status
  const connectedCount = connections.filter(c => c.connected).length;

  // ─── Render ─────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-hub-black overflow-hidden">
      <Header />

      {/* Top bar: title, stats, timeframe selector, sound toggle */}
      <LiquidationTopBar
        stats={stats}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
      />

      {/* Connection status indicator — per-exchange dots */}
      {connections.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.01] border-b border-white/[0.04] overflow-x-auto scrollbar-hide">
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${connectedCount > 0 ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
          <span className="text-[10px] text-neutral-500 flex-shrink-0">
            {connectedCount}/{connections.length} exchanges connected
          </span>
          <div className="flex items-center gap-1.5 ml-1">
            {connections.map(c => (
              <span
                key={c.exchange}
                className={`text-[9px] px-1.5 py-0.5 rounded flex-shrink-0 font-medium flex items-center gap-1 ${
                  c.connected
                    ? (c.eventCount ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/10 text-yellow-400')
                    : 'bg-red-500/10 text-red-400'
                }`}
                title={c.error || (c.connected
                  ? `Connected · ${c.eventCount || 0} events${c.lastEventAt ? ` · last ${Math.round((Date.now() - c.lastEventAt) / 1000)}s ago` : ''}`
                  : 'Disconnected')}
              >
                <ExchangeLogo exchange={c.exchange} size={10} />{c.exchange}{c.eventCount ? ` ${c.eventCount}` : ''}
              </span>
            ))}
          </div>
          <span className="text-[10px] text-neutral-500 ml-auto flex-shrink-0" title="Liquidation data from WebSocket-connected exchanges. Some exchanges send events infrequently during calm markets.">
            Partial coverage · verify independently
          </span>
        </div>
      )}

      {/* Main content grid */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[55%_45%] gap-2 px-3 py-2 overflow-y-auto md:overflow-hidden">
        {/* Left column: Treemap + Chart */}
        <div className="flex flex-col gap-2 md:min-h-0">
          {/* Treemap heatmap */}
          <div className="shrink-0 md:flex-1 md:min-h-0 md:overflow-y-auto">
            <LiquidationTreemap
              data={treemapItems}
              isLoading={treemapLoading}
              onSymbolClick={setSelectedSymbol}
            />
          </div>

          {/* History chart */}
          <div className="shrink-0 md:flex-none">
            <LiquidationChart
              timeframeHours={hours}
              symbol={selectedSymbol}
              topSymbols={treemapItems.slice(0, 10).map(i => i.symbol)}
            />
          </div>
        </div>

        {/* Right column: Live feed (8-exchange WebSocket) */}
        <div className="min-h-[400px] md:min-h-0 md:h-full">
          <LiquidationFeed
            data={feedItems}
            isLoading={allFeedItems.length === 0 && connectedCount === 0}
            sideFilter={sideFilter}
            onSideFilterChange={setSideFilter}
          />
        </div>
      </div>

      {/* Bottom bar: long/short ratio + exchange filter */}
      <LiquidationBottomBar
        stats={filteredStats}
        exchangeFilter={exchangeFilter}
        onExchangeFilterChange={setExchangeFilter}
      />
      <ReferralBanner />
      <Footer />
    </div>
  );
}
