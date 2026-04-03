'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { addRecentlyViewed } from '@/lib/storage/recentlyViewed';

/** Page labels by path prefix for auto-tracking */
const PAGE_LABELS: Record<string, string> = {
  '/funding': 'Funding Rates',
  '/open-interest': 'Open Interest',
  '/liquidations': 'Liquidations',
  '/top-movers': 'Top Movers',
  '/screener': 'Screener',
  '/chart': 'Chart',
  '/spreads': 'Spreads',
  '/fear-greed': 'Fear & Greed',
  '/watchlist': 'Watchlist',
  '/portfolio': 'Portfolio',
  '/alerts': 'Alerts',
  '/dashboard': 'Dashboard',
  '/funding-heatmap': 'Funding Heatmap',
  '/market-heatmap': 'Market Heatmap',
  '/oi-heatmap': 'OI Heatmap',
  '/rsi-heatmap': 'RSI Heatmap',
  '/basis': 'Basis Rates',
  '/compare': 'Compare',
  '/etf': 'ETF Tracker',
};

/**
 * Auto-tracks the current page in recently-viewed history.
 * For dynamic routes like /symbol/BTC or /funding/BTC, pass explicit label and symbol.
 */
export function useTrackPageView(label?: string, symbol?: string) {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname === '/') return;

    // Use explicit label or look up from PAGE_LABELS
    const displayLabel = label || PAGE_LABELS[pathname];
    if (!displayLabel) return;

    addRecentlyViewed(pathname, displayLabel, symbol);
  }, [pathname, label, symbol]);
}
