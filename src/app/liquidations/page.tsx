'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import Header from '@/components/Header';
import LiquidationTopBar from './components/LiquidationTopBar';
import LiquidationTreemap from './components/LiquidationTreemap';
import LiquidationFeed from './components/LiquidationFeed';
import LiquidationBottomBar from './components/LiquidationBottomBar';
import { isLiqCryptoSymbol, normalizeLiqSymbol } from '@/lib/liquidation-parsers';
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
const WS_EXCHANGES = ['Binance', 'Bybit', 'OKX', 'Bitget', 'Deribit', 'HTX', 'gTrade', 'dYdX', 'Bitfinex'];

// ─── SWR Fetcher ────────────────────────────────────
const fetcher = (url: string) => fetch(url).then(r => r.json());

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
  const [soundEnabled, setSoundEnabled] = useState(false);

  const hours = TIMEFRAME_HOURS[timeframe];

  // ─── Real-time WebSocket Feed (8 exchanges) ─────
  const { liquidations: wsLiqs, connections } = useMultiExchangeLiquidations({
    exchanges: WS_EXCHANGES,
    minValue: 1000, // $1K minimum to reduce noise
    maxItems: 500,
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
        soundEnabled={soundEnabled}
        onSoundToggle={() => setSoundEnabled(s => !s)}
      />

      {/* Connection status indicator */}
      {connections.length > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-white/[0.01] border-b border-white/[0.04]">
          <div className={`w-1.5 h-1.5 rounded-full ${connectedCount > 0 ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
          <span className="text-[10px] text-neutral-500">
            {connectedCount}/{connections.length} exchanges connected
          </span>
          <span className="text-[10px] text-neutral-700 ml-1">
            ({connections.filter(c => c.connected).map(c => c.exchange).join(', ')})
          </span>
          <span className="text-[10px] text-neutral-700 ml-auto" title="Liquidation data only from WebSocket-connected exchanges. Total may differ from aggregators with broader coverage.">
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
        stats={stats}
        exchangeFilter={exchangeFilter}
        onExchangeFilterChange={setExchangeFilter}
      />
    </div>
  );
}
