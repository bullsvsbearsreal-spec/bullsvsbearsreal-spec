'use client';

import { useState, useEffect, useMemo, memo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import Logo from './Logo';
import { ALL_EXCHANGES } from '@/lib/constants';
import { formatNumber } from '@/lib/utils/format';
import {
  Twitter, Send,
  Percent, PieChart, Zap, SlidersHorizontal, Grid3X3, LineChart, Shield, ArrowLeftRight,
  Crosshair, Activity, BarChart2, Eye,
  Rocket, Map, Crown, Building2, Landmark, Coins, GitCompareArrows, Unlock, Bitcoin,
  Thermometer, Fish, Newspaper,
  Star, GitCompare, Bell, Wallet, Search,
  Calendar, Palette, Users, BookOpen, Gift,
  TrendingUp, DollarSign, Layers, Radio,
  type LucideIcon,
} from 'lucide-react';

interface FooterLink {
  name: string;
  href: string;
  icon?: LucideIcon;
}

const footerSections: { heading: string; links: FooterLink[] }[] = [
  {
    heading: 'Scan & Trade',
    links: [
      { name: 'Funding Rates', href: '/funding', icon: Percent },
      { name: 'Funding Heatmap', href: '/funding-heatmap', icon: Grid3X3 },
      { name: 'Price Spreads', href: '/spreads', icon: GitCompareArrows },
      { name: 'Spread Scanner', href: '/spread-scanner', icon: Search },
      { name: 'Basis', href: '/basis', icon: BarChart2 },
      { name: 'Execution Costs', href: '/execution-costs', icon: DollarSign },
      { name: 'Chart', href: '/chart', icon: LineChart },
      { name: 'Screener', href: '/screener', icon: SlidersHorizontal },
      { name: 'Options', href: '/options', icon: Shield },
      { name: 'Predictions', href: '/prediction-markets', icon: Eye },
    ],
  },
  {
    heading: 'Monitor',
    links: [
      { name: 'Top Movers', href: '/top-movers', icon: Rocket },
      { name: 'Market Heatmap', href: '/market-heatmap', icon: Map },
      { name: 'Stock Heatmap', href: '/stock-heatmap', icon: Map },
      { name: 'Dominance', href: '/dominance', icon: Crown },
      { name: 'Market Cycle', href: '/market-cycle', icon: Activity },
      { name: 'Correlation', href: '/correlation', icon: GitCompareArrows },
      { name: 'RSI Heatmap', href: '/rsi-heatmap', icon: Grid3X3 },
      { name: 'Exchange Reserves', href: '/exchange-reserves', icon: Landmark },
      { name: 'Stablecoin Flows', href: '/stablecoin-flows', icon: Coins },
      { name: 'On-Chain', href: '/onchain', icon: Building2 },
      { name: 'DeFi Yields', href: '/yields', icon: DollarSign },
      { name: 'Exchanges', href: '/exchange-comparison', icon: Building2 },
    ],
  },
  {
    heading: 'Risk',
    links: [
      { name: 'Liquidations', href: '/liquidations', icon: Zap },
      { name: 'Liq Map', href: '/liquidation-map', icon: Crosshair },
      { name: 'Liq Heatmap', href: '/liquidation-heatmap', icon: Grid3X3 },
      { name: 'Open Interest', href: '/open-interest', icon: PieChart },
      { name: 'OI Heatmap', href: '/oi-heatmap', icon: Grid3X3 },
      { name: 'Long/Short', href: '/longshort', icon: ArrowLeftRight },
      { name: 'CVD', href: '/cvd', icon: LineChart },
      { name: 'Order Flow', href: '/orderflow', icon: Activity },
      { name: 'Whale Alert', href: '/whale-alert', icon: Fish },
      { name: 'HL Whales', href: '/hl-whales', icon: Eye },
    ],
  },
  {
    heading: 'Research',
    links: [
      { name: 'News', href: '/news', icon: Newspaper },
      { name: 'Economic Calendar', href: '/economic-calendar', icon: Calendar },
      { name: 'Token Unlocks', href: '/token-unlocks', icon: Unlock },
      { name: 'Airdrops', href: '/airdrops', icon: Gift },
      { name: 'ETF Tracker', href: '/etf', icon: LineChart },
      { name: 'BTC Treasuries', href: '/bitcoin-treasuries', icon: Bitcoin },
      { name: 'Fear & Greed', href: '/fear-greed', icon: Thermometer },
      { name: 'Guides', href: '/guides', icon: BookOpen },
      { name: 'Developers', href: '/developers', icon: BookOpen },
    ],
  },
  {
    heading: 'My Tools',
    links: [
      { name: 'Dashboard', href: '/dashboard', icon: Layers },
      { name: 'Watchlist', href: '/watchlist', icon: Star },
      { name: 'Portfolio', href: '/portfolio', icon: Wallet },
      { name: 'Alerts', href: '/alerts', icon: Bell },
      { name: 'Compare', href: '/compare', icon: GitCompare },
      { name: 'Wallet Tracker', href: '/wallet-tracker', icon: Search },
      { name: 'Brand Kit', href: '/brand', icon: Palette },
      { name: 'Team', href: '/team', icon: Users },
      { name: 'Referrals', href: '/referrals', icon: Gift },
      { name: 'FAQ', href: '/faq' },
      { name: 'Terms', href: '/terms' },
    ],
  },
];

/* ─── Live stat helpers ─────────────────────────────────────────── */

interface CoinPrice {
  symbol: string;
  price: number;
  change: number;
}

interface LiveStats {
  btcPrice: number;
  btcChange: number;
  totalOI: number;
  volume24h: number;
  activePairs: number;
  fearGreed: { value: number; classification: string } | null;
  longShort: { longRatio: number; shortRatio: number } | null;
  topGainer: { symbol: string; change24h: number } | null;
  topCoins: CoinPrice[];
  lastUpdated: number;
}


function getFearGreedColor(value: number): string {
  if (value <= 20) return '#EF4444';   // Extreme Fear - red
  if (value <= 40) return '#F97316';   // Fear - orange
  if (value <= 60) return '#EAB308';   // Neutral - yellow
  if (value <= 80) return '#84CC16';   // Greed - lime
  return '#22C55E';                    // Extreme Greed - green
}

function StatPill({ icon: Icon, label, value, loading, color }: { icon: LucideIcon; label: string; value: string; loading: boolean; color?: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-hub-default flex-shrink-0">
      <Icon className="w-3 h-3 flex-shrink-0" style={{ color: color ?? 'var(--hub-accent-dark)' }} />
      <span className="text-neutral-600 text-[10px] whitespace-nowrap">{label}</span>
      {loading ? (
        <span className="h-3 w-12 bg-white/[0.06] rounded animate-pulse" />
      ) : (
        <span className="text-white text-[11px] font-semibold font-mono whitespace-nowrap">{value}</span>
      )}
    </div>
  );
}

function safeParseJson(data: unknown): unknown {
  if (typeof data === 'string') {
    try { return JSON.parse(data); } catch { return data; }
  }
  return data;
}

/* ─── Footer ────────────────────────────────────────────────────── */

const jsonFetcher = (url: string) => fetch(url).then(r => r.ok ? r.json() : null).catch(() => null);

function FooterInner() {
  // Use SWR with shared cache keys — deduplicates with page-level fetches
  const { data: tickersRes } = useSWR('/api/tickers', jsonFetcher, { refreshInterval: 45_000, revalidateOnFocus: false });
  const { data: oiRes } = useSWR('/api/openinterest', jsonFetcher, { refreshInterval: 45_000, revalidateOnFocus: false });
  const { data: fgRes } = useSWR('/api/fear-greed', jsonFetcher, { refreshInterval: 45_000, revalidateOnFocus: false });
  const { data: lsRes } = useSWR('/api/longshort', jsonFetcher, { refreshInterval: 45_000, revalidateOnFocus: false });
  const { data: moversRes } = useSWR('/api/top-movers', jsonFetcher, { refreshInterval: 45_000, revalidateOnFocus: false });

  const loading = !tickersRes && !oiRes;

  const stats = useMemo<LiveStats | null>(() => {
    const tickers = Array.isArray(tickersRes) ? tickersRes : tickersRes?.data ?? [];
    const oiData = oiRes?.data ?? [];
    if (tickers.length === 0 && oiData.length === 0) return null;

    const fgData = safeParseJson(fgRes) as { value?: number; classification?: string } | null;
    const moversData = safeParseJson(moversRes) as { gainers?: { symbol: string; change24h: number }[] } | null;

    let btcPrice = 0;
    let btcChange = 0;
    let btcVol = 0;
    let totalVolume = 0;
    const pairSet = new Set<string>();

    const bestBySymbol: Record<string, { vol: number; price: number; change: number }> = {};
    for (const t of tickers) {
      const sym = (t.symbol || '').toUpperCase().replace(/(USDT|USD|USDC|BUSD|PERP|SWAP)$/i, '');
      const ex = ((t.exchange as string) || '').toLowerCase();
      const qVol = Number(t.quoteVolume24h) || 0;
      const isBrokenExchange = ex.includes('gate') || ex.includes('bitmex');
      pairSet.add(`${sym}-${t.exchange}`);

      if (qVol > 0 && !isBrokenExchange) {
        const existing = bestBySymbol[sym];
        if (!existing || qVol > existing.vol) {
          bestBySymbol[sym] = {
            vol: qVol,
            price: t.lastPrice ?? t.price ?? 0,
            change: t.priceChangePercent24h ?? t.changePercent24h ?? 0,
          };
        }
      }

      if (sym === 'BTC' && qVol > btcVol) {
        btcPrice = t.lastPrice ?? t.price ?? 0;
        btcChange = t.priceChangePercent24h ?? t.changePercent24h ?? 0;
        btcVol = qVol;
      }
    }
    for (const entry of Object.values(bestBySymbol)) {
      totalVolume += entry.vol;
    }

    let totalOI = 0;
    for (const o of oiData) {
      totalOI += o.openInterestValue ?? 0;
    }

    const fearGreed = fgData && typeof fgData.value === 'number'
      ? { value: fgData.value, classification: fgData.classification || '' }
      : null;

    const longShort = lsRes && typeof lsRes.longRatio === 'number' && !lsRes.fallback
      ? { longRatio: lsRes.longRatio, shortRatio: lsRes.shortRatio }
      : null;

    const gainers = moversData?.gainers ?? [];
    const topGainer = gainers.length > 0
      ? { symbol: gainers[0].symbol, change24h: gainers[0].change24h }
      : null;

    const TOP_COINS = ['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE', 'ADA', 'AVAX', 'SUI', 'LINK'];
    const topCoins: CoinPrice[] = TOP_COINS
      .filter(sym => bestBySymbol[sym])
      .map(sym => ({
        symbol: sym,
        price: bestBySymbol[sym].price,
        change: bestBySymbol[sym].change,
      }));

    return {
      btcPrice,
      btcChange,
      totalOI,
      volume24h: totalVolume,
      activePairs: pairSet.size,
      fearGreed,
      longShort,
      topGainer,
      topCoins,
      lastUpdated: Date.now(),
    };
  }, [tickersRes, oiRes, fgRes, lsRes, moversRes]);

  return (
    <footer className="border-t border-white/[0.04] mt-12 bg-gradient-to-b from-black/30 to-black/60 relative">
      {/* Top accent line */}
      <div className="accent-line absolute top-0 left-0 right-0" />

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-4 pb-6">

        {/* ─── Live Prices + Market Stats ─── */}
        <div className="pb-3 mb-4 border-b border-white/[0.04]">
          {/* Row 1: Live coin prices */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide mb-2">
            <div className="flex items-center gap-1.5 mr-1 flex-shrink-0">
              <Radio className="w-3 h-3 text-green-500 animate-pulse" />
              <span className="text-neutral-500 text-[9px] font-medium uppercase tracking-wider">Prices</span>
            </div>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.05] flex-shrink-0">
                  <div className="w-3.5 h-3.5 rounded-full bg-white/[0.06] animate-pulse" />
                  <div className="h-3 w-20 bg-white/[0.04] rounded animate-pulse" />
                </div>
              ))
            ) : stats?.topCoins?.map(coin => {
              const change = isFinite(coin.change) ? coin.change : 0;
              const isUp = change >= 0;
              const fmtPrice = !isFinite(coin.price) ? '$0'
                : coin.price >= 1000
                ? `$${coin.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                : coin.price >= 1
                ? `$${coin.price.toFixed(2)}`
                : `$${coin.price.toFixed(4)}`;
              return (
                <div key={coin.symbol} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.05] flex-shrink-0">
                  <span className="text-white text-[10px] font-semibold">{coin.symbol}</span>
                  <span className="text-neutral-300 text-[10px] font-mono">{fmtPrice}</span>
                  <span className={`text-[9px] font-mono font-semibold ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                    {isUp ? '+' : ''}{change.toFixed(2)}%
                  </span>
                </div>
              );
            })}
            {stats?.lastUpdated && (
              <span className="text-neutral-700 text-[9px] flex-shrink-0 ml-auto font-mono">
                {Math.round((Date.now() - stats.lastUpdated) / 1000)}s ago
              </span>
            )}
          </div>

          {/* Row 2: Market stats */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            <StatPill
              icon={BarChart2}
              label="24h Vol"
              value={stats?.volume24h ? formatNumber(stats.volume24h) : '--'}
              loading={loading}
              color="#3B82F6"
            />
            <StatPill
              icon={Layers}
              label="Open Interest"
              value={stats?.totalOI ? formatNumber(stats.totalOI) : '--'}
              loading={loading}
              color="#8B5CF6"
            />

            {/* Fear & Greed */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] flex-shrink-0">
              <Thermometer className="w-3 h-3 flex-shrink-0" style={{ color: stats?.fearGreed ? getFearGreedColor(stats.fearGreed.value) : '#666' }} />
              <span className="text-neutral-600 text-[10px] whitespace-nowrap">Fear/Greed</span>
              {loading ? (
                <span className="h-3 w-10 bg-white/[0.06] rounded animate-pulse" />
              ) : stats?.fearGreed ? (
                <>
                  <span className="text-white text-[11px] font-semibold font-mono">{stats.fearGreed.value}</span>
                  <span className="text-[10px] font-medium" style={{ color: getFearGreedColor(stats.fearGreed.value) }}>
                    {stats.fearGreed.classification}
                  </span>
                </>
              ) : (
                <span className="text-white text-[11px] font-semibold font-mono">--</span>
              )}
            </div>

            {/* Long/Short Ratio */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] flex-shrink-0">
              <ArrowLeftRight className="w-3 h-3 text-hub-yellow/70 flex-shrink-0" />
              <span className="text-neutral-600 text-[10px] whitespace-nowrap">L/S</span>
              {loading ? (
                <span className="h-3 w-16 bg-white/[0.06] rounded animate-pulse" />
              ) : stats?.longShort ? (
                <span className="text-[11px] font-semibold font-mono whitespace-nowrap">
                  <span className="text-green-400">{stats.longShort.longRatio.toFixed(1)}%</span>
                  <span className="text-neutral-600 mx-0.5">/</span>
                  <span className="text-red-400">{stats.longShort.shortRatio.toFixed(1)}%</span>
                </span>
              ) : (
                <span className="text-white text-[11px] font-semibold font-mono">--</span>
            )}
          </div>

          {/* Top Gainer */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] flex-shrink-0">
            <Rocket className="w-3 h-3 text-green-400 flex-shrink-0" />
            <span className="text-neutral-600 text-[10px] whitespace-nowrap">Top Gainer</span>
            {loading ? (
              <span className="h-3 w-16 bg-white/[0.06] rounded animate-pulse" />
            ) : stats?.topGainer ? (
              <>
                <span className="text-white text-[11px] font-semibold font-mono">{stats.topGainer.symbol}</span>
                <span className={`delta-badge text-[9px] ${stats.topGainer.change24h >= 15 ? 'delta-badge-extreme-up' : 'delta-badge-up'}`}>{stats.topGainer.change24h >= 0 ? '+' : ''}{stats.topGainer.change24h.toFixed(1)}%</span>
              </>
            ) : (
              <span className="text-white text-[11px] font-semibold font-mono">--</span>
            )}
          </div>

          {/* Active Pairs & Exchanges */}
          <StatPill
            icon={TrendingUp}
            label="Pairs"
            value={stats?.activePairs ? stats.activePairs.toLocaleString() : '--'}
            loading={loading}
          />
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] flex-shrink-0">
            <Building2 className="w-3 h-3 text-hub-yellow/70" />
            <span className="text-neutral-600 text-[10px]">Exchanges</span>
            <span className="text-white text-[11px] font-semibold font-mono">{ALL_EXCHANGES.length}</span>
          </div>
          </div>
        </div>

        {/* ─── Brand row ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Logo variant="icon" size="sm" />
              <span className="text-white font-bold text-sm">InfoHub</span>
              <span className="text-[10px] font-bold text-hub-yellow bg-hub-yellow/10 px-1.5 py-0.5 rounded">
                {ALL_EXCHANGES.length} exchanges
              </span>
            </div>
            <p className="text-neutral-600 text-xs leading-relaxed max-w-sm">
              Real-time derivatives intelligence. Funding rates, open interest, liquidations & more across {ALL_EXCHANGES.length} exchanges.
            </p>
          </div>
          {/* Social links */}
          <div className="flex items-center gap-2">
            {[
              { href: 'https://x.com/info_hub69', icon: Twitter, label: 'Follow on X / Twitter' },
              { href: 'https://t.me/+Z6SQGJ57SlwyY2Rk', icon: Send, label: 'Join Telegram' },
            ].map(({ href, icon: SocialIcon, label }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-white/[0.04] text-neutral-500 hover:text-hub-yellow hover:bg-hub-yellow/[0.08] transition-all duration-200"
                aria-label={label}
              >
                <SocialIcon className="w-3.5 h-3.5" />
              </a>
            ))}
          </div>
        </div>

        {/* ─── Link columns ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-5">
          {footerSections.map((section) => (
            <div key={section.heading}>
              <h4 className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                {section.heading}
                <span className="text-neutral-700 text-[10px] font-normal lowercase">
                  {section.links.length}
                </span>
              </h4>
              <div className="flex flex-col gap-0.5">
                {section.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="group flex items-center gap-2 text-neutral-500 hover:text-white text-xs transition-colors py-1"
                  >
                    {link.icon && (
                      <link.icon className="w-3 h-3 flex-shrink-0 text-neutral-700 group-hover:text-hub-yellow-light/70 transition-colors" />
                    )}
                    {link.name}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ─── Disclaimer — compact pill, responsive ─── */}
        <div className="border-t border-hub-subtle pt-3 sm:pt-4 mb-3 sm:mb-4 flex justify-center">
          <div className="inline-flex items-start gap-2 px-2.5 sm:px-3 py-2 rounded-lg bg-white/[0.02] border border-hub-subtle max-w-2xl">
            <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0 text-neutral-500 mt-[2px]" />
            <p className="text-[10px] sm:text-[10.5px] text-neutral-500 leading-relaxed text-left">
              <span className="text-neutral-400 font-medium">Not financial advice.</span>{' '}
              <span className="hidden sm:inline">InfoHub aggregates third-party market data for informational purposes only. Data may be delayed or incomplete. DYOR before any financial decisions.</span>
              <span className="sm:hidden">Third-party data, may be delayed. DYOR.</span>
            </p>
          </div>
        </div>

        {/* ─── Bottom bar — responsive: stacked on mobile, 3-col on desktop ─── */}
        <div className="border-t border-hub-subtle pt-3 sm:pt-4 flex flex-col lg:flex-row items-center justify-between gap-3 lg:gap-4">
          {/* Left: logo + wordmark + meta */}
          <div className="flex items-center gap-2 sm:gap-3 order-1">
            <Logo variant="full" size="sm" />
            <span className="hidden sm:inline h-4 w-px bg-white/[0.08]" />
            <div className="hidden sm:flex flex-col leading-tight">
              <span className="text-neutral-400 text-[10px] font-medium tracking-wide">
                &copy; {new Date().getFullYear()} InfoHub
              </span>
              <span className="text-neutral-600 text-[9px] tabular-nums">
                {ALL_EXCHANGES.length} exchanges &middot; v2.0
              </span>
            </div>
          </div>

          {/* Middle: nav links — wraps on narrow screens */}
          <nav className="flex flex-wrap items-center justify-center gap-0.5 sm:gap-1 order-3 lg:order-2">
            {[
              { href: '/terms', label: 'Terms' },
              { href: '/privacy', label: 'Privacy' },
              { href: '/faq', label: 'FAQ' },
              { href: '/developers/docs', label: 'API' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-2 sm:px-2.5 py-1 rounded-md text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.04] transition-colors uppercase tracking-wider text-[10px] font-medium"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right: live status pill */}
          <Link
            href="/funding"
            className="group flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full bg-white/[0.02] border border-hub-subtle hover:border-hub-hover hover:bg-white/[0.04] transition-all order-2 lg:order-3 max-w-full"
          >
            <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
              {stats && (
                <span className="animate-breathe absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
              )}
              <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${stats ? 'bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.4)]' : 'bg-neutral-600'}`} />
            </span>
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 group-hover:text-neutral-400 transition-colors">
              {stats ? 'Streaming' : 'Offline'}
            </span>
            <span className="h-3 w-px bg-white/[0.08]" />
            <span className={`text-[11px] font-semibold tabular-nums ${stats ? 'text-neutral-200' : 'text-neutral-600'}`}>
              {stats ? `${stats.activePairs.toLocaleString()}` : '—'}
            </span>
            <span className="text-[10px] text-neutral-600 hidden xs:inline sm:inline">pairs</span>
          </Link>
        </div>
      </div>
    </footer>
  );
}

const Footer = memo(FooterInner);
export default Footer;
