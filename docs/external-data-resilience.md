# External Data-Source Resilience Guide

Three external data sources have hostile rate-limiting / IP blocks against
DigitalOcean App Platform IPs. We've built per-source workarounds that
keep the affected pages live. This doc captures **what each workaround
does, when it kicks in, how to debug, and how to migrate off** if the
upstream changes again.

Sections:

1. [ETF AUM — Yahoo Finance crumb-auth flow](#1-etf-aum--yahoo-finance-crumb-auth-flow)
2. [ETF Flows — Wayback Machine fallback](#2-etf-flows--wayback-machine-fallback)
3. [LST/LRT pools — DefiLlama project slugs](#3-lstlrt-pools--defillama-project-slugs)

---

## 1. ETF AUM — Yahoo Finance crumb-auth flow

**Powers:** home dashboard "BTC SPOT ETFS" widget · `/etf` page · the
per-fund `marketCap` column on the ETF Tracker.

### The problem

The previous source, `api.sosovalue.com` / `api.sosovalue.xyz`, died in
**May 2026**:

- `.com` returns HTTP 000 (DNS unreachable from any IP).
- `.xyz` requires authentication (HTTP 401) since their API rework.

Symptom in the wild: home widget rendered "TOTAL AUM —" forever; per-fund
`marketCap` came back null in `/api/etf?type=btc`.

### What we do now

`src/app/api/etf/route.ts` calls `fetchAllYahooAum(tickers)` which goes
through Yahoo's `quoteSummary` v10 endpoint. Yahoo locked this endpoint
behind a per-cookie crumb token in 2024, so the flow is:

```
1. GET https://fc.yahoo.com/         → Set-Cookie: A3=...
2. GET /v1/test/getcrumb (with A3)   → returns crumb token
3. GET /v10/finance/quoteSummary/<TICKER>?modules=defaultKeyStatistics&crumb=<crumb>
   (with same A3 cookie)             → totalAssets.raw is the AUM
```

The cookie + crumb pair is cached **1 hour** (`YAHOO_SESSION_TTL`) to
amortize the two-round-trip handshake. Per-ticker fan-out is parallel
via `Promise.allSettled`.

### Critical gotcha — proxy bypass

`src/app/api/_shared/fetch.ts` keeps `query1.finance.yahoo.com` and
`query2.finance.yahoo.com` in `PROXIED_DOMAINS` (leftover from when
Yahoo geo-blocked DO IPs). If you naively use `fetchWithTimeout` for
the Yahoo calls, **the proxy strips the cookies** — defeating the
whole crumb flow. Use the local `rawFetch` helper instead, which is a
plain `fetch` with timeout, no proxy substitution.

### Debugging

```bash
# Verify the route returns non-null AUM
curl -s 'https://info-hub.io/api/etf?type=btc' | jq '.summary.totalAum'
# Expect ~96000000000 ($96B) for tracked BTC ETFs

# Test the crumb flow standalone from the droplet
ssh root@46.101.247.54 'COOKIE_JAR=/tmp/y; rm -f $COOKIE_JAR
curl -s -c $COOKIE_JAR https://fc.yahoo.com/ -A "Mozilla/5.0" -o /dev/null
CRUMB=$(curl -s -b $COOKIE_JAR https://query2.finance.yahoo.com/v1/test/getcrumb -A "Mozilla/5.0")
curl -s -b $COOKIE_JAR "https://query1.finance.yahoo.com/v10/finance/quoteSummary/IBIT?modules=defaultKeyStatistics&crumb=$CRUMB" -A "Mozilla/5.0" | jq ".quoteSummary.result[0].defaultKeyStatistics.totalAssets.raw"'
# Expect ~61000000000 ($61.9B for IBIT)
```

If both droplet + App Platform return null, Yahoo has changed the
API again. Migration options:
- `polygon.io` free tier exposes `/v3/reference/tickers/<symbol>?details=true`
  with `weighted_shares_outstanding` × current price = AUM.
- CoinGecko's `/companies/public_treasury/<asset>` covers MSTR-style
  treasuries but **not** spot ETFs as of May 2026.
- Last resort: hardcode AUM with a `source: 'manual'` flag and a
  monthly maintainer reminder.

### Tracked tickers

`BTC_ETFS` + `ETH_ETFS` arrays at the top of
`src/app/api/etf/route.ts`. To add a new fund: append a `FundMeta`
row. The Yahoo flow auto-fans out to it.

---

## 2. ETF Flows — Wayback Machine fallback

**Powers:** `/etf-flows` page · `/etf-counterfactual` page · the home
dashboard ETF flow indicator.

### The problem

`farside.co.uk/bitcoin-etf-flow-all-data/` is the canonical source for
spot-ETF daily net flows. Their Cloudflare front blocks **every
DigitalOcean IP range** with HTTP 403, including:

- App Platform (FRA1, where Next.js runs)
- The `infohub-aggregator` droplet (also DO, despite being a clean IP)
- All known third-party CORS proxies' DO-hosted edge nodes

Tested 8 third-party proxies from a DO IP — only Wayback Machine
returned actual Farside data. Everything else returned either CF
challenge pages or 403/429.

### What we do now

`src/lib/etf-flows-fetch.ts` `fetchFarsideFlows()` runs a 3-tier
fallback chain:

```
1. Direct fetch  → fastest when Farside isn't blocking us
2. PROXY_URL     → third-party CORS proxy (currently dead for farside)
3. NEW: Wayback  → web.archive.org/web/3/<farside-url> redirects to
                   the latest archived snapshot (~weeks stale, real data)
```

Wayback hits set `result.stale = true` and `result.source = 'wayback'`,
which propagates through `/api/etf-flows` and renders an **orange
"Archived data: Showing archived data through 2026-04-06" banner**
on `/etf-flows` (distinct from the amber "warm cache" banner which is
hours-stale).

### Critical gotcha — Wayback HTML wrapping

Wayback wraps the archived page in extra `<table class="thead">` and
`<table class="tfooter">` decorative tables. The original parser
matched the **first** `<table>` and would pick the wrong one. We now
explicitly match `<table class="etf">` first, falling back to the
first table when missing. Locked in by tests in
`src/lib/__tests__/etf-flows-parsers.test.ts` ("Wayback Machine fix"
section).

### Critical gotcha — date selection

`parseFarsideTable` returns days **newest-first** after its internal
`.reverse()`. The "Showing archived data through DATE" banner uses
`days[0]` (newest), not `days[length - 1]` (which would be the oldest
archived date — January 2024, when ETFs launched).

### Critical gotcha — warm cache poisoning

`src/app/api/cron/refresh-etf-flows/route.ts` deliberately **skips the
warm cache write** when `result.stale === true`. The warm cache is a
hours-fresh tier (48h TTL); pinning weeks-stale Wayback data there
would prevent re-attempting the live source.

### Debugging

```bash
# What is the page seeing?
curl -s 'https://info-hub.io/api/etf-flows' | jq '.source, .stale, .latestDay.date'
# Expect: "wayback", true, "2026-MM-DD" (within last few weeks)

# How fresh is the Wayback snapshot?
ssh root@46.101.247.54 'curl -sL "https://web.archive.org/web/3/https://farside.co.uk/bitcoin-etf-flow-all-data/" -o /tmp/wb.html && grep -oE "[0-9]+ [A-Z][a-z]+ 2026" /tmp/wb.html | sort -u | tail -5'
# Latest archived day appears in the date list

# Is Farside still blocking us?
curl -sI 'https://farside.co.uk/bitcoin-etf-flow-all-data/' -A "Mozilla/5.0" | head -1
# 403 → still blocked. 200 → live source restored, fallback only when needed.
```

### Migration options

If we need fresher than Wayback's typical 2-6 week lag:

1. **Cron job on a non-DO host** — fetch Farside daily from a
   Hetzner/Linode/home server, POST the parsed JSON to a new
   `/api/admin/etf-flows-snapshot` endpoint. We control the IP, so no CF
   block. Cheapest sustainable fix (~€5/month).

2. **FlareSolverr** — solves CF challenges via headless browser. Run on
   a non-DO host, route through it. Heavier than option 1 but works for
   any CF-challenged source we may need later.

3. **Residential-IP scraping service** — Bright Data, ScrapeOps,
   ScraperAPI. ~$50-200/month, robust. Overkill for this one source.

4. **Different upstream** — `theblock.co/data/crypto-markets/spot-etfs`
   has a similar feed; SEC EDGAR has 13F filings (slower; weekly/
   quarterly). Both lose the daily granularity we want.

---

## 3. LST/LRT pools — DefiLlama project slugs

**Powers:** `/restaking` page · `/validators` page.

### The problem

DeFi Llama's `/pools` endpoint uses **hyphen-separated slugs**, not the
casual brand names. Our allowlists were originally written from
display names (because that's how protocols market themselves), so
many real projects were silently dropped:

| What we had | What DefiLlama actually uses |
|---|---|
| `puffer-finance` | `puffer-stake` |
| `ether.fi stake` (with space) | `ether.fi-stake` (with hyphen) |
| `kelp-dao` | `kelp` |
| `swell` | `swell-earn`, `swell-liquid-restaking`, `swell-liquid-staking` |
| `marinade` / `marinade-finance` | `marinade-liquid-staking` |
| `sanctum` | `sanctum-infinity` |
| `jito` | `jito-liquid-staking` |
| `bedrock` | `bedrock-unieth` (ETH LRT) / `bedrock-unibtc` (BTC LRT) |

Symptom: `/restaking` showed **2 pools instead of 16**;
`/validators` was missing several major LST/LRT issuers.

### What we do now

The allowlists are in two files:

- `src/lib/restaking.ts` — `PROTOCOL_DISPLAY` (slug → display name).
- `src/lib/validators-data.ts` — `LST_PROJECTS`, `RESTAKING_PROJECTS`.

Both files have inline comments documenting "DefiLlama uses
hyphen-separated slugs, not brand names" with examples.

The restaking allowlist is locked in by 16 tests in
`src/lib/__tests__/restaking-filter.test.ts`, including an
**anti-leak test** for `fluid-*` (which was incorrectly in the list
and would have polluted /restaking with lending pools).

### Critical gotcha — silent failure

When you add a new protocol to either list, **verify the slug exists in
DefiLlama's response** before deploying. Missing slugs don't error — the
protocol is just silently absent from the page.

### Debugging

```bash
# What slugs does DefiLlama currently expose?
curl -s 'https://yields.llama.fi/pools' | grep -oE '"project":"[a-z0-9_.-]+"' | sort -u | grep -iE 'eigen|karak|symbi|ether|kelp|puffer|swell|mellow|bedrock|fluid|jito|marin|sanctum'
# Cross-check against PROTOCOL_DISPLAY / LST_PROJECTS / RESTAKING_PROJECTS

# Does the page show all known projects?
curl -s 'https://info-hub.io/api/restaking' | jq '.pools[] | .protocol' | sort -u
# Expect at least: ether.fi-stake, ether.fi-liquid, kelp, renzo, swell-*, puffer-stake, bedrock-unieth, eigenpie

curl -s 'https://info-hub.io/api/validators' | jq '.byAsset.ETH[] | .project' | sort -u
# Expect lido, rocket-pool, frax-ether, mantle-lsp, binance-staked-eth, etc.
```

### How to add a new LST/LRT issuer

1. **Verify the slug.** Hit `https://yields.llama.fi/pools` and
   confirm the project's actual slug. New protocols often launch with
   a marketing name that doesn't match their slug.

2. **Pick the right file:**
   - Pure issuer (Lido, Rocket Pool style) → `validators-data.ts` ·
     `LST_PROJECTS`.
   - Restaking issuer (Renzo, EtherFi LRT, Puffer style) → both
     `validators-data.ts` · `RESTAKING_PROJECTS` AND `restaking.ts` ·
     `PROTOCOL_DISPLAY`.

3. **Add a regression test** in `restaking-filter.test.ts` to lock in
   that the new slug matches and that the display name renders
   correctly.

4. **For ambiguous slugs (e.g. `fluid-dex` is NOT restaking despite the
   name), add an anti-leak test** that asserts the slug is **NOT**
   accepted by `isRestakingPool`.

### Migration options

If DefiLlama goes away or rate-limits us:

- **Their public dump** — `https://yields.llama.fi/pools` is JSON, not
  protected. ~13MB. Cron-cache it on the droplet, serve from there.
- **Per-protocol direct APIs** — Lido has `/v1/protocol/eth/steth/apr`,
  Rocket Pool has subgraph queries, etc. Higher maintenance but no
  single-vendor risk.
- **The Graph** — DeFiLlama is partially indexed via subgraphs; lots of
  protocol-specific subgraphs exist.

---

## Cross-cutting tips

### How to detect "data is broken from a DO IP" vs "data is broken globally"

Always test from **both** your local machine AND the droplet:

```bash
# Local IP (probably residential, often gets through)
curl -sI 'https://upstream.example/path' -A "Mozilla/5.0" | head -1

# Droplet (clean DO IP, same as App Platform IPs)
ssh root@46.101.247.54 'curl -sI "https://upstream.example/path" -A "Mozilla/5.0" | head -1'
```

If droplet returns 403/429 but local works, you're hitting an
IP-block — solve with the proxy/Wayback/cron-on-non-DO patterns above.

### Adding a new external source

Three rules from this triage:

1. **Check fresh from the droplet first.** If it 403s from there,
   it'll 403 from App Platform too — plan for a workaround on day 1.
2. **Cache only when fresh.** Stale fallbacks should NOT pin to
   warm/Redis caches that prevent the fresh source from being retried.
3. **Surface the staleness.** Banner ("Archived data through ..."),
   `stale: true` flag, distinct cache headers. Users should know when
   they're not seeing live data.
