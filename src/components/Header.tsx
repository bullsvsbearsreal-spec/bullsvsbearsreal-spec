'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Menu, X, Search, ChevronDown,
  Activity, BarChart3, Heart, Briefcase, MoreHorizontal,
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
import ThemeToggle from './ThemeToggle';
import UserMenu from './UserMenu';
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
    label: 'Trading',
    icon: Activity,
    columns: [
      {
        heading: 'Analysis',
        items: [
          { name: 'Chart', href: '/chart', icon: LineChart, desc: 'TradingView charts' },
          { name: 'Screener', href: '/screener', icon: SlidersHorizontal, desc: 'Filter & scan markets' },
          { name: 'Options', href: '/options', icon: Shield, desc: 'Options flow & greeks' },
          { name: 'Basis', href: '/basis', icon: BarChart2, desc: 'Spot-perp premium' },
          { name: 'Predictions', href: '/prediction-markets', icon: Eye },
          { name: 'Execution Costs', href: '/execution-costs', icon: Crosshair },
        ],
      },
      {
        heading: 'Funding & OI',
        items: [
          { name: 'Funding Rates', href: '/funding', icon: Percent, desc: '33 exchanges live', badge: '33' },
          { name: 'Funding Heatmap', href: '/funding-heatmap', icon: Grid3X3 },
          { name: 'Open Interest', href: '/open-interest', icon: PieChart, desc: 'Aggregated OI' },
          { name: 'OI Heatmap', href: '/oi-heatmap', icon: Grid3X3 },
        ],
      },
      {
        heading: 'Liquidations',
        items: [
          { name: 'Liquidations', href: '/liquidations', icon: Zap, desc: 'Real-time liqs' },
          { name: 'Liq Map', href: '/liquidation-map', icon: Crosshair },
          { name: 'Liq Heatmap', href: '/liquidation-heatmap', icon: Grid3X3 },
        ],
      },
      {
        heading: 'Flow',
        items: [
          { name: 'Long/Short', href: '/longshort', icon: ArrowLeftRight },
          { name: 'CVD', href: '/cvd', icon: LineChart },
          { name: 'Order Flow', href: '/orderflow', icon: Activity },
          { name: 'RSI Heatmap', href: '/rsi-heatmap', icon: GaugeIcon },
        ],
      },
    ],
  },
  {
    label: 'Markets',
    icon: BarChart3,
    columns: [
      {
        heading: 'Overview',
        items: [
          { name: 'Top Movers', href: '/top-movers', icon: Rocket, desc: 'Biggest gainers & losers' },
          { name: 'Heatmap', href: '/market-heatmap', icon: Map, desc: 'Crypto market map' },
          { name: 'Stock Heatmap', href: '/stock-heatmap', icon: Map },
          { name: 'Dominance', href: '/dominance', icon: Crown },
          { name: 'Market Cycle', href: '/market-cycle', icon: Activity },
          { name: 'Correlation', href: '/correlation', icon: GitCompareArrows },
        ],
      },
      {
        heading: 'Institutional',
        items: [
          { name: 'ETF Tracker', href: '/etf', icon: LineChart, desc: 'BTC & ETH ETF flows' },
          { name: 'BTC Treasuries', href: '/bitcoin-treasuries', icon: Bitcoin },
          { name: 'Token Unlocks', href: '/token-unlocks', icon: Unlock },
          { name: 'Airdrops', href: '/airdrops', icon: Gift },
        ],
      },
      {
        heading: 'On-Chain',
        items: [
          { name: 'Exchange Reserves', href: '/exchange-reserves', icon: Landmark },
          { name: 'Stablecoin Flows', href: '/stablecoin-flows', icon: Coins },
          { name: 'On-Chain', href: '/onchain', icon: BarChart3 },
          { name: 'DeFi Yields', href: '/yields', icon: TrendingUp },
          { name: 'Exchanges', href: '/exchange-comparison', icon: Building2 },
        ],
      },
    ],
  },
  {
    label: 'Sentiment',
    icon: Heart,
    columns: [
      {
        heading: '',
        items: [
          { name: 'Fear & Greed', href: '/fear-greed', icon: Thermometer, desc: 'Market sentiment index' },
          { name: 'Whale Alert', href: '/whale-alert', icon: Fish, desc: 'Large transactions' },
          { name: 'HL Whales', href: '/hl-whales', icon: Eye, desc: 'Hyperliquid top traders' },
          { name: 'News', href: '/news', icon: Newspaper, desc: 'Crypto news feed' },
        ],
      },
    ],
  },
  {
    label: 'Portfolio',
    icon: Briefcase,
    columns: [
      {
        heading: '',
        items: [
          { name: 'Watchlist', href: '/watchlist', icon: Star, desc: 'Track your coins' },
          { name: 'Compare', href: '/compare', icon: GitCompare },
          { name: 'Alerts', href: '/alerts', icon: Bell, desc: 'Price & funding alerts' },
          { name: 'Portfolio', href: '/portfolio', icon: Wallet },
          { name: 'Wallet Tracker', href: '/wallet-tracker', icon: SearchIcon },
        ],
      },
    ],
  },
  {
    label: 'More',
    icon: MoreHorizontal,
    columns: [
      {
        heading: '',
        items: [
          { name: 'Economic Calendar', href: '/economic-calendar', icon: Calendar },
          { name: 'Guides', href: '/guides', icon: BookOpen },
          { name: 'Brand Kit', href: '/brand', icon: Palette },
          { name: 'Team', href: '/team', icon: Users },
          { name: 'Referrals', href: '/referrals', icon: Gift },
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

  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
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
        setMobileOpen(false);
        setOpenDropdown(null);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
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
            <ThemeToggle />
            <UserMenu />

            {searchOpen ? (
              <div className="relative">
                <CoinSearch
                  onSelect={handleCoinSelect}
                  placeholder="Search coins..."
                  className="w-60"
                  autoFocus
                />
              </div>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-neutral-500 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-colors text-[13px]"
                aria-label="Search coins"
              >
                <Search className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Search</span>
                <kbd className="hidden sm:inline text-[10px] text-neutral-600 bg-white/[0.06] px-1.5 py-0.5 rounded ml-2">
                  Ctrl K
                </kbd>
              </button>
            )}

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
  );
}
