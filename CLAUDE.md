# CLAUDE.md — InfoHub architecture & operations

Quick orientation for Claude sessions on this repo. **Read this first** before
making infra-shaped changes.

---

## Stack

| Layer | Where | Notes |
| --- | --- | --- |
| Web (Next.js 14, App Router) | DigitalOcean App Platform · FRA1 · 2 GB | Auto-deploys on push to `main` |
| Price aggregator (WS) | DigitalOcean droplet `infohub-aggregator` (FRA1, `46.101.247.54`) | systemd unit `infohub-aggregator.service` running `/opt/infohub-aggregator/index.mjs` |
| Crons (13 jobs) | Same droplet, systemd timers | All hit `https://info-hub.io/api/cron/<name>` with `Authorization: Bearer $CRON_SECRET` |
| DNS | Cloudflare (gray cloud / DNS-only) → CNAME flatten → `infohub-web-hg4id.ondigitalocean.app` | Cloudflare proxy is gray for now — DO's CDN already fronts the app via `*.ondigitalocean.app` |
| SSL | Let's Encrypt via DO App Platform | Auto-renewed |
| Domain registrar | Njalla | DNS delegated to Cloudflare |
| Auth | NextAuth v5 + Postgres adapter | `trustHost: true` |
| Cache / queues | Upstash Redis | |
| Errors | Sentry | DSN gated by `NEXT_PUBLIC_SENTRY_DSN` |
| Email | Resend | |

**Important:** the project was migrated off Vercel on 2026-05-03. The Vercel
project is deleted. Anything in code that still references `process.env.VERCEL_URL`
or `@vercel/analytics` / `@vercel/speed-insights` is a leftover and should be
removed; use `process.env.NEXT_PUBLIC_BASE_URL` (set to `https://info-hub.io`)
instead. `@vercel/blob` is still used for avatar uploads — Vercel Blob stores
are team-scoped, so the token still works post-project-deletion. Keep it
unless someone wants a clean break to DO Spaces.

---

## Operating the droplet

```bash
ssh root@46.101.247.54

# Aggregator
systemctl status infohub-aggregator
journalctl -u infohub-aggregator -n 200 -f

# Crons (13 timers, all hit info-hub.io/api/cron/*).
# Note: /api/cron/watch-hl-wallets does NOT have its own timer —
# it piggybacks on the snapshot cron's tail-call (see "Wallet
# Watch" section below). One cron handles both jobs every 60s.
systemctl list-timers --all 'infohub-cron-*'
journalctl -u 'infohub-cron@*' --since '10 minutes ago' --output=cat | grep 'HTTP'

# Cron secret
cat /etc/infohub-cron.env   # mode 600, contains only CRON_SECRET=...
```

The 13 cron timers and their schedules:

| Endpoint | Schedule |
| --- | --- |
| `/api/cron/snapshot` | every minute |
| `/api/cron/ingest-liquidations` | every minute |
| `/api/cron/sync-positions` | every minute |
| `/api/cron/whale-trades` | every 2 min |
| `/api/cron/alerts` | every 5 min |
| `/api/cron/check-position-alerts` | every 5 min |
| `/api/cron/auto-tweet` | every 5 min |
| `/api/cron/social-fetch` | every 15 min |
| `/api/cron/refresh-etf-flows` | every 30 min |
| `/api/cron/refresh-validators` | every 30 min |
| `/api/cron/warm-smart-money` | every 25 min |
| `/api/cron/portfolio-snapshot` | daily at 12:00 UTC |
| `/api/cron/telegram-daily` | daily at 08:00 UTC |

To add or change a cron, edit `/etc/systemd/system/infohub-cron-<name>.timer`
plus the shared template `infohub-cron@.service`, then `systemctl daemon-reload`
and `systemctl enable --now infohub-cron-<name>.timer`.

---

## Deploys

`git push origin main` → DO App Platform builds + auto-deploys (3-5 min).
Watch via `https://cloud.digitalocean.com/apps/0842fb18-dd91-46de-bd7a-2fc1d3a31305`.

The build runs `npm run build` (Heroku Node.js buildpack, NOT the Dockerfile —
DO ignored the `Dockerfile` we wrote and used the buildpack auto-detect).
A working detector for "new build live" is to poll until a known chunk hash
in the served HTML changes:

```bash
old_chunk=$(curl -s 'https://info-hub.io/' | grep -oE 'app/layout-[a-f0-9]+\.js' | head -1)
until ! curl -s 'https://info-hub.io/' --max-time 8 | grep -q "$old_chunk"; do sleep 25; done
```

---

## Conventions in this codebase

### Slow upstream fetches: always wrap in L1 + CF cache

Public API routes that fan out to upstream APIs (Binance, OKX, Polymarket,
Hyperliquid, etc.) **must** have:

1. An in-process `l1Cache` (Map or single slot) with a TTL appropriate to the
   data freshness — 60s for price-ish, 3-5 min for slow-moving things.
2. A `Cache-Control: public, s-maxage=N, stale-while-revalidate=M` header
   on the success path so Cloudflare can cache at the edge.
3. Cache **only** non-empty / partial-success responses — never pin a
   "all upstreams down" empty body.

Pattern:

```ts
let l1Cache: { body: Resp; ts: number } | null = null;
const L1_TTL = 3 * 60 * 1000;

export async function GET() {
  if (l1Cache && Date.now() - l1Cache.ts < L1_TTL) {
    return NextResponse.json(l1Cache.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=600' },
    });
  }
  // ... fetch upstream, build response ...
  if (response.hasUsefulData) l1Cache = { body: response, ts: Date.now() };
  return NextResponse.json(response, {
    headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=600' },
  });
}
```

For per-symbol routes, use `Map<symbol, entry>` instead of a single slot —
otherwise switching symbols trashes the cache (the original liquidation-map
bug, which produced 8s loads on every BTC↔ETH↔SOL toggle).

### Fee Model surface on v1 API (May 2026)

Every fee-sensitive v1 endpoint exposes the canonical fee schedule so
partners can verify the assumption baked into net-PnL calculations or
recompute under their own fill model. Lives in
`src/lib/constants/exchanges.ts`:

```ts
export const FEE_MODEL_VERSION = 'v1.0-2026-02-01';
export const FEE_MODEL_UPDATED_AT = '2026-02-01T00:00:00Z';
export function getFeeScheduleSnapshot(): { version, updatedAt, unit, schedule };
```

**Bumping discipline.** Any edit to `EXCHANGE_FEES` MUST bump the minor
digit of `FEE_MODEL_VERSION` and update `FEE_MODEL_UPDATED_AT` to match.
Test `src/lib/constants/__tests__/exchanges-fees.test.ts` locks the
contract.

**Where it surfaces:**

| Endpoint | meta.feeModel | X-Fee-Model-Version | Auth |
| --- | --- | --- | --- |
| `/api/v1/arbitrage` | full schedule + per-row maker/taker | ✅ | required |
| `/api/v1/spreads` | full schedule + per-row maker/taker | ✅ | required |
| `/api/v1/funding-arb` | full schedule (scope='gross') | ✅ | required |
| `/api/v1/exchanges` | identifiers only | ✅ | required |
| `/api/v1/status` | identifiers + surfacedOn[] | ✅ | none |
| `/api/v1/openapi` | (header only) | ✅ | none |
| `/api/v1/*` 401 path | (header only) | ✅ | n/a |
| `/api/execution-costs` | (header only) | ✅ | none |

All percent-per-trade. Maker may be negative (e.g. Nado, Deribit, BitMEX,
Hyperliquid VIP tiers — see `EXCHANGE_FEES` for which). Bump-detect via
`meta.feeModel.version` or `X-Fee-Model-Version` (cheap HEAD on /status
or any v1 endpoint's 401 path).

### Aggregate / summary modes on v1 endpoints

Most market-data v1 endpoints support a flag to switch from per-venue
rows to one-row-per-symbol roll-ups:

| Endpoint | Flag | Aggregate row shape |
| --- | --- | --- |
| `/api/v1/funding` | `?aggregate=1` | `{ symbol, venueCount, avgRate8h, minRate8h, minExchange, maxRate8h, maxExchange, spread8h }` (sorted by spread desc) |
| `/api/v1/openinterest` | `?aggregate=1` | `{ symbol, openInterestUsd, venueCount, venues[], changes? }` |
| `/api/v1/tickers` | `?aggregate=1` | `{ symbol, lastPrice (median), high24h (max), low24h (min), volume24h (dedup-summed), priceChange24hPct (mean), venueCount }` |
| `/api/v1/liquidations` | `?summary=1` (+ symbol required) | `{ symbol, hours, totalCount, totalVolumeUsd, longVolumeUsd, shortVolumeUsd, longShare, largest? }` |
| `/api/v1/openinterest` | `?changes=1` | adds `{ pct1h, pct4h, pct24h }` to each row |

`meta.mode` reports which shape the caller is getting ('per-venue' /
'aggregate' / 'feed' / 'summary') so consumers can sanity-check.

### /chart — terminal-style multi-band trading view (May 2026)

The `/chart` page is a TradingView Advanced Chart widget surrounded by
6 horizontal info-bands and (when the user is signed in) an open-position
strip. Every band is data-driven from existing aggregator endpoints —
no new server routes were added.

Layout (top → bottom inside `#main-content`):

| Band | File | Source |
| --- | --- | --- |
| Top control bar | `chart/page.tsx` | local state |
| Quick symbol bar | `chart/page.tsx` | favourites + recents (localStorage) |
| `<ChartStatsBar>` | `chart/components/ChartTerminalStrips.tsx` | tickers + funding + OI + L/S + klines |
| `<ChartAiStrip>` | same file | derived signals (no model call) |
| `<ChartPositionStrip>` | `chart/components/ChartPositionStrip.tsx` | `/api/account/positions` |
| TradingView iframe | `chart/page.tsx::TradingViewChart` | TradingView |
| `<CryptoMetricsPanel>` | `chart/components/CryptoMetricsPanel.tsx` | tickers + funding + OI + history |
| `<ChartSignalsStrip>` | `chart/components/ChartSignalsStrip.tsx` | derived from the same data |
| `<ChartVenueFundingStrip>` | `chart/components/ChartTerminalStrips.tsx` | funding per-venue + OI per-venue |

Data hooks (all in `hooks/useSWRApi.ts`, all keyed so multiple bands
share one in-flight fetch):

- `useTickers()` → `/api/tickers` (60s refresh, dedup-by-exchange)
- `useFundingRates('crypto')` → `/api/funding?assetClass=crypto` (30s)
- `useOpenInterest()` → `/api/openinterest` (60s)
- `useOIChanges()` → `/api/openinterest?changes=1` (60s, top-20 only)
- `useLongShort('BTCUSDT')` → `/api/longshort` (30s, Binance / OKX fallback)

Client-side TA (`chart/components/useChartIndicators.ts`):

- Direct fetch to `https://fapi.binance.com/fapi/v1/klines` (CORS-friendly),
  fallback to `fapi.binance.me` for geo-blocked clients
- Maps TradingView interval string ('60', 'D', etc.) → Binance interval
- Computes Wilder's RSI(14) + ATR(14) on the last 100 bars
- Returns ATR both absolute and as % of last close (scale-free, comparable
  across BTC vs PEPE)
- 60s refresh — graceful no-op for non-Binance symbols / geo-blocks
- Pure functions covered by 9 unit tests in `__tests__/useChartIndicators.test.ts`

Key gotchas:

- `useTickerStats` (the legacy per-symbol hook still in `chart/page.tsx`)
  picks ONE ticker entry by max price — its `volume24h` is **per-exchange**
  and inflates by ~50× when stacked across venues. ChartStatsBar uses the
  `useTickers()` aggregate instead (deduped by exchange, $100B sanity cap).
- The non-crypto asset tabs (stocks/forex/commodities/indices) skip all
  crypto-only strips and fall back to the simpler inline price strip in
  the top control bar (see the `!isCrypto` branch).
- `#main-content` uses `overflowY: auto` + a `minHeight: 360` chart
  container so the bottom bands stay reachable on small (≤600px) viewports
  while the TradingView candles stay usable.
- Signal copy in `<ChartAiStrip>` is heuristic + deterministic (top-2
  ranked signals joined as one sentence). No actual model call — real
  ChatGPT/Claude integration is a follow-up.

### Wallet Watch — multi-venue position alerter (May 2026)

`/watch` lets users subscribe to any HL or gTrade wallet and get
Telegram pings on opens/closes/size-changes/liq-danger/realized-PnL/
funding-paid. Architecture:

| Layer | File | Purpose |
| --- | --- | --- |
| Schema | `lib/db/index.ts` | 4 tables: `hl_watched_wallets`, `hl_position_snapshots` (PK is `(address, venue)`), `hl_position_events`, `hl_event_notifications` (per-user dedup) |
| Lib (pure) | `lib/hl-watch.ts` | Types + `fetchVenueState(addr, venue)` dispatcher + `diffSnapshots` + `applyThresholds` + `formatEvent` |
| Lib (runtime) | `lib/hl-watch-runner.ts` | `runWatchTick()` with process-local mutex + 30s cooldown |
| Cron entry | `/api/cron/watch-hl-wallets` | Thin wrapper: `verifyCronAuth()` → `runWatchTick()` |
| **Trigger** | `/api/cron/snapshot` tail | Awaits `runWatchTick()` after the snapshot work — piggybacks on the existing 60s droplet timer so we don't need a new systemd timer |
| API | `/api/watch/wallets[/[id]]` | NextAuth-gated CRUD |
| API | `/api/watch/test-ping` | Sends a synthetic Telegram so users can verify delivery |
| UI | `/watch` page | List + add form + edit modal + suggested whales + event log |

Key gotchas:
- Snapshot row PK is **`(address, venue)`** — the migration ALTERs an
  older single-column PK shape if it exists. ON CONFLICT must reference
  both.
- HL `clearinghouseState` doesn't return mark price — derive it via
  `mark = entryPx + unrealizedPnl / szi`. Liq-danger needs mark, NOT
  entry, or it'll never fire (entry is constant).
- gTrade reader doesn't surface running cumulative funding → we set
  `cumFundingAllTime = 0` so `funding_paid` events never emit for
  gTrade wallets.
- The mutex in `runWatchTick` is process-local. Single-instance DO
  App Platform = fine. If we ever scale out, the dedup needs to move
  to DB advisory locks.
- 45 unit tests cover diff/threshold/format edge cases. Gating logic
  (mutex + 30s cooldown) lives in `lib/tickGate.ts` and is covered by
  13 unit tests — including the BlockedConcurrent-callers-share-result
  invariant that's the actual Telegram-spam guard.

### Don't fetch internal `/api/openinterest` style giant payloads to filter
one symbol — refactor the underlying logic into `lib/` and import directly.
The HTTP round-trip + 600 KB payload was the entire reason `/api/liquidation-map`
took 8 s.

### Middleware rate limits

`src/middleware.ts` runs an in-memory sliding-window limiter:

- **Strict** (5 req / 15 min, per IP): the explicit `AUTH_PATHS` set
  (signup, password reset, etc.) **plus** any non-GET method on `/api/auth/*`
  (signin POST, signout POST, callback POST).
- **Moderate** (120 req / min, per IP): everything else under `/api/`.
- **Skipped**: `/api/chat`, `/api/admin/*`, `/api/cron/*`, `/api/telegram/webhook`,
  and `/api/v1/*` (which has its own bearer-token flow).

Read methods on `/api/auth/*` (`/session`, `/csrf`, `/providers`) **must**
fall through to the moderate bucket — NextAuth's `useSession()` fires
`/api/auth/session` on every page load and any user browsing 6 pages in
15 min would otherwise trip the strict limit and see auth errors. This was
broken once already, don't reintroduce it.

### Test suite (May 2026)

`npm run test` runs vitest in node environment (no jsdom) — **~2200 tests
across ~130 files** as of 2026-05-18. Coverage is heaviest in `lib/`,
`api/_shared/`, and the chart / spreads / funding feature areas. Adding
new pure functions to `lib/` should come with a `__tests__/*.test.ts`
sibling. Some patterns worth knowing:

- **Browser-only code** (clipboard, localStorage) tests by stubbing
  `globalThis.window` / `document` / `localStorage`. See
  `lib/__tests__/copyToClipboard.test.ts` and
  `lib/storage/__tests__/fundingHistory.test.ts` for templates.
- **Module-level singletons** (the funding-history accumulator cache,
  rate-limit counters, `CRON_SECRET`) need `vi.resetModules()` in
  `beforeEach` so each test gets a fresh import.
- **Top-level env-var reads** (PROXY_URL, EXCHANGE_KEY_ENCRYPTION_KEY,
  CRON_SECRET) are tested by setting `process.env.X` *before* the
  `await import(...)` inside the test.
- **fetch mocks** use `vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(...))`
  rather than installing `msw` — see `lib/auto-tweet/__tests__/twitter.test.ts`.

The full suite runs in ~10s. Pre-deploy verification:
`npx vitest run` and `npx tsc --noEmit`.

---

## Monetization & affiliate program (May 2026)

### Tier ladder

Four tiers, single source of truth in `lib/constants/tiers.ts`:

| Tier   | Price    | API limits          | Alerts | Wallets | History |
|--------|----------|---------------------|--------|---------|---------|
| Free   | $0       | 100/min · 5k/day    | 5      | 10      | 90d     |
| Trader | $12/mo   | 200/min · 25k/day   | 15     | 30      | 180d    |
| Pro    | $29/mo   | 600/min · ∞/day     | 75     | 200     | 1y      |
| Whale  | $59/mo   | ∞ · ∞               | ∞      | ∞       | 5y      |

Annual = 10× monthly = 17% off. Admin role auto-resolves to Whale via
`resolveUserTier` (in `lib/constants/tiers.ts`).

**Today: "free during launch"** — `LAUNCH_GATING_ENABLED = false` in
`src/components/TierGate.tsx`. Every signed-in user gets full access;
the gate component shows a hint chip ("Pro tier feature — free during
launch") instead of paywalling. Flip the constant when NowPayments
checkout goes live and all `<TierGate requires="..."/>` boundaries
auto-engage.

### Tier-gating pattern

```tsx
import TierGate from '@/components/TierGate';

// Soft gate (default) — renders children + overlays paywall when gating on
<TierGate requires="pro">
  <YourPageContent />
</TierGate>

// Hard gate — replaces children entirely with paywall when gating on
<TierGate requires="whale" mode="hard">
  ...
</TierGate>
```

Enforcement layer:
- API rate limits + per-tier daily caps live in `lib/api/rate-limit.ts`
- Alert / watched-wallet count caps in their POST routes via `getUserTier`
- Whale-only channels (webhook URL config, sub-second alerts) gate at
  the API boundary too — UI never blocks alone
- `/api/cron/whale-alerts` runs the priority path; `/api/cron/alerts`
  with no `?priority` flag skips Whale users (no double-fire)

### Affiliate program

20% recurring lifetime commission, USDT payouts on Solana/Arbitrum/Base,
$25 minimum payout, 60-day cookie, 10% off forever for the referred user.

Schema:
- `users.referral_code` (8-char alphanum, generated on signup)
- `users.referred_by_user_id` (set at signup attribution)
- `users.usdt_payout_wallet` + `usdt_payout_chain`
- `referral_events` (click / signup / conversion / payout)

Cookie attribution lives in `src/middleware.ts` — any `?ref=CODE`
landing sets the `ih_ref` cookie with 60d max-age. Signup route reads
it (or body field) and stamps `referred_by_user_id`. Commission events
queue up; the actual conversion → commission row is logged when
NowPayments confirms first paid month.

Surfaces:
- `/referrals` — public landing (program terms + how-it-works + FAQ)
- `/settings/referrals` — private dashboard (code, link, stats, USDT
  payout config, recent activity)
- `/admin-panel` → **Affiliates** tab — operator view (top earners,
  pending payouts, recent activity, payout workflow)

### Pro $29 power features

Pages that gate to Pro+ when launch ends:
- `/positions/tax` — FIFO cost-basis + Tax CSV export via
  `/api/account/tax/csv` (5-section CSV)
- `/breakouts` — setup scanner with composite quality score (0-100,
  weighted: momentum stack + range position + ATH proximity + volume)
- `/dashboard/widgets` — custom widget grid with HTML5 drag/drop,
  8 widget types (6 wired, 2 stubs)

Whale-only:
- Custom alert webhooks (HTTPS endpoint per user) at `/api/account/webhook`
- Sub-second priority alert delivery via `/api/cron/whale-alerts`
- 1:1 Telegram channel with the team

### OG images (deferred)

We tried `next/og` dynamic OG images but `ImageResponse` 503'd on DO
App Platform — neither Edge runtime (unsupported) nor Node runtime
(satori font-loading failure) worked. The 8 `opengraph-image.tsx`
files were removed in commit `<replace-on-next-deploy>`.

Static OG metadata (titles + descriptions via `lib/seo.ts`) still
works fine — Twitter / Telegram show the URL preview with proper
title + description, just no custom hero image. For richer share
cards, options:
  1. Pre-render static PNGs offline + drop in `/public/og/`
  2. Use an external OG service (cloudinary, vercel.app/og)
  3. Migrate this app to Vercel where `next/og` Just Works

---

## Useful Bash one-liners

```bash
# Headers + which build is live + CF cache state
curl -sI 'https://info-hub.io/' | grep -iE 'cache|x-do-app|server|cf-'

# Auth endpoint sanity check (should all be 200)
for ep in /api/auth/csrf /api/auth/providers /api/auth/session; do
  curl -s -o /dev/null -w "%{http_code} $ep\n" "https://info-hub.io$ep"
done

# Cron pass rate (last hour)
ssh root@46.101.247.54 'journalctl --since "1 hour ago" -u "infohub-cron@*" --output=cat | grep -oE "HTTP [0-9]+" | sort | uniq -c'

# Aggregator venue health
curl -s 'https://prices.info-hub.io/health' | jq
```

---

## What NOT to do

- Don't reintroduce `vercel.json` — crons are systemd timers now.
- Don't add `@vercel/analytics` / `@vercel/speed-insights` — their endpoints
  are dead now that the Vercel project is gone.
- Don't set `Cache-Control: no-store` on public, non-personalised API
  responses without thinking — it forces every user to round-trip to FRA1.
- Don't add `pathname.startsWith('/api/auth/')` to the strict middleware
  bucket — see "Middleware rate limits" above.
- Don't fetch `info-hub.io/api/<own-route>` from another route handler if
  you can `import` the underlying logic from `lib/`.
- Don't hardcode `ALL_EXCHANGES.length` / `DEX_EXCHANGES.size` / rate-limit
  numbers / endpoint counts in user-facing copy — derive from the canonical
  constants (`lib/constants/exchanges.ts`, `lib/api/rate-limit.ts`). The
  cross-surface consistency tests in `src/lib/api/__tests__/` and
  `src/app/__tests__/endpoint-count-consistency.test.ts` will break if
  marketing copy drifts from the actual values.
- Don't add `/changelog` or `/health` to the sitemap or remove their
  `noIndex: true` flag — both are admin-gated at runtime (5daf10c6).
  Indexing them dumps users on "Admin access required" from search.
- Don't cache empty arrays in aggregator fetchers — locked in by the
  fetchAll* tests (`src/lib/api/__tests__/fetchAll*.test.ts`). Empty cache
  pinning froze every dependent page for the cache duration last time.
