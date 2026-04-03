'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Menu, X, Search, ChevronDown,
  Activity, BarChart3, Briefcase,
  SlidersHorizontal, Percent, Grid3X3, PieChart, Zap, ArrowLeftRight,
  LineChart, Shield, Gauge as GaugeIcon, BarChart2, Crosshair,
  Rocket, Map, Crown, Building2, Landmark, Coins, GitCompareArrows, Unlock, Bitcoin, TrendingUp,
  Thermometer, Fish, Eye, Newspaper,
  Star, GitCompare, Bell, Wallet, Search as SearchIcon,
  Calendar, Palette, Users, BookOpen, Gift,
  type LucideIcon,
} from 'lucide-react';
import Logo from './Logo';
import CoinSearch from './CoinSearch';
import CommandPalette from './CommandPalette';
import ThemeToggle from './ThemeToggle';
import SoundToggle from './SoundToggle';
import UserMenu from './UserMenu';
import KeyboardShortcutsOverlay from './KeyboardShortcutsOverlay';
import Breadcrumbs from './Breadcrumbs';
import { useTrackPageView } from '@/hooks/useTrackPageView';
import { CoinSearchResult } from '@/lib/api/coingecko';

/* ------------------------------------------------------------------ */
/*  Navigation structure                                               */
/* ------------------------------------------------------------------ */

interface NavLink {
  name: string;
  href: string;
  icon: LucideIcon;
  desc?: string;
  badge?: string;
}

interface NavGroup {
  heading: string;
  items: NavLink[];
}

interface NavCategory {
  label: string;
  icon: LucideIcon;
  columns: NavGroup[];
}

const navCategories: NavCategory[] = [
  {
    label: 'Scan & Trade',
    icon: Activity,
    columns: [
      {
        heading: 'Funding & Arb',
        items: [
          { name: 'Funding Rates', href: '/funding', icon: Percent, desc: '33 exchanges live', badge: '33' },
          { name: 'Funding Heatmap', href: '/funding-heatmap', icon: Grid3X3, desc: 'Visual rate comparison' },
          { name: 'Price Spreads', href: '/spreads', icon: ArrowLeftRight, desc: 'Cross-exchange gaps' },
          { name: 'Spread Scanner', href: '/spread-scanner', icon: ArrowLeftRight, desc: 'Multi-coin arb scanner' },
          { name: 'Basis', href: '/basis', icon: BarChart2, desc: 'Spot-perp premium' },
          { name: 'Execution Costs', href: '/execution-costs', icon: Crosshair, desc: 'Slippage & fee ranking' },
        ],
      },
      {
        heading: 'Analysis',
        items: [
          { name: 'Chart', href: '/chart', icon: LineChart, desc: 'TradingView charts' },
          { name: 'Screener', href: '/screener', icon: SlidersHorizontal, desc: 'Filter & scan markets' },
          { name: 'Options', href: '/options', icon: Shield, desc: 'Options flow & greeks' },
          { name: 'Predictions', href: '/prediction-markets', icon: Eye, desc: 'Prediction markets' },
        ],
      },
    ],
  },
  {
    label: 'Monitor',
    icon: BarChart3,
    columns: [
      {
        heading: 'Market Overview',
        items: [
          { name: 'Top Movers', href: '/top-movers', icon: Rocket, desc: 'Biggest gainers & losers' },
          { name: 'Market Heatmap', href: '/market-heatmap', icon: Map, desc: 'Crypto market map' },
          { name: 'Stock Heatmap', href: '/stock-heatmap', icon: Map, desc: 'Equity market map' },
          { name: 'Dominance', href: '/dominance', icon: Crown, desc: 'BTC/ETH/alt share' },
          { name: 'Market Cycle', href: '/market-cycle', icon: Activity, desc: 'Macro trend phase' },
          { name: 'Correlation', href: '/correlation', icon: GitCompareArrows, desc: 'Cross-asset correlation' },
          { name: 'RSI Heatmap', href: '/rsi-heatmap', icon: GaugeIcon, desc: 'Overbought/oversold scan' },
        ],
      },
      {
        heading: 'On-Chain & Flows',
        items: [
          { name: 'Exchange Reserves', href: '/exchange-reserves', icon: Landmark, desc: 'Exchange balances' },
          { name: 'Stablecoin Flows', href: '/stablecoin-flows', icon: Coins, desc: 'Mint/burn tracker' },
          { name: 'On-Chain', href: '/onchain', icon: BarChart3, desc: 'Blockchain metrics' },
          { name: 'DeFi Yields', href: '/yields', icon: TrendingUp, desc: 'Protocol yield rates' },
          { name: 'Exchanges', href: '/exchange-comparison', icon: Building2, desc: 'Exchange comparison' },
        ],
      },
    ],
  },
  {
    label: 'Risk',
    icon: Zap,
    columns: [
      {
        heading: 'Liquidations',
        items: [
          { name: 'Liquidations', href: '/liquidations', icon: Zap, desc: 'Real-time forced closures' },
          { name: 'Liq Map', href: '/liquidation-map', icon: Crosshair, desc: 'Price-level density' },
          { name: 'Liq Heatmap', href: '/liquidation-heatmap', icon: Grid3X3, desc: 'Visual liq clusters' },
        ],
      },
      {
        heading: 'Positioning',
        items: [
          { name: 'Open Interest', href: '/open-interest', icon: PieChart, desc: 'Aggregated OI data' },
          { name: 'OI Heatmap', href: '/oi-heatmap', icon: Grid3X3, desc: 'Visual OI by coin' },
          { name: 'Long/Short', href: '/longshort', icon: ArrowLeftRight, desc: 'L/S ratio by exchange' },
          { name: 'CVD', href: '/cvd', icon: LineChart, desc: 'Volume delta analysis' },
          { name: 'Order Flow', href: '/orderflow', icon: Activity, desc: 'Tape & aggressor flow' },
        ],
      },
      {
        heading: 'Whales',
        items: [
          { name: 'Whale Alert', href: '/whale-alert', icon: Fish, desc: 'Large on-chain txns' },
          { name: 'HL Whales', href: '/hl-whales', icon: Eye, desc: 'Hyperliquid top traders' },
        ],
      },
    ],
  },
  {
    label: 'Research',
    icon: BookOpen,
    columns: [
      {
        heading: 'News & Events',
        items: [
          { name: 'News', href: '/news', icon: Newspaper, desc: 'Crypto news feed' },
          { name: 'Economic Calendar', href: '/economic-calendar', icon: Calendar, desc: 'Macro data releases' },
          { name: 'Token Unlocks', href: '/token-unlocks', icon: Unlock, desc: 'Vesting schedules' },
          { name: 'Airdrops', href: '/airdrops', icon: Gift, desc: 'Upcoming airdrops' },
        ],
      },
      {
        heading: 'Institutional',
        items: [
          { name: 'ETF Tracker', href: '/etf', icon: LineChart, desc: 'BTC & ETH ETF flows' },
          { name: 'BTC Treasuries', href: '/bitcoin-treasuries', icon: Bitcoin, desc: 'Corporate holdings' },
          { name: 'Fear & Greed', href: '/fear-greed', icon: Thermometer, desc: 'Market sentiment index' },
        ],
      },
      {
        heading: 'Learn',
        items: [
          { name: 'Guides', href: '/guides', icon: BookOpen, desc: 'Trading guides' },
          { name: 'Developers', href: '/developers', icon: BookOpen, desc: 'API & integrations' },
          { name: 'API Docs', href: '/api-docs', icon: BookOpen, desc: 'Endpoint reference' },
        ],
      },
    ],
  },
  {
    label: 'My Tools',
    icon: Briefcase,
    columns: [
      {
        heading: '',
        items: [
          { name: 'Dashboard', href: '/dashboard', icon: BarChart3, desc: 'Custom widget dashboard' },
          { name: 'Watchlist', href: '/watchlist', icon: Star, desc: 'Track your coins' },
          { name: 'Portfolio', href: '/portfolio', icon: Wallet, desc: 'Holdings & P&L' },
          { name: 'Alerts', href: '/alerts', icon: Bell, desc: 'Price & funding alerts' },
          { name: 'Compare', href: '/compare', icon: GitCompare, desc: 'Side-by-side analysis' },
          { name: 'Wallet Tracker', href: '/wallet-tracker', icon: SearchIcon, desc: 'Track any wallet' },
        ],
      },
      {
        heading: '',
        items: [
          { name: 'Brand Kit', href: '/brand', icon: Palette, desc: 'Logos & assets' },
          { name: 'Team', href: '/team', icon: Users, desc: 'Meet the team' },
          { name: 'Referrals', href: '/referrals', icon: Gift, desc: 'Earn rewards' },
        ],
      },
    ],
  },
];

/* Helper: flatten all items from a category */
const allItems = (cat: NavCategory) => cat.columns.flatMap((g) => g.items);

/* ------------------------------------------------------------------ */
/*  Header component                                                   */
/* ------------------------------------------------------------------ */

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();

  // Auto-track page views for recently-viewed history
  useTrackPageView();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);

  const searchRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---------- helpers ------------------------------------------------ */

  const isCategoryActive = useCallback(
    (cat: NavCategory) => allItems(cat).some((item) => pathname === item.href),
    [pathname],
  );

  /* ---------- close search on outside click -------------------------- */

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ---------- close dropdown on outside click ------------------------ */

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ---------- keyboard shortcuts ------------------------------------- */

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setShortcutsOpen(false);
        setMobileOpen(false);
        setOpenDropdown(null);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      // ? key — only when not typing in an input
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !(e.target as HTMLElement)?.isContentEditable) {
          e.preventDefault();
          setShortcutsOpen((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  /* ---------- close mobile menu on route change ---------------------- */

  useEffect(() => {
    setMobileOpen(false);
    setMobileExpanded(null);
  }, [pathname]);

  /* ---------- coin search handler ------------------------------------ */

  const handleCoinSelect = (coin: CoinSearchResult) => {
    setSearchOpen(false);
    setMobileOpen(false);
    router.push(`/coin/${coin.id}`);
  };

  /* ---------- dropdown hover handlers -------------------------------- */

  const handleCategoryEnter = (label: string) => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpenDropdown(label);
  };

  const handleCategoryLeave = () => {
    closeTimer.current = setTimeout(() => {
      setOpenDropdown(null);
    }, 150);
  };

  /* ---------- mobile accordion toggle -------------------------------- */

  const toggleMobileCategory = (label: string) => {
    setMobileExpanded((prev) => (prev === label ? null : label));
  };

  /* ------------------------------------------------------------------ */
  /*  Render helpers                                                     */
  /* ------------------------------------------------------------------ */

  /** Render a single nav link */
  const renderLink = (link: NavLink, onClick?: () => void) => {
    const isActive = pathname === link.href;
    return (
      <Link
        key={link.href}
        href={link.href}
        onClick={onClick}
        className={`group flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ${
          isActive
            ? 'bg-hub-yellow/10 text-hub-yellow'
            : 'text-neutral-300 hover:text-white hover:bg-white/[0.05]'
        }`}
      >
        <span className={`mt-0.5 flex items-center justify-center w-6 h-6 rounded-md flex-shrink-0 transition-colors ${
          isActive
            ? 'bg-hub-yellow/20 text-hub-yellow'
            : 'bg-white/[0.05] text-neutral-500 group-hover:text-neutral-300 group-hover:bg-white/[0.08]'
        }`}>
          <link.icon className="w-3 h-3" />
        </span>
        <div className="flex flex-col gap-0 min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate leading-tight">{link.name}</span>
            {link.badge && (
              <span className="text-[8px] font-bold bg-hub-yellow/15 text-hub-yellow px-1 py-px rounded leading-none flex-shrink-0">{link.badge}</span>
            )}
          </div>
          {link.desc && (
            <span className={`text-[11px] font-normal leading-tight truncate ${
              isActive ? 'text-hub-yellow/50' : 'text-neutral-600 group-hover:text-neutral-500'
            }`}>{link.desc}</span>
          )}
        </div>
      </Link>
    );
  };

  /** Desktop mega-menu dropdown panel */
  const renderDropdown = (cat: NavCategory) => {
    const isMega = cat.columns.length > 1;

    if (!isMega) {
      // Single-column simple dropdown
      return (
        <div className="absolute top-full left-0 pt-1.5 z-50">
          <div className="bg-[#0d0d0d] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/60 py-1.5 px-1.5 min-w-[220px]">
            {cat.columns[0].items.map((link) => renderLink(link, () => setOpenDropdown(null)))}
          </div>
        </div>
      );
    }

    // Multi-column mega menu
    return (
      <div className="absolute top-full left-0 pt-1.5 z-50">
        <div className="bg-[#0d0d0d] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/60 p-2">
          <div className="flex">
            {cat.columns.map((group, gi) => (
              <div key={group.heading} className={`min-w-[185px] px-1 ${gi > 0 ? 'border-l border-white/[0.06]' : ''}`}>
                <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-600 px-2.5 pb-1.5 pt-0.5 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-hub-yellow/40" />
                  {group.heading}
                </div>
                <div className="space-y-px">
                  {group.items.map((link) => renderLink(link, () => setOpenDropdown(null)))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <>
    <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-sm border-b border-white/[0.06]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-12">
          {/* Left: Logo + Nav */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex-shrink-0">
              <Logo size="lg" />
            </Link>

            {/* Desktop navigation */}
            <nav
              ref={navRef}
              className="hidden md:flex items-center gap-0.5"
              aria-label="Main navigation"
            >
              {navCategories.map((cat) => {
                const isOpen = openDropdown === cat.label;
                const hasActive = isCategoryActive(cat);

                return (
                  <div
                    key={cat.label}
                    className="relative"
                    onMouseEnter={() => handleCategoryEnter(cat.label)}
                    onMouseLeave={handleCategoryLeave}
                  >
                    {/* Category trigger */}
                    <button
                      type="button"
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200 ${
                        hasActive
                          ? 'text-hub-yellow hover:shadow-[0_0_12px_rgba(255,140,0,0.15)]'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                      aria-expanded={isOpen}
                      aria-haspopup="true"
                    >
                      <cat.icon className="w-3.5 h-3.5" />
                      {cat.label}
                      <ChevronDown
                        className={`w-3 h-3 transition-transform duration-150 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {/* Dropdown panel */}
                    {isOpen && renderDropdown(cat)}
                  </div>
                );
              })}
            </nav>
          </div>

          {/* Right: Theme + Search + Auth + Mobile toggle */}
          <div className="flex items-center gap-2" ref={searchRef}>
            <SoundToggle />
            <ThemeToggle />
            <button
              onClick={() => setShortcutsOpen(true)}
              className="hidden sm:flex items-center justify-center w-7 h-7 rounded-md text-neutral-600 hover:text-white hover:bg-white/[0.06] transition-colors text-[13px] font-medium"
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts (?)"
            >
              ?
            </button>
            <UserMenu />

            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-neutral-500 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-colors text-[13px]"
              aria-label="Search pages and coins"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden sm:inline text-[10px] text-neutral-600 bg-white/[0.06] px-1.5 py-0.5 rounded ml-2">
                Ctrl K
              </kbd>
            </button>

            <button
              className="md:hidden p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div
          id="mobile-nav"
          className="md:hidden bg-hub-dark border-t border-white/[0.06] max-h-[80vh] overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <div className="p-3">
            <CoinSearch
              onSelect={handleCoinSelect}
              placeholder="Search coins..."
              className="w-full mb-3"
            />

            <nav className="space-y-0.5" aria-label="Mobile navigation">
              {navCategories.map((cat) => {
                const isExpanded = mobileExpanded === cat.label;
                const hasActive = isCategoryActive(cat);

                return (
                  <div key={cat.label}>
                    {/* Category header (accordion trigger) */}
                    <button
                      type="button"
                      onClick={() => toggleMobileCategory(cat.label)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                        hasActive
                          ? 'text-hub-yellow'
                          : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                      }`}
                      aria-expanded={isExpanded}
                    >
                      <span className="flex items-center gap-2.5">
                        <cat.icon className="w-4 h-4" />
                        {cat.label}
                        <span className="text-[10px] text-neutral-600 font-normal">
                          {allItems(cat).length}
                        </span>
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {/* Accordion content with sub-groups */}
                    {isExpanded && (
                      <div className="ml-3 border-l border-white/[0.06] pl-3 pb-1">
                        {cat.columns.map((group) => (
                          <div key={group.heading || 'default'}>
                            {group.heading && (
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-600 px-3 pt-2 pb-1">
                                {group.heading}
                              </div>
                            )}
                            {group.items.map((link) => (
                              <Link
                                key={link.href}
                                href={link.href}
                                onClick={() => setMobileOpen(false)}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                                  pathname === link.href
                                    ? 'bg-hub-yellow/10 text-hub-yellow'
                                    : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                                }`}
                              >
                                <link.icon className="w-3.5 h-3.5 flex-shrink-0" />
                                {link.name}
                              </Link>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </header>
    <Breadcrumbs />

    {searchOpen && (
      <CommandPalette
        onClose={() => setSearchOpen(false)}
        onShowShortcuts={() => { setSearchOpen(false); setShortcutsOpen(true); }}
      />
    )}
    {shortcutsOpen && <KeyboardShortcutsOverlay onClose={() => setShortcutsOpen(false)} />}
    </>
  );
}
