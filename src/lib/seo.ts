import type { Metadata } from 'next';

type PageMeta = {
  title: string;
  description: string;
  ogDesc?: string;
};

export const PAGE_META: Record<string, PageMeta> = {
  '/funding': {
    title: 'Funding Rates',
    description: 'Live perpetual futures funding rates across 24+ exchanges. Compare rates, find arbitrage opportunities, and track funding trends in real-time.',
  },
  '/open-interest': {
    title: 'Open Interest',
    description: 'Aggregate open interest data across 24+ crypto derivatives exchanges. Track OI changes, spot trends, and analyze market positioning.',
  },
  '/liquidations': {
    title: 'Liquidations',
    description: 'Real-time liquidation data across Binance, Bybit, OKX, Bitget, and more. Track large liquidation events and market impact.',
  },
  '/screener': {
    title: 'Screener',
    description: 'Screen and filter perpetual futures across all exchanges. Sort by funding rate, open interest, volume, and price change.',
  },
  '/prediction-markets': {
    title: 'Prediction Markets',
    description: 'Compare prediction market odds from Polymarket and Kalshi. Find arbitrage between platforms and track market sentiment.',
  },
  '/funding-heatmap': {
    title: 'Funding Heatmap',
    description: 'Visual heatmap of funding rates across all exchanges and symbols. Spot extreme rates and funding trends at a glance.',
  },
  '/market-heatmap': {
    title: 'Market Heatmap',
    description: 'Crypto market heatmap showing price performance. Visualize which sectors and coins are leading or lagging.',
  },
  '/top-movers': {
    title: 'Top Movers',
    description: 'Top gaining and losing perpetual futures across all exchanges. Track the biggest movers in real-time.',
  },
  '/fear-greed': {
    title: 'Fear & Greed Index',
    description: 'Crypto Fear & Greed Index with historical chart. Gauge overall market sentiment from extreme fear to extreme greed.',
  },
  '/longshort': {
    title: 'Long/Short Ratio',
    description: 'Long/short ratio data for major crypto derivatives. Understand market positioning and trader sentiment.',
  },
  '/options': {
    title: 'Options Data',
    description: 'Crypto options data including open interest, volume, and max pain. Track BTC and ETH options market activity.',
  },
  '/basis': {
    title: 'Futures Basis',
    description: 'Futures basis (premium/discount) across exchanges. Track annualized basis rates for BTC, ETH, and altcoins.',
  },
  '/correlation': {
    title: 'Correlation Matrix',
    description: 'Cryptocurrency correlation matrix showing how assets move together. Identify diversification opportunities.',
  },
  '/dominance': {
    title: 'Market Dominance',
    description: 'Bitcoin and altcoin market dominance charts. Track BTC, ETH, and stablecoin market share over time.',
  },
  '/token-unlocks': {
    title: 'Token Unlocks',
    description: 'Upcoming token unlock schedule with USD values. Track vesting events that may impact prices.',
  },
  '/economic-calendar': {
    title: 'Economic Calendar',
    description: 'Crypto and macro economic events calendar. Track events that may impact crypto markets.',
  },
  '/news': {
    title: 'Crypto News',
    description: 'Latest cryptocurrency and derivatives market news. Stay informed on events moving the market.',
  },
  '/compare': {
    title: 'Compare Exchanges',
    description: 'Compare funding rates and prices across exchanges side by side. Find the best rates for your trades.',
  },
  '/alerts': {
    title: 'Price Alerts',
    description: 'Set custom alerts for funding rates, prices, and market events. Get notified when conditions are met.',
  },
  '/rsi-heatmap': {
    title: 'RSI Heatmap',
    description: 'RSI heatmap across crypto assets. Identify overbought and oversold conditions at a glance.',
  },
  '/cvd': {
    title: 'CVD (Cumulative Volume Delta)',
    description: 'Cumulative Volume Delta analysis for crypto futures. Track buying vs selling pressure in real-time.',
  },
  '/api-docs': {
    title: 'API Documentation',
    description: 'Free crypto derivatives API. Access real-time funding rates, open interest, tickers, and prediction markets data.',
  },
  '/faq': {
    title: 'FAQ',
    description: 'Frequently asked questions about InfoHub, crypto funding rates, open interest, and derivatives data.',
  },
  '/brand': {
    title: 'Brand Assets',
    description: 'InfoHub brand guidelines, logos, and assets for media and partners.',
  },
  '/team': {
    title: 'Team',
    description: 'Meet the team behind InfoHub - building the best derivatives data platform.',
  },
  '/terms': {
    title: 'Terms of Service',
    description: 'InfoHub terms of service and legal information.',
  },
};

export function pageMetadata(path: string): Metadata {
  const meta = PAGE_META[path];
  if (!meta) return {};

  return {
    title: meta.title,
    description: meta.description,
    openGraph: {
      title: `${meta.title} | InfoHub`,
      description: meta.ogDesc || meta.description,
      images: [`/api/og?title=${encodeURIComponent(meta.title)}&desc=${encodeURIComponent(meta.ogDesc || meta.description)}`],
    },
    twitter: {
      title: `${meta.title} | InfoHub`,
      description: meta.ogDesc || meta.description,
      images: [`/api/og?title=${encodeURIComponent(meta.title)}&desc=${encodeURIComponent(meta.ogDesc || meta.description)}`],
    },
  };
}
