import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://info-hub.io';

  // Pages grouped by priority + freshness. Higher priority = stronger signal
  // to crawlers that this is a primary landing surface. changeFrequency
  // matches actual data refresh (hourly for live data, daily for cycle/
  // sentiment, weekly for guides, monthly for static legal).
  const pages = [
    // ─── Top-tier landing pages ───────────────────────────────────────
    { path: '/',                priority: 1.0, changeFrequency: 'daily' as const },
    { path: '/funding',         priority: 0.9, changeFrequency: 'hourly' as const },
    { path: '/open-interest',   priority: 0.9, changeFrequency: 'hourly' as const },
    { path: '/liquidations',    priority: 0.9, changeFrequency: 'hourly' as const },
    { path: '/chart',           priority: 0.9, changeFrequency: 'hourly' as const },
    { path: '/funding-arb',     priority: 0.9, changeFrequency: 'hourly' as const },

    // ─── Flagship data + scanners ─────────────────────────────────────
    { path: '/screener',                priority: 0.8, changeFrequency: 'hourly' as const },
    { path: '/funding-heatmap',         priority: 0.8, changeFrequency: 'hourly' as const },
    { path: '/liquidation-heatmap',     priority: 0.8, changeFrequency: 'hourly' as const },
    { path: '/liquidation-map',         priority: 0.8, changeFrequency: 'hourly' as const },
    { path: '/oi-heatmap',              priority: 0.8, changeFrequency: 'hourly' as const },
    { path: '/market-heatmap',          priority: 0.8, changeFrequency: 'hourly' as const },
    { path: '/spreads',                 priority: 0.8, changeFrequency: 'hourly' as const },
    { path: '/spread-scanner',          priority: 0.8, changeFrequency: 'hourly' as const },
    { path: '/top-movers',              priority: 0.8, changeFrequency: 'hourly' as const },
    { path: '/news',                    priority: 0.8, changeFrequency: 'hourly' as const },

    // ─── Specialty data ───────────────────────────────────────────────
    { path: '/longshort',          priority: 0.7, changeFrequency: 'hourly' as const },
    { path: '/options',            priority: 0.7, changeFrequency: 'hourly' as const },
    { path: '/basis',              priority: 0.7, changeFrequency: 'hourly' as const },
    { path: '/cme-basis',          priority: 0.7, changeFrequency: 'hourly' as const },
    { path: '/orderflow',          priority: 0.7, changeFrequency: 'hourly' as const },
    { path: '/orderbook-imbalance', priority: 0.7, changeFrequency: 'hourly' as const },
    { path: '/cvd',                priority: 0.7, changeFrequency: 'hourly' as const },
    // /skew, /funding-flips, /funding-leaderboard, /funding-predictor
    // all 308-redirect to /options or /funding (consolidated May 2026).
    // Keeping them in the sitemap just trains Google to keep crawling
    // dead URLs — let the redirect-on-discovery do its job and drop
    // them from the list.
    { path: '/premiums',           priority: 0.7, changeFrequency: 'hourly' as const },
    { path: '/funding-countdown',  priority: 0.7, changeFrequency: 'hourly' as const },
    { path: '/funding-paid',       priority: 0.7, changeFrequency: 'hourly' as const },
    { path: '/perp-dex-volume',    priority: 0.7, changeFrequency: 'hourly' as const },
    { path: '/volume-share',       priority: 0.7, changeFrequency: 'hourly' as const },
    // /whale-alert → /liquidations (consolidated May 2026).
    { path: '/hl-whales',          priority: 0.7, changeFrequency: 'hourly' as const },
    { path: '/hl-traders',         priority: 0.7, changeFrequency: 'hourly' as const },
    { path: '/hl-vaults',          priority: 0.7, changeFrequency: 'hourly' as const },
    { path: '/gmx-traders',        priority: 0.7, changeFrequency: 'hourly' as const },
    { path: '/smart-money',        priority: 0.7, changeFrequency: 'hourly' as const },
    { path: '/smart-money/leaderboard', priority: 0.7, changeFrequency: 'hourly' as const },
    // /smart-money-composite → /smart-money (consolidated May 2026).
    { path: '/whale-liq',          priority: 0.7, changeFrequency: 'hourly' as const },
    // /wallet-tracker → /watch (consolidated May 2026).
    { path: '/watch',              priority: 0.7, changeFrequency: 'weekly' as const },
    { path: '/trader-watch',       priority: 0.6, changeFrequency: 'daily' as const },
    { path: '/breakouts',          priority: 0.7, changeFrequency: 'hourly' as const },
    { path: '/momentum',           priority: 0.7, changeFrequency: 'hourly' as const },
    { path: '/outperformers',      priority: 0.7, changeFrequency: 'hourly' as const },
    { path: '/trending-tokens',    priority: 0.7, changeFrequency: 'hourly' as const },
    { path: '/memecoin-radar',     priority: 0.7, changeFrequency: 'hourly' as const },
    { path: '/listing-radar',      priority: 0.7, changeFrequency: 'hourly' as const },

    // ─── Market context + cycle ───────────────────────────────────────
    { path: '/fear-greed',         priority: 0.7, changeFrequency: 'daily' as const },
    { path: '/altseason',          priority: 0.7, changeFrequency: 'daily' as const },
    { path: '/correlation',        priority: 0.7, changeFrequency: 'daily' as const },
    { path: '/dominance',          priority: 0.7, changeFrequency: 'daily' as const },
    { path: '/market-cycle',       priority: 0.7, changeFrequency: 'daily' as const },
    { path: '/cycle-phase',        priority: 0.7, changeFrequency: 'daily' as const },
    { path: '/crowdedness',        priority: 0.7, changeFrequency: 'daily' as const },
    { path: '/sectors',            priority: 0.7, changeFrequency: 'daily' as const },
    { path: '/hash-ribbons',       priority: 0.6, changeFrequency: 'daily' as const },
    { path: '/economic-calendar',  priority: 0.7, changeFrequency: 'daily' as const },
    { path: '/earnings-calendar',  priority: 0.7, changeFrequency: 'daily' as const },
    { path: '/tge-calendar',       priority: 0.7, changeFrequency: 'daily' as const },
    { path: '/token-unlocks',      priority: 0.7, changeFrequency: 'daily' as const },
    { path: '/cliff-watch',        priority: 0.7, changeFrequency: 'daily' as const },
    { path: '/listings',           priority: 0.7, changeFrequency: 'daily' as const },
    { path: '/airdrops',           priority: 0.7, changeFrequency: 'daily' as const },
    { path: '/fomc-playbook',      priority: 0.6, changeFrequency: 'monthly' as const },

    // ─── Institutional flow + on-chain ────────────────────────────────
    { path: '/etf',                priority: 0.7, changeFrequency: 'daily' as const },
    { path: '/etf-flows',          priority: 0.7, changeFrequency: 'daily' as const },
    // /etf-counterfactual → /etf-flows (consolidated May 2026).
    { path: '/bitcoin-treasuries', priority: 0.7, changeFrequency: 'daily' as const },
    { path: '/crypto-stocks',      priority: 0.6, changeFrequency: 'daily' as const },
    { path: '/stablecoin-flows',   priority: 0.7, changeFrequency: 'daily' as const },
    { path: '/stablecoin-peg',     priority: 0.7, changeFrequency: 'hourly' as const },
    { path: '/stablecoin-supply',  priority: 0.7, changeFrequency: 'daily' as const },
    { path: '/exchange-reserves',  priority: 0.7, changeFrequency: 'daily' as const },
    { path: '/bridge-flows',       priority: 0.7, changeFrequency: 'daily' as const },
    { path: '/onchain',            priority: 0.7, changeFrequency: 'daily' as const },
    { path: '/gas-tracker',        priority: 0.6, changeFrequency: 'hourly' as const },
    { path: '/protocol-revenue',   priority: 0.6, changeFrequency: 'daily' as const },
    { path: '/validators',         priority: 0.6, changeFrequency: 'daily' as const },
    // /restaking + /restaking-delta → /staking (consolidated May 2026).
    { path: '/staking',            priority: 0.6, changeFrequency: 'daily' as const },
    { path: '/yields',             priority: 0.7, changeFrequency: 'daily' as const },
    { path: '/social',             priority: 0.6, changeFrequency: 'hourly' as const },
    { path: '/points',             priority: 0.6, changeFrequency: 'daily' as const },

    // ─── Tools + interactive ──────────────────────────────────────────
    { path: '/compare',            priority: 0.7, changeFrequency: 'daily' as const },
    { path: '/compare-traders',    priority: 0.6, changeFrequency: 'daily' as const },
    { path: '/exchange-comparison', priority: 0.7, changeFrequency: 'daily' as const },
    { path: '/exchange-fees',      priority: 0.7, changeFrequency: 'weekly' as const },
    { path: '/execution-costs',    priority: 0.7, changeFrequency: 'hourly' as const },
    { path: '/trade-optimizer',    priority: 0.7, changeFrequency: 'hourly' as const },
    { path: '/liq-calculator',     priority: 0.7, changeFrequency: 'monthly' as const },
    { path: '/position-size',      priority: 0.7, changeFrequency: 'monthly' as const },
    { path: '/leverage',           priority: 0.7, changeFrequency: 'daily' as const },
    { path: '/backtest',           priority: 0.6, changeFrequency: 'weekly' as const },
    { path: '/liquidation-levels', priority: 0.7, changeFrequency: 'hourly' as const },
    { path: '/rsi-heatmap',        priority: 0.7, changeFrequency: 'hourly' as const },
    { path: '/stock-heatmap',      priority: 0.6, changeFrequency: 'hourly' as const },
    // /rv-iv, /options-iv, /max-pain → /options (consolidated May 2026).
    // /health and /changelog removed — both are admin-gated at runtime
    // (5daf10c6), so leaving them in the sitemap meant Google indexed
    // them and users from search landed on "Admin access required" pages.
    // Add back here ONLY if the runtime gate is removed.

    // ─── API + developer ──────────────────────────────────────────────
    { path: '/developers',         priority: 0.8, changeFrequency: 'weekly' as const },
    { path: '/developers/docs',    priority: 0.8, changeFrequency: 'weekly' as const },
    { path: '/developers/webhooks', priority: 0.7, changeFrequency: 'monthly' as const },
    { path: '/pricing',            priority: 0.9, changeFrequency: 'weekly' as const },
    { path: '/api-docs',           priority: 0.5, changeFrequency: 'weekly' as const },

    // ─── Guides + content ─────────────────────────────────────────────
    { path: '/guides',             priority: 0.6, changeFrequency: 'weekly' as const },
    { path: '/guides/funding-rate-arbitrage',         priority: 0.6, changeFrequency: 'monthly' as const },
    { path: '/guides/reading-open-interest',          priority: 0.6, changeFrequency: 'monthly' as const },
    { path: '/guides/surviving-liquidation-cascades', priority: 0.6, changeFrequency: 'monthly' as const },
    // /changelog dropped — admin-gated (see comment at /health above).
    { path: '/faq',                priority: 0.5, changeFrequency: 'monthly' as const },

    // ─── Account + auth ───────────────────────────────────────────────
    { path: '/login',              priority: 0.4, changeFrequency: 'monthly' as const },
    { path: '/signup',             priority: 0.4, changeFrequency: 'monthly' as const },
    { path: '/dashboard',          priority: 0.6, changeFrequency: 'daily' as const },
    { path: '/watchlist',          priority: 0.5, changeFrequency: 'daily' as const },
    { path: '/alerts',             priority: 0.6, changeFrequency: 'daily' as const },
    { path: '/portfolio',          priority: 0.5, changeFrequency: 'daily' as const },
    { path: '/positions',          priority: 0.5, changeFrequency: 'daily' as const },
    { path: '/referrals',          priority: 0.4, changeFrequency: 'monthly' as const },
    { path: '/invite/leaderboard', priority: 0.5, changeFrequency: 'hourly' as const },

    // ─── Bounce (rekt leaderboard) ────────────────────────────────────
    { path: '/bounce',             priority: 0.6, changeFrequency: 'daily' as const },
    { path: '/bounce/leaderboard', priority: 0.6, changeFrequency: 'hourly' as const },
    { path: '/bounce/check',       priority: 0.5, changeFrequency: 'monthly' as const },
    { path: '/bounce/claim',       priority: 0.4, changeFrequency: 'monthly' as const },

    // ─── Legal + brand ────────────────────────────────────────────────
    { path: '/brand',              priority: 0.4, changeFrequency: 'monthly' as const },
    { path: '/team',               priority: 0.4, changeFrequency: 'monthly' as const },
    { path: '/donate',             priority: 0.3, changeFrequency: 'monthly' as const },
    { path: '/terms',              priority: 0.3, changeFrequency: 'monthly' as const },
    { path: '/privacy',            priority: 0.3, changeFrequency: 'monthly' as const },
  ];

  const staticEntries = pages.map(({ path, priority, changeFrequency }) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));

  // Dynamic routes for top symbols. Coinglass + competitors index hundreds
  // of /symbol/<X> pages; we publish 50 high-traffic symbols. The dynamic
  // /symbol/[symbol] page renders for ANY symbol, but only the ones in
  // this list get crawled by default — long-tail symbols are still
  // accessible directly.
  const topSymbols = [
    // Top 10 by market cap
    'BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE', 'ADA', 'AVAX', 'LINK', 'TRX',
    // Memes + AI + new narratives
    'PEPE', 'WIF', 'BONK', 'FLOKI', 'SHIB', 'TAO', 'FET', 'RENDER', 'WLD',
    // L2 + DeFi
    'OP', 'ARB', 'MATIC', 'UNI', 'AAVE', 'MKR', 'CRV', 'PENDLE', 'ENA', 'JUP',
    // L1 alts
    'DOT', 'NEAR', 'SUI', 'APT', 'FIL', 'ATOM', 'TIA', 'SEI', 'INJ', 'TON',
    // Stablecoins + payment
    'USDT', 'USDC',
    // Perps-native + emerging
    'HYPE', 'DYDX', 'GMX',
    // Established large caps
    'LTC', 'BCH', 'ETC', 'XLM', 'HBAR',
  ];

  const symbolEntries = topSymbols.flatMap((s) => [
    { url: `${base}/symbol/${s}`,  lastModified: new Date(), changeFrequency: 'hourly' as const, priority: 0.6 },
    { url: `${base}/funding/${s}`, lastModified: new Date(), changeFrequency: 'hourly' as const, priority: 0.7 },
  ]);

  const coinEntries = [
    'bitcoin', 'ethereum', 'solana', 'ripple', 'dogecoin', 'cardano', 'avalanche-2',
    'chainlink', 'polkadot', 'uniswap', 'near', 'arbitrum', 'optimism', 'sui', 'aptos',
  ].map((id) => ({
    url: `${base}/coin/${id}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.5,
  }));

  return [...staticEntries, ...symbolEntries, ...coinEntries];
}
