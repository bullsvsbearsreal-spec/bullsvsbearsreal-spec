'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu, X, TrendingUp, BarChart3, Zap, Activity, Bell,
  ChevronDown, Users, Newspaper, Search, Database, Info
} from 'lucide-react';
import Logo from './Logo';

interface NavItem {
  name: string;
  href?: string;
  icon: any;
  children?: { name: string; href: string; icon: any; description: string }[];
}

const navItems: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: Activity },
  {
    name: 'Data',
    icon: Database,
    children: [
      { name: 'Funding Rates', href: '/funding', icon: TrendingUp, description: 'Real-time funding across exchanges' },
      { name: 'Open Interest', href: '/open-interest', icon: BarChart3, description: 'Aggregated OI data' },
      { name: 'Liquidations', href: '/liquidations', icon: Zap, description: 'Live liquidation feed' },
    ]
  },
  { name: 'News', href: '/news', icon: Newspaper },
  { name: 'Team', href: '/team', icon: Users },
];

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActive = (href?: string, children?: NavItem['children']) => {
    if (href) return pathname === href;
    if (children) return children.some(child => pathname === child.href);
    return false;
  };

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'glass-dark shadow-lg shadow-black/20 border-b border-hub-yellow/10'
          : 'bg-hub-black/80 backdrop-blur-md border-b border-hub-gray/20'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center group">
            <div className="relative">
              <Logo size="md" />
              <div className="absolute inset-0 bg-hub-yellow/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1" ref={dropdownRef}>
            {navItems.map((item) => (
              <div key={item.name} className="relative">
                {item.children ? (
                  // Dropdown menu
                  <button
                    onClick={() => setOpenDropdown(openDropdown === item.name ? null : item.name)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                      isActive(item.href, item.children)
                        ? 'text-hub-yellow bg-hub-yellow/10'
                        : 'text-hub-gray-text hover:text-white hover:bg-hub-gray/30'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.name}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${openDropdown === item.name ? 'rotate-180' : ''}`} />
                  </button>
                ) : (
                  // Regular link
                  <Link
                    href={item.href!}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                      isActive(item.href)
                        ? 'text-hub-yellow bg-hub-yellow/10'
                        : 'text-hub-gray-text hover:text-white hover:bg-hub-gray/30'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </Link>
                )}

                {/* Dropdown Content */}
                {item.children && openDropdown === item.name && (
                  <div className="absolute top-full left-0 mt-2 w-72 py-2 bg-hub-gray/95 backdrop-blur-xl border border-hub-gray-light/20 rounded-2xl shadow-2xl shadow-black/50 animate-fadeIn">
                    {item.children.map((child) => (
                      <Link
                        key={child.name}
                        href={child.href}
                        onClick={() => setOpenDropdown(null)}
                        className={`flex items-start gap-3 px-4 py-3 mx-2 rounded-xl transition-all duration-200 ${
                          pathname === child.href
                            ? 'bg-hub-yellow/10 text-hub-yellow'
                            : 'text-hub-gray-text hover:bg-hub-gray/50 hover:text-white'
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${pathname === child.href ? 'bg-hub-yellow/20' : 'bg-hub-gray/50'}`}>
                          <child.icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">{child.name}</div>
                          <div className="text-xs text-hub-gray-text mt-0.5">{child.description}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Search Button */}
            <Link
              href="/"
              className="p-2.5 rounded-xl text-hub-gray-text hover:text-hub-yellow hover:bg-hub-gray/30 transition-all duration-300"
            >
              <Search className="w-5 h-5" />
            </Link>

            {/* Live Status Badge */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
              </span>
              <span className="text-xs text-success font-medium">Live</span>
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2.5 rounded-xl text-hub-gray-text hover:text-hub-yellow hover:bg-hub-gray/30 transition-all"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <div className="relative w-6 h-6">
                <Menu className={`w-6 h-6 absolute transition-all duration-300 ${mobileMenuOpen ? 'opacity-0 rotate-90' : 'opacity-100 rotate-0'}`} />
                <X className={`w-6 h-6 absolute transition-all duration-300 ${mobileMenuOpen ? 'opacity-100 rotate-0' : 'opacity-0 -rotate-90'}`} />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div
        className={`md:hidden absolute left-0 right-0 transition-all duration-300 ease-out ${
          mobileMenuOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 -translate-y-4 pointer-events-none'
        }`}
      >
        <div className="bg-hub-gray/95 backdrop-blur-xl border-t border-hub-gray/30 mx-4 rounded-2xl mt-2 overflow-hidden shadow-2xl">
          <nav className="p-3 space-y-1">
            {navItems.map((item) => (
              <div key={item.name}>
                {item.children ? (
                  // Mobile dropdown
                  <div>
                    <button
                      onClick={() => setOpenDropdown(openDropdown === item.name ? null : item.name)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-hub-gray-text hover:text-white hover:bg-hub-gray/30 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-hub-gray/30">
                          <item.icon className="w-5 h-5" />
                        </div>
                        <span className="font-medium">{item.name}</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 transition-transform ${openDropdown === item.name ? 'rotate-180' : ''}`} />
                    </button>
                    {openDropdown === item.name && (
                      <div className="ml-4 mt-1 space-y-1">
                        {item.children.map((child) => (
                          <Link
                            key={child.name}
                            href={child.href}
                            onClick={() => {
                              setMobileMenuOpen(false);
                              setOpenDropdown(null);
                            }}
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${
                              pathname === child.href
                                ? 'bg-hub-yellow/10 text-hub-yellow'
                                : 'text-hub-gray-text hover:text-white hover:bg-hub-gray/30'
                            }`}
                          >
                            <child.icon className="w-4 h-4" />
                            <span className="text-sm">{child.name}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  // Mobile regular link
                  <Link
                    href={item.href!}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      pathname === item.href
                        ? 'bg-hub-yellow/10 text-hub-yellow'
                        : 'text-hub-gray-text hover:text-white hover:bg-hub-gray/30'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${pathname === item.href ? 'bg-hub-yellow/20' : 'bg-hub-gray/30'}`}>
                      <item.icon className="w-5 h-5" />
                    </div>
                    <span className="font-medium">{item.name}</span>
                  </Link>
                )}
              </div>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
