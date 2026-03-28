# InfoHub — Complete Component & Infrastructure Map

> Generated 2026-03-28 | 7 services, 30 exchanges, 114 API routes, 171 components

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Frontend Pages (70 routes)](#2-frontend-pages)
3. [API Routes (114 endpoints)](#3-api-routes)
4. [React Components (171 files)](#4-react-components)
5. [Hooks (22 files)](#5-hooks)
6. [Libraries & Utilities (60+ files)](#6-libraries--utilities)
7. [Backend Services (7 services)](#7-backend-services)
8. [Database Schema (20+ tables)](#8-database-schema)
9. [External APIs & Integrations](#9-external-apis--integrations)
10. [Configuration & Deployment](#10-configuration--deployment)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Vercel)                        │
│  Next.js 14.2 · React 18 · TypeScript 5.3 · Tailwind 3.4      │
│  70 pages · 171 components · 114 API routes · Edge Runtime      │
│  Deployment: Vercel Mumbai (bom1)                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌─────────────────┐ ┌────────────────┐ ┌──────────────────┐
│ infohub-collector│ │price-aggregator│ │  liq-ingester    │
│ (PM2, 15-min)   │ │ (systemd, RT)  │ │ (PM2, WebSocket) │
│ funding+OI+liq  │ │ 40+ exchanges  │ │ 9 exchange feeds │
│ → PostgreSQL    │ │ WS+REST→memory │ │ → PostgreSQL     │
└────────┬────────┘ └───────┬────────┘ └────────┬─────────┘
         │                  │                    │
         ▼                  │                    ▼
┌─────────────────┐         │         ┌──────────────────┐
│   PostgreSQL    │◄────────┘         │ Cloudflare       │
│ (DigitalOcean)  │                   │ Workers (3)      │
│ 20+ tables      │                   │ proxy-worker     │
│ 30-day retention│                   │ proxy (legacy)   │
│ PgBouncer       │                   │ cf-proxy (DO)    │
└─────────────────┘                   └──────────────────┘
```

**Stack**: Next.js 14.2, React 18, TypeScript 5.3, Tailwind CSS 3.4, Recharts 2.12, Lightweight Charts 4.1
**Database**: DigitalOcean Managed PostgreSQL (postgres.js driver, PgBouncer transaction mode)
**Deployment**: Vercel Edge (Mumbai bom1), Cloudflare Workers, DigitalOcean Droplet (PM2 + systemd)

---

## 2. Frontend Pages (70 routes)

### Authentication & User Management (8)

| Route | Files | Description |
|-------|-------|-------------|
| `/login` | layout, page | Email/password + OAuth login |
| `/signup` | layout, page | Registration with email verification |
| `/forgot-password` | page | Password reset request |
| `/reset-password` | page | Password reset with token |
| `/profile` | page | User profile and avatar |
| `/settings` | page | Account settings (7 sub-components) |
| `/admin` | page | Admin dashboard |
| `/admin-panel` | page | Full admin panel (19 sub-components) |

### Market Data & Analytics (19)

| Route | Files | Description |
|-------|-------|-------------|
| `/` | layout, page, loading | Home page |
| `/screener` | layout, page | Multi-filter token screener |
| `/top-movers` | layout, page | Top gaining/losing assets |
| `/market-heatmap` | layout, page | Crypto market cap heatmap |
| `/stock-heatmap` | layout, page | Stock market heatmap |
| `/rsi-heatmap` | layout, page | RSI heatmap across exchanges |
| `/fear-greed` | layout, page | Fear & Greed Index + chart |
| `/market-cycle` | layout, page | Market cycle indicators |
| `/dominance` | layout, page | BTC/ETH dominance charts |
| `/correlation` | layout, page | Cross-asset correlation matrix |
| `/compare` | layout, page | Side-by-side coin comparison |
| `/bitcoin-treasuries` | layout, page | Corporate BTC holdings |
| `/etf` | layout, page | Spot BTC/ETH ETF flows |
| `/stablecoin-flows` | layout, page | Stablecoin market data |
| `/onchain` | layout, page | Bitcoin on-chain metrics |
| `/exchange-reserves` | layout, page | Exchange reserve tracking |
| `/exchange-comparison` | layout, page | Exchange feature comparison |
| `/economic-calendar` | layout, page | Macro economic events |
| `/prediction-markets` | layout, page | Prediction market browser |

### Funding & Spreads (6)

| Route | Files | Description |
|-------|-------|-------------|
| `/funding` | layout, page | Funding rates (30 exchanges) |
| `/funding/[symbol]` | page | Per-symbol funding history |
| `/funding-heatmap` | layout, page | Funding heatmap by hour/day |
| `/spreads` | layout, page | Real-time price spreads |
| `/spreads/embed` | page | Embeddable spread widget |
| `/spread-scanner` | layout, page | Spread opportunity scanner |

### Trading & Derivatives (10)

| Route | Files | Description |
|-------|-------|-------------|
| `/open-interest` | layout, page | OI across 26 exchanges |
| `/oi-heatmap` | layout, page | OI heatmap visualization |
| `/liquidations` | layout, page | Real-time liquidation feed |
| `/liquidation-heatmap` | layout, page | Liquidation price heatmap |
| `/liquidation-map` | layout, page | Liquidation distribution map |
| `/orderflow` | layout, page | Order book depth + tape |
| `/longshort` | layout, page | Long/short ratios |
| `/options` | layout, page | Options data (4 exchanges) |
| `/basis` | layout, page | Futures basis analysis |
| `/cvd` | layout, page | Cumulative volume delta |

### DeFi & Yield (3)

| Route | Files | Description |
|-------|-------|-------------|
| `/yields` | layout, page | DeFi yield aggregation |
| `/execution-costs` | layout, page | DEX execution cost analysis |
| `/airdrops` | layout, page | Airdrop tracker |

### User Features (6)

| Route | Files | Description |
|-------|-------|-------------|
| `/dashboard` | layout, page | Customizable widget dashboard |
| `/watchlist` | layout, page | User watchlists |
| `/portfolio` | layout, page | Portfolio tracking |
| `/wallet-tracker` | layout, page | Multi-chain wallet tracker |
| `/alerts` | layout, page | Price/funding/arb alerts |
| `/referrals` | layout, page | Referral program |

### On-chain Intelligence (3)

| Route | Files | Description |
|-------|-------|-------------|
| `/hl-whales` | layout, page | Hyperliquid whale tracker |
| `/whale-alert` | layout, page | Large transaction alerts |
| `/token-unlocks` | layout, page | Token unlock schedule |

### Charts & Tools (3)

| Route | Files | Description |
|-------|-------|-------------|
| `/chart` | layout, page | TradingView advanced chart |
| `/coin/[id]` | page | Single coin detail page |
| `/symbol/[symbol]` | layout, page | Symbol overview page |

### Content & Info (11)

| Route | Files | Description |
|-------|-------|-------------|
| `/news` | layout, page | Crypto news aggregation |
| `/guides` | layout, page | Trading guides index |
| `/guides/funding-rate-arbitrage` | layout, page | Funding arb guide |
| `/api-docs` | layout, page | Public API documentation |
| `/developers` | layout, page | Developer portal |
| `/developers/docs` | page | API docs detail |
| `/faq` | layout, page | FAQ |
| `/brand` | layout, page | Brand assets |
| `/team` | layout, page | Team page |
| `/privacy` | layout, page | Privacy policy |
| `/terms` | layout, page | Terms of service |
| `/trailer` | page | Marketing trailer |

---

## 3. API Routes

### Authentication (14 routes)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/[...nextauth]` | GET, POST | NextAuth dynamic handler |
| `/api/auth/signup` | POST | User registration |
| `/api/auth/verify-email` | POST | Email verification |
| `/api/auth/verify-email/resend` | POST | Resend verification |
| `/api/auth/forgot-password` | POST | Password reset request |
| `/api/auth/reset-password` | POST | Password reset |
| `/api/auth/change-password` | POST | Change password |
| `/api/auth/check-credentials` | POST | Credential existence check |
| `/api/auth/2fa/setup` | POST | Generate TOTP secret + QR |
| `/api/auth/2fa/verify` | POST | Verify TOTP and enable 2FA |
| `/api/auth/2fa/validate` | POST | Validate TOTP code |
| `/api/auth/2fa/email` | POST | Enable email 2FA |
| `/api/auth/2fa/challenge` | POST | Send 2FA email challenge |
| `/api/auth/2fa/status` | POST | Check 2FA status |

### Admin (14 routes)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/users` | GET | List users (paginated) |
| `/api/admin/users/[id]` | GET, DELETE | Get/delete user |
| `/api/admin/users/[id]/role` | PUT | Update user role |
| `/api/admin/stats` | GET | Site-wide metrics |
| `/api/admin/audit-log` | GET | Admin audit events |
| `/api/admin/monitoring/alerts` | GET | Alert health metrics |
| `/api/admin/monitoring/database` | GET | DB size/stats |
| `/api/admin/monitoring/pipeline` | GET | Exchange health |
| `/api/admin/actions/broadcast` | POST | Push + Telegram broadcast |
| `/api/admin/actions/flush-cache` | POST | Clear API cache |
| `/api/admin/actions/health-check` | POST | Funding health check |
| `/api/admin/actions/trigger-snapshot` | POST | Manual snapshot trigger |
| `/api/admin/backfill-spreads` | POST | Backfill spread data |
| `/api/admin/dedup-liquidations` | POST | Dedup liquidation rows |

### Market Data (35+ routes)

| Endpoint | Method | External Source |
|----------|--------|----------------|
| `/api/funding` | GET | 30 exchange APIs |
| `/api/openinterest` | GET | 26 exchange APIs |
| `/api/tickers` | GET | 28 exchange APIs |
| `/api/spot-prices` | GET | Multiple exchange APIs |
| `/api/prices` | GET | Exchange APIs |
| `/api/klines` | GET | Binance Futures |
| `/api/klines-multi` | GET | Binance Futures |
| `/api/aggtrades` | GET | Exchange APIs |
| `/api/oi-delta` | GET | Internal cache |
| `/api/coin-data` | GET | CoinMarketCap |
| `/api/coin-search` | GET | Database/static |
| `/api/global-stats` | GET | CMC, blockchain.com, mempool |
| `/api/fear-greed` | GET | CoinMarketCap |
| `/api/correlation` | GET | Ticker analysis |
| `/api/rsi` | GET | Klines analysis |
| `/api/market-cycle` | GET | Historical data |
| `/api/liquidations` | GET | OKX API |
| `/api/liquidations/ingest` | POST | Internal |
| `/api/liquidation-heatmap` | GET | Database |
| `/api/liquidation-map` | GET | Database |
| `/api/longshort` | GET | Exchange APIs |
| `/api/options` | GET | Binance, Bybit, Deribit, OKX |
| `/api/dominance` | GET | CoinGecko |
| `/api/onchain` | GET | blockchain.com, mempool |
| `/api/reserves` | GET | CoinGecko, blockchain |
| `/api/hl-whales` | GET | Hyperliquid API |
| `/api/stablecoins` | GET | CoinGecko |
| `/api/etf` | GET | External data |
| `/api/yields` | GET | DeFi yield APIs |
| `/api/orderbook` | GET | Aggregated order book depth (Binance → Bybit → OKX fallback) |
| `/api/orderbook/multi` | GET | Multi-exchange orderbook depth with slippage analysis |
| `/api/execution-costs` | GET | Exchange orderbooks |
| `/api/top-movers` | GET | Ticker analysis |
| `/api/economic-calendar` | GET | External API |
| `/api/news` | GET | CryptoCompare |
| `/api/prediction-markets` | GET | Prediction APIs |
| `/api/airdrops` | GET | Curated data |
| `/api/token-unlocks` | GET | TokenUnlocks API |
| `/api/treasuries` | GET | External data |

### Spreads (4 routes)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/spreads/current` | GET | Current exchange spreads |
| `/api/spreads/heatmap` | GET | Day-of-week x hour heatmap |
| `/api/spreads/leaderboard` | GET | Top spreads ranking |
| `/api/spreads/opportunities` | GET | Arbitrage opportunities |

### History/Snapshots (10 routes)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/history/funding` | GET | Historical funding rates |
| `/api/history/funding-bulk` | GET | Bulk funding history |
| `/api/history/funding-heatmap` | GET | Funding heatmap data |
| `/api/history/funding-multi` | GET | Multi-symbol funding |
| `/api/history/oi` | GET | OI history |
| `/api/history/oi-multi` | GET | Multi-symbol OI |
| `/api/history/price-multi` | GET | Multi-symbol prices |
| `/api/history/spreads` | GET | Spread history |
| `/api/history/liquidations` | GET | Liquidation history |
| `/api/history/portfolio` | GET | Portfolio snapshots |

### Cron Jobs (9 routes)

All require `CRON_SECRET` Bearer token.

| Endpoint | Purpose | Interval |
|----------|---------|----------|
| `/api/cron/snapshot` | Funding/OI/liq/spread snapshots | Hourly |
| `/api/cron/portfolio-snapshot` | User portfolio snapshots | Daily |
| `/api/cron/alerts` | Process price/funding alerts | ~5 min |
| `/api/cron/arbitrage-alerts` | Arbitrage opportunity check | ~5 min |
| `/api/cron/news-alerts` | News-based alerts | ~15 min |
| `/api/cron/calendar-alerts` | Economic calendar alerts | ~1 hr |
| `/api/cron/telegram-reports` | Telegram report generation | ~1 hr |
| `/api/cron/telegram-weekly` | Weekly Telegram digest | Weekly |
| `/api/cron/ingest-liquidations` | Liquidation ingestion | ~5 min |

### User (4 routes)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/user/account` | GET, DELETE | Account management |
| `/api/user/data` | GET, PUT | Preferences/settings |
| `/api/user/stats` | GET | Portfolio stats |
| `/api/user/avatar` | POST | Avatar upload |

### Wallet (3 routes)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/wallet` | GET | ETH/BTC/SOL balances |
| `/api/wallet/positions` | GET | Token positions |
| `/api/wallet/multichain` | GET | Multi-chain wallet data |

### V1 Public API (8 routes)

API key authentication via `X-API-Key` header.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/status` | GET | Health check |
| `/api/v1/funding` | GET | Real-time funding |
| `/api/v1/funding/history` | GET | Historical funding |
| `/api/v1/openinterest` | GET | Open interest |
| `/api/v1/arbitrage` | GET | Arbitrage opportunities |
| `/api/v1/exchanges` | GET | Exchange list |
| `/api/v1/keys` | GET, POST | API key management |
| `/api/v1/keys/[id]` | DELETE | Delete API key |

### Utility (9 routes)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Health check |
| `/api/debug/db-stats` | GET | Database stats |
| `/api/chat` | POST | Claude AI chat |
| `/api/charts/telegram` | GET | Chart image generation |
| `/api/push/subscribe` | POST | Push notification subscribe |
| `/api/arb-history` | GET | Arbitrage history |
| `/api/proxy/bitunix` | GET | Bitunix API proxy |
| `/api/telegram/setup` | GET | Telegram bot setup |
| `/api/telegram/webhook` | POST | Telegram webhook |

---

## 4. React Components

### Shared Components (`src/components/`) — 85 files

**Layout & Navigation:**
- `Header.tsx` — Main site header with nav
- `Footer.tsx` — Site footer
- `Logo.tsx` — Logo component
- `MarketTicker.tsx` — Scrolling price ticker bar
- `TopStatsBar.tsx` — Global stats bar
- `ThemeToggle.tsx` — Dark/light mode toggle
- `UserMenu.tsx` — Authenticated user menu
- `Pagination.tsx` — Reusable paginator
- `ShowMoreToggle.tsx` — Expand/collapse toggle

**Auth:**
- `AuthGate.tsx` — Hard auth requirement
- `SoftAuthGate.tsx` — Soft auth prompt
- `AuthWall.tsx` — Auth wall overlay
- `AuthOverlay.tsx` — Auth overlay modal

**Data Display:**
- `CoinCard.tsx` — Coin summary card
- `CoinSearch.tsx` — Coin search autocomplete
- `StatCard.tsx` — Metric display card
- `MobileCard.tsx` — Mobile-optimized card
- `DataFreshness.tsx` — Data age indicator
- `StaleIndicator.tsx` — Stale data warning
- `ExchangeHealthDot.tsx` — Exchange status dot
- `ExchangeLogos.tsx` — Exchange logo registry
- `TokenIcon.tsx` — Token icon resolver
- `UpdatedAgo.tsx` — "Updated X ago" text
- `TimeoutLoader.tsx` — Loading with timeout fallback
- `Skeleton.tsx` — Loading skeleton
- `ReferralBanner.tsx` — Referral promo banner
- `ShareButton.tsx` — Share/copy link button
- `WatchlistStar.tsx` — Add-to-watchlist star
- `SoundToggle.tsx` — Sound enable/disable

**Market Widgets:**
- `FearGreedIndex.tsx` — Fear & Greed gauge
- `OIChangeWidget.tsx` — OI change widget
- `TopMovers.tsx` — Top movers strip
- `StatsOverview.tsx` — Stats overview panel
- `MarketIndices.tsx` — Market index display
- `LongShortRatio.tsx` — L/S ratio bar
- `LiquidationHeatmap.tsx` — Liq heatmap component

**Data Providers:**
- `Providers.tsx` — App-level providers (theme, SWR, auth)
- `SWRProvider.tsx` — SWR configuration
- `AlertEngine.tsx` — Background alert processing
- `EventsCalendar.tsx` — Calendar component

**UI (`src/components/ui/`):**
- `ErrorDisplay.tsx` — Error state display
- `LiveIndicator.tsx` — Live data pulse dot
- `LoadingSpinner.tsx` — Loading spinner

**Brand (`src/components/brand/`):**
- `Logo.tsx` — Brand logo variants
- `BrandAssets.tsx` — Brand asset showcase

**Charts (`src/components/charts/`):**
- `LightweightChart.tsx` — TradingView Lightweight Charts wrapper
- `PriceSpreadChart.tsx` — Price spread visualization

**Chat (`src/components/chat/`):**
- `ChatWidget.tsx` — Chat drawer container
- `ChatInput.tsx` — Message input
- `ChatMessages.tsx` — Message list (aria-live)
- `ChatMessage.tsx` — Single message bubble
- `ChatSuggestions.tsx` — Suggested prompts
- `GuardIcon.tsx` — AI guardrail icon

**Dashboard (`src/components/dashboard/`):**
- `DashboardGrid.tsx` — Widget grid layout
- `DashboardHeader.tsx` — Dashboard header/controls
- `WidgetPicker.tsx` — Widget selection dialog
- `WidgetWrapper.tsx` — Widget frame/chrome
- `WidgetErrorBoundary.tsx` — Per-widget error boundary
- `WidgetSkeleton.tsx` — Widget loading skeleton
- `AnimatedValue.tsx` — Animated number transition
- `UpdatedAgo.tsx` — Widget freshness
- `LayoutPresets.tsx` — Dashboard layout presets

**Dashboard Widgets (`src/components/dashboard/widgets/`) — 23:**
- AlertsWidget, AltseasonWidget, ArbitrageWidget
- BtcChartWidget, BtcPriceWidget, DominanceWidget
- EconomicCalendarWidget, ExchangeStatusWidget
- FearGreedWidget, FearGreedChartWidget
- FundingHeatmapWidget, LiquidationsWidget
- LongShortWidget, MarketOverviewWidget
- NewsWidget, OiChartWidget, PortfolioWidget
- StablecoinFlowsWidget, TokenUnlocksWidget
- TopMoversWidget, TrendingWidget
- WalletsWidget, WatchlistWidget

### Page-Specific Components — 86 files

**Admin Panel (`admin-panel/components/`) — 19:**
ActionsTab, AlertHealthPanel, AlertsTab, AuditTimeline, CollectorHealth, ConfirmModal, DatabasePanel, DatabaseTab, DataQualityPanel, ExchangeStatusBoard, HeatmapChart, OverviewTab, PipelineTab, StatCardWithSparkline, TabBar, Toast, AdminSkeletons, UserDetailDrawer, UsersTab

**Chart (`chart/components/`) — 3:**
ChartErrorBoundary, CryptoMetricsPanel, TapeSidebar

**Exchange Comparison (`exchange-comparison/components/`) — 1:**
ComparisonCharts

**Execution Costs (`execution-costs/components/`) — 7:**
AssetSelector, CostBreakdownTable, DepthChart, DirectionToggle, SizeSelector, SlippageHeatmap, VenueCard

**Fear & Greed (`fear-greed/components/`) — 1:**
FearGreedChart

**Funding (`funding/components/`) — 19:**
CorrelationMatrix, DexCexComparison, FundingHeatmapView, FundingHistoryChart, FundingSparkline, FundingSpreadComparison, FundingStats, FundingTableView, Pagination, SpotArbitrageView, WeightedFundingIndex
*arbitrage/*: ComparisonDrawer, ExpandedPanel, FundingArbitrageView, GradeBadge, PriceArbitrageView, ProfitCalculator

**Liquidations (`liquidations/components/`) — 6:**
LiquidationBottomBar, LiquidationChart, LiquidationFeed, LiquidationFeedRow, LiquidationTopBar, LiquidationTreemap

**Long/Short (`longshort/components/`) — 1:**
LSChart

**Market Cycle (`market-cycle/components/`) — 1:**
MarketCycleCharts

**Open Interest (`open-interest/components/`) — 1:**
OIHistoryChart

**Orderflow (`orderflow/components/`) — 3:**
ExchangeDepthTable, MultiDepthChart, TapeView

**Portfolio (`portfolio/components/`) — 1:**
AllocationPieChart

**Prediction Markets (`prediction-markets/components/`) — 3:**
ArbitrageView, BrowseView, StatsCards

**Settings (`settings/components/`) — 7:**
ConnectedAccountsSection, DangerZoneSection, DataExportSection, NotificationsSection, ProfileHeroSection, SecuritySection, TwoFactorSection

**Spreads (`spreads/components/`) — 12:**
*Alerts/*: AlertToast | *Chart/*: SpreadChart | *Controls/*: AlertConfig, TimeframeBar, ViewModeToggle | *ExchangePicker/*: ExchangePicker | *Stats/*: ArbCalculator, SpreadStatsBar | *SymbolPicker/*: SymbolPicker | *Table/*: ExchangeTable, TickerStrip | *Toolbar/*: ExportCSV

**Token Unlocks (`token-unlocks/components/`) — 1:**
WeeklyChart

---

## 5. Hooks

### Global Hooks (`src/hooks/`) — 16

| Hook | Purpose |
|------|---------|
| `useAlertEngine.ts` | Background alert evaluation engine |
| `useApiData.ts` | Generic API data fetching |
| `useAvatarUpload.ts` | Avatar upload + crop |
| `useFlash.ts` | Flash/notification messages |
| `useFundingPrefs.ts` | Funding page preferences (localStorage) |
| `useMultiExchangeLiquidations.ts` | Multi-exchange liq WebSocket |
| `useMultiExchangeWS.ts` | Multi-exchange WebSocket manager |
| `usePushNotifications.ts` | Web Push API subscription |
| `useRealtimeLiquidations.ts` | Single exchange liq WebSocket |
| `useRealtimeTrades.ts` | Binance aggTrade WebSocket |
| `useSound.ts` | Web Audio API sound system |
| `useSortTable.ts` | Table sort state manager |
| `useSWRApi.ts` | SWR wrapper with auth |
| `useTheme.ts` | Dark/light theme toggle |
| `useTimeAgo.ts` | Relative time formatting |
| `useUserSync.ts` | User prefs sync to DB |

### Spreads-Specific Hooks (`src/app/spreads/hooks/`) — 6

| Hook | Purpose |
|------|---------|
| `useAlertSystem.ts` | Spread alert configuration + evaluation |
| `useFlash.ts` | Flash for spread page |
| `useKeyboardShortcuts.ts` | Keyboard shortcuts (1-7 timeframes, T tape, Esc) |
| `useSpreadData.ts` | Spread data fetching + WebSocket |
| `useSpreadState.ts` | Spread page state management |
| `useURLSync.ts` | URL param sync (?s=ETH&tf=240&ac=crypto) |

---

## 6. Libraries & Utilities

### API Layer (`src/lib/api/`) — 10

| File | Purpose |
|------|---------|
| `index.ts` | Main API client + cache layer |
| `types.ts` | API type definitions |
| `rate-limit.ts` | Upstash Redis rate limiter |
| `v1-auth.ts` | V1 API key authentication |
| `aggregator.ts` | Multi-exchange data aggregator |
| `coingecko.ts` | CoinGecko API client |
| `tokenunlocks.ts` | TokenUnlocks API client |
| `dydx.ts` | dYdX protocol client |
| `coinmarketcal.ts` | CoinMarketCal API client |
| `prediction-markets/` | types.ts, mappings.ts |

### Authentication (`src/lib/auth/`) — 4

| File | Purpose |
|------|---------|
| `index.ts` | NextAuth config (providers, callbacks) |
| `adapter.ts` | PostgreSQL adapter for NextAuth |
| `password.ts` | bcrypt password hashing |
| `rate-limit.ts` | Auth-specific rate limiting |

### Storage / localStorage (`src/lib/storage/`) — 8

| File | Purpose |
|------|---------|
| `watchlist.ts` | Watchlist CRUD |
| `portfolio.ts` | Portfolio positions |
| `wallets.ts` | Tracked wallets |
| `alerts.ts` | Alert rules |
| `chat.ts` | Chat history |
| `screenerPresets.ts` | Screener filter presets |
| `priceHistory.ts` | Local price cache |
| `fundingHistory.ts` | Local funding cache |

### Constants (`src/lib/constants/`) — 5

| File | Purpose |
|------|---------|
| `index.ts` | App-wide constants |
| `exchanges.ts` | Exchange definitions (30 exchanges, logos, URLs) |
| `symbols.ts` | Symbol mappings + normalization |
| `thresholds.ts` | Alert/color thresholds |
| `famous-wallets.ts` | Known whale wallet addresses |

### Execution Costs (`src/lib/execution-costs/`) — 20

| File | Purpose |
|------|---------|
| `types.ts` | Venue/orderbook types |
| `calculator.ts` | Slippage + fee calculator |
| `book-walker.ts` | Orderbook walk-through engine |
| `symbol-map.ts` | Symbol normalization per venue |
| `venues/index.ts` | Venue registry |
| `venues/*.ts` | 15 venue adapters: Hyperliquid, dYdX, Aster, Aevo, Lighter, edgeX, Drift, Extended, Variational, Binance, Bybit, OKX, Bitget, GMX, gTrade |

### Spreads Lib (`src/app/spreads/lib/`) — 5

| File | Purpose |
|------|---------|
| `types.ts` | Spread page type definitions |
| `spread-math.ts` | Spread calculation formulas |
| `exchange-colors.ts` | Per-exchange color mapping |
| `symbols.ts` | Symbol list for spread page |
| `trader-slang.ts` | Trader slang tooltips |

### Core Utilities

| File | Purpose |
|------|---------|
| `src/lib/utils/format.ts` | Number/currency/date formatting |
| `src/lib/db/index.ts` | PostgreSQL connection pool (postgres.js) |
| `src/lib/seo.ts` | Centralized `pageMetadata()` for 58 layouts |
| `src/lib/market-data.ts` | Market data aggregation |
| `src/lib/arbitrage-detector.ts` | Cross-exchange arb detection |
| `src/lib/liquidation-parsers.ts` | Exchange-specific liq parsing |
| `src/lib/currency-status.ts` | Trading pair status checking |
| `src/lib/spot-withdrawal-fees.ts` | Withdrawal fee data |
| `src/lib/coinIcons.ts` | Coin icon URL resolver |
| `src/lib/telegram.ts` | Telegram Bot API client |
| `src/lib/notifications.ts` | Push notification sender |
| `src/lib/referralLinks.ts` | Referral link generation |
| `src/lib/logging/index.ts` | Structured logging |
| `src/lib/validation/schemas.ts` | Zod validation schemas |
| `src/lib/data/economic-events.ts` | Economic event definitions |

### Types (`src/types/`) — 2

| File | Purpose |
|------|---------|
| `index.ts` | Core type definitions (FundingRateData, OIData, TickerData, etc.) |
| `next-auth.d.ts` | NextAuth session type augmentation |

### Middleware

| File | Purpose |
|------|---------|
| `src/middleware.ts` | Rate limiting, auth checks, CORS |

---

## 7. Backend Services

### A. infohub-collector (PM2, 15-min cron)

| Property | Value |
|----------|-------|
| **Location** | `/infohub-collector/` |
| **Language** | JavaScript (ES modules) |
| **Entry** | `collector.mjs` |
| **Health** | `health.mjs` (port 3001) |
| **PM2** | Single instance, 256MB max |
| **Database** | PostgreSQL (5 connections, 20s idle) |
| **Purpose** | Collects funding rates + OI from all 30 exchanges every 15 min |
| **Retention** | 30 days auto-pruning |
| **Batch size** | 50 items per INSERT |

**Tables written**: `funding_snapshots`, `oi_snapshots`, `liquidation_snapshots`

### B. price-aggregator (systemd, real-time)

| Property | Value |
|----------|-------|
| **Location** | `/price-aggregator/` |
| **Language** | JavaScript (ES modules) |
| **Entry** | `index.mjs` (port 3100) |
| **Process** | systemd service (auto-restart) |
| **Database** | None (in-memory only) |
| **Purpose** | Real-time price feeds from 40+ exchanges via WebSocket + REST |

**WebSocket feeds (9)**: Binance, Bybit, OKX, Bitget, MEXC, Hyperliquid, Kraken, Coinbase, Deribit

**REST polling (30+)**: KuCoin, HTX, Bitfinex, BingX, Phemex, CoinEx, Bitunix, WhiteBIT, dYdX, Lighter, Aevo, Drift, Extended, Variational, Nado, Backpack, Orderly, Paradex, edgeX, gTrade, GMX, etc.

**Endpoints**:
- `GET /prices` — All prices (filterable `?symbol=`)
- `GET /spreads` — Pre-computed spreads
- `GET /health` — Per-exchange connection status

### C. liquidation-ingester (PM2, WebSocket)

| Property | Value |
|----------|-------|
| **Location** | `/workers/liquidation-ingester.ts` |
| **Language** | TypeScript (tsx runtime) |
| **PM2** | Single instance, 256MB max |
| **Database** | PostgreSQL |
| **Purpose** | Real-time liquidation event ingestion from 9 exchanges |

**Exchange WebSocket feeds**: Binance, Bybit, OKX, Bitget, Deribit, MEXC, BingX, HTX, gTrade

**Buffer**: In-memory queue, flushes every 2s, 50 items per batch

**Table written**: `liquidation_snapshots` (dedup via unique constraint)

### D. proxy-worker (Cloudflare Worker)

| Property | Value |
|----------|-------|
| **Location** | `/proxy-worker/` |
| **Language** | TypeScript |
| **Platform** | Cloudflare Workers |
| **Purpose** | Bypass Cloudflare IP blocks for restricted exchanges |
| **Rate limit** | 300 req/min per IP |

**Allowed targets**: `www.bitmex.com`, `api.gateio.ws`, `pro.edgex.exchange`, `query1.finance.yahoo.com`, `query2.finance.yahoo.com`

### E. proxy (Legacy Cloudflare Worker)

| Property | Value |
|----------|-------|
| **Location** | `/proxy/` |
| **Language** | JavaScript |
| **Purpose** | Legacy proxy for BitMEX + Gate.io |

### F. cf-proxy (Durable Objects Worker)

| Property | Value |
|----------|-------|
| **Location** | `/cf-proxy/` |
| **Language** | JavaScript |
| **Platform** | Cloudflare Durable Objects + SQLite |
| **Purpose** | Stateful proxy variant |

### G. audit-system (Python, multi-agent)

| Property | Value |
|----------|-------|
| **Location** | `/audit-system/` |
| **Language** | Python 3.11+ |
| **Framework** | Playwright + Streamlit |
| **Purpose** | 18 concurrent agents audit all dashboard pages |

**Components**: base_agent, specialist_agent (per-page), supervisor_agent

**Scoring**: UI/UX, data accuracy, real-time fidelity, bug risk

**Output**: HTML/JSON/Markdown reports in `audit_reports/`

---

## 8. Database Schema

**Provider**: DigitalOcean Managed PostgreSQL
**Driver**: `postgres.js` (PgBouncer transaction mode, 3 pools)
**SSL**: Required | **Idle timeout**: 5s | **Connect timeout**: 10s

### Authentication & Users

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `users` | id, email, name, email_verified, password_hash, role, image | Core user accounts |
| `accounts` | id, user_id, provider, provider_account_id, type | OAuth provider links |
| `sessions` | id, session_token, user_id, expires | Active sessions |
| `verification_tokens` | identifier, token, expires | Email verification |
| `email_verification_codes` | id, user_id, code, expires_at | 6-digit email codes |
| `twofa_login_codes` | id, user_id, code, expires_at | 2FA email challenges |
| `user_2fa` | id, user_id, totp_secret, backup_codes, enabled | TOTP configuration |
| `password_reset_tokens` | id, user_id, token, expires_at | Password reset (1hr TTL) |

### Market Data (30-day retention)

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `funding_snapshots` | symbol, exchange, rate, predicted_rate, mark_price, ts | Funding rates per exchange |
| `oi_snapshots` | symbol, exchange, open_interest_usd, ts | Open interest per exchange |
| `spread_snapshots` | symbol, spread_pct, high_exchange, low_exchange, ts | Price spread snapshots |
| `liquidation_snapshots` | symbol, exchange, side, price, quantity, value_usd, ts | Liquidation events |
| `arb_opportunities` | symbol, long_exchange, short_exchange, spread, ts | Active arb detection |

### User Features

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `watchlists` | user_id, symbols (jsonb) | User watchlists |
| `user_prefs` | user_id, prefs (jsonb) | Dashboard layout, theme, etc. |
| `alert_notifications` | user_id, alert_type, symbol, message, ts | Alert audit trail (7-day) |
| `portfolio_snapshots` | user_id, holdings (jsonb), total_value, ts | Daily portfolio snapshots |

### API & Integrations

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `api_keys` | user_id, key_hash, name, permissions | V1 API keys (SHA256, max 5/user) |
| `telegram_users` | telegram_id, user_id, chat_id | Telegram account links |
| `telegram_alerts` | telegram_user_id, alert_config (jsonb) | Telegram alert rules |
| `telegram_cooldowns` | telegram_user_id, alert_type, last_sent | Alert throttling |
| `telegram_report_schedule` | telegram_user_id, schedule, config | Scheduled reports |
| `push_subscriptions` | user_id, endpoint, p256dh, auth | Web Push subscriptions |

### Admin & Cache

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `admin_monitoring` | metric, value, details (jsonb), ts | Admin metrics |
| `api_cache` | key, value (jsonb), expires_at | L2 persistent cache |

### Key Indexes

```
idx_funding_sym_ts        (symbol, ts DESC)
idx_funding_sym_ex_ts     (symbol, exchange, ts)
idx_oi_sym_ts             (symbol, ts DESC)
idx_liq_dedup             (symbol, exchange, side, price, ts) UNIQUE
idx_api_cache_expires_at  (expires_at DESC)
idx_api_keys_hash         (key_hash)
idx_alert_notif_user      (user_id, ts DESC)
idx_portfolio_user_ts     (user_id, ts DESC)
```

---

## 9. External APIs & Integrations

### Exchange APIs (30 exchanges)

**CEX (16)**: Binance, Bybit, OKX, Bitget, MEXC, Kraken, BingX, Phemex, Bitunix, KuCoin, HTX, Bitfinex, WhiteBIT, Coinbase, CoinEx, Gate.io

**DEX (12)**: Hyperliquid, dYdX, Aster, Lighter, Aevo, Drift, GMX, gTrade, Extended, Variational, edgeX, Nado

**Blocked (2)**: BitMEX, Gate.io (Cloudflare on datacenter IPs)

**Coverage**:

| Data Type | Count | Notes |
|-----------|-------|-------|
| Funding rates | 30/30 | All exchanges |
| Tickers/prices | 28/30 | All except blocked |
| Open interest | 26/30 | No Bitunix, no blocked |
| Options | 4 | Binance, Bybit, Deribit, OKX |
| Liquidations (RT) | 9 | Binance, Bybit, OKX, Bitget, Deribit, MEXC, BingX, HTX, gTrade |

### Third-Party Data APIs

| Service | Purpose | Used In |
|---------|---------|---------|
| CoinGecko | Prices, dominance, reserves | Multiple endpoints |
| CoinMarketCap | Coin data, fear/greed, global stats | `/api/coin-data`, `/api/fear-greed`, `/api/global-stats` |
| CoinMarketCal | Economic events | `/api/economic-calendar` |
| TokenUnlocks | Token unlock schedules | `/api/token-unlocks` |
| CryptoCompare | News aggregation | `/api/news` |

### Infrastructure APIs

| Service | Purpose |
|---------|---------|
| Resend | Transactional email (verification, 2FA, password reset) |
| Anthropic Claude | AI chat feature |
| Telegram Bot API | Alerts, reports, weekly digests |
| Web Push (VAPID) | Browser push notifications |
| Upstash Redis | Rate limiting |
| Vercel Analytics | Frontend analytics |
| Sentry | Error tracking |
| AWS S3 / Vercel Blob | Avatar + image storage |

---

## 10. Configuration & Deployment

### Environment Variables

```
DATABASE_URL          PostgreSQL connection string (SSL required)
AUTH_SECRET           NextAuth secret (openssl rand -base64 32)
AUTH_URL              App URL (https://info-hub.io)
AUTH_GOOGLE_ID        Google OAuth client ID
AUTH_GOOGLE_SECRET    Google OAuth secret
AUTH_DISCORD_ID       Discord OAuth client ID
AUTH_DISCORD_SECRET   Discord OAuth secret
CMC_API_KEY           CoinMarketCap API key
RESEND_API_KEY        Resend email API key
ANTHROPIC_API_KEY     Anthropic Claude API key
PROXY_URL             Cloudflare proxy worker URL
TELEGRAM_BOT_TOKEN    Telegram bot token
TELEGRAM_WEBHOOK_SECRET  Telegram webhook verification
UPSTASH_REDIS_REST_URL   Upstash Redis URL
UPSTASH_REDIS_REST_TOKEN Upstash Redis token
CRON_SECRET           Bearer token for cron routes
NEXT_PUBLIC_VAPID_PUBLIC_KEY  Web Push VAPID public key
VAPID_PRIVATE_KEY     Web Push VAPID private key
INFOHUB_BASE_URL      Base URL for collector (https://info-hub.io)
HEALTH_PORT           Collector health port (3001)
```

### Build & Deploy

| Target | Command | Platform |
|--------|---------|----------|
| Frontend | `next build` → `vercel --prod` | Vercel (Mumbai bom1) |
| Collector | `pm2 start ecosystem.config.cjs` | DigitalOcean Droplet |
| Liq Ingester | `pm2 start workers/liquidation-ingester.ts` | DigitalOcean Droplet |
| Price Aggregator | `systemctl start price-aggregator` | DigitalOcean Droplet |
| Proxy Workers | `wrangler deploy` | Cloudflare Workers |
| Audit System | `python dashboard_auditor.py` | Local/CI |

### Config Files

| File | Purpose |
|------|---------|
| `next.config.js` | Next.js config (images, headers, rewrites) |
| `tailwind.config.js` | Tailwind theme + plugins |
| `tsconfig.json` | TypeScript compiler options |
| `package.json` | Dependencies + scripts |
| `vercel.json` | Vercel project config |
| `ecosystem.config.cjs` | PM2 process config (collector + liq-ingester) |
| `wrangler.toml` x 3 | Cloudflare Worker configs |

---

## Summary

| Metric | Count |
|--------|-------|
| Frontend pages | 70 routes |
| API routes | 114 endpoints |
| React components | 171 files (85 shared + 86 page-specific) |
| Hooks | 22 files |
| Library/utility files | 60+ |
| Backend services | 7 |
| Database tables | 20+ |
| Database indexes | 10+ |
| Exchanges integrated | 30 (16 CEX + 12 DEX + 2 blocked) |
| External APIs | 12+ services |
| Cron jobs | 9 |
| Dashboard widgets | 23 |
| Execution cost venues | 15 |
