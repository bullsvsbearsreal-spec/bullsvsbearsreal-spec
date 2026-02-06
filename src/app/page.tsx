'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import MarketTicker from '@/components/MarketTicker';
import TopStatsBar from '@/components/TopStatsBar';
import StatsOverview from '@/components/StatsOverview';
import FearGreedIndex from '@/components/FearGreedIndex';
import LiquidationHeatmap from '@/components/LiquidationHeatmap';
import TopMovers from '@/components/TopMovers';
import OIChangeWidget from '@/components/OIChangeWidget';
import LongShortRatio from '@/components/LongShortRatio';
import MarketIndices from '@/components/MarketIndices';
import CoinSearch from '@/components/CoinSearch';
import { CoinSearchResult } from '@/lib/api/coingecko';
import {
  Sparkles, ArrowRight, TrendingUp, Zap, BarChart3, Newspaper,
  DollarSign, Activity, Globe, ExternalLink
} from 'lucide-react';

// Import API functions
import { fetchAllFundingRates } from '@/lib/api/aggregator';
import { FundingRateData } from '@/lib/api/types';
import { fetchCryptoNews, NewsArticle, formatTimeAgo } from '@/lib/api/coinmarketcal';

export default function Home() {
  const router = useRouter();
  const [topFunding, setTopFunding] = useState<FundingRateData[]>([]);
  const [latestNews, setLatestNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        // Fetch funding rates
        const fundingData = await fetchAllFundingRates();
        const validFunding = fundingData
          .filter(fr => fr && typeof fr.fundingRate === 'number' && !isNaN(fr.fundingRate) && isFinite(fr.fundingRate))
          .sort((a, b) => Math.abs(b.fundingRate) - Math.abs(a.fundingRate))
          .slice(0, 5);
        setTopFunding(validFunding);

        // Fetch news
        const newsData = await fetchCryptoNews(4);
        setLatestNews(newsData);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleCoinSelect = (coin: CoinSearchResult) => {
    router.push(`/coin/${coin.id}`);
  };

  return (
    <div className="min-h-screen bg-hub-black relative">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-hub-yellow/5 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-hub-orange/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '-2s' }} />
      </div>

      <Header />
      <TopStatsBar />
      <MarketTicker />

      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <section className="mb-10 animate-slideUp">
          <div className="flex items-center gap-2 mb-4">
            <div className="px-3 py-1.5 rounded-full bg-gradient-to-r from-hub-yellow/20 to-hub-orange/20 border border-hub-yellow/30">
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

          {/* Search Bar */}
          <div className="max-w-2xl mb-6">
            <CoinSearch
              onSelect={handleCoinSelect}
              placeholder="Search any coin for events, unlocks & news..."
              className="w-full"
            />
          </div>

          {/* Quick Stats Pills */}
          <div className="flex flex-wrap gap-3">
            <Link href="/funding" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-hub-gray/30 border border-hub-gray/30 hover:border-hub-yellow/30 transition-all text-sm group">
              <TrendingUp className="w-4 h-4 text-hub-yellow" />
              <span className="text-hub-gray-text group-hover:text-white">Funding Rates</span>
            </Link>
            <Link href="/open-interest" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-hub-gray/30 border border-hub-gray/30 hover:border-hub-yellow/30 transition-all text-sm group">
              <BarChart3 className="w-4 h-4 text-hub-yellow" />
              <span className="text-hub-gray-text group-hover:text-white">Open Interest</span>
            </Link>
            <Link href="/liquidations" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-hub-gray/30 border border-hub-gray/30 hover:border-hub-yellow/30 transition-all text-sm group">
              <Zap className="w-4 h-4 text-hub-yellow" />
              <span className="text-hub-gray-text group-hover:text-white">Liquidations</span>
            </Link>
            <Link href="/news" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-hub-gray/30 border border-hub-gray/30 hover:border-hub-yellow/30 transition-all text-sm group">
              <Newspaper className="w-4 h-4 text-hub-yellow" />
              <span className="text-hub-gray-text group-hover:text-white">Market News</span>
            </Link>
          </div>
        </section>

        {/* Stats Overview */}
        <section className="mb-10">
          <StatsOverview />
        </section>

        {/* Row 1: Fear & Greed + Liquidation Heatmap */}
        <section className="mb-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <FearGreedIndex />
            <LiquidationHeatmap />
          </div>
        </section>

        {/* Row 2: Market Indices + Top Movers + Long/Short Ratio */}
        <section className="mb-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <MarketIndices />
            <TopMovers />
            <LongShortRatio />
          </div>
        </section>

        {/* Row 3: Funding Preview + OI Widget + News */}
        <section className="mb-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Funding Rates Preview */}
            <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-hub-yellow/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-hub-yellow" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Top Funding</h3>
                    <p className="text-hub-gray-text text-xs">Highest rates now</p>
                  </div>
                </div>
                <Link href="/funding" className="text-hub-yellow text-sm hover:underline flex items-center gap-1">
                  View All <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="animate-pulse h-10 bg-hub-gray/30 rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {topFunding.map((item, index) => (
                    <div
                      key={`${item.symbol}-${item.exchange}-${index}`}
                      className="flex items-center justify-between p-3 rounded-xl bg-hub-gray/30 hover:bg-hub-gray/40 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-hub-gray-text text-xs w-4">{index + 1}</span>
                        <span className="text-white font-medium text-sm">{item.symbol}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-hub-gray-text text-xs">{item.exchange}</span>
                        <span className={`font-mono font-semibold text-sm ${
                          item.fundingRate >= 0 ? 'text-success' : 'text-danger'
                        }`}>
                          {item.fundingRate >= 0 ? '+' : ''}{item.fundingRate.toFixed(4)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* OI Widget */}
            <OIChangeWidget />

            {/* News Preview */}
            <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-hub-yellow/10 flex items-center justify-center">
                    <Newspaper className="w-5 h-5 text-hub-yellow" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Latest News</h3>
                    <p className="text-hub-gray-text text-xs">Market updates</p>
                  </div>
                </div>
                <Link href="/news" className="text-hub-yellow text-sm hover:underline flex items-center gap-1">
                  View All <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="animate-pulse h-16 bg-hub-gray/30 rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {latestNews.map((article, index) => (
                    <a
                      key={article.id || index}
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 rounded-xl bg-hub-gray/30 hover:bg-hub-gray/40 transition-all group"
                    >
                      <h4 className="text-white text-sm font-medium line-clamp-2 group-hover:text-hub-yellow transition-colors">
                        {article.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-hub-gray-text">{article.source_info?.name || article.source}</span>
                        <span className="text-xs text-hub-gray-text">•</span>
                        <span className="text-xs text-hub-gray-text">{formatTimeAgo(article.published_on)}</span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Data Sources */}
        <section className="mb-10">
          <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-hub-yellow/10 flex items-center justify-center">
                <Globe className="w-5 h-5 text-hub-yellow" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Connected Exchanges</h3>
                <p className="text-hub-gray-text text-xs">Real-time data from 6 exchanges</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {['Binance', 'Bybit', 'OKX', 'Bitget', 'Hyperliquid', 'dYdX'].map((exchange) => (
                <div
                  key={exchange}
                  className="flex items-center justify-center gap-2 p-4 rounded-xl bg-hub-gray/30 border border-hub-gray/30"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                  </span>
                  <span className="text-white font-medium text-sm">{exchange}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-hub-gray/20 bg-hub-black/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
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

          {/* Navigation */}
          <div>
            <h4 className="text-white font-semibold mb-4">Navigation</h4>
            <ul className="space-y-2">
              <li><Link href="/" className="text-hub-gray-text hover:text-hub-yellow transition-colors text-sm">Dashboard</Link></li>
              <li><Link href="/funding" className="text-hub-gray-text hover:text-hub-yellow transition-colors text-sm">Funding Rates</Link></li>
              <li><Link href="/open-interest" className="text-hub-gray-text hover:text-hub-yellow transition-colors text-sm">Open Interest</Link></li>
              <li><Link href="/liquidations" className="text-hub-gray-text hover:text-hub-yellow transition-colors text-sm">Liquidations</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-white font-semibold mb-4">Resources</h4>
            <ul className="space-y-2">
              <li><Link href="/news" className="text-hub-gray-text hover:text-hub-yellow transition-colors text-sm">Market News</Link></li>
              <li><Link href="/team" className="text-hub-gray-text hover:text-hub-yellow transition-colors text-sm">Our Team</Link></li>
              <li><Link href="/brand" className="text-hub-gray-text hover:text-hub-yellow transition-colors text-sm">Brand Assets</Link></li>
            </ul>
          </div>

          {/* Data Sources */}
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

        <div className="flex flex-col md:flex-row items-center justify-between pt-8 mt-8 border-t border-hub-gray/20">
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
      </div>
    </footer>
  );
}
