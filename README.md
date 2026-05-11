# InfoHub

Crypto derivatives aggregator + public REST API. Real-time funding rates,
open interest, liquidations, spreads, options, arbitrage, and on-chain
whale data from 32 exchanges into a single endpoint.

Live at **[info-hub.io](https://info-hub.io)**.

## What this is

A Next.js 14 web app (App Router) + Postgres backend deployed to DigitalOcean
App Platform. The site has two faces:

- **Public web UI** — terminal-styled dashboards for traders. ~150 pages
  covering funding, OI, liquidations, options, on-chain whales, alerts,
  watchlists, position simulators, and a TradingView-integrated chart.
- **Partner REST API** at `/api/v1/*` — 26 documented endpoints with
  OpenAPI 3.1 spec, fee transparency, multi-venue fallback, and a
  generous free tier (100 req/min, 5,000/day).

## Stack

| Layer | Where |
| --- | --- |
| Web (Next.js 14, App Router) | DigitalOcean App Platform · FRA1 · 2 GB |
| Price aggregator (WS) | DigitalOcean droplet `infohub-aggregator` (FRA1) |
| Crons (12 jobs) | Same droplet, systemd timers |
| DB | Postgres (DigitalOcean managed) |
| Cache / queues | Upstash Redis |
| Auth | NextAuth v5 + Postgres adapter |
| Errors | Sentry |
| Email | Resend |

See `CLAUDE.md` for full architecture details, deploy notes, and operational
conventions.

## API at a glance

```bash
# Status check (no auth)
curl https://info-hub.io/api/v1/status

# Full OpenAPI 3.1 spec for codegen (no auth)
curl https://info-hub.io/api/v1/openapi | jq

# Get an API key at /developers, then:
curl -H "Authorization: Bearer ih_..." \
  "https://info-hub.io/api/v1/arbitrage?grade=A,B&minSpread=0.05"

# Aggregate funding spread scanner — one row per symbol
curl -H "Authorization: Bearer ih_..." \
  "https://info-hub.io/api/v1/funding?aggregate=1&symbols=BTC,ETH,SOL"
```

**Highlights** that differentiate from CoinAPI / Coinglass / Amberdata:

- `meta.feeModel` block on every fee-aware response (per-venue maker +
  taker, versioned schedule) — verify or recompute net P&L under your
  own fill model
- `?aggregate=1` on funding / OI / tickers for symbol-level rollups
- `?summary=1` on liquidations for aggregated stats in one query
- Multi-venue fallback on `/klines` (Binance perp → Bybit → OKX →
  Binance spot)
- 32 exchange coverage — 18 CEX + 14 DEX (Hyperliquid, dYdX, Aster,
  Lighter, GMX, gTrade, Aevo, Backpack, Orderly, Paradex,
  Variational, edgeX, Nado, Extended)
- `X-RateLimit-*` + `X-Fee-Model-Version` headers on every response
- Fee-aware A-D grading on `/arbitrage` (built-in OI sanity + 7-day
  stability + round-trip fees)

Full reference: **[info-hub.io/developers/docs](https://info-hub.io/developers/docs)**.

## Local dev

```bash
git clone https://github.com/bullsvsbearsreal-spec/bullsvsbearsreal-spec.git
cd infohub
npm install

# Copy environment template
cp .env.example .env.local
# fill in: DATABASE_URL, NEXTAUTH_SECRET, CMC_API_KEY, RESEND_API_KEY, etc.

npm run dev
# → http://localhost:3000
```

## Tests

```bash
npm run test:unit          # vitest (1142 tests across 63 files)
npm run test:e2e           # playwright (browser flows)
npm run test:api           # playwright (API contract tests)
```

The vitest suite covers:

- Pure math: RSI(14) / ATR(14) indicators, fee snapshot, format helpers,
  countdown math, AI insight heuristic ranking
- API: OpenAPI 3.1 spec self-consistency (`$ref` resolution),
  exchange-fetcher retry path, funding normalisation
- Unit: `formatPrice`, `normalizeSymbol`, `validateBugReport`,
  position-health scoring, fee scheduling

## Project structure

```
src/
├── app/
│   ├── api/             # Server-side API routes
│   │   ├── v1/          # Public partner API (auth-gated, OpenAPI-documented)
│   │   └── [other]      # Internal routes the web UI uses
│   ├── chart/           # TradingView chart + 6 terminal strips
│   ├── developers/      # API portal + docs
│   ├── home/            # Landing dashboard
│   └── [~150 more pages]
├── components/
│   ├── design-system/   # Shared chrome (sidebar, status bar, etc.)
│   └── [feature components]
├── lib/
│   ├── api/             # SWR hooks + aggregator clients
│   ├── constants/       # ALL_EXCHANGES, EXCHANGE_FEES, etc.
│   ├── db/              # Postgres queries (tagged-template SQL)
│   └── openapi-spec.ts  # Hand-curated OpenAPI 3.1 spec
└── hooks/
```

## Conventions

See **[`CLAUDE.md`](./CLAUDE.md)** for full operational + architectural
conventions used in this codebase, including:

- Cache patterns for slow upstreams (L1 in-process + Cloudflare edge)
- Wallet Watch — multi-venue position alerter
- `/chart` architecture (6 horizontal info-bands + TradingView widget)
- Fee Model versioning + bumping discipline
- Middleware rate limits (strict for auth endpoints, moderate elsewhere)

## Deploy

`git push origin main` → DigitalOcean App Platform auto-builds + deploys
in 3-5 minutes. Watch via the app dashboard. No staging environment —
just push.

## Contact

- API status: **[/api/v1/status](https://info-hub.io/api/v1/status)** (no auth)
- Docs: **[/developers/docs](https://info-hub.io/developers/docs)**
- Get a key: **[/developers](https://info-hub.io/developers)**
- DMs: [@info_hub69](https://t.me/info_hub69)
