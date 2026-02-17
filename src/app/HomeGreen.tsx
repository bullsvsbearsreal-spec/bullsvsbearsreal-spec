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
import { ArrowRight, Activity, BarChart3, Zap, TrendingUp, Newspaper, Shield, Terminal, GitCompareArrows } from 'lucide-react';
import { ALL_EXCHANGES, isExchangeDex } from '@/lib/constants';
import { isValidNumber } from '@/lib/utils/format';
import { fetchAllFundingRates, fetchExchangeHealth, ExchangeHealthInfo } from '@/lib/api/aggregator';
import { FundingRateData } from '@/lib/api/types';
import { fetchCryptoNews, NewsArticle, formatTimeAgo } from '@/lib/api/coinmarketcal';
import Footer from '@/components/Footer';

export default function HomeGreen() {
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
          fetchCryptoNews(6),
          fetchExchangeHealth(),
        ]);
        const validFunding = fundingData
          .filter(fr => fr && isValidNumber(fr.fundingRate))
          .sort((a, b) => Math.abs(b.fundingRate) - Math.abs(a.fundingRate))
          .slice(0, 8);
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

  const activeExchanges = exchangeHealth.filter(h => h.status === 'ok');
  const cexCount = ALL_EXCHANGES.filter(e => !isExchangeDex(e)).filter(e => exchangeHealth.find(h => h.name === e)?.status === 'ok').length;
  const dexCount = ALL_EXCHANGES.filter(e => isExchangeDex(e)).filter(e => exchangeHealth.find(h => h.name === e)?.status === 'ok').length;

  return (
    <div className="min-h-screen" style={{ background: '#030806' }}>
      <Header />
      <TopStatsBar />
      <MarketTicker />

      <main id="main-content" className="max-w-[1400px] mx-auto px-4 sm:px-6">

        {/* ═══ Terminal Hero ═══ */}
        <section className="relative pt-5 pb-3 mb-3 g-scanlines">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-1">
              <Terminal className="w-4 h-4 text-[#00DC82]" />
              <h1 className="font-mono text-lg font-bold text-white tracking-tight">
                <span className="text-white">info</span><span className="text-[#00DC82]">hub</span>
              </h1>
              <span className="g-badge">LIVE</span>
              <span className="g-badge" style={{ background: 'rgba(0,220,130,0.04)', color: 'rgba(0,220,130,0.4)' }}>
                {activeExchangeCount} EXCHANGES
              </span>
            </div>
            <p className="font-mono text-[11px] text-neutral-600 mb-4 tracking-wide">
              Real-time derivatives terminal — {ALL_EXCHANGES.length} exchanges connected
            </p>
            <div className="max-w-md">
              <CoinSearch
                onSelect={handleCoinSelect}
                placeholder="Search symbol..."
                className="w-full"
                compact
              />
            </div>
          </div>
        </section>

        {/* ═══ Dashboard Grid — 60/40 split ═══ */}
        <div className="g-grid-dashboard mb-6">

          {/* LEFT COLUMN — Primary data */}
          <div className="space-y-3">

            {/* Stats Overview */}
            <StatsOverview />

            {/* Top Funding Rates — Terminal style */}
            <div className="g-card">
              <div className="g-card-header">
                <div className="flex items-center gap-2">
                  <Activity className="w-3 h-3 text-[#00DC82]" />
                  <span className="g-card-title">Top Funding</span>
                </div>
                <Link href="/funding" className="g-link flex items-center gap-1">
                  ALL <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {loading ? (
                <div className="space-y-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                    <div key={i} className="h-7 rounded" style={{ background: 'rgba(0,220,130,0.03)' }} />
                  ))}
                </div>
              ) : (
                <table className="g-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Symbol</th>
                      <th>Exchange</th>
                      <th style={{ textAlign: 'right' }}>Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topFunding.map((item, i) => (
                      <tr key={`${item.symbol}-${item.exchange}-${i}`}>
                        <td style={{ color: '#444', width: 28 }}>{i + 1}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <TokenIconSimple symbol={item.symbol} size={16} />
                            <span className="text-white font-semibold">{item.symbol}</span>
                          </div>
                        </td>
                        <td style={{ color: '#666' }}>{item.exchange}</td>
                        <td style={{ textAlign: 'right' }}>
                          <span className={item.fundingRate >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {item.fundingRate >= 0 ? '+' : ''}{item.fundingRate.toFixed(4)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Market Pulse — side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <FearGreedIndex />
              <LiquidationHeatmap />
            </div>

            {/* Exchange Status — condensed */}
            <div className="g-card">
              <div className="g-card-header">
                <div className="flex items-center gap-2">
                  <Shield className="w-3 h-3 text-[#00DC82]" />
                  <span className="g-card-title">Infrastructure</span>
                  <span className="g-badge">{ALL_EXCHANGES.length}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] text-green-500/70">{cexCount} CEX</span>
                  <span className="font-mono text-[10px] text-purple-400/70">{dexCount} DEX</span>
                </div>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-1">
                {ALL_EXCHANGES.map((exchange) => {
                  const health = exchangeHealth.find(h => h.name === exchange);
                  const isActive = health?.status === 'ok';
                  const isDex = isExchangeDex(exchange);
                  return (
                    <div
                      key={exchange}
                      className="flex items-center gap-1 px-1.5 py-1 rounded"
                      style={{
                        background: isActive
                          ? isDex ? 'rgba(168,85,247,0.05)' : 'rgba(0,220,130,0.04)'
                          : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${isActive
                          ? isDex ? 'rgba(168,85,247,0.12)' : 'rgba(0,220,130,0.08)'
                          : 'rgba(255,255,255,0.04)'
                        }`
                      }}
                      title={health ? `${exchange}: ${health.count} pairs` : exchange}
                    >
                      <span className={`h-1 w-1 rounded-full flex-shrink-0 ${
                        isActive
                          ? isDex ? 'bg-purple-500' : 'bg-green-500'
                          : health?.status === 'empty' ? 'bg-yellow-500' : 'bg-neutral-700'
                      }`} />
                      <ExchangeLogo exchange={exchange.toLowerCase()} size={12} />
                      <span className={`text-[10px] font-mono truncate ${isActive ? 'text-neutral-400' : 'text-neutral-700'}`}>{exchange}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN — Secondary widgets */}
          <div className="space-y-3">

            {/* Quick Nav */}
            <div className="g-card" style={{ borderLeft: '2px solid rgba(0,220,130,0.2)' }}>
              <span className="g-label mb-2 block">Quick Access</span>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { name: 'Funding', href: '/funding', icon: Activity },
                  { name: 'Open Interest', href: '/open-interest', icon: BarChart3 },
                  { name: 'Liquidations', href: '/liquidations', icon: Zap },
                  { name: 'Screener', href: '/screener', icon: TrendingUp },
                ].map(link => (
                  <Link key={link.href} href={link.href} className="g-btn flex items-center gap-2 text-center justify-center">
                    <link.icon className="w-3 h-3" />
                    {link.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* Trading Signals */}
            <MarketIndices />
            <TopMovers />
            <LongShortRatio />

            {/* OI Widget */}
            <OIChangeWidget />

            {/* Latest News */}
            <div className="g-card">
              <div className="g-card-header">
                <div className="flex items-center gap-2">
                  <Newspaper className="w-3 h-3 text-[#00DC82]" />
                  <span className="g-card-title">News Feed</span>
                </div>
                <Link href="/news" className="g-link flex items-center gap-1">
                  ALL <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              {loading ? (
                <div className="space-y-1">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="h-10 rounded" style={{ background: 'rgba(0,220,130,0.03)' }} />
                  ))}
                </div>
              ) : (
                <div className="space-y-0.5">
                  {latestNews.map((article, i) => (
                    <a
                      key={article.id || i}
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="g-row block"
                    >
                      <div>
                        <h4 className="text-white text-[11px] font-medium font-mono line-clamp-1 leading-relaxed">
                          {article.title}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px] font-mono text-neutral-600">{article.source_info?.name || article.source}</span>
                          <span className="text-neutral-800 text-[8px]">/</span>
                          <span className="text-[9px] font-mono text-neutral-700">{formatTimeAgo(article.published_on)}</span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </main>
      <Footer />
    </div>
  );
}
