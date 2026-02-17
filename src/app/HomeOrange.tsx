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
import { ArrowRight, Activity, TrendingUp, Zap, BarChart3, Newspaper, Shield, GitCompareArrows, Search, Radio, ChevronRight, Globe } from 'lucide-react';
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

  const cexExchanges = ALL_EXCHANGES.filter(e => !isExchangeDex(e));
  const dexExchanges = ALL_EXCHANGES.filter(e => isExchangeDex(e));
  const activeCex = cexExchanges.filter(e => exchangeHealth.find(h => h.name === e)?.status === 'ok').length;
  const activeDex = dexExchanges.filter(e => exchangeHealth.find(h => h.name === e)?.status === 'ok').length;

  const quickLinks = [
    { name: 'Funding', href: '/funding', icon: Activity, desc: 'Live rates' },
    { name: 'Open Interest', href: '/open-interest', icon: BarChart3, desc: 'Position sizing' },
    { name: 'Liquidations', href: '/liquidations', icon: Zap, desc: 'Real-time rekt' },
    { name: 'Screener', href: '/screener', icon: TrendingUp, desc: 'Market scanner' },
    { name: 'Compare', href: '/compare', icon: GitCompareArrows, desc: 'Cross-exchange' },
    { name: 'News', href: '/news', icon: Newspaper, desc: 'Crypto news' },
  ];

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <TopStatsBar />
      <MarketTicker />

      <main id="main-content" className="max-w-[1400px] mx-auto px-4 sm:px-6">

        {/* ═══ Hero Section ═══ */}
        <section className="relative pt-8 pb-6 mb-2">
          <div className="absolute inset-0 hero-mesh pointer-events-none" aria-hidden="true" />

          <div className="relative">
            {/* Title area */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    <span className="text-white">info</span><span className="bg-gradient-to-r from-hub-yellow to-hub-orange bg-clip-text text-transparent">hub</span>
                  </h1>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20">
                    <span className="live-dot" />
                    <span className="text-green-400 text-[10px] font-semibold uppercase tracking-wider">Live</span>
                  </div>
                </div>
                <p className="text-neutral-500 text-sm max-w-md">
                  Real-time derivatives intelligence across <span className="text-neutral-400 font-medium">{ALL_EXCHANGES.length} exchanges</span>. Funding, OI, liquidations & more.
                </p>
              </div>
            </div>

            {/* Search bar — elevated */}
            <div className="max-w-xl mb-6">
              <CoinSearch
                onSelect={handleCoinSelect}
                placeholder="Search any coin for events, unlocks & news..."
                className="w-full"
                compact
              />
            </div>

            {/* Quick access grid */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {quickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-hub-yellow/30 hover:bg-hub-yellow/[0.04] transition-all duration-200"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/[0.04] group-hover:bg-hub-yellow/10 flex items-center justify-center transition-colors">
                    <link.icon className="w-4 h-4 text-neutral-500 group-hover:text-hub-yellow transition-colors" />
                  </div>
                  <span className="text-neutral-400 group-hover:text-white text-[11px] font-medium transition-colors">{link.name}</span>
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

        {/* ═══ Market Pulse — Fear & Greed + Liquidation ═══ */}
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Radio className="w-3.5 h-3.5 text-hub-yellow" />
            <span className="section-label">Market Pulse</span>
            <div className="flex-1 h-px bg-white/[0.04]" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 stagger">
            <FearGreedIndex />
            <LiquidationHeatmap />
          </div>
        </section>

        {/* ═══ Trading Signals Row ═══ */}
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-3.5 h-3.5 text-hub-yellow" />
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
            <Activity className="w-3.5 h-3.5 text-hub-yellow" />
            <span className="section-label">Data Feeds</span>
            <div className="flex-1 h-px bg-white/[0.04]" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 stagger">

            {/* Top Funding Rates */}
            <div className="card-premium p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-hub-yellow/10 flex items-center justify-center">
                    <Activity className="w-3 h-3 text-hub-yellow" />
                  </div>
                  <h2 className="text-white font-semibold text-sm">Top Funding</h2>
                </div>
                <Link href="/funding" className="group/link flex items-center gap-1 text-hub-yellow/60 hover:text-hub-yellow text-[10px] font-medium transition-colors">
                  View All <ChevronRight className="w-3 h-3 group-hover/link:translate-x-0.5 transition-transform" />
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
                        <span className="text-neutral-700 text-[10px] font-mono w-3">{index + 1}</span>
                        <TokenIconSimple symbol={item.symbol} size={18} />
                        <div className="flex flex-col">
                          <span className="text-white font-medium text-xs">{item.symbol}</span>
                          <span className="text-neutral-600 text-[9px] leading-none">{item.exchange}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`h-5 rounded-md px-1.5 flex items-center ${
                          item.fundingRate >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'
                        }`}>
                          <span className={`font-mono font-bold text-[11px] tabular-nums ${
                            item.fundingRate >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {item.fundingRate >= 0 ? '+' : ''}{item.fundingRate.toFixed(4)}%
                          </span>
                        </div>
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
                  <div className="w-6 h-6 rounded-md bg-hub-yellow/10 flex items-center justify-center">
                    <Newspaper className="w-3 h-3 text-hub-yellow" />
                  </div>
                  <h2 className="text-white font-semibold text-sm">Latest News</h2>
                </div>
                <Link href="/news" className="group/link flex items-center gap-1 text-hub-yellow/60 hover:text-hub-yellow text-[10px] font-medium transition-colors">
                  View All <ChevronRight className="w-3 h-3 group-hover/link:translate-x-0.5 transition-transform" />
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
                      className="data-row-premium block group/news"
                    >
                      <h4 className="text-neutral-300 group-hover/news:text-white text-xs font-medium line-clamp-2 leading-relaxed transition-colors">
                        {article.title}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] text-hub-yellow/60 font-medium">{article.source_info?.name || article.source}</span>
                        <span className="text-neutral-700 text-[8px]">&middot;</span>
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
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-3.5 h-3.5 text-hub-yellow" />
            <span className="section-label">Infrastructure</span>
            <div className="flex-1 h-px bg-white/[0.04]" />
            <div className="flex items-center gap-3 text-[10px]">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]" />
                <span className="text-neutral-500">Active</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                <span className="text-neutral-500">Empty</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500/60" />
                <span className="text-neutral-500">Down</span>
              </div>
            </div>
          </div>

          <div className="card-premium overflow-hidden">
            {/* Summary bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-white/[0.01]">
              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4 text-hub-yellow" />
                <h2 className="text-white font-semibold text-sm">Exchange Status</h2>
                <span className="text-[10px] font-mono text-neutral-500 bg-white/[0.04] px-1.5 py-0.5 rounded">
                  {activeCex + activeDex}/{ALL_EXCHANGES.length} online
                </span>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* CEX */}
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Centralized</span>
                  <div className="flex items-center gap-1 text-[10px] font-mono">
                    <span className="text-green-500">{activeCex}</span>
                    <span className="text-neutral-700">/</span>
                    <span className="text-neutral-600">{cexExchanges.length}</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-1.5">
                  {cexExchanges.map((exchange) => {
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
                  <div className="flex items-center gap-1 text-[10px] font-mono">
                    <span className="text-purple-400">{activeDex}</span>
                    <span className="text-neutral-700">/</span>
                    <span className="text-neutral-600">{dexExchanges.length}</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-1.5">
                  {dexExchanges.map((exchange) => {
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
