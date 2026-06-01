/**
 * Subscription tier definitions — single source of truth for /pricing,
 * UserMenu badges, paywall cards, and the underlying API tier field on
 * `api_keys.tier`.
 *
 * 4-tier ladder (May 2026 reshape):
 *   Free   $0   — Demand-gen + SEO entry point. Data terminal, 3 alerts.
 *   Trader $15  — Active retail. All venues + power dashboards + 15 alerts.
 *   Pro    $49  — "I trade for a living". + API archive, tax export,
 *                  custom dashboards, setup scanner.
 *   Whale  $99  — Funds + desks. + Priority alerts, unlimited everything.
 *
 * Today: Pro + Trader + Whale are "FREE DURING LAUNCH" — the prices
 * are visible on /pricing for transparency but no charges happen yet.
 * NowPayments crypto checkout is stubbed until we wire the real provider.
 *
 * Per-tier limits live HERE. The free path in code reads
 * TIER_LIMITS.free.X; the runtime tier-aware check should do
 * TIER_LIMITS[user.tier].X. Keep these in sync with what the UI says.
 *
 * Admin role implies Whale tier automatically (see resolveUserTier).
 */
import {
  FREE_TIER_PER_MINUTE,
  TRADER_TIER_PER_MINUTE,
  PRO_TIER_PER_MINUTE,
  FREE_TIER_PER_DAY,
  TRADER_TIER_PER_DAY,
} from '@/lib/api/rate-limit';
import { ALL_EXCHANGES } from './exchanges';

export type Tier = 'free' | 'trader' | 'pro' | 'whale';

export const TIER_ORDER: Tier[] = ['free', 'trader', 'pro', 'whale'];

/**
 * The tier shown with the "MOST POPULAR" highlight on /pricing. Lives
 * here (not in pricing/page.tsx) so changing the conversion anchor is a
 * single-file edit. Picked as Pro because it's the conversion sweet
 * spot — wide enough features for trade-for-a-living users without
 * Whale's $59/mo barrier.
 */
export const MOST_POPULAR_TIER: Tier = 'pro';

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
    maxAlerts: 3,
    maxWatchedWallets: 5,
    historyDays: 30,
    archiveDays: 30,
  },
  trader: {
    apiPerMinute: TRADER_TIER_PER_MINUTE,  // 200
    apiPerDay: TRADER_TIER_PER_DAY,         // 25,000
    maxAlerts: 15,
    maxWatchedWallets: 30,
    historyDays: 180,
    archiveDays: 180,
  },
  pro: {
    apiPerMinute: PRO_TIER_PER_MINUTE,     // 600
    apiPerDay: Infinity,
    maxAlerts: 75,
    maxWatchedWallets: 200,
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
  trader: 15,
  pro: 49,
  whale: 99,
};

/** Annual prices in USD — 10 months for the price of 12 (~17% off). */
export const TIER_PRICE_ANNUAL: Record<Tier, number> = {
  free: 0,
  trader: TIER_PRICE_MONTHLY.trader * 10,  // $150/yr
  pro: TIER_PRICE_MONTHLY.pro * 10,        // $490/yr
  whale: TIER_PRICE_MONTHLY.whale * 10,    // $990/yr
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
  iconName: 'Sparkles' | 'Compass' | 'Zap' | 'Crown';
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
    tagline: 'Get started — full data terminal, no card required',
  },
  trader: {
    label: 'Trader',
    textColor: 'text-sky-300',
    bgTint: 'bg-sky-500/[0.04]',
    borderTint: 'border-sky-400/30',
    iconName: 'Compass',
    tagline: 'Active retail — every venue real-time, 15 alerts, wallet watch',
  },
  pro: {
    label: 'Pro',
    textColor: 'text-emerald-300',
    bgTint: 'bg-emerald-500/[0.04]',
    borderTint: 'border-emerald-400/30',
    iconName: 'Zap',
    tagline: 'Trade for a living — API archive, tax export, custom dashboards, setup scanner',
  },
  whale: {
    label: 'Whale',
    textColor: 'text-amber-300',
    bgTint: 'bg-gradient-to-br from-amber-500/[0.08] to-orange-500/[0.05]',
    borderTint: 'border-amber-400/40',
    iconName: 'Crown',
    tagline: 'Funds + desks — priority alerts + unlimited everything',
  },
};

/**
 * Tier-aware tool lists for the /pricing "What's in each tier" section.
 *
 * Each tier owns a curated list of tools/features. Higher tiers
 * implicitly include everything below them (cumulative), so Trader's
 * list shows what Trader ADDS on top of Free, Pro's shows what Pro
 * ADDS on top of Trader, and Whale's shows what Whale ADDS on top of
 * Pro. This is the standard pricing-page pattern that lets users see
 * the upgrade path clearly.
 *
 * Items can be either pages (with `href`) or pure features without a
 * route (custom webhooks, priority alerts, etc. — the Whale tier has
 * several of these).
 */
export interface TierToolItem {
  /** Display label, e.g. "Chart" or "Custom alert webhooks" */
  label: string;
  /** Internal route — omit for pure features (no clickable page) */
  href?: string;
  /** One-line hint shown next to the label */
  hint?: string;
}

export interface TierToolList {
  tier: Tier;
  /** Section heading, e.g. "Everyone gets" or "Pro adds" */
  heading: string;
  /** Sub-line explaining what users get at this tier */
  description: string;
  items: TierToolItem[];
}

export const TOOLS_BY_TIER: TierToolList[] = [
  {
    tier: 'free',
    heading: 'Everyone gets',
    description: 'Free tier — full data terminal, no card required',
    items: [
      { label: 'Chart', href: '/chart', hint: 'TradingView + 6 info bands' },
      { label: 'Screener', href: '/screener', hint: 'Filter every market' },
      { label: 'Funding Rates', href: '/funding', hint: 'Live across all venues' },
      { label: 'Open Interest', href: '/open-interest', hint: 'OI + 24h changes' },
      { label: 'Liquidations', href: '/liquidations', hint: 'Live rekt feed' },
      { label: 'ETF Tracker', href: '/etf', hint: 'Spot ETF flows + premiums' },
      { label: 'Long / Short', href: '/longshort', hint: 'Crowd positioning' },
      { label: 'Fear & Greed', href: '/fear-greed' },
      { label: 'Event Calendar', href: '/economic-calendar', hint: 'Macro + token events' },
      { label: 'Token Unlocks', href: '/token-unlocks', hint: 'Vesting + cliffs' },
      { label: 'Liq Heatmap', href: '/liquidation-heatmap' },
      { label: 'News + Signals', href: '/news' },
      { label: '3 custom alerts · 5 watched wallets', hint: '30d history · 100 API req/min · 5k req/day' },
      { label: 'Community Telegram support' },
    ],
  },
  {
    tier: 'trader',
    heading: 'Trader adds',
    description: 'Active-retail power tools — all venues, wallet copy-trading, more alerts, longer history',
    items: [
      { label: 'Spreads', href: '/spreads', hint: 'Cross-venue arb · net-of-fees' },
      { label: 'Funding Arb', href: '/spread-scanner', hint: 'Long/short pair grader A→D' },
      { label: 'Trade Optimizer', href: '/trade-optimizer', hint: 'Cheapest venue per trade' },
      { label: 'Options', href: '/options', hint: 'Chain · Greeks · IV · max pain' },
      { label: 'Wallet Alerts', href: '/watch', hint: 'HL + gTrade position alerter' },
      { label: 'Smart Money', href: '/smart-money', hint: 'Top trader leaderboard + Consensus mode' },
      { label: 'HL Whales', href: '/hl-whales', hint: 'Top Hyperliquid positions' },
      { label: 'On-Chain', href: '/onchain', hint: 'MVRV · NUPL · network metrics' },
      { label: 'FOMC Playbook', href: '/fomc-playbook' },
      { label: '15 custom alerts · 30 watched wallets', hint: '180d history · 200 API req/min · 25k req/day' },
      { label: 'Priority email + DM support' },
    ],
  },
  {
    tier: 'pro',
    heading: 'Pro adds',
    description: 'Trade-for-a-living tools — power API + tax + dashboards + scanner',
    items: [
      { label: 'API funding-history archive (1y)', href: '/developers/docs', hint: 'Bulk historical funding export via /api/v1/funding/history' },
      { label: 'Tax CSV export', href: '/positions/tax', hint: 'Positions + funding paid + realized PnL' },
      { label: 'Custom dashboards', href: '/dashboard', hint: 'Drag/drop tiles · save layouts' },
      { label: 'Setup scanner', href: '/breakouts', hint: 'Breakout / range / divergence across top 200' },
      { label: '75 custom alerts · 200 watched wallets', hint: '1y history · 600 API req/min · unlimited daily' },
      { label: 'Priority email + DM support · 12h response' },
    ],
  },
  {
    tier: 'whale',
    heading: 'Whale adds',
    description: 'Funds + desks — priority alerts + unlimited everything',
    items: [
      { label: 'Priority alert delivery', hint: 'Dedicated Whale queue — delivers in seconds, vs the 5-min standard cron' },
      { label: 'Custom alert webhooks', href: '/developers/webhooks', hint: 'HMAC-signed POSTs to your endpoint' },
      { label: 'API funding-history archive (5y)', href: '/developers/docs', hint: 'Full funding-history export, unlimited rate' },
      { label: 'Unlimited alerts · unlimited watched wallets' },
      { label: '1:1 Telegram channel with the team', hint: 'Feature requests + priority response' },
    ],
  },
];

/** Total tools/features highlighted across all tiers. Derived so it
 *  can't drift from the actual list. */
export const TOOLS_BY_TIER_COUNT = TOOLS_BY_TIER.reduce(
  (acc, t) => acc + t.items.length,
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
    values: {
      free: '100 req/min',
      trader: '200 req/min',
      pro: '600 req/min',
      whale: 'Unlimited',
    },
  },
  {
    label: 'Daily API requests',
    values: {
      free: '5,000 / day',
      trader: '25,000 / day',
      pro: 'Unlimited',
      whale: 'Unlimited',
    },
  },
  {
    label: 'API archive window (historical bulk export)',
    values: {
      free: '30 days',
      trader: '180 days',
      pro: '1 year',
      whale: '5 years',
    },
  },
  {
    label: 'OpenAPI 3.1 spec access',
    values: { free: true, trader: true, pro: true, whale: true },
  },
  {
    label: 'Fee Model + X-RateLimit headers',
    values: { free: true, trader: true, pro: true, whale: true },
  },
  // ── Alerts + Watch ──
  {
    label: 'Custom alerts (price / funding / OI / change)',
    values: { free: '3', trader: '15', pro: '75', whale: 'Unlimited' },
  },
  {
    label: 'Wallet Alerts (HL + gTrade)',
    values: { free: '5', trader: '30', pro: '200', whale: 'Unlimited' },
  },
  {
    label: 'Priority alert delivery (dedicated queue · seconds)',
    values: { free: false, trader: false, pro: false, whale: true },
  },
  {
    label: 'Custom alert webhooks (your own HTTPS endpoint)',
    values: { free: false, trader: false, pro: false, whale: true },
  },
  // ── Data ──
  {
    label: 'Historical funding + OI in-app window',
    values: { free: '30 days', trader: '180 days', pro: '1 year', whale: '5 years' },
  },
  {
    label: `Real-time aggregator (${ALL_EXCHANGES.length} venues)`,
    values: { free: true, trader: true, pro: true, whale: true },
  },
  {
    label: 'Smart Money + Hyperliquid whale feeds',
    values: { free: false, trader: true, pro: true, whale: true },
  },
  // ── Pro-tier power features ──
  {
    label: 'Tax CSV export (positions + funding + PnL)',
    values: { free: false, trader: false, pro: true, whale: true },
  },
  {
    label: 'Custom dashboards (drag/drop tiles)',
    values: { free: false, trader: false, pro: true, whale: true },
  },
  {
    label: 'Setup scanner (breakout/range/divergence)',
    values: { free: false, trader: false, pro: true, whale: true },
  },
  // ── Whale-only ──
  {
    label: '1:1 Telegram channel with the team',
    values: { free: false, trader: false, pro: false, whale: true },
  },
  // ── Support ──
  {
    label: 'Community Telegram support',
    values: { free: true, trader: true, pro: true, whale: true },
  },
  {
    label: 'Priority email / DM response',
    values: { free: false, trader: true, pro: true, whale: true },
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
  if (t === 'free' || t === 'trader' || t === 'pro' || t === 'whale') return t;
  return 'free';
}

/** Annualised savings copy: "Save $24/yr" for Trader at $12/mo. */
export function annualSavingsUsd(tier: Tier): number {
  return TIER_PRICE_MONTHLY[tier] * 12 - TIER_PRICE_ANNUAL[tier];
}

/** Marketing label for the annual saving: "17%" (2 months free). */
export const ANNUAL_DISCOUNT_PCT = 17;

/**
 * Tier comparison helper — does tier A satisfy a minimum required tier?
 * Used by `<TierGate requires="pro">`-style checks. Ordering matches
 * TIER_ORDER (free < trader < pro < whale).
 */
export function tierAtLeast(actual: Tier, required: Tier): boolean {
  return TIER_ORDER.indexOf(actual) >= TIER_ORDER.indexOf(required);
}
