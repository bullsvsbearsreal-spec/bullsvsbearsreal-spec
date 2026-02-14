'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, Search, ChevronDown } from 'lucide-react';
import Logo from './Logo';
import CoinSearch from './CoinSearch';
import { CoinSearchResult } from '@/lib/api/coingecko';

/* ------------------------------------------------------------------ */
/*  Navigation structure                                               */
/* ------------------------------------------------------------------ */

interface NavLink {
  name: string;
  href: string;
}

interface NavCategory {
  label: string;
  items: NavLink[];
}

const navCategories: NavCategory[] = [
  {
    label: 'Trading',
    items: [
      { name: 'Screener', href: '/screener' },
      { name: 'Funding', href: '/funding' },
      { name: 'Funding Heatmap', href: '/funding-heatmap' },
      { name: 'Open Interest', href: '/open-interest' },
      { name: 'Liquidations', href: '/liquidations' },
      { name: 'Long/Short', href: '/longshort' },
      { name: 'CVD', href: '/cvd' },
      { name: 'Options', href: '/options' },
    ],
  },
  {
    label: 'Markets',
    items: [
      { name: 'Heatmap', href: '/market-heatmap' },
      { name: 'Dominance', href: '/dominance' },
      { name: 'Exchanges', href: '/exchange-comparison' },
      { name: 'Stablecoin Flows', href: '/stablecoin-flows' },
      { name: 'Correlation', href: '/correlation' },
      { name: 'Token Unlocks', href: '/token-unlocks' },
    ],
  },
  {
    label: 'Sentiment',
    items: [
      { name: 'Fear & Greed', href: '/fear-greed' },
      { name: 'Whale Alert', href: '/whale-alert' },
      { name: 'HL Whales', href: '/hl-whales' },
      { name: 'News', href: '/news' },
    ],
  },
  {
    label: 'Portfolio',
    items: [
      { name: 'Watchlist', href: '/watchlist' },
      { name: 'Alerts', href: '/alerts' },
      { name: 'Portfolio', href: '/portfolio' },
      { name: 'Wallet Tracker', href: '/wallet-tracker' },
    ],
  },
  {
    label: 'More',
    items: [
      { name: 'Economic Calendar', href: '/economic-calendar' },
      { name: 'API', href: '/api-docs' },
    ],
  },
];

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

  /** Check whether any item in a category matches the current path */
  const isCategoryActive = useCallback(
    (cat: NavCategory) => cat.items.some((item) => pathname === item.href),
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
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-sm border-b border-white/[0.06]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-12">
          {/* Left: Logo + Nav */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex-shrink-0">
              <Logo size="sm" />
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
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                        hasActive
                          ? 'text-hub-yellow'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                      aria-expanded={isOpen}
                      aria-haspopup="true"
                    >
                      {cat.label}
                      <ChevronDown
                        className={`w-3 h-3 transition-transform duration-150 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {/* Dropdown panel */}
                    {isOpen && (
                      <div className="absolute top-full left-0 pt-1 z-50">
                        <div className="bg-[#111] border border-white/[0.08] rounded-lg shadow-xl py-1 min-w-[180px]">
                          {cat.items.map((link) => (
                            <Link
                              key={link.href}
                              href={link.href}
                              onClick={() => setOpenDropdown(null)}
                              className={`block px-4 py-2 text-[13px] font-medium transition-colors ${
                                pathname === link.href
                                  ? 'bg-hub-yellow text-black'
                                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.06]'
                              }`}
                            >
                              {link.name}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>

          {/* Right: Search + Mobile toggle */}
          <div className="flex items-center gap-2" ref={searchRef}>
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
          className="md:hidden bg-[#0a0a0a] border-t border-white/[0.06]"
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
                      {cat.label}
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {/* Accordion content */}
                    {isExpanded && (
                      <div className="ml-3 border-l border-white/[0.06] pl-3 pb-1">
                        {cat.items.map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            onClick={() => setMobileOpen(false)}
                            className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] flex items-center ${
                              pathname === link.href
                                ? 'bg-hub-yellow/10 text-hub-yellow'
                                : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                            }`}
                          >
                            {link.name}
                          </Link>
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
