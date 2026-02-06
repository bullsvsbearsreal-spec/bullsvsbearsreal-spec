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
    <div className="min-h-screen bg-hub-black">
      <Header />
      <TopStatsBar />
      <MarketTicker />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Hero - kept simple and direct */}
        <section className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            Crypto derivatives data
          </h1>
          <p className="text-hub-gray-text mb-5">
            Funding, OI, liquidations — 7 exchanges, real-time.
          </p>

          {/* Search */}
          <div className="max-w-md mb-5">
            <CoinSearch
              onSelect={handleCoinSelect}
              placeholder="Search coin..."
              className="w-full"
            />
          </div>

          {/* Quick links - simpler styling */}
          <div className="flex flex-wrap gap-2">
            <Link href="/funding" className="px-3 py-1.5 rounded-lg bg-hub-gray/40 text-sm text-white/80 hover:text-hub-yellow hover:bg-hub-gray/60 transition-colors">
              Funding
            </Link>
            <Link href="/open-interest" className="px-3 py-1.5 rounded-lg bg-hub-gray/40 text-sm text-white/80 hover:text-hub-yellow hover:bg-hub-gray/60 transition-colors">
              Open Interest
            </Link>
            <Link href="/liquidations" className="px-3 py-1.5 rounded-lg bg-hub-gray/40 text-sm text-white/80 hover:text-hub-yellow hover:bg-hub-gray/60 transition-colors">
              Liquidations
            </Link>
            <Link href="/news" className="px-3 py-1.5 rounded-lg bg-hub-gray/40 text-sm text-white/80 hover:text-hub-yellow hover:bg-hub-gray/60 transition-colors">
              News
            </Link>
          </div>
        </section>

        {/* Stats row */}
        <section className="mb-8">
          <StatsOverview />
        </section>

        {/* Main grid - mixed sizing for visual interest */}
        <section className="mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <FearGreedIndex />
            </div>
            <div className="lg:col-span-3">
              <LiquidationHeatmap />
            </div>
          </div>
        </section>

        {/* Secondary row */}
        <section className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <TopMovers />
            <LongShortRatio />
            <MarketIndices />
          </div>
        </section>

        {/* Bottom row - funding, OI, news */}
        <section className="mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Top Funding */}
            <div className="bg-hub-gray/20 border border-hub-gray/20 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Top Funding Rates</h3>
                <Link href="/funding" className="text-hub-yellow text-xs hover:underline">
                  See all →
                </Link>
              </div>

              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-9 bg-hub-gray/30 rounded animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {topFunding.map((item, index) => (
                    <div
                      key={`${item.symbol}-${item.exchange}-${index}`}
                      className="flex items-center justify-between py-2 px-2 rounded hover:bg-hub-gray/30"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-hub-gray-text text-xs w-3">{index + 1}</span>
                        <span className="text-white text-sm">{item.symbol}</span>
                        <span className="text-hub-gray-text text-xs">· {item.exchange}</span>
                      </div>
                      <span className={`font-mono text-sm ${
                        item.fundingRate >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {item.fundingRate >= 0 ? '+' : ''}{item.fundingRate.toFixed(4)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* OI Changes */}
            <OIChangeWidget />

            {/* News */}
            <div className="bg-hub-gray/20 border border-hub-gray/20 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">News</h3>
                <Link href="/news" className="text-hub-yellow text-xs hover:underline">
                  More →
                </Link>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-14 bg-hub-gray/30 rounded animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {latestNews.map((article, index) => (
                    <a
                      key={article.id || index}
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block py-2 hover:bg-hub-gray/20 rounded px-2 -mx-2"
                    >
                      <p className="text-white text-sm line-clamp-2 leading-snug">
                        {article.title}
                      </p>
                      <p className="text-hub-gray-text text-xs mt-1">
                        {article.source_info?.name || article.source} · {formatTimeAgo(article.published_on)}
                      </p>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Exchanges - more compact */}
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-hub-gray-text text-sm">Data from:</span>
            <div className="flex flex-wrap gap-2">
              {['Binance', 'Bybit', 'OKX', 'Bitget', 'Hyperliquid', 'dYdX', 'gTrade'].map((exchange) => (
                <span
                  key={exchange}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-hub-gray/30 text-xs text-white/70"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                  {exchange}
                </span>
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
    <footer className="border-t border-hub-gray/20 mt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="text-white font-semibold">InfoHub</span>
            <span className="text-hub-gray-text text-sm">Crypto data dashboard</span>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link href="/funding" className="text-hub-gray-text hover:text-white">Funding</Link>
            <Link href="/open-interest" className="text-hub-gray-text hover:text-white">OI</Link>
            <Link href="/liquidations" className="text-hub-gray-text hover:text-white">Liquidations</Link>
            <Link href="/news" className="text-hub-gray-text hover:text-white">News</Link>
            <Link href="/team" className="text-hub-gray-text hover:text-white">Team</Link>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-hub-gray/10 text-xs text-hub-gray-text">
          Data for informational purposes only. Not financial advice.
        </div>
      </div>
    </footer>
  );
}
