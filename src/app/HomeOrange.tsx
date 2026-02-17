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
import { ArrowRight, Activity, TrendingUp, Zap, BarChart3, Newspaper, Shield, GitCompareArrows } from 'lucide-react';
import { ALL_EXCHANGES, isExchangeDex } from '@/lib/constants';
import { isValidNumber } from '@/lib/utils/format';
import { fetchAllFundingRates, fetchExchangeHealth, ExchangeHealthInfo } from '@/lib/api/aggregator';
import { FundingRateData } from '@/lib/api/types';
import { fetchCryptoNews, NewsArticle, formatTimeAgo } from '@/lib/api/coinmarketcal';
import Footer from '@/components/Footer';

export default function HomeOrange() {
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
    <div className="min-h-screen bg-hub-black">
      <Header />
      <TopStatsBar />
      <MarketTicker />

      <main id="main-content" className="max-w-[1400px] mx-auto px-4 sm:px-6">

        {/* ═══ Hero Section ═══ */}
        <section className="relative pt-6 pb-4 mb-2">
          <div className="absolute inset-0 hero-mesh pointer-events-none" aria-hidden="true" />

          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-white">
                <span className="text-white">info</span><span className="text-hub-yellow">hub</span>
              </h1>
              <span className="live-dot" />
            </div>
            <p className="text-neutral-500 text-[13px] mb-5">
              Real-time derivatives intelligence across {ALL_EXCHANGES.length} exchanges.
            </p>

            <div className="max-w-lg mb-5">
              <CoinSearch
                onSelect={handleCoinSelect}
                placeholder="Search any coin for events, unlocks & news..."
                className="w-full"
                compact
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { name: 'Funding', href: '/funding', icon: Activity },
                { name: 'Open Interest', href: '/open-interest', icon: BarChart3 },
                { name: 'Liquidations', href: '/liquidations', icon: Zap },
                { name: 'Screener', href: '/screener', icon: TrendingUp },
                { name: 'Compare', href: '/compare', icon: GitCompareArrows },
                { name: 'News', href: '/news', icon: Newspaper },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:border-hub-yellow/30 hover:bg-hub-yellow/[0.05] text-neutral-400 hover:text-white text-xs font-medium transition-all duration-200"
                >
                  <link.icon className="w-3 h-3 text-neutral-500 group-hover:text-hub-yellow transition-colors" />
                  {link.name}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Accent divider */}
        <div className="accent-line mb-6" />

        {/* ═══ Stats Overview ═══ */}
        <section className="mb-6 stagger">
          <StatsOverview />
        </section>

        {/* ═══ Primary Widgets Row ═══ */}
        <section className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="section-label">Market Pulse</span>
            <div className="flex-1 h-px bg-white/[0.04]" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 stagger">
            <FearGreedIndex />
            <LiquidationHeatmap />
          </div>
        </section>

        {/* ═══ Secondary Widgets Row ═══ */}
        <section className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="section-label">Trading Signals</span>
            <div className="flex-1 h-px bg-white/[0.04]" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 stagger">
            <MarketIndices />
            <TopMovers />
            <LongShortRatio />
          </div>
        </section>

        {/* ═══ Data Feeds Row ═══ */}
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="section-label">Data Feeds</span>
            <div className="flex-1 h-px bg-white/[0.04]" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 stagger">

            {/* Top Funding Rates */}
            <div className="card-premium p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-hub-yellow" />
                  <h2 className="text-white font-semibold text-sm">Top Funding</h2>
                </div>
                <Link href="/funding" className="text-hub-yellow/70 hover:text-hub-yellow text-[10px] font-medium flex items-center gap-0.5 transition-colors">
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
                <div className="space-y-0.5">
                  {topFunding.map((item, index) => (
                    <div
                      key={`${item.symbol}-${item.exchange}-${index}`}
                      className="data-row-premium flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-600 text-[10px] font-mono w-3">{index + 1}</span>
                        <TokenIconSimple symbol={item.symbol} size={18} />
                        <span className="text-white font-medium text-xs">{item.symbol}</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-neutral-600 text-[10px]">{item.exchange}</span>
                        <span className={`font-mono font-semibold text-xs tabular-nums ${
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

            {/* Latest News */}
            <div className="card-premium p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Newspaper className="w-3.5 h-3.5 text-hub-yellow" />
                  <h2 className="text-white font-semibold text-sm">Latest News</h2>
                </div>
                <Link href="/news" className="text-hub-yellow/70 hover:text-hub-yellow text-[10px] font-medium flex items-center gap-0.5 transition-colors">
                  View All <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {loading ? (
                <div className="space-y-1.5">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="animate-pulse h-14 bg-white/[0.03] rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="space-y-0.5">
                  {latestNews.map((article, index) => (
                    <a
                      key={article.id || index}
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="data-row-premium block"
                    >
                      <h4 className="text-white text-xs font-medium line-clamp-2 leading-relaxed">
                        {article.title}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] text-neutral-600">{article.source_info?.name || article.source}</span>
                        <span className="text-neutral-700 text-[8px]">•</span>
                        <span className="text-[10px] text-neutral-600">{formatTimeAgo(article.published_on)}</span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ═══ Exchange Status ═══ */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="section-label">Infrastructure</span>
            <div className="flex-1 h-px bg-white/[0.04]" />
          </div>

          <div className="card-premium overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <Shield className="w-3.5 h-3.5 text-hub-yellow" />
                <h2 className="text-white font-semibold text-sm">Exchange Status</h2>
                <span className="text-[10px] font-mono text-neutral-500 bg-white/[0.04] px-1.5 py-0.5 rounded">
                  {ALL_EXCHANGES.length}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]" />
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
                        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg transition-all duration-200 ${
                          isActive
                            ? 'bg-green-500/5 border border-green-500/15 hover:border-green-500/30'
                            : isEmpty
                              ? 'bg-yellow-500/5 border border-yellow-500/15'
                              : health
                                ? 'bg-red-500/5 border border-red-500/15'
                                : 'bg-white/[0.02] border border-white/[0.04]'
                        }`}
                        title={health ? `${exchange}: ${health.count} pairs · ${health.latencyMs}ms${health.error ? ` · ${health.error}` : ''}` : exchange}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                          isActive ? 'bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.4)]' : isEmpty ? 'bg-yellow-500' : health ? 'bg-red-500/60' : 'bg-neutral-600'
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
              <div className="accent-line" />

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
                        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg transition-all duration-200 ${
                          isActive
                            ? 'bg-purple-500/5 border border-purple-500/15 hover:border-purple-500/30'
                            : isEmpty
                              ? 'bg-yellow-500/5 border border-yellow-500/15'
                              : health
                                ? 'bg-red-500/5 border border-red-500/15'
                                : 'bg-white/[0.02] border border-white/[0.04]'
                        }`}
                        title={health ? `${exchange}: ${health.count} pairs · ${health.latencyMs}ms${health.error ? ` · ${health.error}` : ''}` : exchange}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                          isActive ? 'bg-purple-500 shadow-[0_0_4px_rgba(168,85,247,0.4)]' : isEmpty ? 'bg-yellow-500' : health ? 'bg-red-500/60' : 'bg-neutral-600'
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
