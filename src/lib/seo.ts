import type { Metadata } from 'next';
import { ALL_EXCHANGES } from '@/lib/constants';

type OGVariant =
  | 'default'
  | 'tape'         // hero variant — only /home + landing pages opt in
  | 'funding'
  | 'liquidations'
  | 'oi'
  | 'screener'
  | 'news'
  | 'heatmap'
  | 'chart'
  | 'donate'
  | 'ratios'
  | 'etf'
  | 'options';

type PageMeta = {
  title: string;
  description: string;
  ogDesc?: string;
  noIndex?: boolean;
  ogVariant?: OGVariant;
};

// Maps a path to its OG variant when `ogVariant` isn't explicitly set.
// Substring match on path (so e.g. /funding-heatmap → 'heatmap').
const VARIANT_BY_PATH_PREFIX: { match: string; variant: OGVariant }[] = [
  { match: 'funding-heatmap', variant: 'heatmap' },
  { match: 'liquidation-heatmap', variant: 'heatmap' },
  { match: 'rsi-heatmap', variant: 'heatmap' },
  { match: 'stock-heatmap', variant: 'heatmap' },
  { match: 'market-heatmap', variant: 'heatmap' },
  { match: 'oi-heatmap', variant: 'heatmap' },
  { match: 'liquidations', variant: 'liquidations' },
  { match: 'liq-', variant: 'liquidations' },
  { match: 'open-interest', variant: 'oi' },
  { match: 'oi-', variant: 'oi' },
  { match: 'longshort', variant: 'ratios' },
  { match: 'long-short', variant: 'ratios' },
  { match: 'funding', variant: 'funding' },
  { match: 'screener', variant: 'screener' },
  { match: 'top-movers', variant: 'screener' },
  { match: 'momentum', variant: 'screener' },
  { match: 'breakouts', variant: 'screener' },
  { match: 'outperformers', variant: 'screener' },
  { match: 'trending-tokens', variant: 'screener' },
  { match: 'news', variant: 'news' },
  { match: 'economic-calendar', variant: 'news' },
  { match: 'token-unlocks', variant: 'news' },
  { match: 'airdrops', variant: 'news' },
  { match: 'listings', variant: 'news' },
  { match: 'donate', variant: 'donate' },
  { match: 'referrals', variant: 'donate' },
  { match: 'points', variant: 'donate' },
  { match: 'chart', variant: 'chart' },
  { match: 'symbol', variant: 'chart' },
  { match: 'coin', variant: 'chart' },
  { match: 'fear-greed', variant: 'chart' },
  { match: 'etf', variant: 'etf' },
  { match: 'hl-vaults', variant: 'etf' },
  { match: 'staking', variant: 'etf' },
  { match: 'options-iv', variant: 'options' },
  { match: 'max-pain', variant: 'options' },
  { match: 'options', variant: 'options' },
];

/**
 * Resolve which OG-image variant to use for a given page path.
 *
 * If the page metadata has `ogVariant` set explicitly, use it.
 * Otherwise scan VARIANT_BY_PATH_PREFIX in declared order and use
 * the first substring match. Falls back to 'default' if nothing
 * matches.
 *
 * Order matters in VARIANT_BY_PATH_PREFIX: longer / more-specific
 * matches come first ('funding-heatmap' → 'heatmap' must beat
 * 'funding' → 'funding').
 */
export function pickVariant(path: string, explicit?: OGVariant): OGVariant {
  if (explicit) return explicit;
  const p = path.replace(/^\//, '').toLowerCase();
  for (const entry of VARIANT_BY_PATH_PREFIX) {
    if (p.includes(entry.match)) return entry.variant;
  }
  return 'default';
}

export const PAGE_META: Record<string, PageMeta> = {
  '/etf': {
    title: 'Crypto ETF Tracker',
    description: 'Track Bitcoin and Ethereum spot ETF funds — IBIT, FBTC, GBTC, ETHA, and more. Compare fees, issuers, and fund performance.',
  },
  '/orderflow': {
    title: 'Order Flow',
    description: 'Real-time order book depth, trade tape, and buy/sell pressure for Bitcoin and top crypto perpetual futures.',
  },
  '/funding': {
    title: 'Funding Rates',
    description: `Live perpetual futures funding rates across ${ALL_EXCHANGES.length}+ exchanges. Compare rates, find arbitrage opportunities, and track funding trends in real-time.`,
  },
  '/open-interest': {
    title: 'Open Interest',
    description: `Aggregate open interest data across ${ALL_EXCHANGES.length}+ crypto derivatives exchanges. Track OI changes, spot trends, and analyze market positioning.`,
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
    title: 'Prediction Market Arbitrage Scanner',
    description: 'Find mispriced bets across Polymarket & Kalshi. Real-time arbitrage scanner with liquidity scoring, quality filters, and cross-platform spread detection.',
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
    description: 'Real-time crypto news from 21+ sources — CoinDesk, The Block, Cointelegraph, Decrypt, CryptoSlate, and more. Filter by time, source type, and sentiment.',
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
    description: 'Crypto derivatives REST API across 32 exchanges. Real-time funding rates, open interest, liquidations, spreads, arbitrage, options, and on-chain whale data. OpenAPI 3.1 spec with full fee transparency.',
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
    description: 'Two traders. One frustration: every derivatives tool was ugly, expensive, or both. Meet 0x.0celot and snakether, the people building InfoHub.',
  },
  '/terms': {
    title: 'Terms of Service',
    description: 'InfoHub terms of service and legal information.',
  },
  '/privacy': {
    title: 'Privacy Policy',
    description: 'InfoHub privacy policy — how we handle your data, analytics, cookies, and your rights.',
  },
  '/hl-whales': {
    title: 'Hyperliquid Whale Tracker',
    description: 'Track Hyperliquid whale positions, large trades, and notable trader activity in real-time.',
  },
  '/whale-alert': {
    title: 'Whale Alert',
    description: 'Real-time whale liquidation alerts across Binance, Bybit, OKX, and more. Monitor large liquidation events as they happen.',
  },
  '/portfolio': {
    title: 'Portfolio Tracker',
    description: 'Track your crypto derivatives portfolio with live prices, P&L, and allocation breakdown.',
  },
  '/watchlist': {
    title: 'Watchlist',
    description: 'Create a custom watchlist of perpetual futures. Track prices, funding rates, and open interest for your favorite pairs.',
  },
  '/exchange-comparison': {
    title: 'Exchange Comparison',
    description: 'Compare crypto derivatives exchanges side by side. Analyze open interest, funding rates, volume, and symbol coverage.',
  },
  '/stablecoin-flows': {
    title: 'Stablecoin Flows',
    description: 'Track stablecoin market cap, chain distribution, and flows. Monitor USDT, USDC, and other stablecoin trends.',
  },
  '/exchange-reserves': {
    title: 'Exchange Reserves',
    description: 'Monitor crypto exchange reserves and balance changes. Track Bitcoin and stablecoin holdings across major exchanges.',
  },
  '/oi-heatmap': {
    title: 'OI Change Heatmap',
    description: 'Open interest change heatmap across crypto perpetual futures. Visualize which assets are gaining or losing OI in real-time.',
  },
  '/bitcoin-treasuries': {
    title: 'Bitcoin Treasuries',
    description: 'Track the largest corporate, ETF, and government Bitcoin holdings. MicroStrategy, BlackRock IBIT, Fidelity FBTC, and more.',
  },
  '/liquidation-map': {
    title: 'Liquidation Map',
    description: 'Estimated liquidation clusters for BTC, ETH, and SOL based on common leverage tiers and real open interest data. Visualize where leveraged positions would get liquidated.',
  },
  '/market-cycle': {
    title: 'Market Cycle Indicators',
    description: 'Bitcoin on-chain models and technical cycle indicators. Pi Cycle Top, Rainbow Chart, 200-Week MA Heatmap, and Stock-to-Flow model.',
  },
  '/onchain': {
    title: 'On-Chain Metrics',
    description: 'Bitcoin on-chain analytics — hash rate, mining difficulty, miner revenue, Puell Multiple, MVRV Z-Score, mempool fees, and transaction volume.',
  },
  '/liquidation-heatmap': {
    title: 'Liquidation Heatmap',
    description: 'Real-time forced liquidation density heatmap from Binance and OKX. Visualize liquidation clusters by price and time for BTC, ETH, and SOL.',
  },
  '/chart': {
    title: 'Chart',
    description: 'Professional cryptocurrency charting with technical indicators powered by TradingView lightweight-charts.',
  },
  '/guides': {
    title: 'Trading Guides',
    description: 'Trading guides written by traders, not SEO writers. Funding rate arbitrage end-to-end, reading open interest, surviving liquidation cascades, and more.',
  },
  '/wallet-tracker': {
    title: 'Wallet Tracker',
    description: 'Track any Hyperliquid wallet in real-time. View open positions, PnL, trade history, and portfolio performance.',
  },
  '/execution-costs': {
    title: 'Execution Costs',
    description: 'Compare real-time execution costs across DEX perpetual exchanges. Fees, spread, price impact, and orderbook depth for Hyperliquid, dYdX, Drift, Aster, and more.',
  },
  '/stock-heatmap': {
    title: 'Stock Heatmap',
    description: 'Real-time stock market heatmap — S&P 500, US stocks, and global equities. Visualize performance by sector, market cap, and timeframe.',
  },
  '/airdrops': {
    title: 'Airdrop Tracker',
    description: 'Track upcoming and active crypto airdrops. Filter by status, chain, and requirements. Never miss a free token distribution.',
  },
  '/yields': {
    title: 'DeFi Yields',
    description: 'Compare DeFi yield opportunities across protocols and chains. Track APY, TVL, and risk metrics for lending, staking, and liquidity pools.',
  },
  '/developers': {
    title: 'Crypto Derivatives API · InfoHub',
    description: '26 endpoints, 32 exchanges, free 100 req/min tier. Real-time funding rates, OI, liquidations, fee-aware arbitrage grading, multi-venue klines fallback, on-chain whale data. OpenAPI 3.1 spec, X-RateLimit headers, no credit card required.',
  },
  '/home': {
    title: 'Live Crypto Derivatives Dashboard',
    description: 'Real-time funding rates, open interest, liquidations, and arbitrage opportunities across 32 exchanges. Track BTC/ETH/SOL/altcoin perpetual futures with terminal-style precision.',
    ogVariant: 'tape',
  },
  '/spreads': {
    title: 'Price Spreads',
    description: 'Real-time cross-exchange price spread tracker for crypto perpetual futures. Compare bid/ask prices across 32 exchanges to find arbitrage opportunities.',
  },
  '/spread-scanner': {
    title: 'Spread Scanner',
    description: 'Scan for the largest price spreads across crypto exchanges in real time. Identify arbitrage opportunities across CEX and DEX venues.',
  },
  '/dashboard': {
    title: 'Dashboard · Command Center',
    description: 'Your InfoHub command center — equity, open positions, alerts, watched wallets, and connected exchanges in one personal view.',
  },
  '/account': {
    title: 'Account · Command Center',
    description: 'Your InfoHub account at a glance — connected venues, open positions, watched wallets, alerts, recent notifications, and quick actions for everything you trade.',
  },
  '/watch': {
    title: 'Wallet Watch · Hyperliquid + gTrade Position Alerts',
    description: 'Watch any Hyperliquid or gTrade wallet in real time. Get Telegram pings when they open or close positions, change size, near liq, take realized PnL, or pay funding. Free.',
  },
  '/health': {
    title: 'Endpoint Health',
    description: 'Live status of every InfoHub data endpoint, measured from your browser. Green = healthy, amber = degraded, red = error or timeout. Re-checks every 60s.',
  },
  '/changelog': {
    title: 'Changelog',
    description: 'What we have shipped recently. New features, fixes, and improvements to the InfoHub data terminal — admin-only release notes.',
  },
  '/positions': {
    title: 'Positions · Cross-Venue',
    description: 'Unified view of your open positions across connected accounts. Direction-aware funding, per-position health score, funding cost-of-carry, TP/SL, and liquidation distance.',
  },
  '/positions/tax': {
    title: 'Tax / Cost-Basis · FIFO',
    description: 'Aggregate cost-basis and realised PnL across every connected wallet and key. FIFO accounting over your entire trade history. Live for Hyperliquid, Binance, Bybit, and OKX.',
  },
  '/positions/journal': {
    title: 'Trade Journal',
    description: 'Every closed trade across your connected wallets and keys, with realised PnL, win rate, and a 90-day cumulative chart. Live for Hyperliquid, Binance, Bybit, and OKX.',
  },
  '/positions/simulate': {
    title: 'Pre-Trade Decision Engine',
    description: 'Plug in a hypothetical trade and see its impact on your book before you execute. Health score, liquidation distance, funding carry, and risk concerns surfaced.',
  },
  '/referrals': {
    title: 'Referrals',
    description: 'Earn rewards by referring traders to InfoHub. Share your link and get credit when friends sign up and use the platform.',
  },
  '/guides/funding-rate-arbitrage': {
    title: 'Funding Rate Arbitrage Guide',
    description: 'Learn how to profit from funding rate arbitrage across crypto derivatives exchanges. Step-by-step strategy guide with real examples.',
  },
  '/login': {
    title: 'Log In',
    description: 'Sign in to your InfoHub account to access watchlists, alerts, portfolio tracking, and personalized derivatives data.',
  },
  '/signup': {
    title: 'Sign Up',
    description: 'Create a free InfoHub account. Get access to real-time crypto derivatives data, alerts, watchlists, and more.',
  },
  '/profile': {
    title: 'Profile',
    description: 'Manage your InfoHub profile, account settings, and preferences.',
    noIndex: true,
  },
  '/settings': {
    title: 'Settings',
    description: 'Configure your InfoHub account settings, notifications, and display preferences.',
    noIndex: true,
  },
  '/forgot-password': {
    title: 'Forgot Password',
    description: 'Reset your InfoHub account password. Enter your email to receive a password reset link.',
    noIndex: true,
  },
  '/reset-password': {
    title: 'Reset Password',
    description: 'Set a new password for your InfoHub account.',
    noIndex: true,
  },
  '/developers/docs': {
    title: 'API Reference · InfoHub v1',
    description: '26 endpoints across funding, OI, tickers, klines, spreads, arbitrage, liquidations, options, on-chain whales, and more. Fee transparency with versioned schedule, aggregate=1 modes, X-RateLimit headers, OpenAPI 3.1 spec.',
  },
  '/guides/reading-open-interest': {
    title: 'How to Read Open Interest',
    description: 'Learn how to interpret open interest data for crypto perpetual futures. Understand what rising and falling OI means for price action and market positioning.',
  },
  '/guides/surviving-liquidation-cascades': {
    title: 'Surviving Liquidation Cascades',
    description: 'When leveraged positions unwind, prices move fast. Anatomy of a cascade, the 5 precursors that signal one coming, defensive + offensive playbooks, and a pre-cascade checklist drawing on the live signals InfoHub already tracks.',
  },
  '/gmx-traders': {
    title: 'GMX Traders Leaderboard',
    description: 'Top on-chain perpetual traders on GMX V2 (Arbitrum + Avalanche). Ranked by realized PnL, volume, and win rate. See their open positions, recent trades, and 30-day PnL sparklines.',
  },
  '/hl-traders': {
    title: 'Hyperliquid Traders Leaderboard',
    description: 'Top Hyperliquid perp traders ranked by window PnL. Live positions with leverage, entry price, and liquidation levels. Scanned across 34,000+ active accounts.',
  },
  '/trader': {
    title: 'Cross-Platform Trader Profile',
    description: 'Unified view of any wallet across GMX V2 (Arbitrum + Avalanche) and Hyperliquid. See all positions, total notional, unrealized PnL, and venue-specific stats in one place.',
  },
  '/funding-arb': {
    title: 'Funding Rate Arbitrage Scanner',
    description: 'Cross-exchange funding rate divergence scanner across 30+ venues. Identify cash-and-carry opportunities, annualized APR estimates, and CEX↔DEX arbs in real-time.',
  },
  '/smart-money': {
    title: 'Smart Money Wallets',
    description: 'Track wallets with proven alpha — high lifetime PnL, high volume, consistent win rate. See what the pros are positioned in right now with aggregate sentiment gauge.',
  },
  '/liquidation-levels': {
    title: 'Liquidation Levels & Cascade Forecast',
    description: 'Where are liquidations clustering? Empirical liquidation histogram from OKX + forecast of long/short clusters at each leverage tier using aggregate OI.',
  },
  '/points': {
    title: 'Points & Airdrop Hub',
    description: 'Curated directory of active crypto points programs — Hyperliquid, Aster, Lighter, Paradex, Backpack, Drift, and more. Deep-link to each program with your wallet pre-filled.',
  },
  '/compare-traders': {
    title: 'Compare Traders',
    description: 'Side-by-side comparison of up to 3 wallets across GMX V2 (Arbitrum + Avalanche) and Hyperliquid. Stats rolled up across venues with best-value highlighting.',
  },
  '/stablecoin-peg': {
    title: 'Stablecoin Peg Monitor',
    description: 'Live peg-deviation tracker for major USD stablecoins — USDT, USDC, DAI, FDUSD, PYUSD, USDe, and more. 25bp watch threshold · 100bp depeg alert · updates every 30 seconds.',
  },
  '/protocol-revenue': {
    title: 'Protocol Revenue Leaderboard',
    description: 'Which crypto protocols actually make money. 24h / 7d / 30d fee revenue ranking across DEXs, perps, lending, L1s, and stablecoin issuers — sourced from DeFiLlama.',
  },
  '/perp-dex-volume': {
    title: 'Perp DEX Volume Race',
    description: 'Daily and weekly market-share leaderboard for on-chain perp DEXs. Fees tracked in real time with implied notional volume, change%, and concentration stats.',
  },
  '/premiums': {
    title: 'Regional Premiums · Coinbase + Kimchi',
    description: 'Live BTC / ETH price gaps between Coinbase (US), Upbit (Korea), bitFlyer (Japan) and global Binance. Track institutional and regional demand in real time.',
  },
  '/gas-tracker': {
    title: 'Gas Tracker · Ethereum + L2s',
    description: 'Live gas prices and transaction costs across Ethereum mainnet, Base, Arbitrum, Optimism, Polygon, and BNB Chain. Transfer and swap cost estimates in USD.',
  },
  '/altseason': {
    title: 'Altseason Index',
    description: 'Live Altseason Index — % of top-50 altcoins outperforming Bitcoin over 90 days. BTC dominance, stablecoin share, and per-coin relative performance.',
  },
  '/leverage': {
    title: 'Leverage Dashboard',
    description: 'OI-weighted funding rates, spot-vs-perp volume ratio, and aggregate leverage pressure across 32 venues. One lens on real positioning vs retail noise.',
  },
  '/bounce': {
    title: 'bounce.tech on InfoHub · Leveraged Tokens + Rekt Profiles',
    description: 'Check any Hyperliquid wallet\'s bounce.tech rekt profile: liquidation score, per-asset breakdown, monthly history, and claim status. Plus an overview of bounce.tech\'s leveraged-tokens protocol on HyperEVM.',
  },
  '/bounce/leaderboard': {
    title: 'Rekt Leaderboard · Biggest Hyperliquid Liquidations',
    description: 'Most-liquidated wallets on Hyperliquid scored 0-1000 by bounce.tech. The worse the rekt, the bigger the potential BOUNCE claim.',
  },
  '/bounce/check': {
    title: 'Check Wallet Rekt Profile · bounce.tech',
    description: 'Look up any Hyperliquid-active wallet to see its bounce.tech rekt profile — score, per-asset breakdown, monthly history, claim status.',
  },
  '/bounce/claim': {
    title: 'How to Claim BOUNCE · Rekt Rebate Guide',
    description: 'Step-by-step walkthrough for claiming BOUNCE tokens for your Hyperliquid liquidation history. Check score, register, claim.',
  },
  '/donate': {
    title: 'Support InfoHub · Crypto Donations',
    description: 'Help keep InfoHub free, no-ads, no-signup. Accepting BTC, ETH (+ all L2s), SOL, HYPE, USDT-TRC20. Every tip funds hosting, APIs, and shipping velocity.',
  },
  '/outperformers': {
    title: 'Altcoin Outperformance · vs BTC + ETH',
    description: 'Which altcoins are beating BTC and ETH over the rolling window. Sort by relative performance, top-100 screened, stablecoins + BTC/ETH wrappers excluded.',
  },
  '/skew': {
    title: 'Options Skew · Put-Call IV per Expiry',
    description: 'Live put-call IV skew per Deribit expiry for BTC + ETH. Negative skew (calls richer than puts) is rare and historically a top warning signal — track it across the term structure.',
  },
  '/cme-basis': {
    title: 'CME Basis · BTC + ETH Cash-and-Carry',
    description: 'CME front-month BTC and ETH futures premium vs spot, annualized to expiry. Real cash-and-carry rate institutions can earn — hot basis (>15% APR) marks risk-on regimes.',
  },
  '/sectors': {
    title: 'Sector Rotation · Crypto Money Flow Map',
    description: 'Which crypto sectors money is flowing into right now. 24h market-cap change heatmap across 27 sectors — AI, DeFi, L2s, RWA, memes — to spot rotations as they form.',
  },
  '/cycle-phase': {
    title: 'BTC Cycle Phase · Composite of 5 Signals',
    description: 'Where in the cycle are we? Hash Ribbons + Puell Multiple + MVRV Z-score + funding regime + price-vs-200d-SMA synthesised into a single phase tag with confidence.',
  },
  '/etf-flows': {
    title: 'ETF Flows · Daily Net BTC + ETH Spot Flows',
    description: 'Daily net inflows / outflows for every US spot Bitcoin and Ethereum ETF, sourced from Farside. Cumulative 7d / 30d totals + per-issuer breakdown.',
  },
  '/etf-counterfactual': {
    title: 'BTC without ETF Flows · Counterfactual Model',
    description: 'Where would BTC be trading if spot ETFs hadn’t been bidding? Linear regression of daily ETF net flows against price returns, then strip the flow contribution out.',
  },
  '/cliff-watch': {
    title: 'Cliff Watch · Major Token Vesting Cliffs',
    description: 'Upcoming cliff vesting events that drop large supply tranches all at once. Tracks the biggest single-day unlocks alongside investor / team / treasury attribution.',
  },
  '/crowdedness': {
    title: 'Crowdedness Score · Position-Side Imbalance',
    description: 'Composite crowdedness across funding, OI growth, long/short ratio. Extreme readings precede squeezes / flushes — see which symbols are most one-sided.',
  },
  '/crypto-stocks': {
    title: 'Crypto Stocks · MSTR + COIN + Miners',
    description: 'Live prices and momentum for crypto-exposed equities — MSTR, COIN, MARA, RIOT, CLSK, HUT and more. Premium / discount to NAV for the BTC-treasuries.',
  },
  '/fomc-playbook': {
    title: 'FOMC Playbook · Crypto Reaction Patterns',
    description: 'Crypto’s historical reaction to every FOMC decision — hike, hold, cut, dot-plot revisions — broken down by 1h / 4h / 24h price moves with median + IQR.',
  },
  '/funding-countdown': {
    title: 'Funding Countdown · Next Settlement Per Venue',
    description: 'Real-time countdown to the next funding settlement on every perp exchange, with predicted rates based on the live mark-vs-index gap.',
  },
  '/funding-flips': {
    title: 'Funding Flips · Sign Changes Across Venues',
    description: 'Symbols where funding just flipped from positive to negative (longs paying → shorts paying) or vice versa across exchanges — leading sentiment indicator.',
  },
  '/funding-leaderboard': {
    title: 'Funding Leaderboard · Highest + Most Negative Rates',
    description: 'Top symbols by absolute funding rate across every venue. The most-stressed positions today — either crowded longs paying through the nose or aggressive shorts.',
  },
  '/funding-paid': {
    title: 'Funding Paid 30d · Cumulative Cost Per Symbol',
    description: '30-day cumulative funding paid (or earned) per perpetual futures pair — useful for sizing the carry cost / yield of a delta-neutral or directional position.',
  },
  '/funding-predictor': {
    title: 'Funding Predictor · Next Settlement Forecast',
    description: 'Forecast the next funding rate at every venue using live mark / index basis and recent rate momentum. Spot upcoming rate spikes before they print.',
  },
  '/hash-ribbons': {
    title: 'Hash Ribbons · Bitcoin Miner Capitulation Signal',
    description: 'Live Hash Ribbons (30d / 60d hash rate moving averages). When the 30d crosses below the 60d, miners are capitulating — historically a multi-month BTC bottom signal.',
  },
  '/memecoin-radar': {
    title: 'Memecoin Radar · Trending On-Chain Tokens',
    description: 'Live trending memecoins from Solana, Base, and Hyperliquid — sorted by volume momentum, holder growth, and freshness. Catch the rotation before it tops.',
  },
  '/orderbook-imbalance': {
    title: 'Order Book Imbalance · Bid/Ask Pressure',
    description: 'Live bid vs ask depth imbalance for top symbols. Heavy bid-side pressure = absorption / squeeze setup; heavy ask-side = distribution / breakdown setup.',
  },
  '/restaking-delta': {
    title: 'Restaking Delta · TVL + APY Movements',
    description: '30-day change in TVL and APY across every liquid restaking pool. Spot which protocols are gaining share and which are bleeding outflows.',
  },
  '/rv-iv': {
    title: 'Realised vs Implied Vol · Premium Tracker',
    description: 'Live realised volatility vs Deribit implied vol for BTC + ETH at multiple horizons. RV>IV = options under-priced; IV>RV = vol-sellers harvesting premium.',
  },
  '/smart-money-composite': {
    title: 'Smart Money Composite · Aggregate Positioning',
    description: 'Aggregate sentiment gauge built from top traders’ positioning across Hyperliquid + GMX V2. Net long/short bias, leaderboard alignment, conviction score.',
  },
  '/social': {
    title: 'KOL Feed · Crypto Twitter Signal',
    description: 'Live feed of high-signal crypto Twitter posts from a curated list of traders, analysts, and protocol leads. $TICKERS auto-linked, no algorithmic ranking noise.',
  },
  '/stablecoin-supply': {
    title: 'Stablecoin Supply · Total Issued + 7d / 30d Change',
    description: 'Live supply across USDT, USDC, DAI, FDUSD, PYUSD, USDe and more. 7d / 30d issuance changes — net stablecoin inflow into crypto is a leading risk-on indicator.',
  },
  '/tge-calendar': {
    title: 'TGE Calendar · Upcoming Token Generation Events',
    description: 'Upcoming token generation events with FDV, initial circulating supply, vesting cliff, funding raised, and chain. Listings historically pump 30-200% in the first 24h.',
  },
  '/trade-optimizer': {
    title: 'Trade Optimizer · Best Venue + Size + Slippage',
    description: 'Given size, side and asset, find the venue with the best execution: lowest fee, smallest slippage, deepest book, and least adverse funding.',
  },
  '/validators': {
    title: 'Validator Economics · LST + Restaking Yields',
    description: 'Live yields from validator staking + liquid-staking pools across ETH, SOL, NEAR, ATOM, MATIC and more. Cross-protocol APY ranking with TVL + risk metadata.',
  },
  '/volume-share': {
    title: 'CEX vs DEX Volume Share · Daily Trend',
    description: 'On-chain perp DEXs vs centralized exchange perp volume — the rolling DEX market share trend. Daily and weekly tracking with leader concentration.',
  },
  '/whale-liq': {
    title: 'Whale Liquidation Roulette · Near-Liq HL Positions',
    description: 'Live tracker of Hyperliquid whale positions sitting near their liquidation price. Sorted by distance to liq with notional, leverage, and PnL — see who is about to get rekt.',
  },
  '/restaking': {
    title: 'Restaking Yields · EigenLayer + Symbiotic + Karak + LRTs',
    description: 'Aggregated APY + TVL for liquid restaking pools across EigenLayer, Symbiotic, Karak, EtherFi, Renzo, Kelp, Puffer, and more. Sorted by TVL with reward token + risk metadata.',
  },
  '/bridge-flows': {
    title: 'Cross-Chain Bridge Flow Map · Wormhole',
    description: 'Live cross-chain volume + transfer counts via Wormhole. Source→destination chain matrix, top assets being bridged, and ranked corridors over 24h / 7d / 30d windows.',
  },
  '/earnings-calendar': {
    title: 'Crypto Earnings Calendar · Unlocks + TGEs + Mainnets',
    description: 'Upcoming crypto schedule events grouped by ISO week — token unlocks, TGEs, halvings, governance votes, and mainnet launches with USD impact estimates.',
  },
  '/backtest': {
    title: 'Strategy Backtest Lab · DCA + Funding Carry',
    description: 'Run historical simulations of dollar-cost-averaging and funding-carry strategies on real on-chain price + funding data. Sharpe, max drawdown, daily series with one click.',
  },
  '/listing-radar': {
    title: 'Pre-Listing Leak Tracker · Listing Radar',
    description: 'Real-time CEX listing announcements from Binance/Coinbase/OKX. Listings historically pump 30-200% in the first 24h — track which announcements are still inside the front-run window.',
  },
  '/smart-money/leaderboard': {
    title: 'Top Hyperliquid Traders · Realized PnL Leaderboard',
    description: 'Top wallets ranked by closing-trade PnL over the last 90 days on Hyperliquid. Per-trader win rate, biggest single trade, top symbols, and click into full position detail.',
  },
  '/exchange-fees': {
    title: 'Exchange Fee Comparison · 20 CEX + DEX',
    description: 'Maker and taker fees side-by-side across Binance, Bybit, OKX, Bitget, MEXC, Kraken, Coinbase, BingX, KuCoin, Hyperliquid, GMX, dYdX, Aster, Lighter, and more. Affiliate commission rates included.',
  },
  '/max-pain': {
    title: 'Max Pain Tracker · BTC + ETH Options Expiries',
    description: 'Max pain strike for every BTC and ETH options expiry on Deribit. Weighted average, spot-to-pain gap, next big expiry callout, dealer-hedging pressure direction.',
  },
  '/breakouts': {
    title: 'Breakout Scanner · Near ATH, 24h Highs, Strong Trends',
    description: 'Crypto breakout screener across 220+ liquid coins. Five signal modes: near all-time high, 24h breakout, multi-window uptrend, breakdown to ATL, and recovery plays.',
  },
  '/hl-vaults': {
    title: 'Hyperliquid Vaults',
    description: 'Public vaults on Hyperliquid ranked by TVL, APR, and PnL across day/week/month/all-time. See every active leader vault on HL, their age, size, and performance.',
  },
  '/staking': {
    title: 'Staking + Restaking Yields',
    description: 'Ethereum liquid staking (LST), liquid restaking (LRT), and synthetic yield protocols ranked by TVL. Lido, Rocket Pool, Ether.fi, Renzo, Kelp, Ethena, Usual, and more. Base + reward APY, 30d mean, 7d change.',
  },
  '/options-iv': {
    title: 'Options IV Dashboard · BTC + ETH',
    description: 'Implied vol term structure, put/call OI ratio, 25-delta skew, and max pain per expiry for BTC and ETH options. Real-time data from Deribit.',
  },
  '/momentum': {
    title: 'Momentum Screener',
    description: 'Crypto momentum setup screener scoring coins on price move, volume surge, funding alignment, and OI backing. Surfaces long-biased and short-biased setups across 30+ venues.',
  },
  '/liq-calculator': {
    title: 'Liquidation Calculator',
    description: 'Linear perp liquidation price, breakeven, and PnL scenarios. Given entry, leverage, margin, and maintenance margin, computes your liquidation price and risk tier. USDT/USDC-margined BTC, ETH, alts.',
  },
  '/listings': {
    title: 'Exchange Listings Tracker',
    description: 'New listings and delistings from Binance, Bybit, OKX, Coinbase, Upbit, Kraken, MEXC, KuCoin, and more, aggregated from official announcements. Spot, perps, futures, and earn products.',
  },
  '/trending-tokens': {
    title: 'Trending Tokens · Memecoin Screener',
    description: 'Boosted / promoted tokens across Solana, Ethereum, Base, BNB Chain, and more. Live price, volume, buy/sell ratio, liquidity, and age via DexScreener. Raw memecoin screener for hunters.',
  },
  '/position-size': {
    title: 'Position Size Calculator · R:R + Kelly',
    description: 'Compute exact position size given account, risk %, entry, and stop. Plus R:R ratio, leverage required, take-profit scenarios, and Kelly sizing for systematic traders.',
  },
  '/trader-watch': {
    title: 'Trader Watch · Live positions',
    description: 'Watch traders across GMX, Hyperliquid, and gTrade on one screen. Star any trader and see their open positions, leverage, liq distance, and funding exposure live — no more 5 tabs to copy-trade.',
  },
};

export function pageMetadata(path: string): Metadata {
  const meta = PAGE_META[path];
  if (!meta) return {};

  const variant = pickVariant(path, meta.ogVariant);
  const ogUrl = `/api/og?title=${encodeURIComponent(meta.title)}&desc=${encodeURIComponent(meta.ogDesc || meta.description)}&v=${variant}`;

  const result: Metadata = {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: `https://info-hub.io${path}`,
    },
    openGraph: {
      title: `${meta.title} | InfoHub`,
      description: meta.ogDesc || meta.description,
      images: [ogUrl],
    },
    twitter: {
      title: `${meta.title} | InfoHub`,
      description: meta.ogDesc || meta.description,
      images: [ogUrl],
    },
  };

  if (meta.noIndex) {
    result.robots = { index: false, follow: false };
  }

  return result;
}
