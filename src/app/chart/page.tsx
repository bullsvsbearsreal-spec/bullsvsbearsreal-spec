'use client';

/**
 * /chart — trading terminal.
 *
 * Layout (desktop ≥ 1280px):
 *   ┌───────────────────────────────────────────────────────────┐
 *   │  Site header (shared Header component)                    │
 *   ├───────────────────────────────────────────────────────────┤
 *   │  TerminalControlBar (asset class + symbol + interval +    │
 *   │                       action buttons)                      │
 *   ├──────────────┬───────────────────────────┬────────────────┤
 *   │              │  TerminalStatsBar (7 cells)│                │
 *   │  Sidebar     ├───────────────────────────┤  OrderBook    │
 *   │  · Watchlist │                            │                │
 *   │  · Recent    │  TradingViewChart          ├────────────────┤
 *   │  · Tools     │                            │  TradeTape     │
 *   │  · Signal    │                            │                │
 *   │              ├───────────────────────────┤                │
 *   │              │  BottomTabs                │                │
 *   └──────────────┴───────────────────────────┴────────────────┘
 *
 * Responsive:
 *   · < 1280px: hide right rail (OrderBook + TradeTape)
 *   · <  900px: hide left sidebar too. Chart + stats + bottom tabs only.
 *
 * State:
 *   · Top-level holds (assetClass, symbolLabel, interval). All panels
 *     re-render from these.
 *   · Recents tracked in localStorage (`infohub_chart_recents`).
 *   · Watchlist favourites in `infohub_favorites` (back-compat with
 *     the old /chart page — flipping the star here updates the old
 *     page's reads too).
 */
import { useEffect, useMemo, useState } from 'react';
import Header from '@/components/Header';
import { ASSET_TABS, WATCHLIST_DEFAULTS, findBySymbol, assetClassFor } from './catalog';
import type { AssetClass, Timeframe } from './catalog';
import { TerminalControlBar } from './components/TerminalControlBar';
import { TerminalSidebar } from './components/TerminalSidebar';
import { TerminalStatsBar } from './components/TerminalStatsBar';
import { TradingViewChart } from './components/TradingViewChart';
import { OrderBookPanel } from './components/OrderBookPanel';
import { TradeTapePanel } from './components/TradeTapePanel';
import { TerminalBottomTabs } from './components/TerminalBottomTabs';
import { useTickers } from '@/hooks/useSWRApi';

const RECENT_STORAGE_KEY = 'infohub_chart_recents';
const RECENT_MAX = 4;

export default function ChartPage() {
  const [assetClass, setAssetClass] = useState<AssetClass>('crypto');
  const [symbolLabel, setSymbolLabel] = useState<string>('BTC');
  // Avoid shadowing window.setInterval — renamed to setChartInterval.
  const [chartInterval, setChartInterval] = useState<Timeframe>('15');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);

  // Hydrate favourites + recents from localStorage
  useEffect(() => {
    try {
      const f = localStorage.getItem('infohub_favorites');
      if (f) {
        const parsed = JSON.parse(f);
        if (Array.isArray(parsed)) setFavorites(parsed.filter((s): s is string => typeof s === 'string'));
      }
    } catch { /* ignore */ }
    try {
      const r = localStorage.getItem(RECENT_STORAGE_KEY);
      if (r) {
        const parsed = JSON.parse(r);
        if (Array.isArray(parsed)) setRecents(parsed.filter((s): s is string => typeof s === 'string').slice(0, RECENT_MAX));
      }
    } catch { /* ignore */ }
  }, []);

  // Whenever symbol changes, push to recents (FIFO de-dup, max 4)
  useEffect(() => {
    if (!symbolLabel) return;
    setRecents(prev => {
      const next = [symbolLabel, ...prev.filter(s => s !== symbolLabel)].slice(0, RECENT_MAX);
      try { localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [symbolLabel]);

  // Switching asset class without a symbol picked → default to that
  // class's first pinned symbol.
  const handleAssetClassChange = (c: AssetClass) => {
    setAssetClass(c);
    const tab = ASSET_TABS.find(t => t.id === c);
    if (tab && !tab.pinned.some(s => s.label === symbolLabel)) {
      setSymbolLabel(tab.pinned[0]?.label ?? 'BTC');
    }
  };

  const handleSymbolChange = (label: string) => {
    if (label === '__add__') return; // sentinel from sidebar +
    const cls = assetClassFor(label);
    if (cls && cls !== assetClass) setAssetClass(cls);
    setSymbolLabel(label);
  };

  const toggleFavorite = () => {
    setFavorites(prev => {
      const next = prev.includes(symbolLabel)
        ? prev.filter(s => s !== symbolLabel)
        : [symbolLabel, ...prev];
      try { localStorage.setItem('infohub_favorites', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  // Build ticker lookup once per ticker refresh, pass to sidebar
  const { data: tickerData } = useTickers();
  const tickerLookup = useMemo(() => {
    const map = new Map<string, { label: string; price?: number; change24h?: number }>();
    if (!tickerData) return map;
    type T = { symbol?: string; lastPrice?: number; price?: number; priceChangePercent24h?: number; changePercent24h?: number };
    // Aggregate per symbol (median price, avg change) since tickers
    // are one row per venue.
    const grouped = new Map<string, { prices: number[]; changes: number[] }>();
    for (const r of tickerData as T[]) {
      const sym = (r.symbol ?? '').toUpperCase();
      if (!sym) continue;
      const p = r.lastPrice ?? r.price ?? 0;
      const c = r.priceChangePercent24h ?? r.changePercent24h ?? 0;
      const cur = grouped.get(sym) ?? { prices: [], changes: [] };
      if (p > 0) cur.prices.push(p);
      cur.changes.push(c);
      grouped.set(sym, cur);
    }
    grouped.forEach((v, sym) => {
      const sortedPrices = [...v.prices].sort((a: number, b: number) => a - b);
      const mid = sortedPrices.length > 0
        ? (sortedPrices.length % 2 === 0
            ? (sortedPrices[sortedPrices.length / 2 - 1] + sortedPrices[sortedPrices.length / 2]) / 2
            : sortedPrices[Math.floor(sortedPrices.length / 2)])
        : undefined;
      const avgChange = v.changes.length > 0
        ? v.changes.reduce((a: number, b: number) => a + b, 0) / v.changes.length
        : undefined;
      map.set(sym, { label: sym, price: mid, change24h: avgChange });
    });
    return map;
  }, [tickerData]);

  const activeTicker = tickerLookup.get(symbolLabel);
  const livePrice = activeTicker?.price ?? null;
  const livePriceChange24h = activeTicker?.change24h ?? null;

  const activeSymbolMeta = findBySymbol(symbolLabel);
  const tvSymbol = activeSymbolMeta?.tvSymbol ?? `BINANCE:${symbolLabel}USDT`;
  const isFavorited = favorites.includes(symbolLabel);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <Header />
      <TerminalControlBar
        assetClass={assetClass}
        symbolLabel={symbolLabel}
        interval={chartInterval}
        livePrice={livePrice}
        livePriceChange24h={livePriceChange24h}
        isFavorited={isFavorited}
        onAssetClassChange={handleAssetClassChange}
        onSymbolChange={handleSymbolChange}
        onIntervalChange={setChartInterval}
        onToggleFavorite={toggleFavorite}
      />

      {/* Terminal grid */}
      <div
        className="flex-1 grid min-h-0"
        style={{
          gridTemplateColumns: 'minmax(180px, 220px) 1fr minmax(260px, 300px)',
          gridTemplateRows: 'auto 1fr 280px',
          gridTemplateAreas: `
            "sidebar stats  right"
            "sidebar chart  right"
            "sidebar bottom right"
          `,
        }}
      >
        <div style={{ gridArea: 'sidebar' }} className="hidden md:block min-w-0 overflow-hidden">
          <TerminalSidebar
            activeSymbol={symbolLabel}
            tickerLookup={tickerLookup}
            recents={recents}
            onSelect={handleSymbolChange}
          />
        </div>

        <div style={{ gridArea: 'stats' }} className="min-w-0">
          <TerminalStatsBar symbol={symbolLabel} assetClass={assetClass} />
        </div>

        <div style={{ gridArea: 'chart' }} className="min-w-0 min-h-0 overflow-hidden bg-black border-r border-white/[0.06]">
          <TradingViewChart tvSymbol={tvSymbol} interval={chartInterval} />
        </div>

        <div style={{ gridArea: 'right' }} className="hidden xl:flex flex-col min-w-0 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 border-b border-white/[0.06]">
            <OrderBookPanel symbol={symbolLabel} />
          </div>
          <div className="flex-1 min-h-0">
            <TradeTapePanel symbol={symbolLabel} />
          </div>
        </div>

        <div style={{ gridArea: 'bottom' }} className="min-w-0 min-h-0 overflow-hidden">
          <TerminalBottomTabs symbol={symbolLabel} />
        </div>
      </div>
    </div>
  );
}
