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
import {
  ArrowRight, Activity, BarChart3, Zap, TrendingUp,
  Newspaper, Shield, Globe, Sparkles, Eye
} from 'lucide-react';
import { ALL_EXCHANGES, isExchangeDex } from '@/lib/constants';
import { isValidNumber } from '@/lib/utils/format';
import { fetchAllFundingRates, fetchExchangeHealth, ExchangeHealthInfo } from '@/lib/api/aggregator';
import { FundingRateData } from '@/lib/api/types';
import { fetchCryptoNews, NewsArticle, formatTimeAgo } from '@/lib/api/coinmarketcal';
import Footer from '@/components/Footer';

export default function HomeBlue() {
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
          fetchCryptoNews(5),
          fetchExchangeHealth(),
        ]);
        const validFunding = fundingData
          .filter(fr => fr && isValidNumber(fr.fundingRate))
          .sort((a, b) => Math.abs(b.fundingRate) - Math.abs(a.fundingRate))
          .slice(0, 6);
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

  const cexCount = ALL_EXCHANGES.filter(e => !isExchangeDex(e)).filter(e => exchangeHealth.find(h => h.name === e)?.status === 'ok').length;
  const dexCount = ALL_EXCHANGES.filter(e => isExchangeDex(e)).filter(e => exchangeHealth.find(h => h.name === e)?.status === 'ok').length;

  return (
    <div className="min-h-screen" style={{ background: '#06060e' }}>
      <Header />
      <TopStatsBar />
      <MarketTicker />

      <main id="main-content" className="max-w-[1440px] mx-auto px-4 sm:px-6">

        {/* ═══ Nebula Hero ═══ */}
        <section className="relative pt-8 pb-6 mb-4 b-aurora overflow-hidden">
          {/* Floating orbs */}
          <div className="b-orb-1" style={{ top: '-40px', right: '10%' }} />
          <div className="b-orb-2" style={{ bottom: '-20px', left: '5%' }} />

          <div className="relative z-10 text-center max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 mb-3 px-3 py-1.5 rounded-full" style={{ background: 'rgba(123,97,255,0.06)', border: '1px solid rgba(123,97,255,0.12)' }}>
              <Sparkles className="w-3 h-3 text-[#7B61FF]" />
              <span className="text-[11px] font-medium text-[#9D8BFF]">{activeExchangeCount} Exchanges Live</span>
              <span className="h-1.5 w-1.5 rounded-full bg-[#7B61FF] animate-pulse" />
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">
              <span className="text-white">Info</span>
              <span style={{ background: 'linear-gradient(135deg, #7B61FF, #00D4FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Hub</span>
            </h1>
            <p className="text-sm text-neutral-400 mb-5 leading-relaxed max-w-md mx-auto">
              Real-time derivatives intelligence across {ALL_EXCHANGES.length} exchanges
            </p>

            <div className="max-w-sm mx-auto">
              <CoinSearch
                onSelect={handleCoinSelect}
                placeholder="Search any market..."
                className="w-full"
                compact
              />
            </div>

            {/* Quick nav pills */}
            <div className="flex flex-wrap justify-center gap-2 mt-5">
              {[
                { name: 'Funding', href: '/funding', icon: Activity },
                { name: 'Open Interest', href: '/open-interest', icon: BarChart3 },
                { name: 'Liquidations', href: '/liquidations', icon: Zap },
                { name: 'Screener', href: '/screener', icon: TrendingUp },
                { name: 'News', href: '/news', icon: Newspaper },
              ].map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="b-btn inline-flex items-center gap-1.5"
                >
                  <link.icon className="w-3 h-3" />
                  {link.name}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ 3-Column Masonry Dashboard ═══ */}
        <div className="b-grid-dashboard mb-8">

          {/* ── Column 1: Stats + Funding ── */}
          <div className="space-y-4">
            <StatsOverview />

            {/* Top Funding — Glass card with gradient header */}
            <div className="b-card">
              <div className="b-card-header">
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-[#7B61FF]" />
                  <span className="b-card-title">Top Funding Rates</span>
                </div>
                <Link href="/funding" className="b-link flex items-center gap-1">
                  View All <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="h-8 rounded-lg" style={{ background: 'rgba(123,97,255,0.03)' }} />
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {topFunding.map((item, i) => (
                    <div key={`${item.symbol}-${item.exchange}-${i}`} className="b-row">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-neutral-600 w-4 text-right">{i + 1}</span>
                        <TokenIconSimple symbol={item.symbol} size={18} />
                        <div>
                          <span className="text-white text-[13px] font-semibold">{item.symbol}</span>
                          <span className="text-neutral-500 text-[10px] ml-2">{item.exchange}</span>
                        </div>
                      </div>
                      <span className={`text-[13px] font-bold tabular-nums ${item.fundingRate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {item.fundingRate >= 0 ? '+' : ''}{item.fundingRate.toFixed(4)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Long/Short Ratio */}
            <LongShortRatio />
          </div>

          {/* ── Column 2: Market Pulse ── */}
          <div className="space-y-4">
            <FearGreedIndex />
            <LiquidationHeatmap />
            <OIChangeWidget />
          </div>

          {/* ── Column 3: Signals + News ── */}
          <div className="space-y-4">
            <MarketIndices />
            <TopMovers />

            {/* News — Nebula style */}
            <div className="b-card">
              <div className="b-card-header">
                <div className="flex items-center gap-2">
                  <Newspaper className="w-3.5 h-3.5 text-[#00D4FF]" />
                  <span className="b-card-title">Latest News</span>
                </div>
                <Link href="/news" className="b-link flex items-center gap-1">
                  All <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-12 rounded-lg" style={{ background: 'rgba(123,97,255,0.03)' }} />
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {latestNews.map((article, i) => (
                    <a
                      key={article.id || i}
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="b-row block"
                    >
                      <div className="min-w-0">
                        <h4 className="text-white text-[12px] font-medium line-clamp-1 leading-relaxed">
                          {article.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-[#9D8BFF]/60">{article.source_info?.name || article.source}</span>
                          <span className="text-neutral-700 text-[8px]">|</span>
                          <span className="text-[10px] text-neutral-600">{formatTimeAgo(article.published_on)}</span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══ Exchange Status — Full width glass panel ═══ */}
        <div className="b-card mb-8" style={{ borderRadius: '20px', padding: '20px 24px' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(123,97,255,0.15), rgba(0,212,255,0.08))' }}>
                <Globe className="w-4 h-4 text-[#7B61FF]" />
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-white">Exchange Infrastructure</h3>
                <p className="text-[11px] text-neutral-500">{cexCount} CEX + {dexCount} DEX active</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="b-badge">{ALL_EXCHANGES.length} Total</span>
              <span className="b-badge-cyan">{activeExchangeCount} Online</span>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 gap-2">
            {ALL_EXCHANGES.map((exchange) => {
              const health = exchangeHealth.find(h => h.name === exchange);
              const isActive = health?.status === 'ok';
              const isDex = isExchangeDex(exchange);
              return (
                <div
                  key={exchange}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all"
                  style={{
                    background: isActive
                      ? isDex ? 'rgba(0,212,255,0.04)' : 'rgba(123,97,255,0.04)'
                      : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isActive
                      ? isDex ? 'rgba(0,212,255,0.10)' : 'rgba(123,97,255,0.08)'
                      : 'rgba(255,255,255,0.04)'
                    }`
                  }}
                  title={health ? `${exchange}: ${health.count} pairs` : exchange}
                >
                  <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                    isActive
                      ? isDex ? 'bg-cyan-400' : 'bg-[#7B61FF]'
                      : health?.status === 'empty' ? 'bg-yellow-500' : 'bg-neutral-700'
                  }`} />
                  <ExchangeLogo exchange={exchange.toLowerCase()} size={14} />
                  <span className={`text-[10px] truncate ${isActive ? 'text-neutral-400' : 'text-neutral-700'}`}>{exchange}</span>
                </div>
              );
            })}
          </div>
        </div>

      </main>
      <Footer />
    </div>
  );
}
