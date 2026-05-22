'use client';

import { Suspense, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChevronDown, Search, X, Star, TrendingUp, BarChart3, DollarSign, Wheat, Globe2, Layers, Cpu, Flame, Zap, Clock, Bell, Activity, GitCompareArrows, Crosshair, Eye, ExternalLink, Link2, Maximize2 } from 'lucide-react';
import Link from 'next/link';
import { TokenIconSimple } from '@/components/TokenIcon';
import CryptoMetricsPanel from './components/CryptoMetricsPanel';
import ChartErrorBoundary from './components/ChartErrorBoundary';
import SoundToggle from '@/components/SoundToggle';
import FeatureHint from '@/components/FeatureHint';
import dynamic from 'next/dynamic';

const TapeSidebar = dynamic(() => import('./components/TapeSidebar'), {
  ssr: false,
  loading: () => null,
});

/* ═══════════════════════════════════════════════════════════════════════
   Asset class definitions
   ═══════════════════════════════════════════════════════════════════════ */

type AssetClass = 'crypto' | 'stocks' | 'forex' | 'commodities' | 'indices';

interface AssetSymbol {
  label: string;          // Display name: "BTC", "AAPL", "EUR/USD"
  tvSymbol: string;       // TradingView symbol: "BINANCE:BTCUSDT", "NASDAQ:AAPL"
  displayPair?: string;   // Optional pair display: "/USDT", ""
  icon?: string;          // For crypto we use TokenIconSimple
  cat?: string;           // Category grouping for grid display
}

interface AssetTab {
  id: AssetClass;
  label: string;
  icon: React.ReactNode;
  pinned: AssetSymbol[];
}

const ASSET_TABS: AssetTab[] = [
  {
    id: 'crypto',
    label: 'Crypto',
    icon: <TrendingUp className="w-3.5 h-3.5" />,
    pinned: [
      { label: 'BTC', tvSymbol: 'BITSTAMP:BTCUSD', displayPair: '/USD', icon: 'btc', cat: 'Top' },
      { label: 'ETH', tvSymbol: 'BITSTAMP:ETHUSD', displayPair: '/USD', icon: 'eth', cat: 'Top' },
      { label: 'SOL', tvSymbol: 'COINBASE:SOLUSD', displayPair: '/USD', icon: 'sol', cat: 'Top' },
      { label: 'XRP', tvSymbol: 'BITSTAMP:XRPUSD', displayPair: '/USD', icon: 'xrp', cat: 'Top' },
      { label: 'BNB', tvSymbol: 'BINANCE:BNBUSDT', displayPair: '/USDT', icon: 'bnb', cat: 'Top' },
      { label: 'DOGE', tvSymbol: 'COINBASE:DOGEUSD', displayPair: '/USD', icon: 'doge', cat: 'Top' },
      { label: 'ADA', tvSymbol: 'COINBASE:ADAUSD', displayPair: '/USD', icon: 'ada', cat: 'Top' },
      { label: 'AVAX', tvSymbol: 'COINBASE:AVAXUSD', displayPair: '/USD', icon: 'avax', cat: 'Top' },
      { label: 'LINK', tvSymbol: 'COINBASE:LINKUSD', displayPair: '/USD', icon: 'link', cat: 'Top' },
      { label: 'DOT', tvSymbol: 'COINBASE:DOTUSD', displayPair: '/USD', icon: 'dot', cat: 'Top' },
      { label: 'TRX', tvSymbol: 'BINANCE:TRXUSDT', displayPair: '/USDT', icon: 'trx', cat: 'Top' },
      { label: 'TON', tvSymbol: 'BINANCE:TONUSDT', displayPair: '/USDT', icon: 'ton', cat: 'Top' },
      { label: 'SHIB', tvSymbol: 'COINBASE:SHIBUSD', displayPair: '/USD', icon: 'shib', cat: 'Top' },
      { label: 'SUI', tvSymbol: 'COINBASE:SUIUSD', displayPair: '/USD', icon: 'sui', cat: 'Top' },
      { label: 'NEAR', tvSymbol: 'COINBASE:NEARUSD', displayPair: '/USD', icon: 'near', cat: 'Top' },
      { label: 'APT', tvSymbol: 'COINBASE:APTUSD', displayPair: '/USD', icon: 'apt', cat: 'Top' },
      { label: 'LTC', tvSymbol: 'COINBASE:LTCUSD', displayPair: '/USD', icon: 'ltc', cat: 'Top' },
      { label: 'BCH', tvSymbol: 'COINBASE:BCHUSD', displayPair: '/USD', icon: 'bch', cat: 'Top' },
      { label: 'HBAR', tvSymbol: 'BINANCE:HBARUSDT', displayPair: '/USDT', icon: 'hbar', cat: 'Top' },
      { label: 'MATIC', tvSymbol: 'COINBASE:MATICUSD', displayPair: '/USD', icon: 'matic', cat: 'L2' },
      { label: 'OP', tvSymbol: 'COINBASE:OPUSD', displayPair: '/USD', icon: 'op', cat: 'L2' },
      { label: 'ARB', tvSymbol: 'COINBASE:ARBUSD', displayPair: '/USD', icon: 'arb', cat: 'L2' },
      { label: 'SEI', tvSymbol: 'COINBASE:SEIUSD', displayPair: '/USD', icon: 'sei', cat: 'L2' },
      { label: 'TIA', tvSymbol: 'COINBASE:TIAUSD', displayPair: '/USD', icon: 'tia', cat: 'L2' },
      { label: 'INJ', tvSymbol: 'COINBASE:INJUSD', displayPair: '/USD', icon: 'inj', cat: 'L2' },
      { label: 'STX', tvSymbol: 'COINBASE:STXUSD', displayPair: '/USD', icon: 'stx', cat: 'L2' },
      { label: 'UNI', tvSymbol: 'COINBASE:UNIUSD', displayPair: '/USD', icon: 'uni', cat: 'DeFi' },
      { label: 'AAVE', tvSymbol: 'COINBASE:AAVEUSD', displayPair: '/USD', icon: 'aave', cat: 'DeFi' },
      { label: 'MKR', tvSymbol: 'COINBASE:MKRUSD', displayPair: '/USD', icon: 'mkr', cat: 'DeFi' },
      { label: 'CRV', tvSymbol: 'COINBASE:CRVUSD', displayPair: '/USD', icon: 'crv', cat: 'DeFi' },
      { label: 'PENDLE', tvSymbol: 'BINANCE:PENDLEUSDT', displayPair: '/USDT', icon: 'pendle', cat: 'DeFi' },
      { label: 'ENA', tvSymbol: 'BINANCE:ENAUSDT', displayPair: '/USDT', icon: 'ena', cat: 'DeFi' },
      { label: 'JUP', tvSymbol: 'COINBASE:JUPUSD', displayPair: '/USD', icon: 'jup', cat: 'DeFi' },
      { label: 'RENDER', tvSymbol: 'COINBASE:RENDERUSD', displayPair: '/USD', icon: 'render', cat: 'AI' },
      { label: 'FET', tvSymbol: 'COINBASE:FETUSD', displayPair: '/USD', icon: 'fet', cat: 'AI' },
      { label: 'TAO', tvSymbol: 'BINANCE:TAOUSDT', displayPair: '/USDT', icon: 'tao', cat: 'AI' },
      { label: 'PEPE', tvSymbol: 'COINBASE:PEPEUSD', displayPair: '/USD', icon: 'pepe', cat: 'Meme' },
      { label: 'WIF', tvSymbol: 'COINBASE:WIFUSD', displayPair: '/USD', icon: 'wif', cat: 'Meme' },
      { label: 'BONK', tvSymbol: 'COINBASE:BONKUSD', displayPair: '/USD', icon: 'bonk', cat: 'Meme' },
      { label: 'FLOKI', tvSymbol: 'COINBASE:FLOKIUSD', displayPair: '/USD', icon: 'floki', cat: 'Meme' },
      { label: 'HYPE', tvSymbol: 'BINANCE:HYPEUSDT', displayPair: '/USDT', icon: 'hype', cat: 'Perps' },
      { label: 'DRIFT', tvSymbol: 'BINANCE:DRIFTUSDT', displayPair: '/USDT', icon: 'drift', cat: 'Perps' },
      { label: 'DYDX', tvSymbol: 'COINBASE:DYDXUSD', displayPair: '/USD', icon: 'dydx', cat: 'Perps' },
    ],
  },
  {
    id: 'stocks',
    label: 'Stocks',
    icon: <BarChart3 className="w-3.5 h-3.5" />,
    pinned: [
      { label: 'AAPL', tvSymbol: 'NASDAQ:AAPL', displayPair: '' },
      { label: 'MSFT', tvSymbol: 'NASDAQ:MSFT', displayPair: '' },
      { label: 'NVDA', tvSymbol: 'NASDAQ:NVDA', displayPair: '' },
      { label: 'GOOGL', tvSymbol: 'NASDAQ:GOOGL', displayPair: '' },
      { label: 'AMZN', tvSymbol: 'NASDAQ:AMZN', displayPair: '' },
      { label: 'TSLA', tvSymbol: 'NASDAQ:TSLA', displayPair: '' },
      { label: 'META', tvSymbol: 'NASDAQ:META', displayPair: '' },
      { label: 'AMD', tvSymbol: 'NASDAQ:AMD', displayPair: '' },
      { label: 'NFLX', tvSymbol: 'NASDAQ:NFLX', displayPair: '' },
      { label: 'JPM', tvSymbol: 'NYSE:JPM', displayPair: '' },
      { label: 'V', tvSymbol: 'NYSE:V', displayPair: '' },
      { label: 'BA', tvSymbol: 'NYSE:BA', displayPair: '' },
      { label: 'DIS', tvSymbol: 'NYSE:DIS', displayPair: '' },
      { label: 'COIN', tvSymbol: 'NASDAQ:COIN', displayPair: '' },
      { label: 'MSTR', tvSymbol: 'NASDAQ:MSTR', displayPair: '' },
      { label: 'PLTR', tvSymbol: 'NASDAQ:PLTR', displayPair: '' },
      { label: 'SMCI', tvSymbol: 'NASDAQ:SMCI', displayPair: '' },
      { label: 'ARM', tvSymbol: 'NASDAQ:ARM', displayPair: '' },
    ],
  },
  {
    id: 'forex',
    label: 'Forex',
    icon: <DollarSign className="w-3.5 h-3.5" />,
    pinned: [
      { label: 'EUR/USD', tvSymbol: 'FX:EURUSD', displayPair: '' },
      { label: 'GBP/USD', tvSymbol: 'FX:GBPUSD', displayPair: '' },
      { label: 'USD/JPY', tvSymbol: 'FX:USDJPY', displayPair: '' },
      { label: 'USD/CHF', tvSymbol: 'FX:USDCHF', displayPair: '' },
      { label: 'AUD/USD', tvSymbol: 'FX:AUDUSD', displayPair: '' },
      { label: 'USD/CAD', tvSymbol: 'FX:USDCAD', displayPair: '' },
      { label: 'NZD/USD', tvSymbol: 'FX:NZDUSD', displayPair: '' },
      { label: 'EUR/GBP', tvSymbol: 'FX:EURGBP', displayPair: '' },
      { label: 'EUR/JPY', tvSymbol: 'FX:EURJPY', displayPair: '' },
      { label: 'GBP/JPY', tvSymbol: 'FX:GBPJPY', displayPair: '' },
      { label: 'EUR/CHF', tvSymbol: 'FX:EURCHF', displayPair: '' },
      { label: 'AUD/JPY', tvSymbol: 'FX:AUDJPY', displayPair: '' },
      { label: 'EUR/AUD', tvSymbol: 'FX:EURAUD', displayPair: '' },
      { label: 'USD/MXN', tvSymbol: 'FX:USDMXN', displayPair: '' },
      { label: 'USD/TRY', tvSymbol: 'FX:USDTRY', displayPair: '' },
      { label: 'USD/ZAR', tvSymbol: 'FX:USDZAR', displayPair: '' },
      { label: 'DXY', tvSymbol: 'TVC:DXY', displayPair: '' },
    ],
  },
  {
    id: 'commodities',
    label: 'Commodities',
    icon: <Wheat className="w-3.5 h-3.5" />,
    pinned: [
      { label: 'Gold', tvSymbol: 'TVC:GOLD', displayPair: '' },
      { label: 'Silver', tvSymbol: 'TVC:SILVER', displayPair: '' },
      { label: 'Crude Oil', tvSymbol: 'TVC:USOIL', displayPair: '' },
      { label: 'Brent', tvSymbol: 'TVC:UKOIL', displayPair: '' },
      { label: 'Natural Gas', tvSymbol: 'PEPPERSTONE:NATGAS', displayPair: '' },
      { label: 'Copper', tvSymbol: 'PEPPERSTONE:COPPER', displayPair: '' },
      { label: 'Platinum', tvSymbol: 'TVC:PLATINUM', displayPair: '' },
      { label: 'Palladium', tvSymbol: 'TVC:PALLADIUM', displayPair: '' },
      { label: 'Wheat', tvSymbol: 'PEPPERSTONE:WHEAT', displayPair: '' },
      { label: 'Corn', tvSymbol: 'PEPPERSTONE:CORN', displayPair: '' },
      { label: 'Soybeans', tvSymbol: 'PEPPERSTONE:SOYBEAN', displayPair: '' },
      { label: 'Coffee', tvSymbol: 'PEPPERSTONE:COFFEE', displayPair: '' },
      { label: 'Cocoa', tvSymbol: 'PEPPERSTONE:COCOA', displayPair: '' },
      { label: 'Sugar', tvSymbol: 'PEPPERSTONE:SUGAR', displayPair: '' },
      { label: 'Cotton', tvSymbol: 'PEPPERSTONE:COTTON', displayPair: '' },
    ],
  },
  {
    id: 'indices',
    label: 'Indices',
    icon: <Globe2 className="w-3.5 h-3.5" />,
    pinned: [
      { label: 'S&P 500', tvSymbol: 'FOREXCOM:SPX500', displayPair: '' },
      { label: 'NASDAQ 100', tvSymbol: 'FOREXCOM:NSXUSD', displayPair: '' },
      { label: 'Dow Jones', tvSymbol: 'FOREXCOM:DJI', displayPair: '' },
      { label: 'Russell 2000', tvSymbol: 'FOREXCOM:RUSS2000', displayPair: '' },
      { label: 'VIX', tvSymbol: 'CAPITALCOM:VIX', displayPair: '' },
      { label: 'DAX', tvSymbol: 'FOREXCOM:DEU40', displayPair: '' },
      { label: 'FTSE 100', tvSymbol: 'FOREXCOM:UK100', displayPair: '' },
      { label: 'CAC 40', tvSymbol: 'FOREXCOM:FRA40', displayPair: '' },
      { label: 'Nikkei 225', tvSymbol: 'FOREXCOM:JPN225', displayPair: '' },
      { label: 'Hang Seng', tvSymbol: 'FOREXCOM:HKG33', displayPair: '' },
      { label: 'Euro Stoxx 50', tvSymbol: 'FOREXCOM:EU50', displayPair: '' },
      { label: 'ASX 200', tvSymbol: 'FOREXCOM:AUS200', displayPair: '' },
      { label: 'Spain 35', tvSymbol: 'FOREXCOM:ESP35', displayPair: '' },
      { label: 'SPY ETF', tvSymbol: 'AMEX:SPY', displayPair: '' },
      { label: 'QQQ ETF', tvSymbol: 'NASDAQ:QQQ', displayPair: '' },
    ],
  },
];

const TIMEFRAMES = [
  { label: '1m', value: '1', key: '1' },
  { label: '5m', value: '5', key: '2' },
  { label: '15m', value: '15', key: '3' },
  { label: '1H', value: '60', key: '4' },
  { label: '4H', value: '240', key: '5' },
  { label: '1D', value: 'D', key: '6' },
  { label: '1W', value: 'W', key: '7' },
] as const;

/* ═══════════════════════════════════════════════════════════════════════
   Live ticker data + persistence helpers
   ═══════════════════════════════════════════════════════════════════════ */

interface TickerLite {
  symbol: string;
  price: number;
  change24h: number;
  quoteVolume24h: number;
}

/** Single-flight 30s-refresh fetcher for /api/tickers. Aggregates per
 *  symbol across venues (median price, max quote volume) so the picker
 *  shows ONE row per coin sorted by global 24h volume. */
function useAllTickers(): { tickers: TickerLite[]; loading: boolean } {
  const [tickers, setTickers] = useState<TickerLite[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const r = await fetch('/api/tickers', { signal: AbortSignal.timeout(10_000) });
        if (!r.ok) return;
        const j = await r.json();
        const raw: Array<{ symbol: string; lastPrice?: number; price?: number; priceChangePercent24h?: number; changePercent24h?: number; quoteVolume24h?: number }> =
          Array.isArray(j) ? j : (j?.data ?? []);
        if (!mounted) return;
        // Bucket per symbol: collect all venue quotes
        const bySym = new Map<string, { prices: number[]; chgs: number[]; vols: number[] }>();
        for (const t of raw) {
          if (!t.symbol) continue;
          const price = t.lastPrice ?? t.price ?? 0;
          if (price <= 0) continue;
          const chg = t.priceChangePercent24h ?? t.changePercent24h ?? 0;
          const vol = t.quoteVolume24h ?? 0;
          const slot = bySym.get(t.symbol) ?? { prices: [], chgs: [], vols: [] };
          slot.prices.push(price);
          slot.chgs.push(chg);
          slot.vols.push(vol);
          bySym.set(t.symbol, slot);
        }
        const median = (xs: number[]) => {
          if (xs.length === 0) return 0;
          const s = [...xs].sort((a, b) => a - b);
          return s[Math.floor(s.length / 2)];
        };
        const list: TickerLite[] = [];
        bySym.forEach((v, k) => {
          // Use max volume (the leading venue's volume) — sums can double-
          // count when different venues report on the same liquidity, and
          // medians under-state for high-cap coins like BTC.
          const maxVol = v.vols.length > 0 ? Math.max(...v.vols) : 0;
          list.push({ symbol: k, price: median(v.prices), change24h: median(v.chgs), quoteVolume24h: maxVol });
        });
        list.sort((a, b) => b.quoteVolume24h - a.quoteVolume24h);
        setTickers(list);
        setLoading(false);
      } catch { /* silent — keep last good list */ }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => { mounted = false; clearInterval(id); };
  }, []);
  return { tickers, loading };
}

/** Recent + favorite symbols persisted to localStorage. Both bounded
 *  (recents to 12, favorites unlimited but typically <30). Survives
 *  refresh + tab switches so the user's working set stays warm. */
const LS_RECENTS_KEY = 'ih:chart:recents';
const LS_FAVORITES_KEY = 'ih:chart:favorites';
const RECENTS_MAX = 12;

function loadStringList(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(x => typeof x === 'string') : [];
  } catch { return []; }
}

function saveStringList(key: string, list: string[]) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, JSON.stringify(list)); } catch { /* quota */ }
}

/** Build a TradingView symbol for a given crypto label. Falls back to
 *  Binance USDT pair (most coverage); for tokens not on Binance the
 *  iframe's own search lets the user pick a different venue. */
function tvSymbolFor(label: string): string {
  return `BINANCE:${label.toUpperCase()}USDT`;
}

/* ═══════════════════════════════════════════════════════════════════════
   TradingView Widget — full-featured
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * TradingView chart style codes (per their embed widget docs):
 *   '1' candles · '8' heikin-ashi · '2' line · '3' area · '0' bars
 * Plus we expose two indicator presets ('basic' = RSI, 'pro' = RSI + MACD
 * + Volume MA) that pre-load on first render. The user can still add /
 * remove studies via TradingView's own indicator menu — these presets
 * are just a sensible starting point so the chart isn't blank.
 */
type ChartStyle = '1' | '8' | '2' | '3';
type StudyPreset = 'none' | 'basic' | 'pro';

const STUDY_PRESETS: Record<StudyPreset, string[]> = {
  none: [],
  basic: ['STD;RSI'],
  pro: ['STD;RSI', 'STD;MACD', 'Volume@tv-basicstudies'],
};

function TradingViewChart({
  tvSymbol, interval, chartStyle, studyPreset, compareSymbol,
}: {
  tvSymbol: string;
  interval: string;
  chartStyle: ChartStyle;
  studyPreset: StudyPreset;
  compareSymbol?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;
    setLoading(true);
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    const studies = STUDY_PRESETS[studyPreset];
    // Compare overlay — TradingView accepts an array of objects with
    // symbol + position. We overlay onto the same pane so the lines
    // share the price axis; ideal for "BTC vs ETH" relative-strength
    // viewing without leaving the chart.
    const compareSymbols = compareSymbol
      ? [{ symbol: compareSymbol, position: 'SameScale' as const }]
      : undefined;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: interval,
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: chartStyle,
      locale: 'en',
      backgroundColor: 'rgba(0, 0, 0, 1)',
      gridColor: 'rgba(255, 255, 255, 0.03)',
      hide_top_toolbar: false,
      hide_legend: false,
      hide_side_toolbar: false,
      allow_symbol_change: true,
      save_image: true,
      calendar: false,
      hide_volume: false,
      support_host: 'https://www.tradingview.com',
      withdateranges: true,
      details: true,
      hotlist: true,
      show_popup_button: true,
      popup_width: '1000',
      popup_height: '650',
      studies,
      ...(compareSymbols ? { compareSymbols } : {}),
      enabled_features: [
        'study_templates',
      ],
      overrides: {
        'paneProperties.backgroundType': 'solid',
        'paneProperties.background': '#000000',
        'mainSeriesProperties.candleStyle.upColor': '#eab308',
        'mainSeriesProperties.candleStyle.downColor': '#ef4444',
        'mainSeriesProperties.candleStyle.borderUpColor': '#eab308',
        'mainSeriesProperties.candleStyle.borderDownColor': '#ef4444',
        'mainSeriesProperties.candleStyle.wickUpColor': '#eab308',
        'mainSeriesProperties.candleStyle.wickDownColor': '#ef4444',
      },
    });

    // Hide loading skeleton once TradingView iframe loads
    script.onload = () => setTimeout(() => setLoading(false), 600);
    script.onerror = () => setLoading(false);

    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container';
    widgetContainer.style.height = '100%';
    widgetContainer.style.width = '100%';

    const widgetInner = document.createElement('div');
    widgetInner.className = 'tradingview-widget-container__widget';
    widgetInner.style.height = 'calc(100% - 32px)';
    widgetInner.style.width = '100%';

    widgetContainer.appendChild(widgetInner);
    widgetContainer.appendChild(script);
    containerRef.current.appendChild(widgetContainer);

    const container = containerRef.current;
    return () => {
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [tvSymbol, interval, chartStyle, studyPreset, compareSymbol]);

  return (
    <div className="w-full h-full relative">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black" aria-hidden="true">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-hub-yellow/30 border-t-hub-yellow rounded-full animate-spin" />
            <span className="text-[11px] text-neutral-600 font-medium">Loading chart...</span>
          </div>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Tool button — used by the Tools strip below the symbol bar
   ═══════════════════════════════════════════════════════════════════════ */

function ToolButton({
  icon, label, title, href, external, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  href?: string;
  external?: boolean;
  onClick?: () => void;
}) {
  const cls =
    'flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors';
  if (onClick) {
    return (
      <button onClick={onClick} title={title} aria-label={title} className={cls}>
        {icon}
        <span className="hidden sm:inline">{label}</span>
      </button>
    );
  }
  if (external && href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" title={title} aria-label={title} className={cls}>
        {icon}
        <span className="hidden sm:inline">{label}</span>
      </a>
    );
  }
  if (href) {
    return (
      <Link href={href} title={title} aria-label={title} className={cls}>
        {icon}
        <span className="hidden sm:inline">{label}</span>
      </Link>
    );
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════════════
   Page component
   ═══════════════════════════════════════════════════════════════════════ */

function ChartPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  /* ─── Live ticker data + recents/favorites ─────────────────────────── */
  const { tickers: allTickers } = useAllTickers();
  const [recents, setRecents] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  useEffect(() => {
    setRecents(loadStringList(LS_RECENTS_KEY));
    setFavorites(loadStringList(LS_FAVORITES_KEY));
  }, []);
  const pushRecent = useCallback((label: string) => {
    setRecents(prev => {
      const next = [label, ...prev.filter(x => x !== label)].slice(0, RECENTS_MAX);
      saveStringList(LS_RECENTS_KEY, next);
      return next;
    });
  }, []);
  const toggleFavorite = useCallback((label: string) => {
    setFavorites(prev => {
      const has = prev.includes(label);
      const next = has ? prev.filter(x => x !== label) : [label, ...prev];
      saveStringList(LS_FAVORITES_KEY, next);
      return next;
    });
  }, []);
  const isFavorite = useCallback((label: string) => favorites.includes(label), [favorites]);

  /* ─── Initialize state from URL params ─────────────────────────────── */
  const initialSymbolLabel = searchParams.get('s') || 'BTC';
  const initialInterval = searchParams.get('tf') || '60';
  const initialAssetClass = (searchParams.get('ac') as AssetClass) || 'crypto';

  // Find the matching symbol from URL params
  const initialTab = ASSET_TABS.find(t => t.id === initialAssetClass) ?? ASSET_TABS[0];
  const initialSymbol = initialTab.pinned.find(
    s => s.label.toUpperCase() === initialSymbolLabel.toUpperCase()
  ) ?? initialTab.pinned[0];

  const [assetClass, setAssetClass] = useState<AssetClass>(initialTab.id);
  const [tvSymbol, setTvSymbol] = useState(initialSymbol.tvSymbol);
  const [displayLabel, setDisplayLabel] = useState(initialSymbol.label);
  const [displayPair, setDisplayPair] = useState(initialSymbol.displayPair ?? '');
  const [interval, setInterval_] = useState(
    TIMEFRAMES.some(tf => tf.value === initialInterval) ? initialInterval : '60'
  );

  // Bottom panel
  const [bottomPanelOpen, setBottomPanelOpen] = useState(true);

  // Tape sidebar (only for crypto)
  const [tapeVisible, setTapeVisible] = useState(false);

  // Chart style (candles / heikin-ashi / line / area) + indicator
  // preset + compare overlay. Persisted to localStorage so the user's
  // preferred default sticks across reloads without us having to add
  // a settings page. Initial-mount-from-localStorage pattern (set in
  // useEffect, not useState initialiser) keeps the SSR render
  // deterministic — no hydration mismatch since the initial paint
  // shows the defaults and the localStorage values swap in after
  // mount.
  const [chartStyle, setChartStyle] = useState<ChartStyle>('1');
  const [studyPreset, setStudyPreset] = useState<StudyPreset>('basic');
  const [compareSymbol, setCompareSymbol] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const s = localStorage.getItem('ih:chart:style');
      if (s === '1' || s === '8' || s === '2' || s === '3') setChartStyle(s);
      const p = localStorage.getItem('ih:chart:studies');
      if (p === 'none' || p === 'basic' || p === 'pro') setStudyPreset(p);
      const c = localStorage.getItem('ih:chart:compare');
      if (c) setCompareSymbol(c);
    } catch { /* localStorage may be unavailable in private mode */ }
  }, []);
  const updateChartStyle = useCallback((s: ChartStyle) => {
    setChartStyle(s);
    try { localStorage.setItem('ih:chart:style', s); } catch { /* quota */ }
  }, []);
  const updateStudyPreset = useCallback((p: StudyPreset) => {
    setStudyPreset(p);
    try { localStorage.setItem('ih:chart:studies', p); } catch { /* quota */ }
  }, []);
  const updateCompareSymbol = useCallback((c: string | null) => {
    setCompareSymbol(c);
    try {
      if (c) localStorage.setItem('ih:chart:compare', c);
      else localStorage.removeItem('ih:chart:compare');
    } catch { /* quota */ }
  }, []);

  // Symbol dropdown
  const [symbolOpen, setSymbolOpen] = useState(false);
  const [symbolQuery, setSymbolQuery] = useState('');
  const symbolRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const currentTab = useMemo(
    () => ASSET_TABS.find(t => t.id === assetClass)!,
    [assetClass],
  );

  // Filter symbols by search. For crypto, when the user starts typing
  // we ALSO search the live /api/tickers universe (top ~500 coins by
  // 24h volume) so any listed coin is reachable — not just the curated
  // ~45 pinned ones. The curated list still wins for no-query browse
  // since it has category groupings and hand-tuned TradingView symbols
  // (e.g. BITSTAMP:BTCUSD for BTC vs auto-built BINANCE:BTCUSDT).
  const filteredSymbols = useMemo(() => {
    const q = symbolQuery.trim().toLowerCase();
    if (!q) return currentTab.pinned;
    const fromPinned = currentTab.pinned.filter(s =>
      s.label.toLowerCase().includes(q) || s.tvSymbol.toLowerCase().includes(q)
    );
    if (assetClass !== 'crypto') return fromPinned;
    // Merge in live-ticker matches that aren't already in the pinned
    // hits. Cap at ~80 results so the dropdown stays scrollable.
    const seen = new Set(fromPinned.map(s => s.label.toUpperCase()));
    const fromLive: AssetSymbol[] = [];
    for (const t of allTickers) {
      if (fromLive.length + fromPinned.length >= 80) break;
      const up = t.symbol.toUpperCase();
      if (seen.has(up)) continue;
      if (!up.toLowerCase().includes(q)) continue;
      seen.add(up);
      fromLive.push({
        label: up,
        tvSymbol: tvSymbolFor(up),
        displayPair: '/USDT',
        icon: t.symbol.toLowerCase(),
        cat: 'Live',
      });
    }
    return [...fromPinned, ...fromLive];
  }, [symbolQuery, currentTab, assetClass, allTickers]);

  // Live price + 24h change for the currently-selected crypto symbol.
  // Pulls from the same /api/tickers fetch — no extra request, just an
  // index lookup. Non-crypto asset classes leave this null since
  // TradingView's own header already shows price for those.
  const livePrice = useMemo(() => {
    if (assetClass !== 'crypto') return null;
    const t = allTickers.find(x => x.symbol.toUpperCase() === displayLabel.toUpperCase());
    return t ?? null;
  }, [assetClass, allTickers, displayLabel]);

  /* ─── Sync state to URL params (shallow, no navigation) ────────────── */
  const updateURL = useCallback((label: string, tf: string, ac: AssetClass) => {
    const params = new URLSearchParams();
    if (label !== 'BTC') params.set('s', label);
    if (tf !== '60') params.set('tf', tf);
    if (ac !== 'crypto') params.set('ac', ac);
    const qs = params.toString();
    router.replace(`/chart${qs ? `?${qs}` : ''}`, { scroll: false });
  }, [router]);

  const selectSymbol = useCallback((sym: AssetSymbol) => {
    setTvSymbol(sym.tvSymbol);
    setDisplayLabel(sym.label);
    setDisplayPair(sym.displayPair ?? '');
    setSymbolOpen(false);
    setSymbolQuery('');
    setFocusedIndex(-1);
    updateURL(sym.label, interval, assetClass);
    // Track in localStorage so the recents row + jump-back UX work
    // across reloads. Only push for crypto — non-crypto labels often
    // contain slashes ('EUR/USD') which would collide with key encoding.
    if (assetClass === 'crypto') pushRecent(sym.label);
  }, [interval, assetClass, updateURL, pushRecent]);

  const switchAssetClass = useCallback((ac: AssetClass) => {
    setAssetClass(ac);
    setSymbolQuery('');
    // Auto-select first symbol in the new asset class
    const tab = ASSET_TABS.find(t => t.id === ac)!;
    const first = tab.pinned[0];
    setTvSymbol(first.tvSymbol);
    setDisplayLabel(first.label);
    setDisplayPair(first.displayPair ?? '');
    updateURL(first.label, interval, ac);
  }, [interval, updateURL]);

  const setIntervalAndSync = useCallback((tf: string) => {
    setInterval_(tf);
    updateURL(displayLabel, tf, assetClass);
  }, [displayLabel, assetClass, updateURL]);

  /* ─── Keyboard shortcuts for timeframes + Escape ───────────────────── */
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) return;

      // Escape closes dropdown
      if (e.key === 'Escape' && symbolOpen) {
        setSymbolOpen(false);
        setFocusedIndex(-1);
        return;
      }

      // T key toggles tape sidebar
      if (e.key === 't' && assetClass === 'crypto' && !symbolOpen) {
        setTapeVisible(v => !v);
        return;
      }

      // Number keys for timeframes
      const idx = parseInt(e.key) - 1;
      if (idx >= 0 && idx < TIMEFRAMES.length) {
        setIntervalAndSync(TIMEFRAMES[idx].value);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [symbolOpen, assetClass, setIntervalAndSync]);

  /* ─── Keyboard navigation within dropdown ──────────────────────────── */
  const handleDropdownKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(i => Math.min(i + 1, filteredSymbols.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && focusedIndex >= 0 && focusedIndex < filteredSymbols.length) {
      e.preventDefault();
      selectSymbol(filteredSymbols[focusedIndex]);
    } else if (e.key === 'Escape') {
      setSymbolOpen(false);
      setFocusedIndex(-1);
    }
  }, [filteredSymbols, focusedIndex, selectSymbol]);

  /* ─── Close dropdown on outside click ──────────────────────────────── */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (symbolRef.current && !symbolRef.current.contains(e.target as Node)) {
        setSymbolOpen(false);
        setFocusedIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  /* ─── Focus search when dropdown opens ─────────────────────────────── */
  useEffect(() => {
    if (symbolOpen && searchInputRef.current) {
      searchInputRef.current.focus();
      setFocusedIndex(-1);
    }
  }, [symbolOpen]);

  return (
    // h-full + min-h-0 so the chart fills the main element that
    // TerminalShell allocates without spilling. Previously was
    // h-screen w-screen which double-counted the header height when
    // the shell wrapper became standard for /chart — chart bottom
    // got pushed past the viewport.
    <div id="main-content" className="h-full w-full bg-black flex flex-col overflow-hidden min-h-0">
      <h1 className="sr-only">Chart</h1>
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-white/[0.08] bg-[#060606] relative z-20">
        <div className="flex items-center px-2 sm:px-3 py-1.5 gap-1.5 sm:gap-2">
          {/* Asset class tabs — logo + back removed since TerminalShell's
              TerminalHeader already provides the brand mark + home link.
              Don't duplicate chrome on chart, just lead with content. */}
          <div className="flex items-center gap-0.5 flex-shrink-0" role="tablist" aria-label="Asset class">
            {ASSET_TABS.map(tab => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={assetClass === tab.id}
                onClick={() => switchAssetClass(tab.id)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
                  assetClass === tab.id
                    ? 'bg-hub-yellow/15 text-hub-yellow border border-hub-yellow/25'
                    : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-white/[0.06] flex-shrink-0" />

          {/* Symbol selector + favorite toggle + live price strip */}
          <div ref={symbolRef} className="relative flex-shrink-0 flex items-center gap-1.5">
            <button
              onClick={() => setSymbolOpen(!symbolOpen)}
              aria-expanded={symbolOpen}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors focus:ring-2 focus:ring-hub-yellow/30"
            >
              {assetClass === 'crypto' && (
                <TokenIconSimple symbol={displayLabel} size={16} />
              )}
              <span className="text-[13px] font-bold text-white">
                {displayLabel}
                {displayPair && <span className="text-neutral-500 font-normal text-xs">{displayPair}</span>}
              </span>
              <ChevronDown className={`w-3 h-3 text-neutral-500 transition-transform ${symbolOpen ? 'rotate-180' : ''}`} />
            </button>
            {/* Favorite star — toggles a localStorage flag so the user
                can pin their working set across reloads. Crypto only;
                the curated stocks/forex/commodities lists are already
                pre-pinned by category. */}
            {assetClass === 'crypto' && (
              <button
                onClick={() => toggleFavorite(displayLabel)}
                aria-label={isFavorite(displayLabel) ? `Unfavorite ${displayLabel}` : `Favorite ${displayLabel}`}
                aria-pressed={isFavorite(displayLabel)}
                title={isFavorite(displayLabel) ? 'Remove from favorites' : 'Add to favorites'}
                className={`p-1 rounded-md transition-colors ${isFavorite(displayLabel) ? 'text-hub-yellow hover:text-hub-yellow/80' : 'text-neutral-600 hover:text-white'}`}
              >
                <Star className={`w-3.5 h-3.5 ${isFavorite(displayLabel) ? 'fill-current' : ''}`} />
              </button>
            )}
            {/* Live price + 24h change — sourced from /api/tickers so
                the user sees the same aggregated median we show on
                /home + /screener. Hidden on mobile (≤sm) to keep the
                header from wrapping. */}
            {livePrice && livePrice.price > 0 && (
              <div className="hidden sm:flex items-baseline gap-1.5 px-2 py-1 rounded-md bg-black/40 border border-white/[0.04]" aria-live="polite">
                <span className="text-[13px] font-bold text-white tabular-nums">
                  ${livePrice.price >= 1
                    ? livePrice.price.toLocaleString(undefined, { maximumFractionDigits: 2 })
                    : livePrice.price.toPrecision(4)}
                </span>
                <span className={`text-[11px] font-medium tabular-nums ${livePrice.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {livePrice.change24h >= 0 ? '+' : ''}{livePrice.change24h.toFixed(2)}%
                </span>
              </div>
            )}

            {symbolOpen && (
              <div
                className="absolute top-full left-0 mt-1 z-50 w-72 sm:w-80 bg-[#0a0a0a] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden animate-scale-in"
                role="dialog"
                aria-label="Symbol picker"
                onKeyDown={handleDropdownKeyDown}
              >
                {/* Search */}
                <div className="relative px-3 py-2 border-b border-white/[0.06]">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    aria-label="Search symbols"
                    aria-activedescendant={focusedIndex >= 0 ? `symbol-${focusedIndex}` : undefined}
                    placeholder={`Search ${currentTab.label.toLowerCase()}...`}
                    value={symbolQuery}
                    onChange={e => { setSymbolQuery(e.target.value); setFocusedIndex(-1); }}
                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-hub-yellow/30 focus-visible:ring-2 focus-visible:ring-hub-yellow/50"
                  />
                  {symbolQuery && (
                    <button
                      onClick={() => setSymbolQuery('')}
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Asset class sub-tabs inside dropdown */}
                <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-white/[0.04] overflow-x-auto scrollbar-none">
                  {ASSET_TABS.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        switchAssetClass(tab.id);
                        setSymbolQuery('');
                      }}
                      className={`flex-shrink-0 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                        assetClass === tab.id
                          ? 'bg-hub-yellow/15 text-hub-yellow'
                          : 'text-neutral-600 hover:text-neutral-400'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Favorites + Recents pills — shown only on crypto when
                    the user isn't actively searching. Lets users jump
                    back to their working set without scrolling the
                    full grid. Star-toggle on the header keeps the
                    favorites list curated. */}
                {assetClass === 'crypto' && !symbolQuery.trim() && (favorites.length > 0 || recents.length > 0) && (
                  <div className="border-b border-white/[0.04] px-2 py-1.5 space-y-1.5">
                    {favorites.length > 0 && (
                      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                        <Star className="w-3 h-3 text-hub-yellow flex-shrink-0 fill-current" aria-hidden />
                        <span className="text-[9px] text-neutral-600 uppercase tracking-wider font-semibold flex-shrink-0 mr-1">Pinned</span>
                        {favorites.map(label => (
                          <button
                            key={`fav-${label}`}
                            onClick={() => selectSymbol({ label, tvSymbol: tvSymbolFor(label), displayPair: '/USDT', icon: label.toLowerCase() })}
                            className={`flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                              label === displayLabel
                                ? 'bg-hub-yellow/15 text-hub-yellow'
                                : 'bg-white/[0.04] text-neutral-300 hover:bg-white/[0.08]'
                            }`}
                          >
                            <TokenIconSimple symbol={label.toLowerCase()} size={11} />
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                    {recents.length > 0 && (
                      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                        <Clock className="w-3 h-3 text-neutral-500 flex-shrink-0" aria-hidden />
                        <span className="text-[9px] text-neutral-600 uppercase tracking-wider font-semibold flex-shrink-0 mr-1">Recent</span>
                        {recents.filter(r => !favorites.includes(r)).slice(0, 10).map(label => (
                          <button
                            key={`rec-${label}`}
                            onClick={() => selectSymbol({ label, tvSymbol: tvSymbolFor(label), displayPair: '/USDT', icon: label.toLowerCase() })}
                            className={`flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                              label === displayLabel
                                ? 'bg-hub-yellow/15 text-hub-yellow'
                                : 'bg-white/[0.04] text-neutral-400 hover:bg-white/[0.08]'
                            }`}
                          >
                            <TokenIconSimple symbol={label.toLowerCase()} size={11} />
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Symbol grid */}
                <div className="max-h-[60vh] overflow-y-auto py-1 scrollbar-thin" role="listbox">
                  {filteredSymbols.length === 0 && (
                    <div className="px-4 py-3 text-xs text-neutral-500 text-center">
                      No symbols found. Use TradingView search in the chart for more.
                    </div>
                  )}
                  {assetClass === 'crypto' && !symbolQuery.trim() ? (
                    /* ── Categorized grid for crypto ── */
                    (() => {
                      const CAT_META: Record<string, { icon: React.ReactNode; color: string }> = {
                        Top: { icon: <Star className="w-3 h-3" />, color: 'text-hub-yellow' },
                        L2: { icon: <Layers className="w-3 h-3" />, color: 'text-blue-400' },
                        DeFi: { icon: <Zap className="w-3 h-3" />, color: 'text-emerald-400' },
                        AI: { icon: <Cpu className="w-3 h-3" />, color: 'text-purple-400' },
                        Meme: { icon: <Flame className="w-3 h-3" />, color: 'text-orange-400' },
                        Perps: { icon: <TrendingUp className="w-3 h-3" />, color: 'text-cyan-400' },
                      };
                      const cats = ['Top', 'L2', 'DeFi', 'AI', 'Meme', 'Perps'];
                      const grouped = new Map<string, AssetSymbol[]>();
                      for (const sym of filteredSymbols) {
                        const c = sym.cat || 'Top';
                        if (!grouped.has(c)) grouped.set(c, []);
                        grouped.get(c)!.push(sym);
                      }
                      let globalIdx = 0;
                      return cats.filter(c => grouped.has(c)).map(cat => {
                        const syms = grouped.get(cat)!;
                        const meta = CAT_META[cat] || CAT_META.Top;
                        return (
                          <div key={cat}>
                            <div className="px-3 py-2 flex items-center gap-2">
                              <span className={meta.color}>{meta.icon}</span>
                              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">{cat}</span>
                              <span className={`text-[9px] tabular-nums font-medium ${meta.color} opacity-60`}>{syms.length}</span>
                              <div className="flex-1 h-px bg-white/[0.04]" />
                            </div>
                            <div className="grid grid-cols-3 gap-0.5 px-2 pb-1">
                              {syms.map(sym => {
                                const idx = globalIdx++;
                                return (
                                  <button
                                    key={sym.tvSymbol}
                                    id={`symbol-${idx}`}
                                    role="option"
                                    aria-selected={sym.tvSymbol === tvSymbol}
                                    onClick={() => selectSymbol(sym)}
                                    onMouseEnter={() => setFocusedIndex(idx)}
                                    className={`flex items-center gap-2 px-2 py-[6px] rounded-lg text-left transition-all ${
                                      sym.tvSymbol === tvSymbol
                                        ? 'bg-hub-yellow/15 ring-1 ring-hub-yellow/30'
                                        : focusedIndex === idx
                                          ? 'bg-white/[0.08]'
                                          : 'hover:bg-white/[0.04]'
                                    }`}
                                  >
                                    <span className={`shrink-0 transition-opacity ${sym.tvSymbol === tvSymbol ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>
                                      <TokenIconSimple symbol={sym.icon || sym.label} size={18} />
                                    </span>
                                    <span className={`text-[11px] font-medium truncate ${
                                      sym.tvSymbol === tvSymbol ? 'text-hub-yellow' : 'text-white'
                                    }`}>
                                      {sym.label}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      });
                    })()
                  ) : (
                    /* ── Flat list for search results & non-crypto ── */
                    <>
                      {!symbolQuery.trim() && (
                        <div className="px-3 pt-1.5 pb-1 flex items-center gap-1.5">
                          <Star className="w-3 h-3 text-hub-yellow/60" />
                          <span className="text-[10px] font-medium text-neutral-600 uppercase tracking-wider">
                            Popular {currentTab.label}
                          </span>
                        </div>
                      )}
                      {filteredSymbols.map((sym, idx) => (
                        <button
                          key={sym.tvSymbol}
                          id={`symbol-${idx}`}
                          role="option"
                          aria-selected={sym.tvSymbol === tvSymbol}
                          onClick={() => selectSymbol(sym)}
                          onMouseEnter={() => setFocusedIndex(idx)}
                          className={`w-full text-left px-3 py-1.5 transition-colors flex items-center gap-2 ${
                            focusedIndex === idx
                              ? 'bg-white/[0.08]'
                              : sym.tvSymbol === tvSymbol
                                ? 'bg-hub-yellow/10'
                                : 'hover:bg-white/[0.04]'
                          }`}
                        >
                          {assetClass === 'crypto' && sym.icon ? (
                            <TokenIconSimple symbol={sym.icon} size={18} />
                          ) : assetClass !== 'crypto' ? (
                            <div className={`w-[18px] h-[18px] rounded flex items-center justify-center text-[7px] font-bold flex-shrink-0 ${
                              assetClass === 'stocks' ? 'bg-blue-500/15 text-blue-400' :
                              assetClass === 'forex' ? 'bg-emerald-500/15 text-emerald-400' :
                              assetClass === 'commodities' ? 'bg-amber-500/15 text-amber-400' :
                              'bg-purple-500/15 text-purple-400'
                            }`}>
                              {sym.label.slice(0, 2).toUpperCase()}
                            </div>
                          ) : null}
                          <div className="flex-1 min-w-0">
                            <span className={`text-[13px] font-medium ${
                              sym.tvSymbol === tvSymbol ? 'text-hub-yellow' : 'text-white'
                            }`}>
                              {sym.label}
                            </span>
                            {sym.displayPair && (
                              <span className="text-neutral-600 text-xs">{sym.displayPair}</span>
                            )}
                          </div>
                          <span className="text-[10px] text-neutral-600 font-mono flex-shrink-0">
                            {sym.tvSymbol.split(':')[0]}
                          </span>
                        </button>
                      ))}
                    </>
                  )}
                </div>

                {/* Hints */}
                <div className="px-3 py-1.5 border-t border-white/[0.04] flex items-center justify-between">
                  <span className="text-[10px] text-neutral-600">
                    <kbd className="px-1 py-0.5 bg-white/[0.06] rounded text-[9px]">↑↓</kbd> navigate
                    <kbd className="ml-1.5 px-1 py-0.5 bg-white/[0.06] rounded text-[9px]">↵</kbd> select
                    <kbd className="ml-1.5 px-1 py-0.5 bg-white/[0.06] rounded text-[9px]">esc</kbd> close
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1" />

          {/* Sound toggle */}
          {assetClass === 'crypto' && <SoundToggle />}

          {/* Timeframe buttons */}
          <div className="flex items-center flex-wrap gap-0.5 flex-shrink-0" role="group" aria-label="Timeframe">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf.value}
                onClick={() => setIntervalAndSync(tf.value)}
                aria-pressed={interval === tf.value}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors flex-shrink-0 ${
                  interval === tf.value
                    ? 'bg-hub-yellow text-black font-bold'
                    : 'text-neutral-500 hover:text-white hover:bg-white/[0.06]'
                }`}
                title={`${tf.label} (Shortcut: ${tf.key})`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Quick symbol bar ─────────────────────────────────────────
          For crypto: shows favorites (★) first, then up to 12 recents,
          then fills with top-by-24h-volume coins from /api/tickers.
          Total surface stays one horizontal scroll-row tall so we
          don't push the chart down.

          For other asset classes: shows the curated pinned[0..14]
          list (same behavior as before) — those rosters are small
          enough not to need volume sorting. */}
      <div className="flex-shrink-0 border-b border-white/[0.04] bg-black/40">
        <div className="flex items-center gap-0.5 px-2 sm:px-3 py-1 overflow-x-auto scrollbar-none" role="tablist" aria-label="Quick symbols">
          {assetClass === 'crypto' ? (() => {
            // Build the working set: favorites + recents (de-duped),
            // then top-volume tickers to fill out to ~24 items.
            const seen = new Set<string>();
            const items: { label: string; kind: 'fav' | 'recent' | 'top' }[] = [];
            for (const f of favorites) {
              if (seen.has(f)) continue;
              seen.add(f);
              items.push({ label: f, kind: 'fav' });
            }
            for (const r of recents) {
              if (seen.has(r)) continue;
              seen.add(r);
              items.push({ label: r, kind: 'recent' });
              if (items.length >= 16) break;
            }
            for (const t of allTickers) {
              if (items.length >= 24) break;
              const up = t.symbol.toUpperCase();
              if (seen.has(up)) continue;
              seen.add(up);
              items.push({ label: up, kind: 'top' });
            }
            // Fallback to curated list if /api/tickers hasn't loaded yet
            if (items.length === 0) {
              for (const p of currentTab.pinned.slice(0, 14)) {
                items.push({ label: p.label, kind: 'top' });
              }
            }
            return items.map(({ label, kind }) => {
              const sel = label === displayLabel;
              return (
                <button
                  key={`${kind}-${label}`}
                  role="tab"
                  aria-selected={sel}
                  onClick={() => selectSymbol({ label, tvSymbol: tvSymbolFor(label), displayPair: '/USDT', icon: label.toLowerCase() })}
                  title={kind === 'fav' ? 'Pinned' : kind === 'recent' ? 'Recently viewed' : `Top by 24h volume`}
                  className={`flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                    sel
                      ? 'bg-hub-yellow/15 text-hub-yellow'
                      : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04]'
                  }`}
                >
                  {kind === 'fav' && <Star className="w-2.5 h-2.5 text-hub-yellow fill-current shrink-0" />}
                  <TokenIconSimple symbol={label.toLowerCase()} size={12} />
                  {label}
                </button>
              );
            });
          })() : (
            currentTab.pinned.slice(0, 14).map(sym => (
              <button
                key={sym.tvSymbol}
                role="tab"
                aria-selected={sym.tvSymbol === tvSymbol}
                onClick={() => selectSymbol(sym)}
                className={`flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                  sym.tvSymbol === tvSymbol
                    ? 'bg-hub-yellow/15 text-hub-yellow'
                    : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04]'
                }`}
              >
                {sym.label}
              </button>
            ))
          )}
        </div>
      </div>

      {/* ─── Tools strip ─────────────────────────────────────────────
          Compact one-row toolbar with InfoHub-deep-links for the
          current symbol (crypto only — non-crypto asset classes hide
          this row since most of these InfoHub features are perp-
          focused). Each link prefills the destination page with the
          active symbol via `?symbol=` so the user lands in context.

          Plus chart actions: copy permalink, open in TradingView. */}
      {assetClass === 'crypto' && (
        <div className="flex-shrink-0 border-b border-white/[0.04] bg-black/30">
          <div className="flex items-center gap-0.5 px-2 sm:px-3 py-1 overflow-x-auto scrollbar-none" role="toolbar" aria-label="Chart tools">
            {/* Chart style — candles / heikin-ashi / line / area */}
            <div className="flex items-center gap-0.5 mr-1 flex-shrink-0 border-r border-white/[0.06] pr-1.5">
              {(
                [
                  { v: '1' as ChartStyle, label: 'Candles' },
                  { v: '8' as ChartStyle, label: 'HA' },
                  { v: '2' as ChartStyle, label: 'Line' },
                  { v: '3' as ChartStyle, label: 'Area' },
                ]
              ).map(({ v, label }) => (
                <button
                  key={v}
                  onClick={() => updateChartStyle(v)}
                  aria-pressed={chartStyle === v}
                  title={`Chart style: ${label}`}
                  className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    chartStyle === v
                      ? 'bg-hub-yellow/15 text-hub-yellow'
                      : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* Indicator preset — none / basic (RSI) / pro (RSI+MACD+Volume) */}
            <div className="flex items-center gap-0.5 mr-1 flex-shrink-0 border-r border-white/[0.06] pr-1.5">
              {(
                [
                  { v: 'none' as StudyPreset, label: 'Bare' },
                  { v: 'basic' as StudyPreset, label: 'RSI' },
                  { v: 'pro' as StudyPreset, label: 'Pro' },
                ]
              ).map(({ v, label }) => (
                <button
                  key={v}
                  onClick={() => updateStudyPreset(v)}
                  aria-pressed={studyPreset === v}
                  title={v === 'none' ? 'No indicators' : v === 'basic' ? 'RSI only' : 'RSI + MACD + Volume MA'}
                  className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    studyPreset === v
                      ? 'bg-hub-yellow/15 text-hub-yellow'
                      : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* Compare overlay — quick-toggle BTC overlay so the user
                can spot relative-strength shifts vs the macro asset.
                For BTC itself, toggle vs ETH instead. Click again to
                clear. */}
            {(() => {
              const macro = displayLabel.toUpperCase() === 'BTC' ? 'ETH' : 'BTC';
              const macroTV = tvSymbolFor(macro);
              const active = compareSymbol === macroTV;
              return (
                <button
                  onClick={() => updateCompareSymbol(active ? null : macroTV)}
                  aria-pressed={active}
                  title={active ? `Stop comparing with ${macro}` : `Compare vs ${macro}`}
                  className={`flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors mr-1.5 border-r border-white/[0.06] pr-2 ${
                    active
                      ? 'bg-hub-yellow/15 text-hub-yellow'
                      : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04]'
                  }`}
                >
                  <GitCompareArrows className="w-3 h-3" />
                  vs {macro}
                </button>
              );
            })()}
            <span className="hidden sm:inline text-[9px] uppercase tracking-wider font-semibold text-neutral-600 mr-1.5 flex-shrink-0">Tools</span>
            <ToolButton
              icon={<Bell className="w-3 h-3" />}
              label="Alert"
              title="Set a price / funding alert for this symbol"
              href={`/alerts?symbol=${encodeURIComponent(displayLabel)}`}
            />
            <ToolButton
              icon={<Activity className="w-3 h-3" />}
              label="Funding"
              title="Compare funding rates across venues"
              href={`/funding?symbol=${encodeURIComponent(displayLabel)}`}
            />
            <ToolButton
              icon={<GitCompareArrows className="w-3 h-3" />}
              label="Arb"
              title="Funding-arb pairs involving this symbol"
              href={`/spread-scanner?symbol=${encodeURIComponent(displayLabel)}`}
            />
            <ToolButton
              icon={<Crosshair className="w-3 h-3" />}
              label="Liq Map"
              title="Liquidation levels heatmap"
              href={`/liquidation-map?symbol=${encodeURIComponent(displayLabel)}`}
            />
            <ToolButton
              icon={<Eye className="w-3 h-3" />}
              label="OI"
              title="Open interest across venues"
              href={`/open-interest?symbol=${encodeURIComponent(displayLabel)}`}
            />
            <ToolButton
              icon={<TrendingUp className="w-3 h-3" />}
              label="Whales"
              title="Largest holders + recent whale moves"
              href={`/hl-whales?symbol=${encodeURIComponent(displayLabel)}`}
            />
            <div className="w-px h-4 bg-white/[0.06] mx-1 flex-shrink-0" />
            <ToolButton
              icon={<Link2 className="w-3 h-3" />}
              label="Copy"
              title="Copy a permalink to this exact chart (symbol + timeframe)"
              onClick={() => {
                if (typeof window === 'undefined') return;
                const params = new URLSearchParams();
                params.set('s', displayLabel);
                params.set('tf', interval);
                params.set('ac', assetClass);
                const url = `${window.location.origin}/chart?${params.toString()}`;
                navigator.clipboard?.writeText(url).catch(() => {});
              }}
            />
            <ToolButton
              icon={<Maximize2 className="w-3 h-3" />}
              label="Fullscreen"
              title="Fullscreen this chart"
              onClick={() => {
                const el = document.getElementById('main-content');
                if (!el) return;
                if (document.fullscreenElement) {
                  document.exitFullscreen?.().catch(() => {});
                } else {
                  el.requestFullscreen?.().catch(() => {});
                }
              }}
            />
            <ToolButton
              icon={<ExternalLink className="w-3 h-3" />}
              label="TradingView"
              title="Open this chart on TradingView.com"
              href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}`}
              external
            />
          </div>
        </div>
      )}

      {/* ─── Feature hint (first visit only) ────── */}
      <div className="flex-shrink-0 px-2">
        <FeatureHint page="/chart" />
      </div>

      {/* ─── TradingView Chart + Tape Sidebar + Metrics Panel ────── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 flex min-h-0 relative z-0" style={{ minHeight: '250px' }}>
          <div className="flex-1 relative overflow-hidden">
            <ChartErrorBoundary name="TradingView Chart" minHeight="250px">
              <TradingViewChart
                tvSymbol={tvSymbol}
                interval={interval}
                chartStyle={chartStyle}
                studyPreset={studyPreset}
                compareSymbol={compareSymbol}
              />
            </ChartErrorBoundary>
          </div>
          {assetClass === 'crypto' && (
            <ChartErrorBoundary name="Trade Tape">
              <TapeSidebar
                symbol={displayLabel}
                visible={tapeVisible}
                onToggle={() => setTapeVisible(v => !v)}
              />
            </ChartErrorBoundary>
          )}

        </div>
        {assetClass === 'crypto' && (
          <ChartErrorBoundary name="Crypto Metrics">
            <CryptoMetricsPanel
              symbol={displayLabel}
              open={bottomPanelOpen}
              onToggle={() => setBottomPanelOpen(v => !v)}
            />
          </ChartErrorBoundary>
        )}
      </div>
    </div>
  );
}

export default function ChartPage() {
  return (
    <Suspense fallback={<div className="h-full w-full bg-black" />}>
      <ChartPageInner />
    </Suspense>
  );
}
