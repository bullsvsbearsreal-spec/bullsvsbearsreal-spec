'use client';

// /chart — Terminal-styled trading chart.
// TradingView Advanced Chart at the core, surrounded by a Bloomberg-style
// control bar, live-stat strip, and optional trade tape side panel.

import { Suspense, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ChevronDown, Search, X, Star, TrendingUp, BarChart3, DollarSign,
  Wheat, Globe2, Layers, Cpu, Flame, Zap, Activity, Volume2,
} from 'lucide-react';
import { TokenIconSimple } from '@/components/TokenIcon';
import ChartErrorBoundary from './components/ChartErrorBoundary';
import SoundToggle from '@/components/SoundToggle';
import { SatPing, StreamBars } from '@/components/design-system';

const TapeSidebar = dynamic(() => import('./components/TapeSidebar'), { ssr: false, loading: () => null });
const CryptoMetricsPanel = dynamic(() => import('./components/CryptoMetricsPanel'), { ssr: false, loading: () => null });

// ────────────────────────────────────────────────────────────────────
// Asset definitions
// ────────────────────────────────────────────────────────────────────
type AssetClass = 'crypto' | 'stocks' | 'forex' | 'commodities' | 'indices';

interface AssetSymbol {
  label: string;
  tvSymbol: string;
  displayPair?: string;
  icon?: string;
  cat?: string;
}

interface AssetTab {
  id: AssetClass;
  label: string;
  icon: React.ReactNode;
  pinned: AssetSymbol[];
}

const ASSET_TABS: AssetTab[] = [
  {
    id: 'crypto', label: 'Crypto', icon: <TrendingUp size={12} />,
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
      { label: 'OP',  tvSymbol: 'COINBASE:OPUSD',  displayPair: '/USD', icon: 'op',  cat: 'L2' },
      { label: 'ARB', tvSymbol: 'COINBASE:ARBUSD', displayPair: '/USD', icon: 'arb', cat: 'L2' },
      { label: 'SEI', tvSymbol: 'COINBASE:SEIUSD', displayPair: '/USD', icon: 'sei', cat: 'L2' },
      { label: 'TIA', tvSymbol: 'COINBASE:TIAUSD', displayPair: '/USD', icon: 'tia', cat: 'L2' },
      { label: 'INJ', tvSymbol: 'COINBASE:INJUSD', displayPair: '/USD', icon: 'inj', cat: 'L2' },
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
    id: 'stocks', label: 'Stocks', icon: <BarChart3 size={12} />,
    pinned: [
      { label: 'AAPL', tvSymbol: 'NASDAQ:AAPL', displayPair: '' },
      { label: 'MSFT', tvSymbol: 'NASDAQ:MSFT', displayPair: '' },
      { label: 'NVDA', tvSymbol: 'NASDAQ:NVDA', displayPair: '' },
      { label: 'GOOGL', tvSymbol: 'NASDAQ:GOOGL', displayPair: '' },
      { label: 'AMZN', tvSymbol: 'NASDAQ:AMZN', displayPair: '' },
      { label: 'TSLA', tvSymbol: 'NASDAQ:TSLA', displayPair: '' },
      { label: 'META', tvSymbol: 'NASDAQ:META', displayPair: '' },
      { label: 'AMD',  tvSymbol: 'NASDAQ:AMD',  displayPair: '' },
      { label: 'NFLX', tvSymbol: 'NASDAQ:NFLX', displayPair: '' },
      { label: 'JPM',  tvSymbol: 'NYSE:JPM', displayPair: '' },
      { label: 'V',    tvSymbol: 'NYSE:V', displayPair: '' },
      { label: 'BA',   tvSymbol: 'NYSE:BA', displayPair: '' },
      { label: 'DIS',  tvSymbol: 'NYSE:DIS', displayPair: '' },
      { label: 'COIN', tvSymbol: 'NASDAQ:COIN', displayPair: '' },
      { label: 'MSTR', tvSymbol: 'NASDAQ:MSTR', displayPair: '' },
      { label: 'PLTR', tvSymbol: 'NASDAQ:PLTR', displayPair: '' },
      { label: 'SMCI', tvSymbol: 'NASDAQ:SMCI', displayPair: '' },
      { label: 'ARM',  tvSymbol: 'NASDAQ:ARM', displayPair: '' },
    ],
  },
  {
    id: 'forex', label: 'Forex', icon: <DollarSign size={12} />,
    pinned: [
      { label: 'EUR/USD', tvSymbol: 'FX:EURUSD' }, { label: 'GBP/USD', tvSymbol: 'FX:GBPUSD' },
      { label: 'USD/JPY', tvSymbol: 'FX:USDJPY' }, { label: 'USD/CHF', tvSymbol: 'FX:USDCHF' },
      { label: 'AUD/USD', tvSymbol: 'FX:AUDUSD' }, { label: 'USD/CAD', tvSymbol: 'FX:USDCAD' },
      { label: 'NZD/USD', tvSymbol: 'FX:NZDUSD' }, { label: 'EUR/GBP', tvSymbol: 'FX:EURGBP' },
      { label: 'EUR/JPY', tvSymbol: 'FX:EURJPY' }, { label: 'GBP/JPY', tvSymbol: 'FX:GBPJPY' },
      { label: 'EUR/CHF', tvSymbol: 'FX:EURCHF' }, { label: 'AUD/JPY', tvSymbol: 'FX:AUDJPY' },
      { label: 'USD/MXN', tvSymbol: 'FX:USDMXN' }, { label: 'USD/TRY', tvSymbol: 'FX:USDTRY' },
      { label: 'DXY',     tvSymbol: 'TVC:DXY' },
    ],
  },
  {
    id: 'commodities', label: 'Commodities', icon: <Wheat size={12} />,
    pinned: [
      { label: 'Gold',     tvSymbol: 'TVC:GOLD' },     { label: 'Silver', tvSymbol: 'TVC:SILVER' },
      { label: 'Crude Oil', tvSymbol: 'TVC:USOIL' },   { label: 'Brent',  tvSymbol: 'TVC:UKOIL' },
      { label: 'Natural Gas', tvSymbol: 'PEPPERSTONE:NATGAS' },
      { label: 'Copper',   tvSymbol: 'PEPPERSTONE:COPPER' },
      { label: 'Platinum', tvSymbol: 'TVC:PLATINUM' }, { label: 'Palladium', tvSymbol: 'TVC:PALLADIUM' },
      { label: 'Wheat',    tvSymbol: 'PEPPERSTONE:WHEAT' }, { label: 'Corn', tvSymbol: 'PEPPERSTONE:CORN' },
    ],
  },
  {
    id: 'indices', label: 'Indices', icon: <Globe2 size={12} />,
    pinned: [
      { label: 'S&P 500', tvSymbol: 'FOREXCOM:SPX500' }, { label: 'NASDAQ 100', tvSymbol: 'FOREXCOM:NSXUSD' },
      { label: 'Dow Jones', tvSymbol: 'FOREXCOM:DJI' },  { label: 'Russell 2000', tvSymbol: 'FOREXCOM:RUSS2000' },
      { label: 'VIX',     tvSymbol: 'CAPITALCOM:VIX' },  { label: 'DAX',     tvSymbol: 'FOREXCOM:DEU40' },
      { label: 'FTSE 100', tvSymbol: 'FOREXCOM:UK100' }, { label: 'Nikkei 225', tvSymbol: 'FOREXCOM:JPN225' },
      { label: 'Hang Seng', tvSymbol: 'FOREXCOM:HKG33' },
    ],
  },
];

const TIMEFRAMES = [
  { label: '1m',  value: '1',   key: '1' },
  { label: '5m',  value: '5',   key: '2' },
  { label: '15m', value: '15',  key: '3' },
  { label: '1H',  value: '60',  key: '4' },
  { label: '4H',  value: '240', key: '5' },
  { label: '1D',  value: 'D',   key: '6' },
  { label: '1W',  value: 'W',   key: '7' },
] as const;

// ────────────────────────────────────────────────────────────────────
// Live ticker fetch (used for the stat strip)
// ────────────────────────────────────────────────────────────────────
interface TickerStat { price?: number; change24h?: number; high24h?: number; low24h?: number; volume24h?: number; }

function useTickerStats(symbol: string, isCrypto: boolean): TickerStat {
  const [stat, setStat] = useState<TickerStat>({});
  useEffect(() => {
    if (!isCrypto) { setStat({}); return; }
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch(`/api/tickers`);
        if (!r.ok) return;
        const v = await r.json();
        const arr = Array.isArray(v) ? v : v?.data ?? [];
        const matches = arr.filter((t: { symbol: string }) => t.symbol === symbol);
        if (!matches.length) return;
        // Pick the one with max price (most likely USD-denominated, not e.g. BTC pair)
        const best = matches.reduce((a: { lastPrice?: number; price?: number }, b: { lastPrice?: number; price?: number }) =>
          ((a.lastPrice ?? a.price ?? 0) > (b.lastPrice ?? b.price ?? 0) ? a : b));
        if (cancelled) return;
        setStat({
          price: best.lastPrice ?? best.price,
          change24h: best.priceChangePercent24h ?? best.change24h ?? best.changePercent24h,
          high24h: best.highPrice24h ?? best.high24h,
          low24h: best.lowPrice24h ?? best.low24h,
          volume24h: best.volume24h ?? best.quoteVolume24h,
        });
      } catch {}
    }
    load();
    const id = setInterval(load, 15_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [symbol, isCrypto]);
  return stat;
}

// ────────────────────────────────────────────────────────────────────
// TradingView widget
// ────────────────────────────────────────────────────────────────────
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
      popup_width: '1000', popup_height: '650',
      studies: [],
      enabled_features: ['study_templates'],
      overrides: {
        'paneProperties.backgroundType': 'solid',
        'paneProperties.background': '#000000',
        'mainSeriesProperties.candleStyle.upColor': '#22c55e',
        'mainSeriesProperties.candleStyle.downColor': '#ef4444',
        'mainSeriesProperties.candleStyle.borderUpColor': '#22c55e',
        'mainSeriesProperties.candleStyle.borderDownColor': '#ef4444',
        'mainSeriesProperties.candleStyle.wickUpColor': '#22c55e',
        'mainSeriesProperties.candleStyle.wickDownColor': '#ef4444',
      },
    });
    script.onload = () => setTimeout(() => setLoading(false), 600);
    script.onerror = () => setLoading(false);

    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container';
    widgetContainer.style.height = '100%';
    widgetContainer.style.width  = '100%';
    const widgetInner = document.createElement('div');
    widgetInner.className = 'tradingview-widget-container__widget';
    widgetInner.style.height = 'calc(100% - 32px)';
    widgetInner.style.width  = '100%';
    widgetContainer.appendChild(widgetInner);
    widgetContainer.appendChild(script);
    containerRef.current.appendChild(widgetContainer);

    const container = containerRef.current;
    return () => { if (container) container.innerHTML = ''; };
  }, [tvSymbol, interval]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {loading && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#000',
        }} aria-hidden="true">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 999,
              border: '2px solid rgba(var(--hub-accent-rgb), 0.25)',
              borderTopColor: 'var(--hub-accent)',
              animation: 'spin 700ms linear infinite',
            }} />
            <span style={{ fontSize: 11, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>
              Loading chart…
            </span>
          </div>
        </div>
      )}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────
function ChartPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialSymbolLabel = searchParams.get('s') || 'BTC';
  const initialInterval    = searchParams.get('tf') || '60';
  const initialAssetClass  = (searchParams.get('ac') as AssetClass) || 'crypto';
  const initialTab    = ASSET_TABS.find(t => t.id === initialAssetClass) ?? ASSET_TABS[0];
  const initialSymbol = initialTab.pinned.find(s => s.label.toUpperCase() === initialSymbolLabel.toUpperCase()) ?? initialTab.pinned[0];

  const [assetClass, setAssetClass] = useState<AssetClass>(initialTab.id);
  const [tvSymbol, setTvSymbol]     = useState(initialSymbol.tvSymbol);
  const [displayLabel, setDisplayLabel] = useState(initialSymbol.label);
  const [displayPair,  setDisplayPair]  = useState(initialSymbol.displayPair ?? '');
  const [interval, setInterval_] = useState(TIMEFRAMES.some(tf => tf.value === initialInterval) ? initialInterval : '60');

  const [bottomPanelOpen, setBottomPanelOpen] = useState(false);
  const [tapeVisible, setTapeVisible] = useState(false);

  const [symbolOpen,  setSymbolOpen]  = useState(false);
  const [symbolQuery, setSymbolQuery] = useState('');
  const symbolRef      = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const isCrypto    = assetClass === 'crypto';
  const tickerStat  = useTickerStats(displayLabel, isCrypto);
  const currentTab  = useMemo(() => ASSET_TABS.find(t => t.id === assetClass)!, [assetClass]);

  const filteredSymbols = useMemo(() => {
    const q = symbolQuery.trim().toLowerCase();
    if (!q) return currentTab.pinned;
    return currentTab.pinned.filter(s =>
      s.label.toLowerCase().includes(q) || s.tvSymbol.toLowerCase().includes(q),
    );
  }, [symbolQuery, currentTab]);

  const updateURL = useCallback((label: string, tf: string, ac: AssetClass) => {
    const params = new URLSearchParams();
    if (label !== 'BTC')  params.set('s',  label);
    if (tf !== '60')      params.set('tf', tf);
    if (ac !== 'crypto')  params.set('ac', ac);
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

  // Keyboard: timeframe number keys + Esc + T (tape)
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || (t as HTMLElement).isContentEditable) return;
      if (e.key === 'Escape' && symbolOpen) { setSymbolOpen(false); setFocusedIndex(-1); return; }
      if (e.key === 't' && isCrypto && !symbolOpen) { setTapeVisible(v => !v); return; }
      const idx = parseInt(e.key) - 1;
      if (idx >= 0 && idx < TIMEFRAMES.length) setIntervalAndSync(TIMEFRAMES[idx].value);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [symbolOpen, isCrypto, setIntervalAndSync]);

  const handleDropdownKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault(); setFocusedIndex(i => Math.min(i + 1, filteredSymbols.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); setFocusedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && focusedIndex >= 0 && focusedIndex < filteredSymbols.length) {
      e.preventDefault(); selectSymbol(filteredSymbols[focusedIndex]);
    } else if (e.key === 'Escape') {
      setSymbolOpen(false); setFocusedIndex(-1);
    }
  }, [filteredSymbols, focusedIndex, selectSymbol]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (symbolRef.current && !symbolRef.current.contains(e.target as Node)) {
        setSymbolOpen(false); setFocusedIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (symbolOpen && searchInputRef.current) { searchInputRef.current.focus(); setFocusedIndex(-1); }
  }, [symbolOpen]);

  const positive = (tickerStat.change24h ?? 0) >= 0;
  const priceColor = positive ? 'var(--pump-mild)' : 'var(--rekt-mild)';

  return (
    <div id="main-content" style={{
      display: 'flex', flexDirection: 'column',
      width: '100%', height: '100%', minHeight: 0,
      background: '#000', overflow: 'hidden',
    }}>
      <h1 className="sr-only">Chart · {displayLabel}</h1>

      {/* ─── Top control bar ─── */}
      <div style={{
        flexShrink: 0,
        background: 'rgba(7,9,13,0.94)',
        borderBottom: '1px solid var(--hub-border-subtle)',
        padding: '8px 14px',
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10,
        backdropFilter: 'blur(6px)',
        position: 'relative', zIndex: 30,
      }}>
        {/* Asset class tabs */}
        <div style={{
          display: 'inline-flex',
          background: 'var(--hub-darker)',
          border: '1px solid var(--hub-border-subtle)',
          borderRadius: 8, overflow: 'hidden',
        }} role="tablist" aria-label="Asset class">
          {ASSET_TABS.map(tab => {
            const on = assetClass === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={on}
                onClick={() => switchAssetClass(tab.id)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '6px 11px',
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                  background: on ? 'var(--hub-accent)' : 'transparent',
                  color: on ? '#000' : 'var(--fg-muted)',
                  border: 'none', cursor: 'pointer',
                  textTransform: 'uppercase',
                  transition: 'background 150ms',
                }}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Symbol selector */}
        <div ref={symbolRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setSymbolOpen(!symbolOpen)}
            aria-expanded={symbolOpen}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 12px',
              borderRadius: 8,
              background: 'var(--hub-darker)',
              border: '1px solid var(--hub-border)',
              color: 'var(--fg-default)',
              fontSize: 13, fontWeight: 700,
              cursor: 'pointer',
              transition: 'border-color 150ms',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--hub-accent)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--hub-border)'; }}
          >
            {isCrypto && <TokenIconSimple symbol={displayLabel} size={18} />}
            <span style={{ letterSpacing: '-0.01em' }}>{displayLabel}</span>
            {displayPair && <span style={{ color: 'var(--fg-muted)', fontWeight: 500, fontSize: 11 }}>{displayPair}</span>}
            <ChevronDown size={12} style={{
              color: 'var(--fg-muted)',
              transform: symbolOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 150ms',
            }} />
          </button>

          {symbolOpen && (
            <div
              role="dialog"
              aria-label="Symbol picker"
              onKeyDown={handleDropdownKeyDown}
              style={{
                position: 'absolute', top: 'calc(100% + 6px)', left: 0,
                width: 320,
                background: 'rgba(15,18,24,0.98)',
                border: '1px solid var(--hub-border-hover)',
                borderRadius: 10,
                boxShadow: '0 18px 40px -12px rgba(0,0,0,0.7)',
                zIndex: 50,
                overflow: 'hidden',
                animation: 'page-enter 180ms ease-out',
              }}
            >
              <div style={{ position: 'relative', padding: '10px 12px', borderBottom: '1px solid var(--hub-border-subtle)' }}>
                <Search size={13} style={{ position: 'absolute', left: 22, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)' }} />
                <input
                  ref={searchInputRef}
                  type="text"
                  aria-label="Search symbols"
                  placeholder={`Search ${currentTab.label.toLowerCase()}…`}
                  value={symbolQuery}
                  onChange={(e) => { setSymbolQuery(e.target.value); setFocusedIndex(-1); }}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid var(--hub-border-subtle)',
                    borderRadius: 8,
                    padding: '6px 10px 6px 30px',
                    fontSize: 12, color: 'var(--fg-default)',
                    outline: 'none',
                  }}
                />
                {symbolQuery && (
                  <button
                    onClick={() => setSymbolQuery('')}
                    style={{ position: 'absolute', right: 22, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--fg-muted)', cursor: 'pointer' }}
                    aria-label="Clear search"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Asset class strip */}
              <div style={{
                display: 'flex', gap: 4, padding: '6px 8px',
                borderBottom: '1px solid var(--hub-border-subtle)',
                overflowX: 'auto',
              }}>
                {ASSET_TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => { switchAssetClass(tab.id); setSymbolQuery(''); }}
                    style={{
                      flexShrink: 0,
                      padding: '4px 8px',
                      borderRadius: 5,
                      background: assetClass === tab.id ? 'rgba(var(--hub-accent-rgb), 0.15)' : 'transparent',
                      color: assetClass === tab.id ? 'var(--hub-accent)' : 'var(--fg-muted)',
                      border: 'none',
                      fontSize: 10, fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >{tab.label}</button>
                ))}
              </div>

              {/* Symbol list */}
              <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: 6 }} role="listbox">
                {filteredSymbols.length === 0 && (
                  <div style={{ padding: 14, textAlign: 'center', fontSize: 11, color: 'var(--fg-muted)' }}>
                    No symbols found.
                  </div>
                )}
                {isCrypto && !symbolQuery.trim() ? (
                  <CategorizedSymbolGrid
                    symbols={filteredSymbols}
                    activeTv={tvSymbol}
                    focusedIndex={focusedIndex}
                    setFocusedIndex={setFocusedIndex}
                    onSelect={selectSymbol}
                  />
                ) : (
                  <FlatSymbolList
                    symbols={filteredSymbols}
                    activeTv={tvSymbol}
                    focusedIndex={focusedIndex}
                    setFocusedIndex={setFocusedIndex}
                    onSelect={selectSymbol}
                    isCrypto={isCrypto}
                    showPopularLabel={!symbolQuery.trim()}
                    currentLabel={currentTab.label}
                  />
                )}
              </div>

              {/* Hints */}
              <div style={{
                padding: '6px 12px',
                borderTop: '1px solid var(--hub-border-subtle)',
                fontSize: 9, color: 'var(--fg-muted)',
                fontFamily: 'var(--font-mono)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <Kbd>↑↓</Kbd> nav <Kbd>↵</Kbd> select <Kbd>esc</Kbd> close
                {isCrypto && <><span style={{ flex: 1 }} /><Kbd>T</Kbd> tape</>}
              </div>
            </div>
          )}
        </div>

        {/* Live price strip (crypto only) */}
        {isCrypto && tickerStat.price != null && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 14,
            padding: '4px 12px',
            borderRadius: 8,
            background: `linear-gradient(135deg, ${priceColor}10 0%, transparent 70%)`,
            border: `1px solid ${priceColor}33`,
            fontFamily: 'var(--font-mono)',
          }}>
            <SatPing size={8} color={priceColor} />
            <span style={{
              fontSize: 15, fontWeight: 800, color: 'var(--fg-default)', letterSpacing: '-0.01em',
            }}>
              {tickerStat.price >= 100 ? `$${tickerStat.price.toFixed(2)}`
                : tickerStat.price >= 1   ? `$${tickerStat.price.toFixed(3)}`
                : `$${tickerStat.price.toFixed(6)}`}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 700, color: priceColor,
              padding: '1px 7px', borderRadius: 999,
              background: positive ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)',
              border: `1px solid ${positive ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
            }}>
              {tickerStat.change24h != null ? `${tickerStat.change24h >= 0 ? '+' : ''}${tickerStat.change24h.toFixed(2)}%` : '—'}
            </span>
            {tickerStat.high24h != null && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--fg-muted)' }}>
                H <span style={{ color: 'var(--pump-mild)' }}>${tickerStat.high24h.toFixed(2)}</span>
              </span>
            )}
            {tickerStat.low24h != null && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--fg-muted)' }}>
                L <span style={{ color: 'var(--rekt-mild)' }}>${tickerStat.low24h.toFixed(2)}</span>
              </span>
            )}
            {tickerStat.volume24h != null && tickerStat.volume24h > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--fg-muted)' }}>
                <Volume2 size={10} />
                <span style={{ color: 'var(--fg-default)' }}>
                  {tickerStat.volume24h >= 1e9 ? `$${(tickerStat.volume24h / 1e9).toFixed(2)}B`
                    : tickerStat.volume24h >= 1e6 ? `$${(tickerStat.volume24h / 1e6).toFixed(1)}M`
                    : `$${(tickerStat.volume24h / 1e3).toFixed(0)}K`}
                </span>
              </span>
            )}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Sound toggle for crypto */}
        {isCrypto && <SoundToggle />}

        {/* Timeframe pills */}
        <div style={{
          display: 'inline-flex',
          background: 'var(--hub-darker)',
          border: '1px solid var(--hub-border-subtle)',
          borderRadius: 8, overflow: 'hidden',
        }} role="group" aria-label="Timeframe">
          {TIMEFRAMES.map(tf => {
            const on = interval === tf.value;
            return (
              <button
                key={tf.value}
                onClick={() => setIntervalAndSync(tf.value)}
                aria-pressed={on}
                title={`${tf.label} (Shortcut: ${tf.key})`}
                style={{
                  padding: '5px 10px',
                  fontSize: 11, fontWeight: 700,
                  background: on ? 'var(--hub-accent)' : 'transparent',
                  color: on ? '#000' : 'var(--fg-muted)',
                  border: 'none', cursor: 'pointer',
                  letterSpacing: '0.02em',
                }}
              >{tf.label}</button>
            );
          })}
        </div>

        {/* Tape toggle (crypto) */}
        {isCrypto && (
          <button
            onClick={() => setTapeVisible(v => !v)}
            title="Toggle trade tape (T)"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '5px 10px',
              borderRadius: 8,
              background: tapeVisible ? 'rgba(var(--hub-accent-rgb), 0.15)' : 'var(--hub-darker)',
              border: `1px solid ${tapeVisible ? 'var(--hub-accent)' : 'var(--hub-border-subtle)'}`,
              color: tapeVisible ? 'var(--hub-accent)' : 'var(--fg-muted)',
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
              letterSpacing: '0.04em', textTransform: 'uppercase',
            }}
          >
            <Activity size={11} />
            Tape
          </button>
        )}

        {/* Bottom panel toggle (crypto) */}
        {isCrypto && (
          <button
            onClick={() => setBottomPanelOpen(v => !v)}
            title="Toggle metrics panel"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '5px 10px',
              borderRadius: 8,
              background: bottomPanelOpen ? 'rgba(var(--hub-accent-rgb), 0.15)' : 'var(--hub-darker)',
              border: `1px solid ${bottomPanelOpen ? 'var(--hub-accent)' : 'var(--hub-border-subtle)'}`,
              color: bottomPanelOpen ? 'var(--hub-accent)' : 'var(--fg-muted)',
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
              letterSpacing: '0.04em', textTransform: 'uppercase',
            }}
          >
            <BarChart3 size={11} />
            Metrics
          </button>
        )}
      </div>

      {/* ─── Quick symbol bar ─── */}
      <div style={{
        flexShrink: 0,
        background: 'rgba(0,0,0,0.5)',
        borderBottom: '1px solid var(--hub-border-subtle)',
        padding: '6px 14px',
        display: 'flex', alignItems: 'center', gap: 4,
        overflowX: 'auto',
      }} role="tablist" aria-label="Quick symbols">
        {currentTab.pinned.slice(0, 16).map(sym => {
          const on = sym.tvSymbol === tvSymbol;
          return (
            <button
              key={sym.tvSymbol}
              role="tab"
              aria-selected={on}
              onClick={() => selectSymbol(sym)}
              style={{
                flexShrink: 0,
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 9px',
                borderRadius: 6,
                background: on ? 'rgba(var(--hub-accent-rgb), 0.18)' : 'transparent',
                color: on ? 'var(--hub-accent)' : 'var(--fg-muted)',
                border: on ? '1px solid rgba(var(--hub-accent-rgb), 0.4)' : '1px solid transparent',
                fontSize: 11, fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 150ms',
              }}
              onMouseEnter={(e) => { if (!on) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={(e) => { if (!on) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              {isCrypto && sym.icon && <TokenIconSimple symbol={sym.icon} size={13} />}
              {sym.label}
            </button>
          );
        })}
      </div>

      {/* ─── Chart + side tape ─── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', position: 'relative' }}>
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <ChartErrorBoundary name="TradingView Chart" minHeight="250px">
              <TradingViewChart tvSymbol={tvSymbol} interval={interval} />
            </ChartErrorBoundary>
          </div>
          {isCrypto && tapeVisible && (
            <ChartErrorBoundary name="Trade Tape">
              <TapeSidebar
                symbol={displayLabel}
                visible={tapeVisible}
                onToggle={() => setTapeVisible(v => !v)}
              />
            </ChartErrorBoundary>
          )}
        </div>
        {isCrypto && (
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

// ────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '1px 5px',
      borderRadius: 3,
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid var(--hub-border-subtle)',
      fontSize: 9, fontFamily: 'var(--font-mono)',
      color: 'var(--fg-default)',
    }}>{children}</kbd>
  );
}

function CategorizedSymbolGrid({
  symbols, activeTv, focusedIndex, setFocusedIndex, onSelect,
}: {
  symbols: AssetSymbol[];
  activeTv: string;
  focusedIndex: number;
  setFocusedIndex: (i: number) => void;
  onSelect: (s: AssetSymbol) => void;
}) {
  const CAT_META: Record<string, { icon: React.ReactNode; color: string }> = {
    Top:   { icon: <Star size={10} />,    color: 'var(--hub-accent)' },
    L2:    { icon: <Layers size={10} />,  color: '#60a5fa' },
    DeFi:  { icon: <Zap size={10} />,     color: 'var(--pump-mild)' },
    AI:    { icon: <Cpu size={10} />,     color: '#a78bfa' },
    Meme:  { icon: <Flame size={10} />,   color: '#fb923c' },
    Perps: { icon: <TrendingUp size={10} />, color: '#22d3ee' },
  };
  const cats = ['Top', 'L2', 'DeFi', 'AI', 'Meme', 'Perps'];
  const grouped = new Map<string, AssetSymbol[]>();
  for (const sym of symbols) {
    const c = sym.cat || 'Top';
    if (!grouped.has(c)) grouped.set(c, []);
    grouped.get(c)!.push(sym);
  }
  let idx = 0;
  return (
    <>
      {cats.filter(c => grouped.has(c)).map(cat => {
        const syms = grouped.get(cat)!;
        const meta = CAT_META[cat];
        return (
          <div key={cat}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 6px 4px',
            }}>
              <span style={{ color: meta.color, display: 'inline-flex' }}>{meta.icon}</span>
              <span style={{
                fontSize: 9, fontWeight: 700, color: 'var(--fg-muted)',
                letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>{cat}</span>
              <span style={{ fontSize: 9, color: meta.color, opacity: 0.6, fontFamily: 'var(--font-mono)' }}>{syms.length}</span>
              <div style={{ flex: 1, height: 1, background: 'var(--hub-border-subtle)' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
              {syms.map(sym => {
                const i = idx++;
                const on  = sym.tvSymbol === activeTv;
                const fok = focusedIndex === i;
                return (
                  <button
                    key={sym.tvSymbol}
                    role="option"
                    aria-selected={on}
                    onClick={() => onSelect(sym)}
                    onMouseEnter={() => setFocusedIndex(i)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 8px',
                      borderRadius: 6,
                      border: 'none', textAlign: 'left',
                      background: on ? 'rgba(var(--hub-accent-rgb), 0.18)'
                        : fok ? 'rgba(255,255,255,0.08)' : 'transparent',
                      color: on ? 'var(--hub-accent)' : 'var(--fg-default)',
                      fontSize: 11, fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <TokenIconSimple symbol={sym.icon || sym.label} size={16} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sym.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}

function FlatSymbolList({
  symbols, activeTv, focusedIndex, setFocusedIndex, onSelect, isCrypto, showPopularLabel, currentLabel,
}: {
  symbols: AssetSymbol[];
  activeTv: string;
  focusedIndex: number;
  setFocusedIndex: (i: number) => void;
  onSelect: (s: AssetSymbol) => void;
  isCrypto: boolean;
  showPopularLabel: boolean;
  currentLabel: string;
}) {
  return (
    <>
      {showPopularLabel && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 8px 4px',
        }}>
          <Star size={10} style={{ color: 'var(--hub-accent)' }} />
          <span style={{
            fontSize: 9, fontWeight: 700, color: 'var(--fg-muted)',
            letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>Popular {currentLabel}</span>
        </div>
      )}
      {symbols.map((sym, i) => {
        const on  = sym.tvSymbol === activeTv;
        const fok = focusedIndex === i;
        return (
          <button
            key={sym.tvSymbol}
            role="option"
            aria-selected={on}
            onClick={() => onSelect(sym)}
            onMouseEnter={() => setFocusedIndex(i)}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 10px',
              borderRadius: 6,
              border: 'none', textAlign: 'left',
              background: on ? 'rgba(var(--hub-accent-rgb), 0.18)'
                : fok ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: on ? 'var(--hub-accent)' : 'var(--fg-default)',
              fontSize: 12, fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {isCrypto && sym.icon ? (
              <TokenIconSimple symbol={sym.icon} size={18} />
            ) : (
              <div style={{
                width: 18, height: 18, borderRadius: 4,
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--fg-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 8, fontWeight: 800,
              }}>
                {sym.label.slice(0, 2).toUpperCase()}
              </div>
            )}
            <span style={{ flex: 1, fontWeight: 600 }}>{sym.label}</span>
            {sym.displayPair && <span style={{ color: 'var(--fg-muted)', fontSize: 10 }}>{sym.displayPair}</span>}
            <span style={{ color: 'var(--fg-faint)', fontSize: 9, fontFamily: 'var(--font-mono)' }}>
              {sym.tvSymbol.split(':')[0]}
            </span>
          </button>
        );
      })}
    </>
  );
}

// ────────────────────────────────────────────────────────────────────
// Default export with Suspense
// ────────────────────────────────────────────────────────────────────
export default function ChartPage() {
  return (
    <Suspense fallback={
      <div style={{ width: '100%', height: '100%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 24, height: 24, borderRadius: 999,
          border: '2px solid rgba(var(--hub-accent-rgb), 0.25)',
          borderTopColor: 'var(--hub-accent)',
          animation: 'spin 700ms linear infinite',
        }} />
      </div>
    }>
      <ChartPageInner />
    </Suspense>
  );
}
