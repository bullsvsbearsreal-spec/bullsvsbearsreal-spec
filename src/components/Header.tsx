'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, Search } from 'lucide-react';
import Logo from './Logo';
import CoinSearch from './CoinSearch';
import { CoinSearchResult } from '@/lib/api/coingecko';

const navLinks = [
  { name: 'Funding', href: '/funding' },
  { name: 'Open Interest', href: '/open-interest' },
  { name: 'Liquidations', href: '/liquidations' },
  { name: 'Heatmap', href: '/market-heatmap' },
  { name: 'Long/Short', href: '/longshort' },
  { name: 'Exchanges', href: '/exchange-comparison' },
  { name: 'News', href: '/news' },
  { name: 'API', href: '/api-docs' },
];

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSearchOpen(false); setMobileOpen(false); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleCoinSelect = (coin: CoinSearchResult) => {
    setSearchOpen(false);
    setMobileOpen(false);
    router.push(`/coin/${coin.id}`);
  };

  return (
    <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-sm border-b border-white/[0.06]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-12">
          {/* Left: Logo + Nav */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex-shrink-0">
              <Logo size="sm" />
            </Link>

            <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                    pathname === link.href
                      ? 'bg-hub-yellow text-black'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {link.name}
                </Link>
              ))}
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
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] flex items-center ${
                    pathname === link.href
                      ? 'bg-hub-yellow/10 text-hub-yellow'
                      : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  {link.name}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
