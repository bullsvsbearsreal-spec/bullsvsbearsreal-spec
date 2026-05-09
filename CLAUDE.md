# CLAUDE.md — InfoHub architecture & operations

Quick orientation for Claude sessions on this repo. **Read this first** before
making infra-shaped changes.

---

## Stack

| Layer | Where | Notes |
| --- | --- | --- |
| Web (Next.js 14, App Router) | DigitalOcean App Platform · FRA1 · 2 GB | Auto-deploys on push to `main` |
| Price aggregator (WS) | DigitalOcean droplet `infohub-aggregator` (FRA1, `46.101.247.54`) | systemd unit `infohub-aggregator.service` running `/opt/infohub-aggregator/index.mjs` |
| Crons (9 jobs) | Same droplet, systemd timers | All hit `https://info-hub.io/api/cron/<name>` with `Authorization: Bearer $CRON_SECRET` |
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

# Crons (12 timers, all hit info-hub.io/api/cron/*).
# Note: /api/cron/watch-hl-wallets does NOT have its own timer —
# it piggybacks on the snapshot cron's tail-call (see "Wallet
# Watch" section below). One cron handles both jobs every 60s.
systemctl list-timers --all 'infohub-cron-*'
journalctl -u 'infohub-cron@*' --since '10 minutes ago' --output=cat | grep 'HTTP'

# Cron secret
cat /etc/infohub-cron.env   # mode 600, contains only CRON_SECRET=...
```

The 12 cron timers and their schedules:

| Endpoint | Schedule |
| --- | --- |
| `/api/cron/snapshot` | every minute |
| `/api/cron/ingest-liquidations` | every minute |
| `/api/cron/sync-positions` | every minute |
| `/api/cron/whale-trades` | every 2 min |
| `/api/cron/alerts` | every 5 min |
| `/api/cron/check-position-alerts` | every 5 min |
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
- 45 unit tests cover diff/threshold/format edge cases. Cron-runner
  level (mutex/cooldown) is currently uncovered — extract gating into
  a pure helper if you need to add tests.

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
