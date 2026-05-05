/**
 * InfoHub changelog — hand-curated list of public-facing releases. Edit
 * here when shipping notable features. Newest entry at the top.
 *
 * The /changelog page renders this list. We don't auto-generate from git
 * because most commit messages are too granular to be useful to users.
 */

export type ChangelogTag = 'new' | 'fix' | 'improved' | 'security' | 'breaking';

export interface ChangelogEntry {
  /** ISO date YYYY-MM-DD. */
  date: string;
  title: string;
  /** Short blurb for the card. Plain text only — no HTML. */
  summary: string;
  /** Optional tags rendered as colored chips. */
  tags?: ChangelogTag[];
  /** Optional list of bullet items rendered as a sub-list. */
  bullets?: string[];
  /** Optional deep links to highlight. */
  links?: Array<{ label: string; href: string }>;
}

/**
 * Last reviewed: 2026-05-05
 */
export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-05-05',
    title: 'Audit pass · 9 bugs caught + fixed',
    summary: 'Systematic audit across all 28 new tools shipped this month — found and fixed every visible issue including a critical sign-inversion on Hyperliquid funding columns.',
    tags: ['fix', 'improved'],
    bullets: [
      'Fixed Hyperliquid cumulative funding sign inversion on /positions (HL convention is opposite of ours)',
      'Fixed -0.0000% display when tiny rates round to zero',
      'Fixed /api/etf-counterfactual 504 with graceful degradation when Farside throttles',
      'Fixed /api/cme-basis empty rows with Binance spot price fallback',
      'Fixed /health dashboard server self-fetch bug (now client-side)',
      'Added /fomc-playbook + /health to Sidebar (was nav-coverage gap)',
    ],
    links: [
      { label: 'Endpoint Health', href: '/health' },
      { label: 'Positions', href: '/positions' },
    ],
  },
  {
    date: '2026-05-05',
    title: 'BTC Cycle Phase + Funding Leaderboard + Crowdedness Index',
    summary: 'Three synthesis tools that combine multiple signals into a single trader verdict.',
    tags: ['new'],
    bullets: [
      '/cycle-phase — composite of Hash Ribbons + Puell + MVRV + funding regime + 200d SMA into one phase tag',
      '/funding-leaderboard — per-exchange 30d funding $ flow ranking (cumulative rate × OI)',
      '/crowdedness — per-coin positioning extremes, fades vs squeezes by combining funding + OI + L/S',
    ],
    links: [
      { label: 'Cycle Phase', href: '/cycle-phase' },
      { label: 'Crowdedness', href: '/crowdedness' },
      { label: 'Funding Leaderboard', href: '/funding-leaderboard' },
    ],
  },
  {
    date: '2026-05-05',
    title: 'Funding alerts now also fire on sustained pressure',
    summary: 'Previously alerts only fired on the moment of a sign flip. Now they also fire when funding has been against your direction for multiple consecutive readings — catches the case where funding has been positive on your long for 10+ hours without ever flipping.',
    tags: ['improved', 'fix'],
    bullets: [
      'New rule: funding > 0.005% per 8h window AND in the same direction for 2+ readings → fires once per cooldown period',
      'Message body differentiates "(now against you)" for fresh flips vs "(still against you)" for sustained pressure',
      '60-min cooldown still applies — at most 1 ping per hour per rule',
    ],
    links: [{ label: 'Manage alerts', href: '/account/connections' }],
  },
  {
    date: '2026-05-05',
    title: 'Phase 6 batch · Funding predictor + CME basis + RV/IV + FOMC playbook + Volume share',
    summary: 'Five more synthesis + macro tools.',
    tags: ['new'],
    bullets: [
      '/funding-predictor — predicted next-window rate from Binance premium index',
      '/cme-basis — CME front-month BTC + ETH futures premium vs spot, annualised',
      '/rv-iv — realised vs implied vol premium with regime tags',
      '/fomc-playbook — historical 24h BTC reaction to past Fed decisions, countdown to next',
      '/volume-share — CEX vs DEX spot volume share over 30 days',
    ],
  },
  {
    date: '2026-05-04',
    title: 'Phase 5 batch · Funding flips + OB imbalance + Stablecoin supply + Validators + Insider Watch',
    summary: 'Five more tools added to the deck.',
    tags: ['new'],
    bullets: [
      '/funding-flips — coins where funding sign flipped recently against the prior trend',
      '/orderbook-imbalance — bid vs ask depth ratio per venue, configurable depth band',
      '/stablecoin-supply — USDT/USDC/DAI/etc 1d/7d/30d circulating supply changes',
      '/validators — liquid-staking + restaking yields per asset',
    ],
  },
  {
    date: '2026-05-04',
    title: 'Phase 4 batch · Hash Ribbons + TGE Calendar + Memecoin Radar',
    summary: 'On-chain miner signal + curated upcoming launches + hot-meme tracker.',
    tags: ['new'],
    bullets: [
      '/hash-ribbons — Charles Edwards miner-capitulation indicator (30d/60d MA crossover)',
      '/tge-calendar — curated upcoming Token Generation Events with FDV + cliff vesting',
      '/memecoin-radar — hot Solana memecoins ranked by 1h velocity (volume × price move)',
    ],
  },
  {
    date: '2026-05-03',
    title: 'Phase 1-3 batch · 13 new tools shipped',
    summary: 'Funding countdown, skew, sectors, funding paid 30d, crypto stocks, ETF flows, ETF counterfactual, trade optimizer, plus more.',
    tags: ['new'],
    bullets: [
      '/funding-countdown — live next-settlement clocks per exchange × symbol',
      '/skew — put-call IV skew per expiry, BTC + ETH',
      '/sectors — sector rotation heatmap by 24h mcap change',
      '/funding-paid — 30d cumulative funding paid leaderboard',
      '/crypto-stocks — COIN/MSTR/miners/ETFs vs BTC, beta + correlation',
      '/etf-flows — daily net inflows per issuer (Farside)',
      '/etf-counterfactual — "BTC without ETF flows" model',
      '/trade-optimizer — cheapest venue for a given trade size + hold',
    ],
  },
  {
    date: '2026-05-02',
    title: 'Funding-aware portfolio shipped',
    summary: 'Connect your CEX API keys and DEX wallets, see all positions in one place with direction-aware funding columns. Live alerts when funding flips against you.',
    tags: ['new'],
    bullets: [
      '/positions — unified position view across Binance, Bybit, OKX, Bitget, Hyperliquid, GMX',
      '/account/connections — vault for encrypted CEX keys + funding-flip alerts via Telegram, email, browser push',
      'New crons: sync-positions every 1 min, check-position-alerts every 5 min',
    ],
    links: [
      { label: 'Connect accounts', href: '/account/connections' },
      { label: 'View positions', href: '/positions' },
    ],
  },
];
