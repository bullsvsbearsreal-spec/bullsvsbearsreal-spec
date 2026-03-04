# Profile Page, Dashboard Improvements & Telegram Bot Enhancements

**Date**: 2026-03-04
**Status**: Approved

---

## Part 1: `/profile` Page

**Route**: `/profile` (auth-required)

### Layout
1. **Profile Header** — Avatar (clickable upload), editable display name, email (read-only), member since, role badge
2. **Bio** — Editable textarea (280 chars max), saved to `user_prefs.prefs.bio`
3. **Display Preferences** — Default currency (USD/EUR/GBP), default exchange filter, funding display (1h/8h/annualized)
4. **Activity Summary** — Cards: watchlist count, alert count, portfolio value, days active
5. **Recent Activity Feed** — Last 20 alert triggers from `alert_notifications` table

**Storage**: Extend `user_prefs.prefs` JSONB with `bio`, `displayPrefs.currency`, `displayPrefs.defaultExchange`, `displayPrefs.fundingDisplay`. No DB migration needed.

---

## Part 2: Dashboard Improvements

- **Mobile**: Single-column on `<768px`, widget collapse/expand
- **Loading**: Per-widget skeleton loaders, staggered fetching (visible-first)
- **Persistence**: Debounce layout saves, fallback: DB → localStorage → defaults

---

## Part 3: Telegram Bot — 6 New Commands

| Command | Data Source | Output |
|---------|-----------|--------|
| `/basis [BTC]` | `/api/funding` → compute basis | Top 5 premium + discount |
| `/rsi [BTC]` | `/api/rsi` | RSI-14 across 1h/4h/1d |
| `/whale` | `/api/whale-alert` | Last 5 whale movements |
| `/dominance` | `/api/dominance` | BTC/ETH/SOL dominance % |
| `/feargreed` | `/api/fear-greed` | Index value + 7-day trend |
| `/yields` | `/api/yields` | Top 5 DeFi yields by APY |

---

## Part 4: Telegram Interactive Main Menu

**`/menu` command** with inline keyboard:
```
[Trading]  [Markets]
[Alerts]   [Reports]
```

Sub-menus:
- **Trading**: Price, Funding, Basis, OI, Liquidations
- **Markets**: Top Movers, RSI, Dominance, Fear & Greed, Yields
- **Alerts**: List, Add, Scan
- **Reports**: Daily Summary (subscribe/unsubscribe)

**Pagination**: `/top`, `/funding`, `/liq` — 5 items/page, Prev/Next buttons via `page:cmd:N` callbacks.

---

## Part 5: Telegram Scheduled Reports

**Cron**: `/api/cron/telegram-reports` at `0 8 * * *` (daily 8 AM UTC)

**Daily report**:
- BTC price + 24h change
- Top 3 gainers/losers
- Highest/lowest funding rates
- Total liquidations (24h)
- Fear & Greed index
- Notable whale movements

**Opt-in**: `/subscribe daily` / `/unsubscribe daily`. Stored in `telegram_users.report_schedule` (new TEXT column, values: `'daily'`, `'weekly'`, `NULL`).

---

## Part 6: Telegram Chart Images

**Approach**: `@napi-rs/canvas` (~15MB) for server-side rendering. No Puppeteer.

**Endpoint**: `GET /api/charts/telegram?type=funding&symbol=BTC` → PNG buffer

**Chart types**:
- Funding rate bar chart (per exchange)
- RSI heatmap grid
- Mini price sparkline

**Specs**: 400x300px, dark theme, sent via `sendPhoto()`.

---

## Files

### Create
- `src/app/profile/page.tsx`
- `src/app/api/cron/telegram-reports/route.ts`
- `src/app/api/charts/telegram/route.ts`

### Modify
- `src/app/api/telegram/webhook/route.ts` — 6 new commands, /menu, pagination, /subscribe
- `src/lib/telegram.ts` — `sendPhoto()` helper
- `src/app/dashboard/page.tsx` — mobile layout, loading, persistence
- `src/lib/db/index.ts` — `report_schedule` column, profile prefs helpers
- `vercel.json` — add telegram-reports cron
- `package.json` — add `@napi-rs/canvas`

---

## Execution Order
1. Profile page (standalone, no deps)
2. Dashboard improvements (standalone)
3. Telegram new commands (uses existing APIs)
4. Telegram interactive menu + pagination
5. Telegram scheduled reports (needs DB column + cron)
6. Telegram chart images (needs @napi-rs/canvas + new API route)
