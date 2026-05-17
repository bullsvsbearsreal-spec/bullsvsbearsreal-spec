'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Search, X, ArrowRight,
  Activity, BarChart3, Heart, Briefcase, MoreHorizontal,
  SlidersHorizontal, Percent, Grid3X3, PieChart, Zap, ArrowLeftRight,
  LineChart, Shield, BarChart2, Crosshair,
  Rocket, Map, Crown, Building2, Landmark, Coins, GitCompareArrows, Unlock, Bitcoin, TrendingUp, TrendingDown,
  Thermometer, Fish, Eye, Newspaper,
  Star, GitCompare, Bell, Wallet, Search as SearchIcon,
  Calendar, Palette, Users, BookOpen, Gift, Keyboard, Clock,
  Globe, Sparkles, Gauge, Fuel, Trophy, Brain, AlertTriangle, Gem, DollarSign, Flame, Vault, Layers, Sigma, Calculator,
  type LucideIcon,
} from 'lucide-react';
import { CoinSearchResult } from '@/lib/api/coingecko';
import { getRecentlyViewed, type RecentItem } from '@/lib/storage/recentlyViewed';
import { TokenIconSimple } from './TokenIcon';

/* ------------------------------------------------------------------ */
/*  Page registry — every navigable page with search keywords          */
/* ------------------------------------------------------------------ */

interface PageEntry {
  name: string;
  href: string;
  icon: LucideIcon;
  keywords: string[];
  category: string;
}

const pageRegistry: PageEntry[] = [
  // Trading > Analysis
  { name: 'Chart', href: '/chart', icon: LineChart, keywords: ['chart', 'tradingview', 'candle', 'price', 'technical'], category: 'Trading' },
  { name: 'Screener', href: '/screener', icon: SlidersHorizontal, keywords: ['screener', 'filter', 'scan', 'search', 'find'], category: 'Trading' },
  { name: 'Options', href: '/options', icon: Shield, keywords: ['options', 'greeks', 'vol', 'volatility', 'puts', 'calls', 'skew'], category: 'Trading' },
  { name: 'Basis', href: '/basis', icon: BarChart2, keywords: ['basis', 'contango', 'backwardation', 'premium', 'spot', 'perp'], category: 'Trading' },
  { name: 'Prediction Markets', href: '/prediction-markets', icon: Eye, keywords: ['prediction', 'polymarket', 'bet', 'forecast'], category: 'Trading' },
  { name: 'Price Spreads', href: '/spreads', icon: ArrowLeftRight, keywords: ['spread', 'price', 'arb', 'difference', 'cross-exchange'], category: 'Trading' },
  { name: 'Spread Scanner', href: '/spread-scanner', icon: ArrowLeftRight, keywords: ['spread', 'scanner', 'arb', 'multi', 'compare'], category: 'Trading' },
  { name: 'Execution Costs', href: '/execution-costs', icon: Crosshair, keywords: ['execution', 'cost', 'slippage', 'dex', 'fee'], category: 'Trading' },
  // Trading > Funding & OI
  { name: 'Funding Rates', href: '/funding', icon: Percent, keywords: ['funding', 'rate', 'perp', 'perpetual', '8h', 'annual', 'arb', 'arbitrage'], category: 'Trading' },
  { name: 'Funding Heatmap', href: '/funding-heatmap', icon: Grid3X3, keywords: ['funding', 'heatmap', 'visual', 'grid'], category: 'Trading' },
  { name: 'Open Interest', href: '/open-interest', icon: PieChart, keywords: ['open interest', 'oi', 'positions', 'contracts', 'delta'], category: 'Trading' },
  { name: 'OI Heatmap', href: '/oi-heatmap', icon: Grid3X3, keywords: ['oi', 'open interest', 'heatmap'], category: 'Trading' },
  // Trading > Liquidations
  { name: 'Liquidations', href: '/liquidations', icon: Zap, keywords: ['liquidation', 'liq', 'rekt', 'cascade', 'whale', 'feed'], category: 'Trading' },
  { name: 'Liquidation Map', href: '/liquidation-map', icon: Crosshair, keywords: ['liquidation', 'map', 'levels', 'clusters'], category: 'Trading' },
  { name: 'Liquidation Heatmap', href: '/liquidation-heatmap', icon: Grid3X3, keywords: ['liquidation', 'heatmap', 'liq'], category: 'Trading' },
  // Trading > Flow
  { name: 'Long/Short Ratio', href: '/longshort', icon: ArrowLeftRight, keywords: ['long', 'short', 'ratio', 'sentiment', 'positioning'], category: 'Trading' },
  { name: 'CVD', href: '/cvd', icon: LineChart, keywords: ['cvd', 'cumulative', 'volume', 'delta', 'buying', 'selling', 'pressure'], category: 'Trading' },
  { name: 'Order Flow', href: '/orderflow', icon: Activity, keywords: ['order', 'flow', 'tape', 'trades', 'aggressor'], category: 'Trading' },
  { name: 'RSI Heatmap', href: '/rsi-heatmap', icon: Activity, keywords: ['rsi', 'overbought', 'oversold', 'momentum', 'heatmap'], category: 'Trading' },
  // Markets
  { name: 'Top Movers', href: '/top-movers', icon: Rocket, keywords: ['movers', 'gainers', 'losers', 'top', 'biggest', 'change'], category: 'Markets' },
  { name: 'Market Heatmap', href: '/market-heatmap', icon: Map, keywords: ['market', 'heatmap', 'crypto', 'overview'], category: 'Markets' },
  { name: 'Stock Heatmap', href: '/stock-heatmap', icon: Map, keywords: ['stock', 'heatmap', 'equity', 'sp500'], category: 'Markets' },
  { name: 'Dominance', href: '/dominance', icon: Crown, keywords: ['dominance', 'btc', 'bitcoin', 'altseason', 'alt', 'market cap'], category: 'Markets' },
  { name: 'Market Cycle', href: '/market-cycle', icon: Activity, keywords: ['cycle', 'market', 'phase', 'bull', 'bear', 'macro'], category: 'Markets' },
  { name: 'Correlation', href: '/correlation', icon: GitCompareArrows, keywords: ['correlation', 'matrix', 'compare', 'relationship'], category: 'Markets' },
  { name: 'ETF Tracker', href: '/etf', icon: LineChart, keywords: ['etf', 'bitcoin', 'ethereum', 'spot', 'flows', 'institutional'], category: 'Markets' },
  { name: 'BTC Treasuries', href: '/bitcoin-treasuries', icon: Bitcoin, keywords: ['treasury', 'bitcoin', 'btc', 'corporate', 'holdings', 'microstrategy'], category: 'Markets' },
  { name: 'Token Unlocks', href: '/token-unlocks', icon: Unlock, keywords: ['unlock', 'token', 'vesting', 'schedule', 'release'], category: 'Markets' },
  { name: 'Airdrops', href: '/airdrops', icon: Gift, keywords: ['airdrop', 'free', 'claim', 'drop'], category: 'Markets' },
  { name: 'Exchange Reserves', href: '/exchange-reserves', icon: Landmark, keywords: ['reserve', 'exchange', 'balance', 'withdrawal', 'deposit'], category: 'Markets' },
  { name: 'Stablecoin Flows', href: '/stablecoin-flows', icon: Coins, keywords: ['stablecoin', 'usdt', 'usdc', 'flow', 'mint', 'burn'], category: 'Markets' },
  { name: 'On-Chain', href: '/onchain', icon: BarChart3, keywords: ['onchain', 'on-chain', 'blockchain', 'metrics', 'addresses'], category: 'Markets' },
  { name: 'DeFi Yields', href: '/yields', icon: TrendingUp, keywords: ['yield', 'defi', 'apy', 'apr', 'farm', 'staking'], category: 'Markets' },
  { name: 'Exchange Comparison', href: '/exchange-comparison', icon: Building2, keywords: ['exchange', 'compare', 'comparison', 'fees', 'volume'], category: 'Markets' },
  // Sentiment
  { name: 'Fear & Greed', href: '/fear-greed', icon: Thermometer, keywords: ['fear', 'greed', 'sentiment', 'index', 'mood'], category: 'Sentiment' },
  // /whale-alert → /liquidations (consolidated May 2026). Route directly
  // to /liquidations so the search palette doesn't bounce users through
  // a redirect — same keywords still surface the right page.
  { name: 'Whale Alert', href: '/liquidations', icon: Fish, keywords: ['whale', 'alert', 'large', 'transaction', 'transfer', 'liquidation'], category: 'Sentiment' },
  { name: 'HL Whales', href: '/hl-whales', icon: Eye, keywords: ['hyperliquid', 'whale', 'traders', 'top', 'positions', 'pnl'], category: 'Sentiment' },
  { name: 'News', href: '/news', icon: Newspaper, keywords: ['news', 'article', 'headline', 'crypto', 'feed'], category: 'Sentiment' },
  // Portfolio
  { name: 'Watchlist', href: '/watchlist', icon: Star, keywords: ['watchlist', 'watch', 'track', 'favorites', 'list'], category: 'Portfolio' },
  { name: 'Compare Coins', href: '/compare', icon: GitCompare, keywords: ['compare', 'side by side', 'vs', 'versus', 'coins'], category: 'Portfolio' },
  { name: 'Alerts', href: '/alerts', icon: Bell, keywords: ['alert', 'notification', 'price', 'trigger', 'alarm'], category: 'Portfolio' },
  { name: 'Portfolio', href: '/portfolio', icon: Wallet, keywords: ['portfolio', 'positions', 'pnl', 'holdings', 'balance'], category: 'Portfolio' },
  // /wallet-tracker → /watch (consolidated May 2026). Same direct-route
  // treatment as Whale Alert above.
  { name: 'Wallet Watch', href: '/watch', icon: SearchIcon, keywords: ['wallet', 'address', 'track', 'balance', 'multichain', 'watch', 'alerts'], category: 'Portfolio' },
  { name: 'Dashboard', href: '/dashboard', icon: BarChart3, keywords: ['dashboard', 'widgets', 'custom', 'home', 'overview'], category: 'Portfolio' },
  // More
  { name: 'Economic Calendar', href: '/economic-calendar', icon: Calendar, keywords: ['economic', 'calendar', 'events', 'fomc', 'cpi', 'macro'], category: 'More' },
  { name: 'Guides', href: '/guides', icon: BookOpen, keywords: ['guide', 'tutorial', 'learn', 'how to', 'education'], category: 'More' },
  { name: 'Brand Kit', href: '/brand', icon: Palette, keywords: ['brand', 'logo', 'assets', 'colors'], category: 'More' },
  { name: 'Developers', href: '/developers', icon: BookOpen, keywords: ['api', 'developer', 'key', 'docs', 'integrate'], category: 'More' },
  { name: 'API Docs', href: '/api-docs', icon: BookOpen, keywords: ['api', 'documentation', 'reference', 'endpoints'], category: 'More' },
  // New intel + trader pages
  { name: 'Regional Premiums', href: '/premiums', icon: Globe, keywords: ['premium', 'coinbase', 'kimchi', 'upbit', 'korean', 'us', 'japan', 'regional', 'spread'], category: 'Markets' },
  { name: 'Gas Tracker', href: '/gas-tracker', icon: Fuel, keywords: ['gas', 'gwei', 'ethereum', 'eth', 'base', 'arbitrum', 'optimism', 'polygon', 'l2'], category: 'Trading' },
  { name: 'Altseason Index', href: '/altseason', icon: Sparkles, keywords: ['altseason', 'altcoin', 'alt', 'btc', 'season', 'outperform'], category: 'Markets' },
  { name: 'Leverage Dashboard', href: '/leverage', icon: Gauge, keywords: ['leverage', 'oi weighted', 'funding', 'spot perp', 'ratio', 'positioning'], category: 'Trading' },
  { name: 'Stablecoin Peg Monitor', href: '/stablecoin-peg', icon: Activity, keywords: ['peg', 'stablecoin', 'usdt', 'usdc', 'dai', 'depeg', 'deviation'], category: 'Markets' },
  { name: 'Protocol Revenue', href: '/protocol-revenue', icon: DollarSign, keywords: ['revenue', 'fees', 'protocol', 'defi', 'llama'], category: 'Markets' },
  { name: 'Perp DEX Race', href: '/perp-dex-volume', icon: Trophy, keywords: ['perp', 'dex', 'volume', 'market share', 'hyperliquid', 'gmx', 'dydx'], category: 'Markets' },
  { name: 'Funding Arb Scanner', href: '/funding-arb', icon: ArrowLeftRight, keywords: ['funding', 'arb', 'arbitrage', 'spread', 'carry'], category: 'Trading' },
  { name: 'GMX Traders', href: '/gmx-traders', icon: Trophy, keywords: ['gmx', 'traders', 'leaderboard', 'arbitrum', 'avalanche', 'pnl'], category: 'Sentiment' },
  { name: 'HL Traders', href: '/hl-traders', icon: Zap, keywords: ['hyperliquid', 'traders', 'leaderboard', 'pnl'], category: 'Sentiment' },
  { name: 'Compare Traders', href: '/compare-traders', icon: GitCompareArrows, keywords: ['compare', 'traders', 'wallet', 'side by side'], category: 'Sentiment' },
  { name: 'Trader Watch · Bookmarked positions', href: '/trader-watch', icon: Star, keywords: ['trader', 'watch', 'star', 'bookmark', 'follow', 'copy trade', 'snake', 'shake', 'gmx', 'hyperliquid', 'gtrade', 'positions'], category: 'Sentiment' },
  { name: 'Invite Friends · Get your referral link', href: '/invite', icon: Gift, keywords: ['invite', 'referral', 'share', 'friend', 'refer', 'invite friend', 'invite code', 'invite link', 'share link', 'tell a friend'], category: 'More' },
  { name: 'Referral Leaderboard', href: '/invite/leaderboard', icon: Trophy, keywords: ['referral leaderboard', 'top referrers', 'invite leaderboard', 'ranking', 'top invites'], category: 'More' },
  { name: 'Liquidation Levels', href: '/liquidation-levels', icon: AlertTriangle, keywords: ['liquidation', 'levels', 'cluster', 'cascade', 'forecast'], category: 'Trading' },
  { name: 'Smart Money', href: '/smart-money', icon: Brain, keywords: ['smart money', 'alpha', 'whales', 'pnl', 'win rate'], category: 'Sentiment' },
  { name: 'Points Hub', href: '/points', icon: Gem, keywords: ['points', 'airdrop', 'farm', 'season', 'hyperliquid', 'aster', 'paradex', 'lighter'], category: 'Markets' },
  { name: 'Rekt Leaderboard', href: '/bounce/leaderboard', icon: Flame, keywords: ['rekt', 'liquidated', 'liquidation', 'bounce', 'bounce.tech', 'hyperliquid', 'loser', 'wallet', 'score', 'leaderboard'], category: 'Sentiment' },
  { name: 'bounce.tech Hub', href: '/bounce', icon: Flame, keywords: ['bounce', 'bounce.tech', 'leveraged tokens', 'rekt profile', 'liquidation score', 'claim', 'hypereVM', 'hyperliquid'], category: 'Sentiment' },
  { name: 'Check Wallet Rekt Profile', href: '/bounce/check', icon: Search, keywords: ['check', 'lookup', 'rekt profile', 'wallet', 'bounce.tech', 'liquidation'], category: 'Sentiment' },
  { name: 'Claim BOUNCE', href: '/bounce/claim', icon: Gift, keywords: ['claim', 'bounce', 'airdrop', 'rebate', 'register', 'rewards', 'how to claim'], category: 'Sentiment' },
  { name: 'HL Vaults', href: '/hl-vaults', icon: Vault, keywords: ['vault', 'vaults', 'hyperliquid', 'hl', 'leader', 'copy', 'trust', 'apr', 'tvl'], category: 'Sentiment' },
  { name: 'Staking + Restaking Yields', href: '/staking', icon: Layers, keywords: ['staking', 'restaking', 'lst', 'lrt', 'lido', 'rocket pool', 'ether.fi', 'renzo', 'kelp', 'ethena', 'usde', 'pendle'], category: 'Markets' },
  { name: 'Options · IV · Skew · Max Pain', href: '/options', icon: Sigma, keywords: ['iv', 'implied vol', 'skew', 'put call ratio', 'pcr', 'max pain', 'term structure', 'options', 'deribit', 'rv-iv', 'realized vol'], category: 'Trading' },
  { name: 'Momentum Screener', href: '/momentum', icon: Zap, keywords: ['momentum', 'screener', 'breakout', 'volume surge', 'squeeze', 'setup', 'scan'], category: 'Trading' },
  { name: 'Liquidation Calculator', href: '/liq-calculator', icon: Calculator, keywords: ['liquidation', 'calc', 'calculator', 'leverage', 'margin', 'liq price', 'position size', 'risk'], category: 'Trading' },
  { name: 'Exchange Listings', href: '/listings', icon: Bell, keywords: ['listing', 'listings', 'new listings', 'delisting', 'delist', 'binance', 'bybit', 'coinbase', 'announcement'], category: 'Sentiment' },
  { name: 'Trending Tokens', href: '/trending-tokens', icon: Rocket, keywords: ['trending', 'memes', 'memecoin', 'pump', 'solana', 'dexscreener', 'boosted', 'hot', 'new tokens'], category: 'Markets' },
  { name: 'Position Size Calculator', href: '/position-size', icon: Calculator, keywords: ['position size', 'sizing', 'risk', 'stop loss', 'r:r', 'reward', 'kelly', 'account size', 'calculator'], category: 'Trading' },
  { name: 'Donate (Crypto)', href: '/donate', icon: Gift, keywords: ['donate', 'donation', 'support', 'tip', 'sponsor', 'btc', 'eth', 'sol', 'usdt'], category: 'More' },
  { name: 'Altcoin Outperformance', href: '/outperformers', icon: Trophy, keywords: ['outperform', 'outperformance', 'vs btc', 'vs eth', 'beat btc', 'relative performance', 'altcoin'], category: 'Markets' },
  { name: 'Exchange Fee Comparison', href: '/exchange-fees', icon: DollarSign, keywords: ['fees', 'maker', 'taker', 'comparison', 'commission', 'trading fees', 'affiliate', 'rebate'], category: 'Markets' },
  // Max Pain folded into /options (May 2026) — entry above covers the keywords
  { name: 'Breakout Scanner', href: '/breakouts', icon: Rocket, keywords: ['breakout', 'breakdown', 'ath', 'all time high', 'new high', 'trend', 'recovery', 'screener'], category: 'Markets' },
  // — additions (May 2026) —
  { name: 'Strategy Backtest Lab', href: '/backtest', icon: Activity, keywords: ['backtest', 'dca', 'funding carry', 'strategy', 'history', 'simulate', 'sharpe', 'returns'], category: 'Trading' },
  { name: 'Bridge Flows', href: '/bridge-flows', icon: ArrowLeftRight, keywords: ['bridge', 'bridges', 'wormhole', 'crosschain', 'cross-chain', 'corridor', 'volume', 'chains'], category: 'Markets' },
  { name: 'Changelog', href: '/changelog', icon: Sparkles, keywords: ['changelog', 'release', 'shipped', 'updates', 'what is new', 'whats new', 'new features'], category: 'More' },
  { name: 'Correlation Matrix', href: '/correlation', icon: GitCompareArrows, keywords: ['correlation', 'matrix', 'beta', 'diversification', 'btc correlation'], category: 'Markets' },
  { name: 'Crypto-Adjacent Stocks', href: '/crypto-stocks', icon: TrendingUp, keywords: ['stocks', 'mstr', 'coin', 'hood', 'crypto stocks', 'mining stocks', 'mara', 'riot'], category: 'Markets' },
  { name: 'Earnings + Event Calendar', href: '/earnings-calendar', icon: Calendar, keywords: ['earnings', 'event', 'calendar', 'unlock', 'tge', 'halving', 'governance', 'upcoming'], category: 'Sentiment' },
  { name: 'ETF Flows', href: '/etf-flows', icon: TrendingDown, keywords: ['etf', 'flows', 'spot etf', 'ibit', 'fbit', 'eth etf', 'inflows', 'outflows', 'farside'], category: 'Markets' },
  { name: 'Funding Paid · who eats the bill', href: '/funding-paid', icon: DollarSign, keywords: ['funding paid', 'who pays funding', '30 day funding', 'longs paid', 'shorts paid', 'rank'], category: 'Trading' },
  { name: 'Funding Countdown', href: '/funding-countdown', icon: Clock, keywords: ['funding countdown', 'next funding', 'settlement', 'imminent', 'minutes until'], category: 'Trading' },
  { name: 'Hash Ribbons · BTC miners', href: '/hash-ribbons', icon: Activity, keywords: ['hash ribbons', 'miners', 'capitulation', 'hashrate', 'btc bottom', 'mining'], category: 'Markets' },
  { name: 'Memecoin Radar', href: '/memecoin-radar', icon: Rocket, keywords: ['memecoin', 'memes', 'shitcoin', 'pump', 'solana memes', 'dexscreener', 'new launch'], category: 'Markets' },
  { name: 'On-Chain Metrics', href: '/onchain', icon: Layers, keywords: ['onchain', 'on-chain', 'tvl', 'active addresses', 'fees', 'transactions', 'glassnode'], category: 'Markets' },
  { name: 'Orderbook Imbalance', href: '/orderbook-imbalance', icon: GitCompareArrows, keywords: ['orderbook', 'imbalance', 'bid ask', 'depth', 'pressure'], category: 'Trading' },
  { name: 'Order Flow + Trade Tape', href: '/orderflow', icon: BarChart3, keywords: ['orderflow', 'order flow', 'tape', 'trades', 'cvd', 'depth', 'aggressive'], category: 'Trading' },
  { name: 'Open Positions', href: '/positions', icon: Briefcase, keywords: ['positions', 'open positions', 'pnl', 'unrealized', 'my trades'], category: 'My Tools' },
  { name: 'Portfolio', href: '/portfolio', icon: Briefcase, keywords: ['portfolio', 'holdings', 'manual', 'tracker'], category: 'My Tools' },
  { name: 'Profile + Settings', href: '/profile', icon: Users, keywords: ['profile', 'account', 'settings', 'preferences', 'notifications', 'api keys', 'connections', 'billing'], category: 'My Tools' },
  { name: 'Exchange Referrals (partner)', href: '/referrals', icon: Gift, keywords: ['referrals', 'exchange referrals', 'affiliate', 'fee discount', 'bybit', 'mexc', 'kucoin', 'sign up bonus'], category: 'More' },
  { name: 'Sector Rotation', href: '/sectors', icon: Layers, keywords: ['sectors', 'rotation', 'ai', 'defi', 'l2', 'memes', 'rwa', 'categories'], category: 'Markets' },
  { name: 'Stablecoin Flows', href: '/stablecoin-flows', icon: DollarSign, keywords: ['stablecoin', 'usdt', 'usdc', 'flows', 'mint', 'redemption', 'supply'], category: 'Markets' },
  { name: 'TGE Calendar', href: '/tge-calendar', icon: Calendar, keywords: ['tge', 'token generation', 'launch', 'upcoming tge', 'token launch'], category: 'Sentiment' },
  { name: 'Trade Optimizer', href: '/trade-optimizer', icon: Calculator, keywords: ['trade optimizer', 'best venue', 'execution cost', 'cheapest', 'route'], category: 'Trading' },
  { name: 'FAQ', href: '/faq', icon: BookOpen, keywords: ['faq', 'questions', 'help', 'how to', 'what is'], category: 'More' },
];

/* ------------------------------------------------------------------ */
/*  Fuzzy matching                                                     */
/* ------------------------------------------------------------------ */

function matchPage(page: PageEntry, q: string): number {
  const lower = q.toLowerCase();
  const name = page.name.toLowerCase();

  // Exact name match
  if (name === lower) return 100;
  // Name starts with query
  if (name.startsWith(lower)) return 90;
  // Name contains query
  if (name.includes(lower)) return 80;
  // Keyword exact match
  if (page.keywords.some((k) => k === lower)) return 75;
  // Keyword starts with
  if (page.keywords.some((k) => k.startsWith(lower))) return 70;
  // Keyword contains
  if (page.keywords.some((k) => k.includes(lower))) return 60;
  // Multi-word: all words match somewhere
  const words = lower.split(/\s+/);
  if (words.length > 1) {
    const allText = [name, ...page.keywords].join(' ');
    if (words.every((w) => allText.includes(w))) return 55;
  }
  return 0;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface CommandPaletteProps {
  onClose: () => void;
  onShowShortcuts: () => void;
}

export default function CommandPalette({ onClose, onShowShortcuts }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [coinResults, setCoinResults] = useState<CoinSearchResult[]>([]);
  const [isLoadingCoins, setIsLoadingCoins] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load recently viewed items
  const [recentItems] = useState<RecentItem[]>(() => getRecentlyViewed());

  // Auto-focus
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Coin search (debounced)
  useEffect(() => {
    if (query.length < 2) {
      setCoinResults([]);
      return;
    }
    let mounted = true;
    setIsLoadingCoins(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/coin-search?q=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (mounted) setCoinResults((json.results || []).slice(0, 5));
      } catch {
        if (mounted) setCoinResults([]);
      }
      if (mounted) setIsLoadingCoins(false);
    }, 300);
    return () => { mounted = false; clearTimeout(timer); };
  }, [query]);

  // Page results (instant, local)
  const pageResults = useMemo(() => {
    if (!query.trim()) return [];
    return pageRegistry
      .map((p) => ({ ...p, score: matchPage(p, query.trim()) }))
      .filter((p) => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [query]);

  // Combined flat list for keyboard nav
  const allResults = useMemo(() => {
    const items: { type: 'page' | 'coin'; data: PageEntry | CoinSearchResult }[] = [];
    pageResults.forEach((p) => items.push({ type: 'page', data: p }));
    coinResults.forEach((c) => items.push({ type: 'coin', data: c }));
    return items;
  }, [pageResults, coinResults]);

  // Reset selection on results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [allResults.length]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, allResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && allResults.length > 0) {
        e.preventDefault();
        const item = allResults[selectedIndex];
        if (item) {
          if (item.type === 'page') {
            router.push((item.data as PageEntry).href);
          } else {
            router.push(`/coin/${(item.data as CoinSearchResult).id}`);
          }
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [allResults, selectedIndex, router, onClose]);

  // Scroll selected into view
  useEffect(() => {
    const el = document.querySelector(`[data-cmd-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const navigateTo = (href: string) => {
    router.push(href);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm">
      <div ref={listRef} className="bg-[#0d0d0d] border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/60 w-full max-w-[560px] mx-4 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
          <Search className="w-4 h-4 text-neutral-500 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, features, or coins..."
            className="flex-1 bg-transparent text-white text-sm placeholder-neutral-500 focus:outline-none"
            aria-label="Command palette search"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={allResults.length > 0}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="p-1 rounded hover:bg-white/[0.06]"
            >
              <X className="w-3.5 h-3.5 text-neutral-500" />
            </button>
          )}
          {isLoadingCoins && (
            <div className="w-4 h-4 border-2 border-hub-yellow/20 border-t-hub-yellow rounded-full animate-spin flex-shrink-0" />
          )}
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {/* No query — show recently viewed + quick actions */}
          {!query.trim() && (
            <div className="p-2">
              {/* Recently Viewed */}
              {recentItems.length > 0 && (
                <>
                  <div className="px-2 py-1.5">
                    <span className="text-[10px] text-neutral-600 uppercase tracking-widest">Recently Viewed</span>
                  </div>
                  {recentItems.slice(0, 5).map((item) => (
                    <button
                      key={item.path}
                      onClick={() => navigateTo(item.path)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-neutral-400 hover:text-white hover:bg-white/[0.04] transition-colors"
                    >
                      {item.symbol ? (
                        <TokenIconSimple symbol={item.symbol} size={14} />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-neutral-600" />
                      )}
                      {item.label}
                      <ArrowRight className="w-3 h-3 text-neutral-700 ml-auto" />
                    </button>
                  ))}
                  <div className="my-1.5 border-t border-white/[0.04]" />
                </>
              )}
              <div className="px-2 py-1.5">
                <span className="text-[10px] text-neutral-600 uppercase tracking-widest">Quick Actions</span>
              </div>
              {[
                { name: 'Funding Rates', href: '/funding', icon: Percent },
                { name: 'Liquidations', href: '/liquidations', icon: Zap },
                { name: 'Open Interest', href: '/open-interest', icon: PieChart },
                { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
                { name: 'Top Movers', href: '/top-movers', icon: Rocket },
              ].map((item) => (
                <button
                  key={item.href}
                  onClick={() => navigateTo(item.href)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-neutral-400 hover:text-white hover:bg-white/[0.04] transition-colors"
                >
                  <item.icon className="w-3.5 h-3.5 text-neutral-600" />
                  {item.name}
                  <ArrowRight className="w-3 h-3 text-neutral-700 ml-auto" />
                </button>
              ))}
            </div>
          )}

          {/* Page results */}
          {pageResults.length > 0 && (
            <div className="p-2">
              <div className="px-2 py-1.5">
                <span className="text-[10px] text-neutral-600 uppercase tracking-widest">Pages</span>
              </div>
              {pageResults.map((page, i) => {
                const idx = i;
                return (
                  <button
                    key={page.href}
                    data-cmd-index={idx}
                    onClick={() => navigateTo(page.href)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedIndex === idx
                        ? 'bg-white/[0.06] text-white'
                        : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    <page.icon className="w-3.5 h-3.5 text-neutral-600 flex-shrink-0" />
                    <span className="flex-1 text-left">{page.name}</span>
                    <span className="text-[10px] text-neutral-600">{page.category}</span>
                    <ArrowRight className="w-3 h-3 text-neutral-700" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Coin results */}
          {coinResults.length > 0 && (
            <div className="p-2 border-t border-white/[0.04]">
              <div className="px-2 py-1.5">
                <span className="text-[10px] text-neutral-600 uppercase tracking-widest">Coins</span>
              </div>
              {coinResults.map((coin, i) => {
                const idx = pageResults.length + i;
                return (
                  <button
                    key={coin.id}
                    data-cmd-index={idx}
                    onClick={() => navigateTo(`/coin/${coin.id}`)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedIndex === idx
                        ? 'bg-white/[0.06] text-white'
                        : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    <Image src={coin.thumb?.startsWith('https://') ? coin.thumb : '/logo-icon.svg'} alt={coin.name} width={20} height={20} className="rounded-full" />
                    <span className="flex-1 text-left">
                      <span className="text-white font-medium">{coin.name}</span>
                      <span className="text-neutral-600 ml-1.5 text-xs">{coin.symbol.toUpperCase()}</span>
                    </span>
                    {coin.market_cap_rank && (
                      <span className="text-[10px] text-neutral-600">#{coin.market_cap_rank}</span>
                    )}
                    <ArrowRight className="w-3 h-3 text-neutral-700" />
                  </button>
                );
              })}
            </div>
          )}

          {/* No results */}
          {query.trim() && pageResults.length === 0 && coinResults.length === 0 && !isLoadingCoins && (
            <div className="px-4 py-8 text-center">
              <p className="text-neutral-600 text-sm">No results for &ldquo;{query}&rdquo;</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3 text-[10px] text-neutral-600">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-white/[0.06] border border-white/[0.08] rounded text-[9px]">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-white/[0.06] border border-white/[0.08] rounded text-[9px]">↵</kbd>
              select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-white/[0.06] border border-white/[0.08] rounded text-[9px]">esc</kbd>
              close
            </span>
          </div>
          <button
            onClick={() => { onClose(); onShowShortcuts(); }}
            className="flex items-center gap-1 text-[10px] text-neutral-600 hover:text-hub-yellow transition-colors"
          >
            <Keyboard className="w-3 h-3" />
            All shortcuts
          </button>
        </div>
      </div>
    </div>
  );
}
