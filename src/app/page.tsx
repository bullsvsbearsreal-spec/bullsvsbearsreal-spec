'use client';

import Header from '@/components/Header';
import MarketTicker from '@/components/MarketTicker';
import StatCard from '@/components/StatCard';
import FundingRatesTable from '@/components/FundingRatesTable';
import LiquidationsCard from '@/components/LiquidationsCard';
import EconomicCalendar from '@/components/EconomicCalendar';
import OpenInterestChart from '@/components/OpenInterestChart';
import ExchangeList from '@/components/ExchangeList';
import CryptoTable from '@/components/CryptoTable';
import FearGreedIndex from '@/components/FearGreedIndex';
import { marketOverview } from '@/lib/mockData';
import { DollarSign, TrendingUp, Zap, BarChart3 } from 'lucide-react';

function formatNumber(num: number): string {
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  return `$${num.toLocaleString()}`;
}

export default function Home() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <MarketTicker />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            <span className="text-white">Welcome to </span>
            <span className="text-gradient">InfoHub</span>
          </h1>
          <p className="text-hub-gray-text">Your one-stop shop for all crypto trading data</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="24h Volume"
            value={formatNumber(marketOverview.totalVolume24h)}
            change="+136.09%"
            changePositive={true}
            icon={DollarSign}
          />
          <StatCard
            title="Open Interest"
            value={formatNumber(marketOverview.totalOpenInterest)}
            change="-1.13%"
            changePositive={false}
            icon={BarChart3}
          />
          <StatCard
            title="24h Liquidations"
            value={formatNumber(marketOverview.totalLiquidations24h)}
            change="+355.85%"
            changePositive={true}
            icon={Zap}
          />
          <StatCard
            title="BTC Dominance"
            value={`${marketOverview.btcDominance}%`}
            subtitle="Market share"
            icon={TrendingUp}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <CryptoTable />
          </div>
          <div>
            <FearGreedIndex />
          </div>
        </div>

        {/* Data Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <FundingRatesTable />
          <LiquidationsCard />
        </div>

        {/* OI and Calendar */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <OpenInterestChart />
          <EconomicCalendar />
        </div>

        {/* Exchange List */}
        <ExchangeList />

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-hub-gray">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-hub-yellow rounded-lg flex items-center justify-center">
                <span className="text-hub-black font-bold text-sm">iH</span>
              </div>
              <span className="text-lg font-bold">
                <span className="text-white">Info</span>
                <span className="text-hub-yellow">Hub</span>
              </span>
            </div>
            <p className="text-hub-gray-text text-sm">
              2026 InfoHub. All data for informational purposes only.
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}