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

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.04] mt-12 bg-black/20 relative">
      {/* Top accent line */}
      <div className="accent-line absolute top-0 left-0 right-0" />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
        {/* Brand row */}
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
              Real-time derivatives intelligence. Funding rates, open interest, liquidations & more.
            </p>
          </div>
          {/* Social links */}
          <div className="flex items-center gap-2">
            <a
              href="https://x.com/InfoHub_io"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-white/[0.04] text-neutral-500 hover:text-amber-400 hover:bg-white/[0.08] transition-colors"
              aria-label="Follow on X / Twitter"
            >
              <Twitter className="w-3.5 h-3.5" />
            </a>
            <a
              href="https://github.com/GroovyGecko88/infohub"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-white/[0.04] text-neutral-500 hover:text-amber-400 hover:bg-white/[0.08] transition-colors"
              aria-label="View on GitHub"
            >
              <Github className="w-3.5 h-3.5" />
            </a>
            <a
              href="https://t.me/+Z6SQGJ57SlwyY2Rk"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-white/[0.04] text-neutral-500 hover:text-amber-400 hover:bg-white/[0.08] transition-colors"
              aria-label="Join Telegram"
            >
              <Send className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
          {footerSections.map((section) => (
            <div key={section.heading}>
              <h4 className="section-label mb-3">{section.heading}</h4>
              <div className="flex flex-col gap-0.5">
                {section.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-2 text-neutral-500 hover:text-white text-xs transition-colors py-1"
                  >
                    {link.icon && <link.icon className="w-3 h-3 flex-shrink-0" />}
                    {link.name}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/[0.04] pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <span className="text-neutral-700 text-[10px]">
              &copy; {new Date().getFullYear()} InfoHub
            </span>
            <span className="hidden sm:inline text-neutral-800 text-[10px]">·</span>
            <span className="hidden sm:inline text-neutral-700 text-[10px]">
              {ALL_EXCHANGES.length} exchanges · Real-time data
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="text-neutral-700 hover:text-neutral-400 text-[10px] transition-colors">
              Terms
            </Link>
            <Link href="/faq" className="text-neutral-700 hover:text-neutral-400 text-[10px] transition-colors">
              FAQ
            </Link>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]" />
              <span className="text-neutral-600 text-[10px]">Operational</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
