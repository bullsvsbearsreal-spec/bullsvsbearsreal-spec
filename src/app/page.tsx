'use client';

import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import MarketTicker from '@/components/MarketTicker';
import StatsOverview from '@/components/StatsOverview';
import FundingRatesTable from '@/components/FundingRatesTable';
import LiquidationsCard from '@/components/LiquidationsCard';
import OpenInterestChart from '@/components/OpenInterestChart';
import ExchangeList from '@/components/ExchangeList';
import CryptoTable from '@/components/CryptoTable';
import FearGreedIndex from '@/components/FearGreedIndex';
import CoinSearch from '@/components/CoinSearch';
import EventsCalendar from '@/components/EventsCalendar';
import { CoinSearchResult } from '@/lib/api/coingecko';
import { Sparkles, ArrowRight, Globe, Shield, Zap, Search, Calendar, TrendingUp, Users } from 'lucide-react';
import TeamSection from '@/components/TeamSection';

export default function Home() {
  const router = useRouter();

  const handleCoinSelect = (coin: CoinSearchResult) => {
    router.push(`/coin/${coin.id}`);
  };

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
        {/* Hero Section */}
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
          <p className="text-hub-gray-text text-lg md:text-xl max-w-2xl mb-8">
            Your one-stop destination for real-time trading data.
          </p>

          {/* Search Bar - Prominent */}
          <div className="max-w-2xl">
            <CoinSearch
              onSelect={handleCoinSelect}
              placeholder="Search any coin for events, unlocks & news..."
              className="w-full"
            />
          </div>

          {/* Feature Pills */}
          <div className="flex flex-wrap gap-3 mt-6">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-hub-gray/30 border border-hub-gray-light/20 text-sm">
              <Search className="w-4 h-4 text-hub-yellow" />
              <span className="text-hub-gray-text-light">Search 10,000+ Coins</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-hub-gray/30 border border-hub-gray-light/20 text-sm">
              <Calendar className="w-4 h-4 text-hub-yellow" />
              <span className="text-hub-gray-text-light">Events & Unlocks</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-hub-gray/30 border border-hub-gray-light/20 text-sm">
              <Globe className="w-4 h-4 text-hub-yellow" />
              <span className="text-hub-gray-text-light">6 Exchanges</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-hub-gray/30 border border-hub-gray-light/20 text-sm">
              <Zap className="w-4 h-4 text-hub-yellow" />
              <span className="text-hub-gray-text-light">Real-time</span>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <section className="mb-10">
          <StatsOverview />
        </section>

        {/* Events & Top Assets Grid */}
        <section className="mb-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Upcoming Events */}
            <div className="lg:col-span-1">
              <EventsCalendar limit={6} showFilters={false} />
            </div>

            {/* Top Assets */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-hub-yellow/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-hub-yellow" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Top Assets</h2>
                    <p className="text-hub-gray-text text-sm">By 24h trading volume</p>
                  </div>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-hub-gray-text hover:text-hub-yellow hover:bg-hub-gray/30 transition-all group">
                  View All
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
              <CryptoTable />
            </div>
          </div>
        </section>

        {/* Fear & Greed + Funding Rates */}
        <section className="mb-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <FearGreedIndex />
            </div>
            <div className="lg:col-span-2">
              <FundingRatesTable />
            </div>
          </div>
        </section>

        {/* Liquidations & Open Interest */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-white">Market Analytics</h2>
              <p className="text-hub-gray-text text-sm">Liquidations & open interest data</p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LiquidationsCard />
            <OpenInterestChart />
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

        {/* Team Section */}
        <section className="mb-10">
          <TeamSection />
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
                Your one-stop destination for real-time trading data.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-white font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2">
                <li><a href="/" className="text-hub-gray-text hover:text-hub-yellow transition-colors text-sm">Dashboard</a></li>
                <li><a href="/funding" className="text-hub-gray-text hover:text-hub-yellow transition-colors text-sm">Funding Rates</a></li>
                <li><a href="/open-interest" className="text-hub-gray-text hover:text-hub-yellow transition-colors text-sm">Open Interest</a></li>
                <li><a href="/liquidations" className="text-hub-gray-text hover:text-hub-yellow transition-colors text-sm">Liquidations</a></li>
                <li><a href="/brand" className="text-hub-gray-text hover:text-hub-yellow transition-colors text-sm">Brand Assets</a></li>
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
