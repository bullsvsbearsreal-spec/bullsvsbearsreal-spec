'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Search, X, ArrowRight,
  Activity, BarChart3, Heart, Briefcase, MoreHorizontal,
  SlidersHorizontal, Percent, Grid3X3, PieChart, Zap, ArrowLeftRight,
  LineChart, Shield, BarChart2, Crosshair,
  Rocket, Map, Crown, Building2, Landmark, Coins, GitCompareArrows, Unlock, Bitcoin, TrendingUp,
  Thermometer, Fish, Eye, Newspaper,
  Star, GitCompare, Bell, Wallet, Search as SearchIcon,
  Calendar, Palette, Users, BookOpen, Gift, Keyboard, Clock,
  type LucideIcon,
} from 'lucide-react';
import { CoinSearchResult } from '@/lib/api/coingecko';
import { getRecentlyViewed, type RecentItem } from '@/lib/storage/recentlyViewed';
import { TokenIconSimple } from './TokenIcon';

/* ------------------------------------------------------------------ */
/*  Page registry — every navigable page with search keywords          */
/* ------------------------------------------------------------------ */

interface PageEntry {
  name: string;
  href: string;
  icon: LucideIcon;
  keywords: string[];
  category: string;
}

const pageRegistry: PageEntry[] = [
  // Trading > Analysis
  { name: 'Chart', href: '/chart', icon: LineChart, keywords: ['chart', 'tradingview', 'candle', 'price', 'technical'], category: 'Trading' },
  { name: 'Screener', href: '/screener', icon: SlidersHorizontal, keywords: ['screener', 'filter', 'scan', 'search', 'find'], category: 'Trading' },
  { name: 'Options', href: '/options', icon: Shield, keywords: ['options', 'greeks', 'vol', 'volatility', 'puts', 'calls', 'skew'], category: 'Trading' },
  { name: 'Basis', href: '/basis', icon: BarChart2, keywords: ['basis', 'contango', 'backwardation', 'premium', 'spot', 'perp'], category: 'Trading' },
  { name: 'Prediction Markets', href: '/prediction-markets', icon: Eye, keywords: ['prediction', 'polymarket', 'bet', 'forecast'], category: 'Trading' },
  { name: 'Price Spreads', href: '/spreads', icon: ArrowLeftRight, keywords: ['spread', 'price', 'arb', 'difference', 'cross-exchange'], category: 'Trading' },
  { name: 'Spread Scanner', href: '/spread-scanner', icon: ArrowLeftRight, keywords: ['spread', 'scanner', 'arb', 'multi', 'compare'], category: 'Trading' },
  { name: 'Execution Costs', href: '/execution-costs', icon: Crosshair, keywords: ['execution', 'cost', 'slippage', 'dex', 'fee'], category: 'Trading' },
  // Trading > Funding & OI
  { name: 'Funding Rates', href: '/funding', icon: Percent, keywords: ['funding', 'rate', 'perp', 'perpetual', '8h', 'annual', 'arb', 'arbitrage'], category: 'Trading' },
  { name: 'Funding Heatmap', href: '/funding-heatmap', icon: Grid3X3, keywords: ['funding', 'heatmap', 'visual', 'grid'], category: 'Trading' },
  { name: 'Open Interest', href: '/open-interest', icon: PieChart, keywords: ['open interest', 'oi', 'positions', 'contracts', 'delta'], category: 'Trading' },
  { name: 'OI Heatmap', href: '/oi-heatmap', icon: Grid3X3, keywords: ['oi', 'open interest', 'heatmap'], category: 'Trading' },
  // Trading > Liquidations
  { name: 'Liquidations', href: '/liquidations', icon: Zap, keywords: ['liquidation', 'liq', 'rekt', 'cascade', 'whale', 'feed'], category: 'Trading' },
  { name: 'Liquidation Map', href: '/liquidation-map', icon: Crosshair, keywords: ['liquidation', 'map', 'levels', 'clusters'], category: 'Trading' },
  { name: 'Liquidation Heatmap', href: '/liquidation-heatmap', icon: Grid3X3, keywords: ['liquidation', 'heatmap', 'liq'], category: 'Trading' },
  // Trading > Flow
  { name: 'Long/Short Ratio', href: '/longshort', icon: ArrowLeftRight, keywords: ['long', 'short', 'ratio', 'sentiment', 'positioning'], category: 'Trading' },
  { name: 'CVD', href: '/cvd', icon: LineChart, keywords: ['cvd', 'cumulative', 'volume', 'delta', 'buying', 'selling', 'pressure'], category: 'Trading' },
  { name: 'Order Flow', href: '/orderflow', icon: Activity, keywords: ['order', 'flow', 'tape', 'trades', 'aggressor'], category: 'Trading' },
  { name: 'RSI Heatmap', href: '/rsi-heatmap', icon: Activity, keywords: ['rsi', 'overbought', 'oversold', 'momentum', 'heatmap'], category: 'Trading' },
  // Markets
  { name: 'Top Movers', href: '/top-movers', icon: Rocket, keywords: ['movers', 'gainers', 'losers', 'top', 'biggest', 'change'], category: 'Markets' },
  { name: 'Market Heatmap', href: '/market-heatmap', icon: Map, keywords: ['market', 'heatmap', 'crypto', 'overview'], category: 'Markets' },
  { name: 'Stock Heatmap', href: '/stock-heatmap', icon: Map, keywords: ['stock', 'heatmap', 'equity', 'sp500'], category: 'Markets' },
  { name: 'Dominance', href: '/dominance', icon: Crown, keywords: ['dominance', 'btc', 'bitcoin', 'altseason', 'alt', 'market cap'], category: 'Markets' },
  { name: 'Market Cycle', href: '/market-cycle', icon: Activity, keywords: ['cycle', 'market', 'phase', 'bull', 'bear', 'macro'], category: 'Markets' },
  { name: 'Correlation', href: '/correlation', icon: GitCompareArrows, keywords: ['correlation', 'matrix', 'compare', 'relationship'], category: 'Markets' },
  { name: 'ETF Tracker', href: '/etf', icon: LineChart, keywords: ['etf', 'bitcoin', 'ethereum', 'spot', 'flows', 'institutional'], category: 'Markets' },
  { name: 'BTC Treasuries', href: '/bitcoin-treasuries', icon: Bitcoin, keywords: ['treasury', 'bitcoin', 'btc', 'corporate', 'holdings', 'microstrategy'], category: 'Markets' },
  { name: 'Token Unlocks', href: '/token-unlocks', icon: Unlock, keywords: ['unlock', 'token', 'vesting', 'schedule', 'release'], category: 'Markets' },
  { name: 'Airdrops', href: '/airdrops', icon: Gift, keywords: ['airdrop', 'free', 'claim', 'drop'], category: 'Markets' },
  { name: 'Exchange Reserves', href: '/exchange-reserves', icon: Landmark, keywords: ['reserve', 'exchange', 'balance', 'withdrawal', 'deposit'], category: 'Markets' },
  { name: 'Stablecoin Flows', href: '/stablecoin-flows', icon: Coins, keywords: ['stablecoin', 'usdt', 'usdc', 'flow', 'mint', 'burn'], category: 'Markets' },
  { name: 'On-Chain', href: '/onchain', icon: BarChart3, keywords: ['onchain', 'on-chain', 'blockchain', 'metrics', 'addresses'], category: 'Markets' },
  { name: 'DeFi Yields', href: '/yields', icon: TrendingUp, keywords: ['yield', 'defi', 'apy', 'apr', 'farm', 'staking'], category: 'Markets' },
  { name: 'Exchange Comparison', href: '/exchange-comparison', icon: Building2, keywords: ['exchange', 'compare', 'comparison', 'fees', 'volume'], category: 'Markets' },
  // Sentiment
  { name: 'Fear & Greed', href: '/fear-greed', icon: Thermometer, keywords: ['fear', 'greed', 'sentiment', 'index', 'mood'], category: 'Sentiment' },
  { name: 'Whale Alert', href: '/whale-alert', icon: Fish, keywords: ['whale', 'alert', 'large', 'transaction', 'transfer'], category: 'Sentiment' },
  { name: 'HL Whales', href: '/hl-whales', icon: Eye, keywords: ['hyperliquid', 'whale', 'traders', 'top', 'positions', 'pnl'], category: 'Sentiment' },
  { name: 'News', href: '/news', icon: Newspaper, keywords: ['news', 'article', 'headline', 'crypto', 'feed'], category: 'Sentiment' },
  // Portfolio
  { name: 'Watchlist', href: '/watchlist', icon: Star, keywords: ['watchlist', 'watch', 'track', 'favorites', 'list'], category: 'Portfolio' },
  { name: 'Compare Coins', href: '/compare', icon: GitCompare, keywords: ['compare', 'side by side', 'vs', 'versus', 'coins'], category: 'Portfolio' },
  { name: 'Alerts', href: '/alerts', icon: Bell, keywords: ['alert', 'notification', 'price', 'trigger', 'alarm'], category: 'Portfolio' },
  { name: 'Portfolio', href: '/portfolio', icon: Wallet, keywords: ['portfolio', 'positions', 'pnl', 'holdings', 'balance'], category: 'Portfolio' },
  { name: 'Wallet Tracker', href: '/wallet-tracker', icon: SearchIcon, keywords: ['wallet', 'address', 'track', 'balance', 'multichain'], category: 'Portfolio' },
  { name: 'Dashboard', href: '/dashboard', icon: BarChart3, keywords: ['dashboard', 'widgets', 'custom', 'home', 'overview'], category: 'Portfolio' },
  // More
  { name: 'Economic Calendar', href: '/economic-calendar', icon: Calendar, keywords: ['economic', 'calendar', 'events', 'fomc', 'cpi', 'macro'], category: 'More' },
  { name: 'Guides', href: '/guides', icon: BookOpen, keywords: ['guide', 'tutorial', 'learn', 'how to', 'education'], category: 'More' },
  { name: 'Brand Kit', href: '/brand', icon: Palette, keywords: ['brand', 'logo', 'assets', 'colors'], category: 'More' },
  { name: 'Developers', href: '/developers', icon: BookOpen, keywords: ['api', 'developer', 'key', 'docs', 'integrate'], category: 'More' },
  { name: 'API Docs', href: '/api-docs', icon: BookOpen, keywords: ['api', 'documentation', 'reference', 'endpoints'], category: 'More' },
];

/* ------------------------------------------------------------------ */
/*  Fuzzy matching                                                     */
/* ------------------------------------------------------------------ */

function matchPage(page: PageEntry, q: string): number {
  const lower = q.toLowerCase();
  const name = page.name.toLowerCase();

  // Exact name match
  if (name === lower) return 100;
  // Name starts with query
  if (name.startsWith(lower)) return 90;
  // Name contains query
  if (name.includes(lower)) return 80;
  // Keyword exact match
  if (page.keywords.some((k) => k === lower)) return 75;
  // Keyword starts with
  if (page.keywords.some((k) => k.startsWith(lower))) return 70;
  // Keyword contains
  if (page.keywords.some((k) => k.includes(lower))) return 60;
  // Multi-word: all words match somewhere
  const words = lower.split(/\s+/);
  if (words.length > 1) {
    const allText = [name, ...page.keywords].join(' ');
    if (words.every((w) => allText.includes(w))) return 55;
  }
  return 0;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface CommandPaletteProps {
  onClose: () => void;
  onShowShortcuts: () => void;
}

export default function CommandPalette({ onClose, onShowShortcuts }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [coinResults, setCoinResults] = useState<CoinSearchResult[]>([]);
  const [isLoadingCoins, setIsLoadingCoins] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load recently viewed items
  const [recentItems] = useState<RecentItem[]>(() => getRecentlyViewed());

  // Auto-focus
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Coin search (debounced)
  useEffect(() => {
    if (query.length < 2) {
      setCoinResults([]);
      return;
    }
    setIsLoadingCoins(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/coin-search?q=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        setCoinResults((json.results || []).slice(0, 5));
      } catch {
        setCoinResults([]);
      }
      setIsLoadingCoins(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Page results (instant, local)
  const pageResults = useMemo(() => {
    if (!query.trim()) return [];
    return pageRegistry
      .map((p) => ({ ...p, score: matchPage(p, query.trim()) }))
      .filter((p) => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [query]);

  // Combined flat list for keyboard nav
  const allResults = useMemo(() => {
    const items: { type: 'page' | 'coin'; data: PageEntry | CoinSearchResult }[] = [];
    pageResults.forEach((p) => items.push({ type: 'page', data: p }));
    coinResults.forEach((c) => items.push({ type: 'coin', data: c }));
    return items;
  }, [pageResults, coinResults]);

  // Reset selection on results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [allResults.length]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, allResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && allResults.length > 0) {
        e.preventDefault();
        const item = allResults[selectedIndex];
        if (item) {
          if (item.type === 'page') {
            router.push((item.data as PageEntry).href);
          } else {
            router.push(`/coin/${(item.data as CoinSearchResult).id}`);
          }
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [allResults, selectedIndex, router, onClose]);

  // Scroll selected into view
  useEffect(() => {
    const el = document.querySelector(`[data-cmd-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const navigateTo = (href: string) => {
    router.push(href);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm">
      <div ref={listRef} className="bg-[#0d0d0d] border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/60 w-full max-w-[560px] mx-4 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
          <Search className="w-4 h-4 text-neutral-500 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, features, or coins..."
            className="flex-1 bg-transparent text-white text-sm placeholder-neutral-500 focus:outline-none"
            aria-label="Command palette search"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={allResults.length > 0}
          />
          {query && (
            <button onClick={() => setQuery('')} className="p-1 rounded hover:bg-white/[0.06]">
              <X className="w-3.5 h-3.5 text-neutral-500" />
            </button>
          )}
          {isLoadingCoins && (
            <div className="w-4 h-4 border-2 border-hub-yellow/20 border-t-hub-yellow rounded-full animate-spin flex-shrink-0" />
          )}
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {/* No query — show recently viewed + quick actions */}
          {!query.trim() && (
            <div className="p-2">
              {/* Recently Viewed */}
              {recentItems.length > 0 && (
                <>
                  <div className="px-2 py-1.5">
                    <span className="text-[10px] text-neutral-600 uppercase tracking-widest">Recently Viewed</span>
                  </div>
                  {recentItems.slice(0, 5).map((item) => (
                    <button
                      key={item.path}
                      onClick={() => navigateTo(item.path)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-neutral-400 hover:text-white hover:bg-white/[0.04] transition-colors"
                    >
                      {item.symbol ? (
                        <TokenIconSimple symbol={item.symbol} size={14} />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-neutral-600" />
                      )}
                      {item.label}
                      <ArrowRight className="w-3 h-3 text-neutral-700 ml-auto" />
                    </button>
                  ))}
                  <div className="my-1.5 border-t border-white/[0.04]" />
                </>
              )}
              <div className="px-2 py-1.5">
                <span className="text-[10px] text-neutral-600 uppercase tracking-widest">Quick Actions</span>
              </div>
              {[
                { name: 'Funding Rates', href: '/funding', icon: Percent },
                { name: 'Liquidations', href: '/liquidations', icon: Zap },
                { name: 'Open Interest', href: '/open-interest', icon: PieChart },
                { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
                { name: 'Top Movers', href: '/top-movers', icon: Rocket },
              ].map((item) => (
                <button
                  key={item.href}
                  onClick={() => navigateTo(item.href)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-neutral-400 hover:text-white hover:bg-white/[0.04] transition-colors"
                >
                  <item.icon className="w-3.5 h-3.5 text-neutral-600" />
                  {item.name}
                  <ArrowRight className="w-3 h-3 text-neutral-700 ml-auto" />
                </button>
              ))}
            </div>
          )}

          {/* Page results */}
          {pageResults.length > 0 && (
            <div className="p-2">
              <div className="px-2 py-1.5">
                <span className="text-[10px] text-neutral-600 uppercase tracking-widest">Pages</span>
              </div>
              {pageResults.map((page, i) => {
                const idx = i;
                return (
                  <button
                    key={page.href}
                    data-cmd-index={idx}
                    onClick={() => navigateTo(page.href)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedIndex === idx
                        ? 'bg-white/[0.06] text-white'
                        : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    <page.icon className="w-3.5 h-3.5 text-neutral-600 flex-shrink-0" />
                    <span className="flex-1 text-left">{page.name}</span>
                    <span className="text-[10px] text-neutral-600">{page.category}</span>
                    <ArrowRight className="w-3 h-3 text-neutral-700" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Coin results */}
          {coinResults.length > 0 && (
            <div className="p-2 border-t border-white/[0.04]">
              <div className="px-2 py-1.5">
                <span className="text-[10px] text-neutral-600 uppercase tracking-widest">Coins</span>
              </div>
              {coinResults.map((coin, i) => {
                const idx = pageResults.length + i;
                return (
                  <button
                    key={coin.id}
                    data-cmd-index={idx}
                    onClick={() => navigateTo(`/coin/${coin.id}`)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedIndex === idx
                        ? 'bg-white/[0.06] text-white'
                        : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    <Image src={coin.thumb?.startsWith('https://') ? coin.thumb : '/logo-icon.svg'} alt={coin.name} width={20} height={20} className="rounded-full" />
                    <span className="flex-1 text-left">
                      <span className="text-white font-medium">{coin.name}</span>
                      <span className="text-neutral-600 ml-1.5 text-xs">{coin.symbol.toUpperCase()}</span>
                    </span>
                    {coin.market_cap_rank && (
                      <span className="text-[10px] text-neutral-600">#{coin.market_cap_rank}</span>
                    )}
                    <ArrowRight className="w-3 h-3 text-neutral-700" />
                  </button>
                );
              })}
            </div>
          )}

          {/* No results */}
          {query.trim() && pageResults.length === 0 && coinResults.length === 0 && !isLoadingCoins && (
            <div className="px-4 py-8 text-center">
              <p className="text-neutral-600 text-sm">No results for &ldquo;{query}&rdquo;</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3 text-[10px] text-neutral-600">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-white/[0.06] border border-white/[0.08] rounded text-[9px]">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-white/[0.06] border border-white/[0.08] rounded text-[9px]">↵</kbd>
              select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-white/[0.06] border border-white/[0.08] rounded text-[9px]">esc</kbd>
              close
            </span>
          </div>
          <button
            onClick={() => { onClose(); onShowShortcuts(); }}
            className="flex items-center gap-1 text-[10px] text-neutral-600 hover:text-hub-yellow transition-colors"
          >
            <Keyboard className="w-3 h-3" />
            All shortcuts
          </button>
        </div>
      </div>
    </div>
  );
}
