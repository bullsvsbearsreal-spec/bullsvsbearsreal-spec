'use client';

import { Suspense, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ChevronDown, Search, X, Star, TrendingUp, BarChart3, DollarSign, Wheat, Globe2 } from 'lucide-react';
import Logo from '@/components/Logo';
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
      { label: 'BTC', tvSymbol: 'BITSTAMP:BTCUSD', displayPair: '/USD', icon: 'btc' },
      { label: 'ETH', tvSymbol: 'BITSTAMP:ETHUSD', displayPair: '/USD', icon: 'eth' },
      { label: 'SOL', tvSymbol: 'COINBASE:SOLUSD', displayPair: '/USD', icon: 'sol' },
      { label: 'XRP', tvSymbol: 'BITSTAMP:XRPUSD', displayPair: '/USD', icon: 'xrp' },
      { label: 'DOGE', tvSymbol: 'COINBASE:DOGEUSD', displayPair: '/USD', icon: 'doge' },
      { label: 'BNB', tvSymbol: 'BINANCE:BNBUSDT', displayPair: '/USDT', icon: 'bnb' },
      { label: 'ADA', tvSymbol: 'COINBASE:ADAUSD', displayPair: '/USD', icon: 'ada' },
      { label: 'AVAX', tvSymbol: 'COINBASE:AVAXUSD', displayPair: '/USD', icon: 'avax' },
      { label: 'LINK', tvSymbol: 'COINBASE:LINKUSD', displayPair: '/USD', icon: 'link' },
      { label: 'DOT', tvSymbol: 'COINBASE:DOTUSD', displayPair: '/USD', icon: 'dot' },
      { label: 'MATIC', tvSymbol: 'COINBASE:MATICUSD', displayPair: '/USD', icon: 'matic' },
      { label: 'SUI', tvSymbol: 'COINBASE:SUIUSD', displayPair: '/USD', icon: 'sui' },
      { label: 'NEAR', tvSymbol: 'COINBASE:NEARUSD', displayPair: '/USD', icon: 'near' },
      { label: 'APT', tvSymbol: 'COINBASE:APTUSD', displayPair: '/USD', icon: 'apt' },
      { label: 'OP', tvSymbol: 'COINBASE:OPUSD', displayPair: '/USD', icon: 'op' },
      { label: 'ARB', tvSymbol: 'COINBASE:ARBUSD', displayPair: '/USD', icon: 'arb' },
      { label: 'PEPE', tvSymbol: 'COINBASE:PEPEUSD', displayPair: '/USD', icon: 'pepe' },
      { label: 'WIF', tvSymbol: 'COINBASE:WIFUSD', displayPair: '/USD', icon: 'wif' },
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
   TradingView Widget — full-featured
   ═══════════════════════════════════════════════════════════════════════ */

function TradingViewChart({ tvSymbol, interval }: { tvSymbol: string; interval: string }) {
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
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: interval,
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
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
      studies: [],
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
  }, [tvSymbol, interval]);

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
   Page component
   ═══════════════════════════════════════════════════════════════════════ */

function ChartPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

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

  // Filter pinned symbols by search
  const filteredSymbols = useMemo(() => {
    const q = symbolQuery.trim().toLowerCase();
    if (!q) return currentTab.pinned;
    return currentTab.pinned.filter(s =>
      s.label.toLowerCase().includes(q) ||
      s.tvSymbol.toLowerCase().includes(q)
    );
  }, [symbolQuery, currentTab]);

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
  }, [interval, assetClass, updateURL]);

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
    <div className="h-screen w-screen bg-black flex flex-col overflow-hidden">
      <h1 className="sr-only">Chart</h1>
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-white/[0.08] bg-[#060606] relative z-20">
        <div className="flex items-center px-2 sm:px-3 py-1.5 gap-1.5 sm:gap-2">
          {/* Logo + back */}
          <Link
            href="/"
            aria-label="Back to home"
            className="flex items-center gap-1.5 text-neutral-400 hover:text-white transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden md:block"><Logo variant="full" size="xs" /></span>
          </Link>

          <div className="w-px h-5 bg-white/[0.06] flex-shrink-0" />

          {/* Asset class tabs */}
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

          {/* Symbol selector */}
          <div ref={symbolRef} className="relative flex-shrink-0">
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

                {/* Symbol list */}
                <div className="max-h-[60vh] overflow-y-auto py-1 scrollbar-thin" role="listbox">
                  {filteredSymbols.length === 0 && (
                    <div className="px-4 py-3 text-xs text-neutral-500 text-center">
                      No symbols found. Use TradingView search in the chart for more.
                    </div>
                  )}
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

      {/* ─── Quick symbol bar ───────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-white/[0.04] bg-black/40">
        <div className="flex items-center gap-0.5 px-2 sm:px-3 py-1 overflow-x-auto scrollbar-none" role="tablist" aria-label="Quick symbols">
          {currentTab.pinned.slice(0, 14).map(sym => (
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
              {assetClass === 'crypto' && sym.icon && (
                <TokenIconSimple symbol={sym.icon} size={12} />
              )}
              {sym.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Feature hint (first visit only) ────── */}
      <div className="flex-shrink-0 px-2">
        <FeatureHint page="/chart" />
      </div>

      {/* ─── TradingView Chart + Tape Sidebar + Metrics Panel ────── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 flex min-h-0 relative z-0" style={{ minHeight: '250px' }}>
          <div className="flex-1 relative overflow-hidden">
            <ChartErrorBoundary name="TradingView Chart" minHeight="250px">
              <TradingViewChart tvSymbol={tvSymbol} interval={interval} />
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
    <Suspense fallback={<div className="h-screen w-screen bg-black" />}>
      <ChartPageInner />
    </Suspense>
  );
}
