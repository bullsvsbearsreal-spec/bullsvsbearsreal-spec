'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Grid3X3, ArrowLeftRight, Zap, PieChart, Crosshair, LineChart,
  Thermometer, Fish, Rocket, Activity, Map, Percent, SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { ALL_EXCHANGES } from '@/lib/constants';

interface RelatedPage {
  name: string;
  href: string;
  desc: string;
  icon: LucideIcon;
}

const RELATED: Record<string, RelatedPage[]> = {
  '/funding': [
    { name: 'Funding Heatmap', href: '/funding-heatmap', desc: 'Visual funding rates across all exchanges', icon: Grid3X3 },
    { name: 'Price Spreads', href: '/spreads', desc: 'Cross-exchange price differentials', icon: ArrowLeftRight },
    { name: 'Spread Scanner', href: '/spread-scanner', desc: 'Multi-coin arbitrage opportunities', icon: ArrowLeftRight },
    { name: 'Open Interest', href: '/open-interest', desc: 'Track position sizing trends', icon: PieChart },
  ],
  '/liquidations': [
    { name: 'Liq Heatmap', href: '/liquidation-heatmap', desc: 'Visualize liquidation clusters', icon: Grid3X3 },
    { name: 'Liq Map', href: '/liquidation-map', desc: 'Price levels with liquidation density', icon: Crosshair },
    { name: 'Long/Short', href: '/longshort', desc: 'Position ratio across exchanges', icon: ArrowLeftRight },
    { name: 'Open Interest', href: '/open-interest', desc: 'Position sizing & trends', icon: PieChart },
  ],
  '/open-interest': [
    { name: 'OI Heatmap', href: '/oi-heatmap', desc: 'Visual OI across coins & exchanges', icon: Grid3X3 },
    { name: 'CVD', href: '/cvd', desc: 'Volume delta divergences', icon: LineChart },
    { name: 'Funding Rates', href: '/funding', desc: `Funding rates across ${ALL_EXCHANGES.length} exchanges`, icon: Percent },
    { name: 'Liquidations', href: '/liquidations', desc: 'Real-time forced closures', icon: Zap },
  ],
  '/spreads': [
    { name: 'Spread Scanner', href: '/spread-scanner', desc: 'Multi-coin spread analysis', icon: ArrowLeftRight },
    { name: 'Funding Rates', href: '/funding', desc: 'Funding-based arbitrage', icon: Percent },
    { name: 'Execution Costs', href: '/execution-costs', desc: 'Slippage & fee comparison', icon: Crosshair },
    { name: 'Screener', href: '/screener', desc: 'Filter coins by any metric', icon: SlidersHorizontal },
  ],
  '/fear-greed': [
    { name: 'Top Movers', href: '/top-movers', desc: 'Biggest gainers & losers', icon: Rocket },
    { name: 'Long/Short', href: '/longshort', desc: 'Market positioning bias', icon: ArrowLeftRight },
    { name: 'Whale Alert', href: '/whale-alert', desc: 'Large on-chain transactions', icon: Fish },
    { name: 'Market Cycle', href: '/market-cycle', desc: 'Macro trend indicators', icon: Activity },
  ],
  '/top-movers': [
    { name: 'Market Heatmap', href: '/market-heatmap', desc: 'Visual market overview', icon: Map },
    { name: 'Screener', href: '/screener', desc: 'Custom filters & scans', icon: SlidersHorizontal },
    { name: 'Fear & Greed', href: '/fear-greed', desc: 'Market sentiment index', icon: Thermometer },
    { name: 'Funding Rates', href: '/funding', desc: 'Sentiment from derivatives', icon: Percent },
  ],
  '/chart': [
    { name: 'Screener', href: '/screener', desc: 'Filter coins to chart', icon: SlidersHorizontal },
    { name: 'Funding Rates', href: '/funding', desc: 'Per-coin funding data', icon: Percent },
    { name: 'Order Flow', href: '/orderflow', desc: 'Tape & volume analysis', icon: Activity },
    { name: 'Top Movers', href: '/top-movers', desc: 'Find trending coins', icon: Rocket },
  ],
};

export default function RelatedPages() {
  const pathname = usePathname();
  const basePath = '/' + pathname.split('/').filter(Boolean)[0];
  const pages = RELATED[basePath];

  if (!pages || pages.length === 0) return null;

  return (
    <section className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 mt-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-3">
        Related pages
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {pages.map((page) => {
          const Icon = page.icon;
          return (
            <Link
              key={page.href}
              href={page.href}
              className="group flex items-start gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.04] transition-all"
            >
              <Icon className="w-4 h-4 text-neutral-600 group-hover:text-hub-yellow transition-colors mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-300 group-hover:text-white transition-colors">
                  {page.name}
                </p>
                <p className="text-[11px] text-neutral-600 mt-0.5 leading-relaxed">
                  {page.desc}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
