'use client';

import Header from '@/components/Header';
import MarketTicker from '@/components/MarketTicker';
import StatsOverview from '@/components/StatsOverview';
import FundingRatesTable from '@/components/FundingRatesTable';
import LiquidationsCard from '@/components/LiquidationsCard';
import EconomicCalendar from '@/components/EconomicCalendar';
import OpenInterestChart from '@/components/OpenInterestChart';
import ExchangeList from '@/components/ExchangeList';
import CryptoTable from '@/components/CryptoTable';
import FearGreedIndex from '@/components/FearGreedIndex';
import { Sparkles, ArrowRight, Globe, Shield, Zap } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-hub-black relative">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-hub-yellow/5 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-hub-orange/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '-2s' }} />
      </div>

      <Header />
      <MarketTicker />

      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section with Animation */}
        <div className="mb-10 animate-slideUp">
          <div className="flex items-center gap-2 mb-3">
            <div className="px-3 py-1 rounded-full bg-gradient-to-r from-hub-yellow/20 to-hub-orange/20 border border-hub-yellow/30">
              <span className="text-xs font-semibold text-hub-yellow flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                Live Market Data
              </span>
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
            <span className="text-white">Welcome to </span>
            <span className="text-gradient animate-shine">InfoHub</span>
          </h1>
          <p className="text-hub-gray-text text-lg md:text-xl max-w-2xl">
            Your one-stop destination for real-time crypto trading data, funding rates, and market analytics.
          </p>

          {/* Feature Pills */}
          <div className="flex flex-wrap gap-3 mt-6">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-hub-gray/30 border border-hub-gray-light/20 text-sm">
              <Globe className="w-4 h-4 text-hub-yellow" />
              <span className="text-hub-gray-text-light">6 Exchanges</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-hub-gray/30 border border-hub-gray-light/20 text-sm">
              <Zap className="w-4 h-4 text-hub-yellow" />
              <span className="text-hub-gray-text-light">Real-time Updates</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-hub-gray/30 border border-hub-gray-light/20 text-sm">
              <Shield className="w-4 h-4 text-hub-yellow" />
              <span className="text-hub-gray-text-light">Reliable Data</span>
            </div>
          </div>
        </div>

        {/* Stats Overview - New Component */}
        <section className="mb-10">
          <StatsOverview />
        </section>

        {/* Main Content Grid */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-white">Top Assets</h2>
              <p className="text-hub-gray-text text-sm">By 24h trading volume</p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-hub-gray-text hover:text-hub-yellow hover:bg-hub-gray/30 transition-all group">
              View All
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <CryptoTable />
            </div>
            <div className="space-y-6">
              <FearGreedIndex />
            </div>
          </div>
        </section>

        {/* Data Section */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-white">Market Data</h2>
              <p className="text-hub-gray-text text-sm">Funding rates & liquidations</p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <FundingRatesTable />
            <LiquidationsCard />
          </div>
        </section>

        {/* OI and Calendar */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-white">Analytics</h2>
              <p className="text-hub-gray-text text-sm">Open interest & upcoming events</p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <OpenInterestChart />
            <EconomicCalendar />
          </div>
        </section>

        {/* Exchange List */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-white">Connected Exchanges</h2>
              <p className="text-hub-gray-text text-sm">Data sources</p>
            </div>
          </div>
          <ExchangeList />
        </section>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-hub-gray/30">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            {/* Brand */}
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-hub-yellow to-hub-orange rounded-xl flex items-center justify-center shadow-lg shadow-hub-yellow/20">
                  <span className="text-hub-black font-bold">iH</span>
                </div>
                <span className="text-xl font-bold">
                  <span className="text-white">Info</span>
                  <span className="text-hub-yellow">Hub</span>
                </span>
              </div>
              <p className="text-hub-gray-text text-sm">
                Real-time crypto market data aggregated from top exchanges.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-white font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-hub-gray-text hover:text-hub-yellow transition-colors text-sm">Dashboard</a></li>
                <li><a href="#" className="text-hub-gray-text hover:text-hub-yellow transition-colors text-sm">Funding Rates</a></li>
                <li><a href="#" className="text-hub-gray-text hover:text-hub-yellow transition-colors text-sm">Open Interest</a></li>
                <li><a href="#" className="text-hub-gray-text hover:text-hub-yellow transition-colors text-sm">Liquidations</a></li>
              </ul>
            </div>

            {/* Exchanges */}
            <div>
              <h4 className="text-white font-semibold mb-4">Data Sources</h4>
              <ul className="space-y-2">
                <li><span className="text-hub-gray-text text-sm">Binance</span></li>
                <li><span className="text-hub-gray-text text-sm">Bybit</span></li>
                <li><span className="text-hub-gray-text text-sm">OKX</span></li>
                <li><span className="text-hub-gray-text text-sm">Bitget</span></li>
                <li><span className="text-hub-gray-text text-sm">Hyperliquid</span></li>
                <li><span className="text-hub-gray-text text-sm">dYdX</span></li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between pt-6 border-t border-hub-gray/20">
            <p className="text-hub-gray-text text-sm mb-4 md:mb-0">
              © 2026 InfoHub. All data for informational purposes only.
            </p>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-2 text-xs text-hub-gray-text">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                </span>
                All systems operational
              </span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
