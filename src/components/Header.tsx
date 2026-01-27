'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, TrendingUp, BarChart3, Zap, Calendar, Activity, Settings, Bell } from 'lucide-react';
import Logo from './Logo';

const navItems = [
  { name: 'Dashboard', href: '/', icon: Activity },
  { name: 'Funding Rates', href: '/funding', icon: TrendingUp },
  { name: 'Open Interest', href: '/open-interest', icon: BarChart3 },
  { name: 'Liquidations', href: '/liquidations', icon: Zap },
  { name: 'Calendar', href: '/calendar', icon: Calendar },
];

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="glass-dark sticky top-0 z-50 border-b border-hub-gray/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center group">
            <Logo size="md" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="relative flex items-center space-x-2 px-4 py-2 rounded-xl text-hub-gray-text hover:text-white transition-all duration-300 group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-hub-yellow/0 via-hub-yellow/10 to-hub-yellow/0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <item.icon className="w-4 h-4 relative z-10 group-hover:text-hub-yellow transition-colors" />
                <span className="relative z-10">{item.name}</span>
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center space-x-2">
            {/* Live indicator */}
            <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-hub-gray/50 border border-hub-gray-light/30">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
              </span>
              <span className="text-xs text-hub-gray-text-light font-medium">Live</span>
            </div>

            {/* Notification bell */}
            <button className="p-2.5 rounded-xl text-hub-gray-text hover:text-hub-yellow hover:bg-hub-gray/50 transition-all duration-200 relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-hub-yellow rounded-full"></span>
            </button>

            {/* Settings */}
            <button className="p-2.5 rounded-xl text-hub-gray-text hover:text-hub-yellow hover:bg-hub-gray/50 transition-all duration-200">
              <Settings className="w-5 h-5" />
            </button>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2.5 rounded-xl text-hub-gray-text hover:text-hub-yellow hover:bg-hub-gray/50 transition-all"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${mobileMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="glass border-t border-hub-gray/30">
          <nav className="px-4 py-3 space-y-1">
            {navItems.map((item, index) => (
              <Link
                key={item.name}
                href={item.href}
                className="flex items-center space-x-3 px-4 py-3 rounded-xl text-hub-gray-text hover:text-white hover:bg-hub-yellow/10 transition-all duration-200"
                onClick={() => setMobileMenuOpen(false)}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <item.icon className="w-5 h-5 text-hub-yellow" />
                <span className="font-medium">{item.name}</span>
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}