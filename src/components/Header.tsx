'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, TrendingUp, BarChart3, Zap, Calendar, Activity, Settings, Bell, ChevronDown } from 'lucide-react';
import Logo from './Logo';

const navItems = [
  { name: 'Dashboard', href: '/', icon: Activity },
  { name: 'Funding', href: '/funding', icon: TrendingUp },
  { name: 'Open Interest', href: '/open-interest', icon: BarChart3 },
  { name: 'Liquidations', href: '/liquidations', icon: Zap },
];

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeNav, setActiveNav] = useState('/');

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'glass-dark shadow-lg shadow-black/20 border-b border-hub-yellow/10'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 md:h-18">
          {/* Logo */}
          <Link href="/" className="flex items-center group">
            <div className="relative">
              <Logo size="md" />
              <div className="absolute inset-0 bg-hub-yellow/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center">
            <div className="flex items-center bg-hub-gray/30 rounded-2xl p-1 backdrop-blur-sm border border-hub-gray-light/20">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setActiveNav(item.href)}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                    activeNav === item.href
                      ? 'tab-active'
                      : 'tab-inactive'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              ))}
            </div>
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Live Status Badge */}
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-success/10 to-success/5 border border-success/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
              </span>
              <span className="text-xs text-success font-semibold tracking-wide">LIVE</span>
            </div>

            {/* Notification Bell */}
            <button className="relative p-2.5 rounded-xl text-hub-gray-text hover:text-white hover:bg-hub-gray/50 transition-all duration-300 group">
              <Bell className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-hub-yellow rounded-full animate-pulse"></span>
            </button>

            {/* Settings */}
            <button className="p-2.5 rounded-xl text-hub-gray-text hover:text-white hover:bg-hub-gray/50 transition-all duration-300 group">
              <Settings className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
            </button>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2.5 rounded-xl text-hub-gray-text hover:text-hub-yellow hover:bg-hub-gray/50 transition-all"
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
        className={`md:hidden absolute left-0 right-0 transition-all duration-400 ease-out ${
          mobileMenuOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 -translate-y-4 pointer-events-none'
        }`}
      >
        <div className="glass-dark border-t border-hub-gray/30 mx-4 rounded-2xl mt-2 overflow-hidden shadow-2xl">
          <nav className="p-3 space-y-1">
            {navItems.map((item, index) => (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 ${
                  activeNav === item.href
                    ? 'bg-hub-yellow/10 text-hub-yellow'
                    : 'text-hub-gray-text hover:text-white hover:bg-hub-gray/30'
                }`}
                onClick={() => {
                  setActiveNav(item.href);
                  setMobileMenuOpen(false);
                }}
                style={{
                  transitionDelay: mobileMenuOpen ? `${index * 50}ms` : '0ms',
                }}
              >
                <div className={`p-2 rounded-lg ${
                  activeNav === item.href ? 'bg-hub-yellow/20' : 'bg-hub-gray/30'
                }`}>
                  <item.icon className="w-5 h-5" />
                </div>
                <span className="font-medium">{item.name}</span>
                {activeNav === item.href && (
                  <ChevronDown className="w-4 h-4 ml-auto -rotate-90" />
                )}
              </Link>
            ))}
          </nav>

          {/* Mobile Stats */}
          <div className="px-4 pb-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-hub-yellow/10 to-hub-orange/10 border border-hub-yellow/20">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                </span>
                <span className="text-xs text-hub-gray-text">Connected to 6 exchanges</span>
              </div>
              <span className="text-xs text-hub-yellow font-semibold">Live</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
