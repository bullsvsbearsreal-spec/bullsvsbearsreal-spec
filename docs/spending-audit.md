# Spending audit — what we pay for, what's free, what to upgrade

> Operator reference for the chat snakether kicked off:
> _"once there are paid users we need to upgrade from all those free things — ppl are not gonna pay for things if it's slow and unusable."_
>
> Inventory of every external service we depend on, current plan, and the
> upgrade path once revenue makes it sane. Numbers are May 2026
> ballparks — verify before signing up. Pairs with the architecture-side
> docs (`backend-infrastructure-services.txt`, `external-data-resilience.md`).

## TL;DR — upgrade order when revenue lands

The 5 things that will visibly break the user experience first as load grows:

1. **CMC API** (Basic free → Hobbyist $33/mo) — coin/market metadata. Free tier is 10k/day; we already burn through it on busy days. **First $33 we should spend.**
2. **Upstash Redis** (Free → Pro $10/mo) — rate limiter + cache. 10k commands/day free. Pro is 100k/day. Whale-priority alerts run every 5-30s and will eat this.
3. **CryptoPanic** (Free → Pro €19/mo) — news feed. Free is 200 req/day per IP. Pro removes that + adds richer metadata. Without it, /news goes stale during volatile sessions.
4. **CoinMarketCal** (Free → Pro $19/mo) — economic calendar. Free is heavily rate-limited; Pro unlocks the full event firehose.
5. **Resend** (Free 3k/mo → Pro $20/mo for 50k) — email. The moment we have >100 active users + welcome + alerts + receipts, 3k/month falls apart.

**Estimated month-1 paid upgrade bundle: ~$95-110/mo.** Trivial against even 10 Trader subs at $12.

---

## Service-by-service inventory

### Infrastructure (always-paid)

| Service | Current plan | Cost | Notes |
|---------|--------------|------|-------|
| **DigitalOcean App Platform** | Basic $5-12/mo | ~$12/mo | FRA1, single Node.js service. Bump to Pro $24+ when sustained traffic doubles. |
| **DigitalOcean Managed Postgres** | Basic $15/mo | ~$15/mo | 1GB RAM / 10GB disk. Bump to $30+ when stored snapshots cross ~5GB or query latency creeps. |
| **DO Droplet (proxy)** | $4/mo basic | $4/mo | `46.101.247.54` — handles CF-blocked exchanges + Yahoo crumb flow. Don't touch. |
| **InfoHub Collector droplet** | $6/mo basic | $6/mo | PM2-managed. May go away if/when we move ingestion to App Platform crons. |
| **Cloudflare Worker proxy** | Free | $0 | weur region, SQLite cache. 100k req/day free is plenty. |
| **DNS / domain** | Cloudflare free + registrar | ~$15/yr | info-hub.io. |

**Infrastructure floor: ~$37/mo.** Already sunk.

---

### Data APIs (free now, will need paid)

| Service | What it powers | Free limit | Paid tier | When to upgrade |
|---------|----------------|------------|-----------|------------------|
| **CoinMarketCap (CMC)** | Coin metadata, prices, /coin pages, top-movers, fear-greed, global-stats, search | 10k credits/day Basic free | Hobbyist $33/mo (10k/day boosted), Startup $99/mo (333k/day) | **Already hitting limits.** Upgrade day 1 of paid launch. |
| **CryptoPanic** | /news feed | 200 req/day per IP | Pro €19/mo (50k req/day + meta) | Hit on volatile news days now. Upgrade day 1. |
| **CoinMarketCal** | /economic-calendar (crypto events) | ~100 req/day | Pro $19/mo (10k req/day + verified events) | Upgrade day 1. |
| **CoinGecko** | Fallback for coin metadata, sentiment | 10-30 req/min free | Demo $129/mo, Lite $499/mo | Stay free — already use it as fallback only. |
| **DefiLlama** | Yields, restaking, validators, stablecoin data | Unlimited public | N/A — donation-funded | Stay free. **Donate** if we ship a paid tier that leans on it. |
| **Etherscan** | Wallet lookups in /wallet | 5 req/sec free | Pro $199/mo | Stay free for now — bursts are small. |
| **Yahoo Finance crumb flow** | ETF AUM | Unofficial, rate-limited | N/A | If it breaks again, switch to `polygon.io` Starter $29/mo. |
| **Farside (via Wayback)** | ETF flows | N/A (scraped, stale 1-4 wks) | N/A | Stale-tolerable. If we want fresh, rent a non-DO droplet ($5/mo Hetzner) and cron it. |
| **Exchange public APIs** (Binance, Bybit, OKX, Bitget, Kraken, Coinbase, HL, GMX, etc.) | All funding/OI/spot/perp data | Free with rate limits | N/A — public | Stay free. If individual exchanges throttle, the proxy droplet handles it. |

---

### App services (free now, scale-dependent)

| Service | Powers | Free limit | Paid | When to upgrade |
|---------|--------|------------|------|------------------|
| **Upstash Redis** | Rate limiter + Funding-arb / OI / news warm cache | 10k cmds/day | Pro $10/mo (100k/day), Pay-as-you-go thereafter | **Will break before CMC does.** Whale-tier 5-30s cron alone consumes the free tier in a day. Upgrade with first 10 paid users. |
| **Resend** | All transactional + alert email | 3k/mo · 100/day | Pro $20/mo (50k/mo) | At ~100 active users with email alerts + welcomes + receipts, you'll cross 3k. Upgrade pre-launch. |
| **Sentry** | Error tracking | 5k events/mo | Team $26/mo (50k) | Free is fine until traffic ~10×s. Watch the monthly burn-rate email. |
| **Anthropic API** | Chat widget on /chat | Pay-per-token | N/A — usage-based | We pay per request. ~$0.003 per chat message with Sonnet. Negligible until chat usage spikes. **Consider rate-limiting per user.** |
| **Vercel Blob** | User avatar storage | 1GB free | $0.15/GB-month | Stay free unless avatars explode. |
| **VAPID / Web Push** | Browser push notifications | Self-hosted (free) | N/A | Free forever — we own the keys. |
| **Cloudflare Turnstile** | Captcha on signup + forgot-password | Free, unlimited | N/A | Free forever. |
| **Twilio** | SMS (referenced in notifications.ts, not active yet) | Pay-per-msg | N/A | **Currently dark.** Decide if SMS alerts are worth ~$0.0075/msg before turning on. |
| **Twitter API** | Auto-tweet on big funding flips | Basic $100/mo | Pro $5,000/mo | **Currently dark or on Basic.** Don't upgrade to Pro — not enough volume. |
| **Telegram Bot API** | @InfoHubRadarBot alerts | Free | N/A | Free forever. Don't accidentally re-enable @ihhubbot AI chat — that costs Anthropic tokens. |

---

### Auth providers (free)

| Provider | Cost | Notes |
|----------|------|-------|
| Google OAuth | Free | Standard OAuth, no quota concerns at our scale |
| Discord OAuth | Free | Same |
| Twitter OAuth | Free (separate from Twitter API) | OAuth-only client |
| Magic-link email | Counts against Resend quota | Already in the email row above |
| TOTP 2FA | Self-hosted (otpauth lib) | Free |

---

## What to cut / shrink

Things we pay for or maintain that don't earn their keep:

1. **`@ihhubbot` Telegram bot** — deprecated, deleted, but if its token is still active in BotFather, it's a footgun (anyone with the token can spam users on our brand). **Operator action: BotFather → /revoke for @ihhubbot.**
2. **Twitter API (if active)** — auto-tweet rarely fires; if we're paying $100/mo Basic and getting <20 tweets/day, kill the subscription and re-enable when auto-tweet volume justifies it.
3. **Prediction-markets page + API + lib** — entire feature being removed this session per 0x0celot's "I will remove prediction markets for now" — see Task #75. Drops one external dependency (Polymarket/Kalshi APIs).
4. **InfoHub Collector droplet** — if data ingestion fully moves to App Platform crons, this $6/mo droplet can die.
5. **Sentry** — if errors stay under 5k/month forever, Free tier is fine. Don't auto-upgrade.

---

## Cost model — three scenarios

Numbers are illustrative; verify each.

### Status quo (today, pre-launch)
- Infrastructure: $37/mo
- All app services free
- **Total: ~$37/mo + Anthropic tokens for /chat (likely <$5/mo)**

### Day 1 of paid launch (~10-50 paid users)
- Infrastructure: $37/mo
- CMC Hobbyist: $33/mo
- Upstash Pro: $10/mo
- CryptoPanic Pro: ~$20/mo (€19)
- CoinMarketCal Pro: $19/mo
- Resend Pro: $20/mo
- Sentry stays free
- **Total: ~$140/mo.** Break-even at ~12 Trader subscriptions ($12 × 12 = $144).

### Scaled (500+ paid users)
- DO App Platform Pro: $24/mo (autoscale group)
- DO Postgres bumped: $30/mo
- CMC Startup: $99/mo
- Upstash pay-as-you-go: ~$30-60/mo
- CryptoPanic Pro: $20/mo
- CoinMarketCal Pro: $19/mo
- Resend Pro: $20/mo
- Sentry Team: $26/mo
- Anthropic: ~$20-50/mo (rate-limited chat)
- **Total: ~$300-360/mo.** Break-even at ~30 Trader subs.

---

## Operator checklist (next paid-launch sprint)

- [ ] Sign up for **CMC Hobbyist** — set new key in DO env `CMC_API_KEY`
- [ ] Upgrade **Upstash** to Pro — no env change needed, billing-only
- [ ] Sign up for **CryptoPanic Pro** — set `CRYPTOPANIC_API_KEY` in DO env (currently free key works but rate-limits)
- [ ] Sign up for **CoinMarketCal Pro** — update `COINMARKETCAL_API_KEY` in DO env
- [ ] Upgrade **Resend** to Pro tier in dashboard — no env change
- [ ] **Revoke `@ihhubbot` token** in BotFather (see launch-checklist.md E1)
- [ ] **Drop dead DB tables** (`telegram_conversations`, `bot_trade_ideas`) per launch-checklist.md
- [ ] Decide on **Twitter API subscription** — keep Basic or kill it
- [ ] Decide on **SMS via Twilio** — wire it or rip the references

---

## Adding a new external service

Three rules from the resilience guide that apply equally to spending:

1. **Check fresh from the droplet first** — if upstream blocks DO IPs, you'll need the proxy. Factor that maintenance cost in.
2. **Use the free tier to validate the integration** before paying — but don't ship to production on it; users will hit the wall.
3. **Document the upgrade path in this file** — don't make Future You re-research what Hobbyist costs.

---

## Pairs with

- `docs/backend-infrastructure-services.txt` — deeper architecture of each service
- `docs/external-data-resilience.md` — Yahoo / Farside / DefiLlama workarounds
- `docs/launch-checklist.md` — pre-launch operator tasks (revoke tokens, drop tables)
- `docs/whale-alerts-systemd.md` — the cron cadence that drives Upstash usage
