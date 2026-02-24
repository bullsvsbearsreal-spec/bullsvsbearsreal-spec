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
  totalOI: number;
  volume24h: number;
  liquidations24h: number;
  activePairs: number;
}

function formatCompact(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function StatPill({ icon: Icon, label, value, loading }: { icon: LucideIcon; label: string; value: string; loading: boolean }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] flex-shrink-0">
      <Icon className="w-3 h-3 text-hub-yellow/70 flex-shrink-0" />
      <span className="text-neutral-600 text-[10px] whitespace-nowrap">{label}</span>
      {loading ? (
        <span className="h-3 w-12 bg-white/[0.06] rounded animate-pulse" />
      ) : (
        <span className="text-white text-[11px] font-semibold font-mono whitespace-nowrap">{value}</span>
      )}
    </div>
  );
}

/* ─── Footer ────────────────────────────────────────────────────── */

export default function Footer() {
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      try {
        const [tickersRes, oiRes, liqRes] = await Promise.all([
          fetch('/api/tickers').then(r => r.ok ? r.json() : null).catch(() => null),
          fetch('/api/openinterest').then(r => r.ok ? r.json() : null).catch(() => null),
          fetch('/api/liquidations').then(r => r.ok ? r.json() : null).catch(() => null),
        ]);

        if (cancelled) return;

        const tickers = Array.isArray(tickersRes) ? tickersRes : tickersRes?.data ?? [];
        const oiData = oiRes?.data ?? [];
        const liqData = Array.isArray(liqRes) ? liqRes : liqRes?.data ?? [];

        // BTC price — highest volume BTC entry
        let btcPrice = 0;
        let btcVol = 0;
        let totalVolume = 0;
        const pairSet = new Set<string>();

        for (const t of tickers) {
          const sym = (t.symbol || '').toUpperCase().replace(/(USDT|USD|USDC|BUSD|PERP|SWAP)$/i, '');
          const vol = t.quoteVolume24h ?? t.volume24h ?? 0;
          totalVolume += vol;
          pairSet.add(`${sym}-${t.exchange}`);
          if (sym === 'BTC' && vol > btcVol) {
            btcPrice = t.lastPrice ?? t.price ?? 0;
            btcVol = vol;
          }
        }

        // Total OI
        let totalOI = 0;
        for (const o of oiData) {
          totalOI += o.openInterestValue ?? 0;
        }

        // Liquidations
        let totalLiq = 0;
        for (const l of liqData) {
          totalLiq += l.totalUsd ?? l.total ?? l.value ?? 0;
        }

        setStats({
          btcPrice,
          totalOI,
          volume24h: totalVolume,
          liquidations24h: totalLiq,
          activePairs: pairSet.size,
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

        {/* ─── Live Stats Banner ─── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 border-b border-white/[0.04] scrollbar-hide">
          <div className="flex items-center gap-1.5 mr-2 flex-shrink-0">
            <Radio className="w-3 h-3 text-green-500 animate-pulse" />
            <span className="text-neutral-500 text-[10px] font-medium uppercase tracking-wider">Live</span>
          </div>
          <StatPill
            icon={Bitcoin}
            label="BTC"
            value={stats?.btcPrice ? `$${stats.btcPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '--'}
            loading={loading}
          />
          <StatPill
            icon={Layers}
            label="Open Interest"
            value={stats?.totalOI ? formatCompact(stats.totalOI) : '--'}
            loading={loading}
          />
          <StatPill
            icon={DollarSign}
            label="24h Volume"
            value={stats?.volume24h ? formatCompact(stats.volume24h) : '--'}
            loading={loading}
          />
          <StatPill
            icon={Zap}
            label="24h Liqs"
            value={stats?.liquidations24h ? formatCompact(stats.liquidations24h) : '--'}
            loading={loading}
          />
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
