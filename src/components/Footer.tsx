'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Logo from './Logo';
import { ALL_EXCHANGES } from '@/lib/constants';
import {
  Github, Twitter, Send,
  Percent, PieChart, Zap, SlidersHorizontal, Grid3X3, LineChart, Shield, ArrowLeftRight,
  Crosshair, Activity, BarChart2, Eye,
  Rocket, Map, Crown, Building2, Landmark, Coins, GitCompareArrows, Unlock, Bitcoin,
  Thermometer, Fish, Newspaper,
  Star, GitCompare, Bell, Wallet, Search,
  Calendar, Code2, Palette, Users, BookOpen,
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
    heading: 'Trading',
    links: [
      { name: 'Funding Rates', href: '/funding', icon: Percent },
      { name: 'Open Interest', href: '/open-interest', icon: PieChart },
      { name: 'Liquidations', href: '/liquidations', icon: Zap },
      { name: 'Screener', href: '/screener', icon: SlidersHorizontal },
      { name: 'Funding Heatmap', href: '/funding-heatmap', icon: Grid3X3 },
      { name: 'OI Heatmap', href: '/oi-heatmap', icon: Grid3X3 },
      { name: 'Liq Map', href: '/liquidation-map', icon: Crosshair },
      { name: 'Options', href: '/options', icon: Shield },
      { name: 'Basis', href: '/basis', icon: BarChart2 },
      { name: 'Long/Short', href: '/longshort', icon: ArrowLeftRight },
      { name: 'CVD', href: '/cvd', icon: LineChart },
      { name: 'Order Flow', href: '/orderflow', icon: Activity },
      { name: 'Predictions', href: '/prediction-markets', icon: Eye },
    ],
  },
  {
    heading: 'Markets',
    links: [
      { name: 'Top Movers', href: '/top-movers', icon: Rocket },
      { name: 'Market Heatmap', href: '/market-heatmap', icon: Map },
      { name: 'Dominance', href: '/dominance', icon: Crown },
      { name: 'ETF Tracker', href: '/etf', icon: LineChart },
      { name: 'BTC Treasuries', href: '/bitcoin-treasuries', icon: Bitcoin },
      { name: 'Exchange Reserves', href: '/exchange-reserves', icon: Landmark },
      { name: 'Stablecoin Flows', href: '/stablecoin-flows', icon: Coins },
      { name: 'Token Unlocks', href: '/token-unlocks', icon: Unlock },
      { name: 'Correlation', href: '/correlation', icon: GitCompareArrows },
      { name: 'Market Cycle', href: '/market-cycle', icon: Activity },
      { name: 'On-Chain', href: '/onchain', icon: Building2 },
      { name: 'Exchanges', href: '/exchange-comparison', icon: Building2 },
    ],
  },
  {
    heading: 'Sentiment',
    links: [
      { name: 'Fear & Greed', href: '/fear-greed', icon: Thermometer },
      { name: 'Whale Alert', href: '/whale-alert', icon: Fish },
      { name: 'HL Whales', href: '/hl-whales', icon: Eye },
      { name: 'News', href: '/news', icon: Newspaper },
    ],
  },
  {
    heading: 'Portfolio',
    links: [
      { name: 'Watchlist', href: '/watchlist', icon: Star },
      { name: 'Compare', href: '/compare', icon: GitCompare },
      { name: 'Alerts', href: '/alerts', icon: Bell },
      { name: 'Portfolio', href: '/portfolio', icon: Wallet },
      { name: 'Wallet Tracker', href: '/wallet-tracker', icon: Search },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { name: 'Economic Calendar', href: '/economic-calendar', icon: Calendar },
      { name: 'Guides', href: '/guides', icon: BookOpen },
      { name: 'API Docs', href: '/api-docs', icon: Code2 },
      { name: 'Brand Kit', href: '/brand', icon: Palette },
      { name: 'Team', href: '/team', icon: Users },
      { name: 'FAQ', href: '/faq' },
      { name: 'Terms', href: '/terms' },
    ],
  },
];

/* ─── Live stat helpers ─────────────────────────────────────────── */

interface LiveStats {
  btcPrice: number;
  btcChange: number;
  totalOI: number;
  volume24h: number;
  activePairs: number;
  fearGreed: { value: number; classification: string } | null;
  longShort: { longRatio: number; shortRatio: number } | null;
  topGainer: { symbol: string; change24h: number } | null;
}

function formatCompact(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
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
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] flex-shrink-0">
      <Icon className="w-3 h-3 flex-shrink-0" style={{ color: color ?? 'rgba(255,223,0,0.7)' }} />
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

export default function Footer() {
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      try {
        const [tickersRes, oiRes, fgRes, lsRes, moversRes] = await Promise.all([
          fetch('/api/tickers').then(r => r.ok ? r.json() : null).catch(() => null),
          fetch('/api/openinterest').then(r => r.ok ? r.json() : null).catch(() => null),
          fetch('/api/fear-greed').then(r => r.ok ? r.json() : null).catch(() => null),
          fetch('/api/longshort').then(r => r.ok ? r.json() : null).catch(() => null),
          fetch('/api/top-movers').then(r => r.ok ? r.json() : null).catch(() => null),
        ]);

        if (cancelled) return;

        const tickers = Array.isArray(tickersRes) ? tickersRes : tickersRes?.data ?? [];
        const oiData = oiRes?.data ?? [];

        // Handle double-encoded JSON responses
        const fgData = safeParseJson(fgRes) as { value?: number; classification?: string } | null;
        const moversData = safeParseJson(moversRes) as { gainers?: { symbol: string; change24h: number }[] } | null;

        // BTC price — highest quote-volume BTC entry
        let btcPrice = 0;
        let btcChange = 0;
        let btcVol = 0;
        let totalVolume = 0;
        const pairSet = new Set<string>();

        for (const t of tickers) {
          const sym = (t.symbol || '').toUpperCase().replace(/(USDT|USD|USDC|BUSD|PERP|SWAP)$/i, '');
          // ONLY use quoteVolume24h (USD-denominated) — never volume24h (base units)
          const qVol = Number(t.quoteVolume24h) || 0;
          if (qVol > 0) totalVolume += qVol;
          pairSet.add(`${sym}-${t.exchange}`);
          if (sym === 'BTC' && qVol > btcVol) {
            btcPrice = t.lastPrice ?? t.price ?? 0;
            btcChange = t.priceChangePercent24h ?? t.changePercent24h ?? 0;
            btcVol = qVol;
          }
        }

        // Total OI
        let totalOI = 0;
        for (const o of oiData) {
          totalOI += o.openInterestValue ?? 0;
        }

        // Fear & Greed
        const fearGreed = fgData && typeof fgData.value === 'number'
          ? { value: fgData.value, classification: fgData.classification || '' }
          : null;

        // Long/Short
        const longShort = lsRes && typeof lsRes.longRatio === 'number'
          ? { longRatio: lsRes.longRatio, shortRatio: lsRes.shortRatio }
          : null;

        // Top Gainer
        const gainers = moversData?.gainers ?? [];
        const topGainer = gainers.length > 0
          ? { symbol: gainers[0].symbol, change24h: gainers[0].change24h }
          : null;

        setStats({
          btcPrice,
          btcChange,
          totalOI,
          volume24h: totalVolume,
          activePairs: pairSet.size,
          fearGreed,
          longShort,
          topGainer,
        });
      } catch {
        // silently fail — stats are supplementary
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchStats();
    const interval = setInterval(fetchStats, 120_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return (
    <footer className="border-t border-white/[0.04] mt-12 bg-gradient-to-b from-black/30 to-black/60 relative">
      {/* Top accent line */}
      <div className="accent-line absolute top-0 left-0 right-0" />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-6 pb-8">

        {/* ─── Live Stats Banner (Coinglass-style) ─── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 border-b border-white/[0.04] scrollbar-hide">
          <div className="flex items-center gap-1.5 mr-2 flex-shrink-0">
            <Radio className="w-3 h-3 text-green-500 animate-pulse" />
            <span className="text-neutral-500 text-[10px] font-medium uppercase tracking-wider">Live</span>
          </div>

          {/* BTC Price with 24h change */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] flex-shrink-0">
            <Bitcoin className="w-3.5 h-3.5 text-[#F7931A] flex-shrink-0" />
            <span className="text-neutral-600 text-[10px] whitespace-nowrap">BTC</span>
            {loading ? (
              <span className="h-3 w-16 bg-white/[0.06] rounded animate-pulse" />
            ) : (
              <>
                <span className="text-white text-[11px] font-semibold font-mono whitespace-nowrap">
                  {stats?.btcPrice ? `$${stats.btcPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '--'}
                </span>
                {stats?.btcChange !== undefined && stats.btcChange !== 0 && (
                  <span className={`text-[10px] font-mono font-medium ${stats.btcChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stats.btcChange >= 0 ? '+' : ''}{stats.btcChange.toFixed(2)}%
                  </span>
                )}
              </>
            )}
          </div>

          {/* 24h Volume */}
          <StatPill
            icon={BarChart2}
            label="24h Vol"
            value={stats?.volume24h ? formatCompact(stats.volume24h) : '--'}
            loading={loading}
            color="#3B82F6"
          />

          {/* Open Interest */}
          <StatPill
            icon={Layers}
            label="Open Interest"
            value={stats?.totalOI ? formatCompact(stats.totalOI) : '--'}
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
                <span className="text-green-400 text-[10px] font-mono font-medium">+{stats.topGainer.change24h.toFixed(1)}%</span>
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

        {/* ─── Brand row ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
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
              { href: 'https://x.com/InfoHub_io', icon: Twitter, label: 'Follow on X / Twitter' },
              { href: 'https://github.com/GroovyGecko88/infohub', icon: Github, label: 'View on GitHub' },
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
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
                      <link.icon className="w-3 h-3 flex-shrink-0 text-neutral-700 group-hover:text-hub-yellow/70 transition-colors" />
                    )}
                    {link.name}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ─── Bottom bar ─── */}
        <div className="border-t border-white/[0.04] pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <span className="text-neutral-700 text-[10px]">
              &copy; {new Date().getFullYear()} InfoHub
            </span>
            <span className="hidden sm:inline text-neutral-800 text-[10px]">&middot;</span>
            <span className="hidden sm:inline text-neutral-700 text-[10px]">
              {ALL_EXCHANGES.length} exchanges &middot; Real-time data
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="text-neutral-700 hover:text-neutral-400 text-[10px] transition-colors">
              Terms
            </Link>
            <Link href="/faq" className="text-neutral-700 hover:text-neutral-400 text-[10px] transition-colors">
              FAQ
            </Link>
            <Link href="/api-docs" className="text-neutral-700 hover:text-neutral-400 text-[10px] transition-colors">
              API
            </Link>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.5)] animate-pulse" />
              <span className="text-neutral-600 text-[10px]">Operational</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
