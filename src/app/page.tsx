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
import { TokenIconSimple } from '@/components/TokenIcon';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { CoinSearchResult } from '@/lib/api/coingecko';
import { ArrowRight } from 'lucide-react';
import { ALL_EXCHANGES, isExchangeDex } from '@/lib/constants';
import { isValidNumber } from '@/lib/utils/format';
import { fetchAllFundingRates, fetchExchangeHealth, ExchangeHealthInfo } from '@/lib/api/aggregator';
import { FundingRateData } from '@/lib/api/types';
import { fetchCryptoNews, NewsArticle, formatTimeAgo } from '@/lib/api/coinmarketcal';

export default function Home() {
  const router = useRouter();
  const [topFunding, setTopFunding] = useState<FundingRateData[]>([]);
  const [latestNews, setLatestNews] = useState<NewsArticle[]>([]);
  const [exchangeHealth, setExchangeHealth] = useState<ExchangeHealthInfo[]>([]);
  const [activeExchangeCount, setActiveExchangeCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [fundingData, newsData, healthData] = await Promise.all([
          fetchAllFundingRates(),
          fetchCryptoNews(4),
          fetchExchangeHealth(),
        ]);

        const validFunding = fundingData
          .filter(fr => fr && isValidNumber(fr.fundingRate))
          .sort((a, b) => Math.abs(b.fundingRate) - Math.abs(a.fundingRate))
          .slice(0, 5);
        setTopFunding(validFunding);
        setLatestNews(newsData);
        setExchangeHealth(healthData.funding);
        setActiveExchangeCount(healthData.meta.activeExchanges);
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
    <div className="min-h-screen bg-black">
      <Header />
      <TopStatsBar />
      <MarketTicker />

      <main id="main-content" className="max-w-[1400px] mx-auto px-4 py-6 page-enter">
        {/* Hero - compact, no animated backgrounds */}
        <section className="mb-6">
          <h1 className="text-xl font-bold text-white mb-1">
            <span className="text-white">info</span>
            <span className="text-hub-yellow">hub</span>
            <span className="text-neutral-500 font-normal text-sm ml-2 inline-flex items-center gap-1.5">
              <span className="live-dot" />
              Real-time derivatives data
            </span>
          </h1>

          <div className="max-w-lg mt-3 mb-4">
            <CoinSearch
              onSelect={handleCoinSelect}
              placeholder="Search any coin for events, unlocks & news..."
              className="w-full"
              compact
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              { name: 'Funding', href: '/funding' },
              { name: 'Open Interest', href: '/open-interest' },
              { name: 'Liquidations', href: '/liquidations' },
              { name: 'News', href: '/news' },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-1.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-neutral-400 hover:text-hub-yellow text-xs transition-colors"
              >
                {link.name}
              </Link>
            ))}
          </div>
        </section>

        {/* Stats Overview */}
        <section className="mb-6">
          <StatsOverview />
        </section>

        {/* Row 1: Fear & Greed + Liquidation Heatmap */}
        <section className="mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 stagger-container">
            <div className="stagger-item"><FearGreedIndex /></div>
            <div className="stagger-item"><LiquidationHeatmap /></div>
          </div>
        </section>

        {/* Row 2: Market Indices + Top Movers + Long/Short Ratio */}
        <section className="mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 stagger-container">
            <div className="stagger-item"><MarketIndices /></div>
            <div className="stagger-item"><TopMovers /></div>
            <div className="stagger-item"><LongShortRatio /></div>
          </div>
        </section>

        {/* Row 3: Funding Preview + OI Widget + News */}
        <section className="mb-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 stagger-container">
            {/* Funding Rates Preview */}
            <div className="card-hub p-4 stagger-item">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-white font-semibold text-sm">Top Funding</h2>
                <Link href="/funding" className="text-hub-yellow text-[10px] hover:underline flex items-center gap-0.5">
                  View All <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {loading ? (
                <div className="space-y-1.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="animate-pulse h-9 bg-white/[0.03] rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {topFunding.map((item, index) => (
                    <div
                      key={`${item.symbol}-${item.exchange}-${index}`}
                      className="flex items-center justify-between px-2.5 py-2 rounded-lg data-row-hub"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-500 text-[10px] font-mono w-3">{index + 1}</span>
                        <TokenIconSimple symbol={item.symbol} size={18} />
                        <span className="text-white font-medium text-xs">{item.symbol}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-500 text-[10px]">{item.exchange}</span>
                        <span className={`font-mono font-semibold text-xs ${
                          item.fundingRate >= 0 ? 'text-green-400' : 'text-red-400'
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
            <div className="card-hub p-4 stagger-item">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-white font-semibold text-sm">Latest News</h2>
                <Link href="/news" className="text-hub-yellow text-[10px] hover:underline flex items-center gap-0.5">
                  View All <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {loading ? (
                <div className="space-y-1.5">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="animate-pulse h-12 bg-white/[0.03] rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {latestNews.map((article, index) => (
                    <a
                      key={article.id || index}
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block px-2.5 py-2 rounded-lg data-row-hub"
                    >
                      <h4 className="text-white text-xs font-medium line-clamp-2 leading-relaxed">
                        {article.title}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] text-neutral-600">{article.source_info?.name || article.source}</span>
                        <span className="text-neutral-700">&middot;</span>
                        <span className="text-[10px] text-neutral-600">{formatTimeAgo(article.published_on)}</span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Connected Exchanges */}
        <section className="mb-6">
          <div className="card-hub overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <h2 className="text-white font-semibold text-sm">Exchange Status</h2>
                <span className="text-[10px] font-mono text-neutral-500 bg-white/[0.04] px-1.5 py-0.5 rounded">
                  {ALL_EXCHANGES.length}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  <span className="text-[10px] text-neutral-500">Active</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                  <span className="text-[10px] text-neutral-500">Empty</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500/60" />
                  <span className="text-[10px] text-neutral-500">Down</span>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* CEX */}
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Centralized</span>
                  <span className="text-[10px] font-mono text-green-500/70">
                    {ALL_EXCHANGES.filter(e => !isExchangeDex(e)).filter(e => exchangeHealth.find(h => h.name === e)?.status === 'ok').length}/{ALL_EXCHANGES.filter(e => !isExchangeDex(e)).length}
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-1.5">
                  {ALL_EXCHANGES.filter(e => !isExchangeDex(e)).map((exchange) => {
                    const health = exchangeHealth.find(h => h.name === exchange);
                    const isActive = health?.status === 'ok';
                    const isEmpty = health?.status === 'empty';
                    return (
                      <div
                        key={exchange}
                        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg transition-colors ${
                          isActive
                            ? 'bg-green-500/5 border border-green-500/15'
                            : isEmpty
                              ? 'bg-yellow-500/5 border border-yellow-500/15'
                              : health
                                ? 'bg-red-500/5 border border-red-500/15'
                                : 'bg-white/[0.02] border border-white/[0.04]'
                        }`}
                        title={health ? `${exchange}: ${health.count} pairs · ${health.latencyMs}ms${health.error ? ` · ${health.error}` : ''}` : exchange}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                          isActive ? 'bg-green-500' : isEmpty ? 'bg-yellow-500' : health ? 'bg-red-500/60' : 'bg-neutral-600'
                        }`} />
                        <ExchangeLogo exchange={exchange.toLowerCase()} size={14} />
                        <span className={`text-xs font-medium truncate ${isActive ? 'text-neutral-300' : 'text-neutral-600'}`}>{exchange}</span>
                        {isActive && health && (
                          <span className="text-[9px] text-green-500/50 font-mono ml-auto flex-shrink-0">{health.count}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Divider */}
              <div className="divider-hub" />

              {/* DEX */}
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Decentralized</span>
                  <span className="text-[10px] font-mono text-green-500/70">
                    {ALL_EXCHANGES.filter(e => isExchangeDex(e)).filter(e => exchangeHealth.find(h => h.name === e)?.status === 'ok').length}/{ALL_EXCHANGES.filter(e => isExchangeDex(e)).length}
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-1.5">
                  {ALL_EXCHANGES.filter(e => isExchangeDex(e)).map((exchange) => {
                    const health = exchangeHealth.find(h => h.name === exchange);
                    const isActive = health?.status === 'ok';
                    const isEmpty = health?.status === 'empty';
                    return (
                      <div
                        key={exchange}
                        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg transition-colors ${
                          isActive
                            ? 'bg-purple-500/5 border border-purple-500/15'
                            : isEmpty
                              ? 'bg-yellow-500/5 border border-yellow-500/15'
                              : health
                                ? 'bg-red-500/5 border border-red-500/15'
                                : 'bg-white/[0.02] border border-white/[0.04]'
                        }`}
                        title={health ? `${exchange}: ${health.count} pairs · ${health.latencyMs}ms${health.error ? ` · ${health.error}` : ''}` : exchange}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                          isActive ? 'bg-purple-500' : isEmpty ? 'bg-yellow-500' : health ? 'bg-red-500/60' : 'bg-neutral-600'
                        }`} />
                        <ExchangeLogo exchange={exchange.toLowerCase()} size={14} />
                        <span className={`text-xs font-medium truncate ${isActive ? 'text-neutral-300' : 'text-neutral-600'}`}>{exchange}</span>
                        {isActive && health && (
                          <span className="text-[9px] text-purple-400/50 font-mono ml-auto flex-shrink-0">{health.count}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/[0.04] bg-black relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-hub-yellow/20 to-transparent" />
      <div className="max-w-[1400px] mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <span className="text-sm font-bold">
                <span className="text-white">info</span>
                <span className="text-hub-yellow">hub</span>
              </span>
            </div>
            <p className="text-neutral-600 text-xs leading-relaxed">
              Real-time derivatives data aggregated from {ALL_EXCHANGES.length}+ exchanges.
            </p>
          </div>

          <div>
            <h4 className="text-neutral-400 font-medium text-xs mb-2">Navigation</h4>
            <ul className="space-y-1.5">
              {[
                { name: 'Dashboard', href: '/' },
                { name: 'Funding Rates', href: '/funding' },
                { name: 'Open Interest', href: '/open-interest' },
                { name: 'Liquidations', href: '/liquidations' },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-neutral-600 hover:text-hub-yellow transition-colors text-xs">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-neutral-400 font-medium text-xs mb-2">Resources</h4>
            <ul className="space-y-1.5">
              {[
                { name: 'Market News', href: '/news' },
                { name: 'Team', href: '/team' },
                { name: 'Brand', href: '/brand' },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-neutral-600 hover:text-hub-yellow transition-colors text-xs">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-neutral-400 font-medium text-xs mb-2">Exchanges</h4>
            <p className="text-neutral-600 text-xs leading-relaxed">
              Binance, Bybit, OKX, Bitget, Gate.io, MEXC, Kraken, BingX, Phemex, Hyperliquid, dYdX & more
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-6 mt-6 border-t border-white/[0.04]">
          <span className="text-neutral-700 text-[10px]">
            &copy; 2026 InfoHub. Data for informational purposes only.
          </span>
          <div className="flex items-center gap-1.5 text-[10px] text-neutral-700">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500/60"></span>
            Data aggregated from {ALL_EXCHANGES.length} exchanges
          </div>
        </div>
      </div>
    </footer>
  );
}
