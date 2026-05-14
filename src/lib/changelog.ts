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
 * Last reviewed: 2026-05-09
 */
export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-05-11',
    title: 'Public API · fee transparency + aggregate modes + new endpoints',
    summary: 'Major upgrade to the v1 partner API: every fee-aware endpoint now exposes the full fee schedule with a versioned identifier, market-data endpoints support symbol-level rollups via aggregate=1, and partners get rate-limit visibility on every response.',
    tags: ['new', 'improved'],
    bullets: [
      'Fee model surface — /arbitrage, /spreads, /funding-arb all return meta.feeModel { version, updatedAt, unit, schedule } with per-venue maker + taker. /status and /exchanges expose the identifiers so monitoring scripts can bump-detect via a no-auth probe.',
      'Per-row maker + taker on /arbitrage — fees.shortExchangeMaker / longExchangeMaker / etc., so partners can recompute net spread under maker-only or post-only fill assumptions.',
      'Net-of-fees on /spreads — netSpreadPct alongside the existing gross spreadPct, with the round-trip taker fee assumption surfaced in fees.roundTrip.',
      'Aggregate modes — ?aggregate=1 on /funding, /openinterest, /tickers collapses per-venue rows into one row per symbol (avg/min/max funding rate, summed OI, deduped volume).',
      'Liquidations summary mode — /liquidations?summary=1 returns aggregated totals (long $ vs short $, count, biggest single hit) in one query instead of paging the feed.',
      'New /klines endpoint — OHLCV candles with Binance perp → Bybit → OKX → Binance spot fallback chain server-side, so partners survive single-venue outages.',
      'Long/short regime classifier — /longshort response now includes a regime field (crowded-long / long-heavy / balanced / short-heavy / crowded-short) plus a derived longShortRatio.',
      'X-RateLimit-* headers on every authenticated response — partners can throttle pre-emptively instead of waiting for a 429.',
      'X-Fee-Model-Version + X-Fee-Model-Updated-At headers on every fee-aware endpoint (including 401 paths) so HEAD probes can detect schedule bumps cheaply.',
      'OpenAPI 3.1 spec at /api/v1/openapi (no auth) — every new field documented, every $ref resolves (7 self-consistency tests lock the schema).',
      'Dev docs rebuilt — all 26 endpoints have a body section + sidebar entry (was 14 before); new Fee Model + Klines + Whales + Backpack/Orderly/Paradex sections; JSON syntax highlighting on every response example.',
    ],
    links: [
      { label: 'API documentation', href: '/developers/docs' },
      { label: 'OpenAPI 3.1 spec', href: '/api/v1/openapi' },
      { label: 'Get a free API key', href: '/developers' },
    ],
  },
  {
    date: '2026-05-09',
    title: 'Wallet Watch · Hyperliquid + gTrade position alerter',
    summary: 'Watch any HL or gTrade wallet and get Telegram pings the moment they open, close, resize, near liq, take realized PnL, or pay funding — all on one page. Free.',
    tags: ['new'],
    bullets: [
      '/watch — paste any 0x address (or one-click pick from the suggested-whales section) to start watching',
      '6 trigger types per wallet: Position opened / closed / size changed / near liq / realized PnL / funding paid — each individually toggleable',
      'Tunable thresholds: size % delta, distance to liq, realized PnL $, funding $ — gear icon on each watched wallet opens the editor',
      'Test-ping button verifies your Telegram link works without waiting for a real event',
      'Polled every 60s via the existing snapshot cron; events typically deliver within a minute or two of the on-chain change',
      'Per-event venue tag (Hyperliquid / gTrade) so you know which book the move came from',
      'Multi-tenant — each user owns their own wallets + thresholds, capped at 25 per account',
      'Dedupe + mutex protection against concurrent runs so you never get duplicate pings',
      '32 unit tests covering every event kind + edge case (longs/shorts, funding deltas, liq distance, Markdown escaping)',
    ],
    links: [
      { label: 'Open Wallet Watch', href: '/watch' },
      { label: 'Link Telegram', href: '/profile?tab=notifications' },
    ],
  },
  {
    date: '2026-05-08',
    title: 'New /account command center + /profile rebuild',
    summary: 'Two opinionated account surfaces alongside the customizable /dashboard widget grid: a glanceable hub at /account and a 9-tab settings dashboard at /profile.',
    tags: ['new', 'improved'],
    bullets: [
      '/account — at-a-glance hub: connected venues, watched wallets, alerts, watchlist counts; Telegram-not-linked banner; recent activity feed (alerts + watch events merged); quick-action grid linking into the deep-dives',
      '/profile rebuilt as 9-tab dashboard: Overview / Connections / API Keys / Notifications / Activity / Preferences / Referrals / Billing / Danger Zone',
      'Danger zone wired to DELETE /api/user/account with two-step confirm; Sign out everywhere via NextAuth signOut',
      'Sidebar gains "Command Center" link; admin panel duplicate ("Admin" + "Admin Panel") consolidated into one entry',
    ],
    links: [
      { label: 'Account command center', href: '/dashboard' },
      { label: 'Profile + settings', href: '/profile' },
    ],
  },
  {
    date: '2026-05-08',
    title: 'Dashboard rework + Liquidation Cascades guide',
    summary: 'Two new featured dashboard widgets, a refined header, updated personas, and the next long-form guide.',
    tags: ['new', 'improved'],
    bullets: [
      'New Market Pulse widget (2-col): gradient mini-cards for BTC + ETH + total market cap + 24h volume',
      'New Bounce Stats widget: top rekt wallets on Hyperliquid via bounce.tech, with click-throughs to per-wallet rekt profile',
      'Dashboard header refined — ETH alongside BTC, Fear & Greed regime label inline, live "synced Ns ago" pulse indicator',
      'Sidebar venue panel + bottom status strip redesigned with proper hierarchy + animated stream bars; INFOHUB V2.0 badge now links to changelog',
      '/login + /signup polish — gradient borders, fade-up animations, trust-strip tagline',
      'Health badges across /positions stop being emoji and become Lucide icons matching the terminal aesthetic',
      'New guide: Surviving Liquidation Cascades — anatomy, 5 precursors, defensive + offensive playbooks',
    ],
    links: [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Liquidation Cascades guide', href: '/guides/surviving-liquidation-cascades' },
    ],
  },
  {
    date: '2026-05-08',
    title: 'Backtest Lab polish + admin tooling',
    summary: 'Backtest gets a hero, presets, and 4 new derived stats. Admin gets a unified Actions tab and 6 new SEO-friendly pages.',
    tags: ['improved'],
    bullets: [
      '/backtest — gradient hero, preset chips ($100/wk · 6mo, ETH $200/wk, BTC-only carry, 50d window etc.), 4 new stats (best/worst day, Calmar, longest underwater)',
      'Fixed best-day calc: was reporting +109% on DCA day-1 because deposits were counted as price moves; now strips deposit injection before percent math',
      'FOMC Playbook: every past meeting now has 24h price reactions (Binance Futures fallback for CG datacenter rate-limits)',
      'Admin Actions tab fully rewritten with 12 grouped actions, risk badges, recent activity feed; new generic /api/admin/actions/trigger-cron endpoint',
      'Per-page SEO titles for /health, /changelog, /positions, /positions/tax, /positions/journal, /positions/simulate (May-5 SEO pass missed them)',
    ],
    links: [
      { label: 'Backtest Lab', href: '/backtest' },
      { label: 'FOMC Playbook', href: '/fomc-playbook' },
    ],
  },
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
      { label: 'Funding Leaderboard', href: '/funding-paid' },
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
