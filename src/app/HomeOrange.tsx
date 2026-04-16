'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import MarketTicker from '@/components/MarketTicker';
import TopStatsBar from '@/components/TopStatsBar';
import CoinSearch from '@/components/CoinSearch';
import { TokenIconSimple } from '@/components/TokenIcon';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { CoinSearchResult } from '@/lib/api/coingecko';
import { Activity, TrendingUp, Zap, BarChart3, Newspaper, Shield, GitCompareArrows, ChevronRight, Globe, Crosshair, ArrowLeftRight } from 'lucide-react';
import { ALL_EXCHANGES, isExchangeDex } from '@/lib/constants';
import { isValidNumber } from '@/lib/utils/format';
import { type ExchangeHealthInfo } from '@/lib/api/aggregator';
import { type FundingRateData } from '@/lib/api/types';
import { type NewsArticle, formatTimeAgo } from '@/lib/api/coinmarketcal';
import Footer from '@/components/Footer';
import RecentPages from '@/components/RecentPages';

// Dynamic imports — below-the-fold widgets + heavy data modules
const StatsOverview = dynamic(() => import('@/components/StatsOverview'));
const FearGreedIndex = dynamic(() => import('@/components/FearGreedIndex'));
const LiquidationHeatmap = dynamic(() => import('@/components/LiquidationHeatmap'));
const TopMovers = dynamic(() => import('@/components/TopMovers'));
const OIChangeWidget = dynamic(() => import('@/components/OIChangeWidget'));
const LongShortRatio = dynamic(() => import('@/components/LongShortRatio'));
const MarketIndices = dynamic(() => import('@/components/MarketIndices'));
const MarketTiles = dynamic(() => import('@/components/MarketTiles'));

const QUICK_LINKS = [
  { name: 'Funding', href: '/funding', icon: Activity, desc: 'Live rates', color: '#22c55e', bg: 'rgba(34,197,94,0.08)' },
  { name: 'Open Interest', href: '/open-interest', icon: BarChart3, desc: 'Position sizing', color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)' },
  { name: 'Liquidations', href: '/liquidations', icon: Zap, desc: 'Real-time rekt', color: '#ff1744', bg: 'rgba(255,23,68,0.08)' },
  { name: 'Screener', href: '/screener', icon: TrendingUp, desc: 'Market scanner', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
  { name: 'Compare', href: '/compare', icon: GitCompareArrows, desc: 'Cross-exchange', color: '#ffa500', bg: 'rgba(255,165,0,0.08)' },
  { name: 'News', href: '/news', icon: Newspaper, desc: 'Crypto news', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
  { name: 'Spreads', href: '/spreads', icon: ArrowLeftRight, desc: 'Price spreads', color: '#ffa726', bg: 'rgba(255,167,38,0.08)' },
  { name: 'Predictions', href: '/prediction-markets', icon: Crosshair, desc: 'Arb scanner', color: '#e040fb', bg: 'rgba(224,64,251,0.08)' },
];

export default function HomeOrange() {
  const { status } = useSession();
  const isAuthed = status === 'authenticated';
  const router = useRouter();
  const [topFunding, setTopFunding] = useState<FundingRateData[]>([]);
  const [latestNews, setLatestNews] = useState<NewsArticle[]>([]);
  const [exchangeHealth, setExchangeHealth] = useState<ExchangeHealthInfo[]>([]);
  const [activeExchangeCount, setActiveExchangeCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [{ fetchAllFundingRates, fetchExchangeHealth }, { fetchCryptoNews }] = await Promise.all([
          import('@/lib/api/aggregator'),
          import('@/lib/api/coinmarketcal'),
        ]);
        const [fundingData, newsData, healthData] = await Promise.all([
          fetchAllFundingRates(),
          fetchCryptoNews(4),
          fetchExchangeHealth(),
        ]);

        const validFunding = fundingData
          .filter(fr => fr && isValidNumber(fr.fundingRate))
          .sort((a, b) => Math.abs(b.fundingRate) - Math.abs(a.fundingRate))
          .slice(0, isAuthed ? 5 : 3);
        setTopFunding(validFunding);
        setLatestNews((newsData ?? []).slice(0, isAuthed ? 4 : 2));
        setExchangeHealth(healthData?.funding ?? []);
        setActiveExchangeCount(healthData?.meta?.activeExchanges ?? 0);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  const handleCoinSelect = (coin: CoinSearchResult) => {
    router.push(`/coin/${coin.id}`);
  };

  const cexExchanges = ALL_EXCHANGES.filter(e => !isExchangeDex(e));
  const dexExchanges = ALL_EXCHANGES.filter(e => isExchangeDex(e));
  // Before health data loads, assume all exchanges are active
  const healthLoaded = exchangeHealth.length > 0;
  const isExchangeActive = (name: string) => {
    const h = exchangeHealth.find(x => x.name === name);
    return h?.status === 'ok';
  };
  const activeCex = healthLoaded
    ? cexExchanges.filter(isExchangeActive).length
    : cexExchanges.length;
  const activeDex = healthLoaded
    ? dexExchanges.filter(isExchangeActive).length
    : dexExchanges.length;

  // QUICK_LINKS defined at module scope for stable references

  // Sidebar navigation groups — Bloomberg/Coinglass-style category tree
  const NAV_GROUPS = [
    {
      label: 'Derivatives',
      items: [
        { name: 'Funding Rates', href: '/funding', icon: Activity, color: '#22c55e' },
        { name: 'Open Interest', href: '/open-interest', icon: BarChart3, color: '#8b5cf6' },
        { name: 'Liquidations', href: '/liquidations', icon: Zap, color: '#ff1744' },
        { name: 'Long/Short', href: '/longshort', icon: GitCompareArrows, color: '#3b82f6' },
      ],
    },
    {
      label: 'Markets',
      items: [
        { name: 'Screener', href: '/screener', icon: TrendingUp, color: '#3b82f6' },
        { name: 'Spreads', href: '/spreads', icon: ArrowLeftRight, color: '#ffa726' },
        { name: 'Compare', href: '/compare', icon: GitCompareArrows, color: '#ffa500' },
        { name: 'Predictions', href: '/prediction-markets', icon: Crosshair, color: '#e040fb' },
      ],
    },
    {
      label: 'Intel',
      items: [
        { name: 'News', href: '/news', icon: Newspaper, color: '#f59e0b' },
        { name: 'Exchanges', href: '#infra', icon: Globe, color: '#22c55e' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <TopStatsBar />
      {/* Sticky Bloomberg-style live tape — majors prices pinned below stats */}
      <MarketTiles />

      {/* ═══ Terminal Layout: Sticky Sidebar + Dense Bento Content ═══ */}
      <div id="main-content" className="max-w-[1600px] mx-auto flex gap-0">

        {/* ═══ Left rail — sticky category nav ═══ */}
        <aside className="terminal-sidebar hidden lg:flex">
          <div className="sidebar-search">
            <CoinSearch
              onSelect={handleCoinSelect}
              placeholder="Search coin..."
              className="w-full"
              compact
            />
          </div>

          <div className="sidebar-scroll">
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="sidebar-group">
                <div className="sidebar-group-label">{group.label}</div>
                {group.items.map((item) => (
                  <Link key={item.href} href={item.href} className="sidebar-item group/nav">
                    <item.icon className="sidebar-item-icon" style={{ color: item.color }} />
                    <span className="sidebar-item-label">{item.name}</span>
                    <ChevronRight className="sidebar-item-arrow" />
                  </Link>
                ))}
              </div>
            ))}
          </div>

          {/* Live footer: compact stats summary */}
          <div className="sidebar-footer">
            <div className="sidebar-footer-row">
              <span className="live-dot" />
              <span className="sidebar-footer-label">Online</span>
              <span className="sidebar-footer-value">{ALL_EXCHANGES.length}</span>
            </div>
            <div className="sidebar-footer-row">
              <span className="sidebar-footer-dot" style={{ background: '#8b5cf6' }} />
              <span className="sidebar-footer-label">DEX</span>
              <span className="sidebar-footer-value">{dexExchanges.length}</span>
            </div>
            <div className="sidebar-footer-row">
              <span className="sidebar-footer-dot" style={{ background: '#22c55e' }} />
              <span className="sidebar-footer-label">CEX</span>
              <span className="sidebar-footer-value">{cexExchanges.length}</span>
            </div>
          </div>
        </aside>

        {/* ═══ Main content column ═══ */}
        <main className="terminal-main flex-1 min-w-0 px-4 sm:px-5 pt-4 pb-10">

        {/* ═══ Mobile-only: search + quick pills (sidebar is hidden on mobile) ═══ */}
        <div className="lg:hidden mb-4 space-y-3">
          <CoinSearch
            onSelect={handleCoinSelect}
            placeholder="Search any coin..."
            className="w-full"
            compact
          />
          <div className="flex flex-wrap gap-1.5">
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[11px] font-medium text-neutral-300"
              >
                <link.icon className="w-3.5 h-3.5" style={{ color: link.color }} />
                <span>{link.name}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Recently viewed pages — self-hides when empty */}
        <RecentPages />

        {/* ═══ Stats tiles row — dense data snapshot ═══ */}
        <section id="stats" className="mb-4 stagger scroll-mt-16">
          <StatsOverview />
        </section>

        {/* ═══ HERO: Liquidation Heatmap — full-width centerpiece ═══ */}
        <section id="pulse" className="mb-4 scroll-mt-16 stagger">
          <LiquidationHeatmap />
        </section>

        {/* ═══ Data Feeds Row — Sentiment + Funding + OI + News ═══ */}
        <section id="feeds" className="mb-4 scroll-mt-16">
          <div className="cg-section-head mb-2">
            <h2 className="cg-section-title">Sentiment · Funding · Open Interest · News</h2>
            <div className="cg-section-rule" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 stagger">

            {/* Fear & Greed — compact sentiment gauge */}
            <FearGreedIndex />

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
                    <div key={i} className="skeleton h-9" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="ranked-list space-y-0.5">
                    {topFunding.map((item, index) => {
                      const isExtreme = Math.abs(item.fundingRate) > 0.05;
                      const slang = item.fundingRate > 0.1
                        ? 'Funding printing — top signal?'
                        : item.fundingRate < -0.1
                          ? 'Funding apocalypse'
                          : item.fundingRate > 0.05
                            ? 'Longs paying premium'
                            : item.fundingRate < -0.05
                              ? 'Shorts paying through the nose'
                              : null;

                      return (
                        <div
                          key={`${item.symbol}-${item.exchange}-${index}`}
                          className="rank-row"
                        >
                          <span className={`rank-number ${index < 3 ? 'rank-number-top' : ''}`}>{index + 1}</span>
                          <TokenIconSimple symbol={item.symbol} size={18} />
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="text-white font-medium text-xs">{item.symbol}</span>
                            <span className="text-neutral-500 text-[10px] leading-none">{item.exchange}</span>
                          </div>
                          <div className="relative has-tooltip">
                            <span className={`delta-badge ${
                              isExtreme
                                ? (item.fundingRate >= 0 ? 'delta-badge-extreme-up' : 'delta-badge-extreme-down')
                                : (item.fundingRate >= 0 ? 'delta-badge-up' : 'delta-badge-down')
                            }`}>
                              {item.fundingRate >= 0 ? '+' : ''}{item.fundingRate.toFixed(4)}%
                            </span>
                            {slang && (
                              <span className="trader-tooltip">
                                <span className="tooltip-slang">{slang}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {!isAuthed && (
                    <Link href="/funding" className="flex items-center justify-center gap-1.5 py-2 mt-1 text-[11px] text-hub-yellow/60 hover:text-hub-yellow transition-colors">
                      <ChevronRight size={10} />
                      View all
                    </Link>
                  )}
                </>
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
                    <div key={i} className="skeleton h-14" />
                  ))}
                </div>
              ) : (
                <>
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
                          <span className="text-neutral-500">&middot;</span>
                          <span className="text-[10px] text-neutral-400">{formatTimeAgo(article.published_on)}</span>
                        </div>
                      </a>
                    ))}
                  </div>
                  {!isAuthed && (
                    <Link href="/news" className="flex items-center justify-center gap-1.5 py-2 mt-1 text-[11px] text-hub-yellow/60 hover:text-hub-yellow transition-colors">
                      <ChevronRight size={10} />
                      View all
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>
        </section>

        {/* ═══ Market Snapshot row ═══ */}
        <section id="signals" className="mb-4 scroll-mt-16">
          <div className="cg-section-head mb-2">
            <h2 className="cg-section-title">Market Snapshot</h2>
            <div className="cg-section-rule" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 stagger">
            <MarketIndices />
            <TopMovers />
            <LongShortRatio />
          </div>
        </section>

        {/* ═══ Exchange Status ═══ */}
        <section id="infra" className="mb-6 scroll-mt-16">
          <div className="cg-section-head mb-2">
            <h2 className="cg-section-title">Exchange Status · {ALL_EXCHANGES.length} sources</h2>
            <div className="cg-section-rule" />
            <div className="flex items-center gap-3 text-[10px] ml-3">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]" />
                <span className="text-neutral-500">Active</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                <span className="text-neutral-500">Recovering</span>
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
                {healthLoaded && (() => {
                  const cbCount = exchangeHealth.filter(h => h.status === 'circuit-open').length;
                  return cbCount > 0 ? (
                    <span className="text-[10px] font-mono text-orange-500/70 bg-orange-500/10 px-1.5 py-0.5 rounded">
                      {cbCount} recovering
                    </span>
                  ) : null;
                })()}
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* CEX */}
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Centralized</span>
                  <div className="flex items-center gap-1 text-[10px] font-mono">
                    <span className="text-green-500">{activeCex}</span>
                    <span className="text-neutral-500">/</span>
                    <span className="text-neutral-400">{cexExchanges.length}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-1.5">
                  {cexExchanges.map((exchange) => {
                    const health = exchangeHealth.find(h => h.name === exchange);
                    const isActive = health?.status === 'ok' || !healthLoaded;
                    const isEmpty = healthLoaded && health?.status === 'empty';
                    const isCircuitOpen = healthLoaded && health?.status === 'circuit-open';
                    return (
                      <div
                        key={exchange}
                        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg transition-all duration-200 ${
                          isActive
                            ? 'bg-green-500/5 border border-green-500/15 hover:border-green-500/30'
                            : isCircuitOpen
                              ? 'bg-orange-500/5 border border-orange-500/15'
                              : isEmpty
                                ? 'bg-yellow-500/5 border border-yellow-500/15'
                                : health
                                  ? 'bg-red-500/5 border border-red-500/15'
                                  : 'bg-white/[0.02] border border-white/[0.04]'
                        }`}
                        title={health ? `${exchange}: ${health.count} pairs · ${health.latencyMs}ms${isCircuitOpen ? ' · Circuit breaker open (recovering)' : ''}${health.error ? ` · ${health.error}` : ''}` : exchange}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                          isActive ? 'bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.4)]' : isCircuitOpen ? 'bg-orange-500 animate-pulse' : isEmpty ? 'bg-yellow-500' : health ? 'bg-red-500/60' : 'bg-neutral-600'
                        }`} />
                        <ExchangeLogo exchange={exchange.toLowerCase()} size={14} />
                        <span className={`text-xs font-medium truncate ${isActive ? 'text-neutral-300' : isCircuitOpen ? 'text-neutral-500' : 'text-neutral-600'}`}>{exchange}</span>
                        {isActive && health && (
                          <span className="text-[10px] text-green-500/50 font-mono ml-auto flex-shrink-0">{health.count}</span>
                        )}
                        {isCircuitOpen && (
                          <span className="text-[10px] text-orange-500/60 font-mono ml-auto flex-shrink-0">CB</span>
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
                    <span className="text-neutral-500">/</span>
                    <span className="text-neutral-400">{dexExchanges.length}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-1.5">
                  {dexExchanges.map((exchange) => {
                    const health = exchangeHealth.find(h => h.name === exchange);
                    const isActive = health?.status === 'ok' || !healthLoaded;
                    const isEmpty = healthLoaded && health?.status === 'empty';
                    const isCircuitOpen = healthLoaded && health?.status === 'circuit-open';
                    return (
                      <div
                        key={exchange}
                        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg transition-all duration-200 ${
                          isActive
                            ? 'bg-purple-500/5 border border-purple-500/15 hover:border-purple-500/30'
                            : isCircuitOpen
                              ? 'bg-orange-500/5 border border-orange-500/15'
                              : isEmpty
                                ? 'bg-yellow-500/5 border border-yellow-500/15'
                                : health
                                  ? 'bg-red-500/5 border border-red-500/15'
                                  : 'bg-white/[0.02] border border-white/[0.04]'
                        }`}
                        title={health ? `${exchange}: ${health.count} pairs · ${health.latencyMs}ms${isCircuitOpen ? ' · Circuit breaker open (recovering)' : ''}${health.error ? ` · ${health.error}` : ''}` : exchange}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                          isActive ? 'bg-purple-500 shadow-[0_0_4px_rgba(168,85,247,0.4)]' : isCircuitOpen ? 'bg-orange-500 animate-pulse' : isEmpty ? 'bg-yellow-500' : health ? 'bg-red-500/60' : 'bg-neutral-600'
                        }`} />
                        <ExchangeLogo exchange={exchange.toLowerCase()} size={14} />
                        <span className={`text-xs font-medium truncate ${isActive ? 'text-neutral-300' : isCircuitOpen ? 'text-neutral-500' : 'text-neutral-600'}`}>{exchange}</span>
                        {isActive && health && (
                          <span className="text-[10px] text-purple-400/50 font-mono ml-auto flex-shrink-0">{health.count}</span>
                        )}
                        {isCircuitOpen && (
                          <span className="text-[10px] text-orange-500/60 font-mono ml-auto flex-shrink-0">CB</span>
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
      </div>

      <Footer />
    </div>
  );
}
