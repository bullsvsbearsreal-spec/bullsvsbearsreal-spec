/**
 * Subscription tier definitions — single source of truth for /pricing,
 * UserMenu badges, paywall cards, and the underlying API tier field on
 * `api_keys.tier`.
 *
 * Today (May 2026): Pro + Whale are "FREE DURING LAUNCH" — the prices
 * are visible on /pricing for transparency but no charges happen yet.
 * NowPayments checkout flow is stubbed until we wire the real provider.
 *
 * Per-tier limits live HERE. The free path in code reads
 * TIER_LIMITS.free.X; the runtime tier-aware check should do
 * TIER_LIMITS[user.tier].X. Keep these in sync with what the UI says.
 *
 * Admin role implies Whale tier automatically (see resolveUserTier).
 */
import { FREE_TIER_PER_MINUTE, PRO_TIER_PER_MINUTE, FREE_TIER_PER_DAY } from '@/lib/api/rate-limit';

export type Tier = 'free' | 'pro' | 'whale';

export const TIER_ORDER: Tier[] = ['free', 'pro', 'whale'];

export interface TierLimits {
  /** API requests per minute (per key) */
  apiPerMinute: number;
  /** Daily API request cap. `Infinity` means no cap. */
  apiPerDay: number;
  /** Max user-created alert rules */
  maxAlerts: number;
  /** Max watched HL/gTrade wallets via /watch */
  maxWatchedWallets: number;
  /** Days of historical funding / OI / liquidations data accessible. */
  historyDays: number;
  /** Cumulative funding / OI window granted to API keys. */
  archiveDays: number;
}

export const TIER_LIMITS: Record<Tier, TierLimits> = {
  free: {
    apiPerMinute: FREE_TIER_PER_MINUTE,    // 100
    apiPerDay: FREE_TIER_PER_DAY,           // 5,000
    maxAlerts: 5,
    maxWatchedWallets: 10,
    historyDays: 90,
    archiveDays: 90,
  },
  pro: {
    apiPerMinute: PRO_TIER_PER_MINUTE,     // 500
    apiPerDay: Infinity,
    maxAlerts: 50,
    maxWatchedWallets: 100,
    historyDays: 365,
    archiveDays: 365,
  },
  whale: {
    apiPerMinute: Infinity,
    apiPerDay: Infinity,
    maxAlerts: Infinity,
    maxWatchedWallets: Infinity,
    historyDays: 365 * 5,                   // 5y
    archiveDays: 365 * 5,
  },
};

/** Monthly USD prices. Annual is derived (12 - 2 months = ~17% off). */
export const TIER_PRICE_MONTHLY: Record<Tier, number> = {
  free: 0,
  pro: 12,
  whale: 49,
};

/** Annual prices in USD — 10 months for the price of 12 (~17% off). */
export const TIER_PRICE_ANNUAL: Record<Tier, number> = {
  free: 0,
  pro: TIER_PRICE_MONTHLY.pro * 10,    // $120/yr
  whale: TIER_PRICE_MONTHLY.whale * 10, // $490/yr
};

export interface TierBranding {
  label: string;
  /** Tailwind text color for the tier name */
  textColor: string;
  /** Tailwind background tint (e.g. for badge / card border) */
  bgTint: string;
  /** Border tint for the card */
  borderTint: string;
  /** Lucide icon name (resolved at render time) */
  iconName: 'Sparkles' | 'Zap' | 'Crown';
  /** One-liner pitch shown on the card */
  tagline: string;
}

export const TIER_BRANDING: Record<Tier, TierBranding> = {
  free: {
    label: 'Free',
    textColor: 'text-neutral-300',
    bgTint: 'bg-white/[0.02]',
    borderTint: 'border-white/[0.06]',
    iconName: 'Sparkles',
    tagline: 'Get started — every page works, no card required',
  },
  pro: {
    label: 'Pro',
    textColor: 'text-emerald-300',
    bgTint: 'bg-emerald-500/[0.04]',
    borderTint: 'border-emerald-400/30',
    iconName: 'Zap',
    tagline: 'Serious traders — higher API limits, more alerts, longer history',
  },
  whale: {
    label: 'Whale',
    textColor: 'text-amber-300',
    bgTint: 'bg-gradient-to-br from-amber-500/[0.08] to-orange-500/[0.05]',
    borderTint: 'border-amber-400/40',
    iconName: 'Crown',
    tagline: 'For funds + power users — unlimited everything + custom webhooks',
  },
};

/**
 * Curated highlight of the data terminal — what tools/pages users
 * actually get on every tier. Used by /pricing's "What's included"
 * section to surface the tools beyond the abstract feature matrix
 * (which is API/limits-focused).
 *
 * Every tier includes every page. Pro + Whale don't unlock new pages
 * — they raise limits and add a few power features (custom webhooks,
 * raw WS, team seats). This list intentionally covers the most useful
 * subset; the side nav has the full menu.
 */
export interface ToolHighlight {
  /** Display label, e.g. "Chart" */
  label: string;
  /** Internal route, e.g. "/chart" */
  href: string;
  /** One-line value hint shown under the label */
  hint?: string;
}

export interface ToolCategory {
  /** Category label, e.g. "Scan & Trade" */
  label: string;
  /** Short description of what this category does */
  description: string;
  tools: ToolHighlight[];
}

export const TOOL_HIGHLIGHTS: ToolCategory[] = [
  {
    label: 'Scan & Trade',
    description: 'Find setups and route them to the cheapest venue',
    tools: [
      { label: 'Chart', href: '/chart', hint: 'TradingView + 6 info bands · RSI/ATR overlays' },
      { label: 'Screener', href: '/screener', hint: 'Filter + sort every market' },
      { label: 'Spreads', href: '/spreads', hint: 'Cross-venue arb · net-of-fees' },
      { label: 'Funding Arb', href: '/spread-scanner', hint: 'Long/short pair grader · A→D' },
      { label: 'Options', href: '/options', hint: 'Chain · Greeks · IV · max pain · skew' },
      { label: 'Trade Optimizer', href: '/trade-optimizer', hint: 'Cheapest venue per trade' },
    ],
  },
  {
    label: 'Live monitors',
    description: 'Real-time data across every venue we cover',
    tools: [
      { label: 'Funding Rates', href: '/funding', hint: 'Live across all venues' },
      { label: 'Open Interest', href: '/open-interest', hint: 'OI changes · 1h/4h/24h' },
      { label: 'Liquidations', href: '/liquidations', hint: 'Live rekt feed · whale tags' },
      { label: 'ETF Tracker', href: '/etf', hint: 'BTC + ETH spot ETF · flows · premiums' },
      { label: 'Long / Short', href: '/longshort', hint: 'Crowd positioning · regime classifier' },
      { label: 'CEX vs DEX Volume', href: '/volume-share', hint: 'On-chain share · 30d' },
    ],
  },
  {
    label: 'Risk & alerts',
    description: 'Stay ahead of liquidation zones and surprise moves',
    tools: [
      { label: 'Liq Heatmap', href: '/liquidation-heatmap', hint: 'Heat tiles · whale clusters' },
      { label: 'Liq Map', href: '/liquidation-map', hint: 'Price-level density forecast' },
      { label: 'Liq Calculator', href: '/liq-calculator', hint: 'Price needed to liquidate' },
      { label: 'Alerts', href: '/alerts', hint: 'Triggers + history · Telegram' },
      { label: 'Wallet Watch', href: '/watch', hint: 'HL + gTrade position alerter' },
      { label: 'Position Sizer', href: '/position-size', hint: 'Risk-based sizing calculator' },
    ],
  },
  {
    label: 'Research',
    description: 'Smart money flows, on-chain signals, news + catalysts',
    tools: [
      { label: 'Smart Money', href: '/smart-money', hint: 'Top trader leaderboard' },
      { label: 'HL Whales', href: '/hl-whales', hint: 'Top Hyperliquid positions' },
      { label: 'News + Signals', href: '/news', hint: 'Curated + algorithmic ranking' },
      { label: 'Event Calendar', href: '/economic-calendar', hint: 'Macro + token events' },
      { label: 'Token Unlocks', href: '/token-unlocks', hint: 'Vesting schedules · cliff risk' },
      { label: 'On-Chain', href: '/onchain', hint: 'Network metrics · MVRV · NUPL' },
    ],
  },
  {
    label: 'Markets & macro',
    description: 'Top-down view — sectors, regimes, sentiment',
    tools: [
      { label: 'Sector Rotation', href: '/sectors', hint: 'Heatmap by category' },
      { label: 'Cycle Phase', href: '/cycle-phase', hint: 'Composite of 5 cycle signals' },
      { label: 'Market Heatmap', href: '/market-heatmap', hint: 'Treemap by mcap' },
      { label: 'Fear & Greed', href: '/fear-greed', hint: 'Sentiment index' },
      { label: 'RSI Heatmap', href: '/rsi-heatmap', hint: 'Overbought / oversold' },
      { label: 'FOMC Playbook', href: '/fomc-playbook', hint: 'BTC reaction to past Fed decisions' },
    ],
  },
];

/** Total number of highlighted tools across all categories. Used by
 *  marketing copy ("X+ tools included"). Derived so it can't drift. */
export const TOOL_HIGHLIGHT_COUNT = TOOL_HIGHLIGHTS.reduce(
  (acc, cat) => acc + cat.tools.length,
  0,
);

/** Bullet features shown under each tier card. Keep parallel structure so
 *  the comparison table reads cleanly: same row labels across tiers. */
export interface FeatureGroup {
  label: string;
  /** Per-tier value cell. `true` = checkmark, `false` = X, string = label. */
  values: Record<Tier, boolean | string>;
}

export const FEATURE_MATRIX: FeatureGroup[] = [
  // ── API ──
  {
    label: 'API rate limit',
    values: { free: '100 req/min', pro: '500 req/min', whale: 'Unlimited' },
  },
  {
    label: 'Daily API requests',
    values: { free: '5,000 / day', pro: 'Unlimited', whale: 'Unlimited' },
  },
  {
    label: 'OpenAPI 3.1 spec access',
    values: { free: true, pro: true, whale: true },
  },
  {
    label: 'Fee Model + X-RateLimit headers',
    values: { free: true, pro: true, whale: true },
  },
  // ── Alerts + Watch ──
  {
    label: 'Custom alerts (price / funding / OI / change)',
    values: { free: '5', pro: '50', whale: 'Unlimited' },
  },
  {
    label: 'Wallet Watch (HL + gTrade)',
    values: { free: '10', pro: '100', whale: 'Unlimited' },
  },
  {
    label: 'Custom alert webhooks (your own HTTPS endpoint)',
    values: { free: false, pro: false, whale: true },
  },
  {
    label: 'Sub-second priority alert delivery',
    values: { free: false, pro: false, whale: true },
  },
  // ── Data ──
  {
    label: 'Historical funding + OI window',
    values: { free: '90 days', pro: '1 year', whale: '5 years' },
  },
  {
    label: 'Real-time aggregator (32 venues)',
    values: { free: true, pro: true, whale: true },
  },
  {
    label: 'Smart Money + Hyperliquid whale feeds',
    values: { free: true, pro: true, whale: true },
  },
  // ── Whale-only ──
  {
    label: 'Raw WebSocket feed (co-located, sub-100ms)',
    values: { free: false, pro: false, whale: true },
  },
  {
    label: 'Team seats (up to 5 users per subscription)',
    values: { free: false, pro: false, whale: true },
  },
  {
    label: '1:1 channel with the team (feature requests)',
    values: { free: false, pro: false, whale: true },
  },
  // ── Support ──
  {
    label: 'Community Telegram support',
    values: { free: true, pro: true, whale: true },
  },
  {
    label: 'Priority email / DM response',
    values: { free: false, pro: true, whale: true },
  },
];

/**
 * Resolve a user's effective tier. Admin role implies Whale automatically
 * (admins built the product — they get the top tier). Otherwise reads the
 * `tier` column off the user's billing record (or the API key tier when
 * called from an API context).
 */
export function resolveUserTier(args: {
  role?: string | null;
  billingTier?: Tier | string | null;
}): Tier {
  if (args.role === 'admin') return 'whale';
  const t = args.billingTier;
  if (t === 'free' || t === 'pro' || t === 'whale') return t;
  return 'free';
}

/** Annualised savings copy: "Save $24/yr" for Pro at $12/mo. */
export function annualSavingsUsd(tier: Tier): number {
  return TIER_PRICE_MONTHLY[tier] * 12 - TIER_PRICE_ANNUAL[tier];
}

/** Marketing label for the annual saving: "17%" (2 months free). */
export const ANNUAL_DISCOUNT_PCT = 17;
