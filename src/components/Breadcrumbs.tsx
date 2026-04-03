'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Page → Category mapping (mirrors Header nav structure)             */
/* ------------------------------------------------------------------ */

interface PageMeta {
  label: string;
  category: string;
  categoryHref?: string; // first page in that category
}

const PAGE_MAP: Record<string, PageMeta> = {
  // Scan & Trade
  '/funding': { label: 'Funding Rates', category: 'Scan & Trade' },
  '/funding-heatmap': { label: 'Funding Heatmap', category: 'Scan & Trade' },
  '/spreads': { label: 'Price Spreads', category: 'Scan & Trade' },
  '/spread-scanner': { label: 'Spread Scanner', category: 'Scan & Trade' },
  '/basis': { label: 'Basis', category: 'Scan & Trade' },
  '/execution-costs': { label: 'Execution Costs', category: 'Scan & Trade' },
  '/chart': { label: 'Chart', category: 'Scan & Trade' },
  '/screener': { label: 'Screener', category: 'Scan & Trade' },
  '/options': { label: 'Options', category: 'Scan & Trade' },
  '/prediction-markets': { label: 'Predictions', category: 'Scan & Trade' },

  // Monitor
  '/top-movers': { label: 'Top Movers', category: 'Monitor' },
  '/market-heatmap': { label: 'Market Heatmap', category: 'Monitor' },
  '/stock-heatmap': { label: 'Stock Heatmap', category: 'Monitor' },
  '/dominance': { label: 'Dominance', category: 'Monitor' },
  '/market-cycle': { label: 'Market Cycle', category: 'Monitor' },
  '/correlation': { label: 'Correlation', category: 'Monitor' },
  '/rsi-heatmap': { label: 'RSI Heatmap', category: 'Monitor' },
  '/exchange-reserves': { label: 'Exchange Reserves', category: 'Monitor' },
  '/stablecoin-flows': { label: 'Stablecoin Flows', category: 'Monitor' },
  '/onchain': { label: 'On-Chain', category: 'Monitor' },
  '/yields': { label: 'DeFi Yields', category: 'Monitor' },
  '/exchange-comparison': { label: 'Exchanges', category: 'Monitor' },

  // Risk
  '/liquidations': { label: 'Liquidations', category: 'Risk' },
  '/liquidation-map': { label: 'Liq Map', category: 'Risk' },
  '/liquidation-heatmap': { label: 'Liq Heatmap', category: 'Risk' },
  '/open-interest': { label: 'Open Interest', category: 'Risk' },
  '/oi-heatmap': { label: 'OI Heatmap', category: 'Risk' },
  '/longshort': { label: 'Long/Short', category: 'Risk' },
  '/cvd': { label: 'CVD', category: 'Risk' },
  '/orderflow': { label: 'Order Flow', category: 'Risk' },
  '/whale-alert': { label: 'Whale Alert', category: 'Risk' },
  '/hl-whales': { label: 'HL Whales', category: 'Risk' },

  // Research
  '/news': { label: 'News', category: 'Research' },
  '/economic-calendar': { label: 'Economic Calendar', category: 'Research' },
  '/token-unlocks': { label: 'Token Unlocks', category: 'Research' },
  '/airdrops': { label: 'Airdrops', category: 'Research' },
  '/etf': { label: 'ETF Tracker', category: 'Research' },
  '/bitcoin-treasuries': { label: 'BTC Treasuries', category: 'Research' },
  '/fear-greed': { label: 'Fear & Greed', category: 'Research' },
  '/guides': { label: 'Guides', category: 'Research' },
  '/developers': { label: 'Developers', category: 'Research' },
  '/api-docs': { label: 'API Docs', category: 'Research' },

  // My Tools
  '/dashboard': { label: 'Dashboard', category: 'My Tools' },
  '/watchlist': { label: 'Watchlist', category: 'My Tools' },
  '/portfolio': { label: 'Portfolio', category: 'My Tools' },
  '/alerts': { label: 'Alerts', category: 'My Tools' },
  '/compare': { label: 'Compare', category: 'My Tools' },
  '/wallet-tracker': { label: 'Wallet Tracker', category: 'My Tools' },
  '/brand': { label: 'Brand Kit', category: 'My Tools' },
  '/team': { label: 'Team', category: 'My Tools' },
  '/referrals': { label: 'Referrals', category: 'My Tools' },
  '/faq': { label: 'FAQ', category: 'My Tools' },
  '/terms': { label: 'Terms', category: 'My Tools' },
};

/* Pages that should NOT show breadcrumbs */
const EXCLUDED = new Set(['/', '/dashboard']);

export default function Breadcrumbs() {
  const pathname = usePathname();

  if (EXCLUDED.has(pathname)) return null;

  // Handle dynamic routes like /funding/BTC
  const basePath = '/' + pathname.split('/').filter(Boolean)[0];
  const subSegment = pathname.split('/').filter(Boolean)[1];

  const meta = PAGE_MAP[basePath];
  if (!meta) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-3 pb-0"
    >
      {/* Mobile: compact back link */}
      <div className="sm:hidden">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-white transition-colors"
        >
          <ChevronRight className="w-3 h-3 rotate-180" />
          <span>{meta.category}</span>
        </Link>
      </div>

      {/* Desktop: full breadcrumb trail */}
      <ol className="hidden sm:flex items-center gap-1 text-xs" role="list">
        <li>
          <Link href="/" className="text-neutral-600 hover:text-white transition-colors flex items-center gap-1">
            <Home className="w-3 h-3" />
            <span>Home</span>
          </Link>
        </li>
        <li aria-hidden="true">
          <ChevronRight className="w-3 h-3 text-neutral-700" />
        </li>
        <li>
          <span className="text-neutral-500">{meta.category}</span>
        </li>
        <li aria-hidden="true">
          <ChevronRight className="w-3 h-3 text-neutral-700" />
        </li>
        {subSegment ? (
          <>
            <li>
              <Link href={basePath} className="text-neutral-500 hover:text-white transition-colors">
                {meta.label}
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="w-3 h-3 text-neutral-700" />
            </li>
            <li>
              <span className="text-white font-medium">{subSegment.toUpperCase()}</span>
            </li>
          </>
        ) : (
          <li>
            <span className="text-white font-medium">{meta.label}</span>
          </li>
        )}
      </ol>
    </nav>
  );
}
