# Telegram Arbitrage Bot — Design Doc

**Date:** 2026-02-24
**Status:** Approved

## Problem

Traders using InfoHub want real-time alerts when price spreads or funding rate divergences appear across exchanges. Currently this data exists on the web dashboard but requires manual monitoring.

## Solution

A Telegram bot integrated into the existing InfoHub Vercel project that:
1. Polls ticker + funding data every 60s via Vercel Cron
2. Detects price spreads and funding rate arbitrage across 28 exchanges
3. Sends personalized Telegram alerts to subscribed users
4. Supports commands for threshold, watchlist, and settings

## Architecture

### Components

```
Vercel Cron (60s) → /api/cron/arbitrage-alerts
                       ├── fetch /api/tickers (28 exchanges, 30s cache)
                       ├── fetch /api/funding (24 exchanges, 2min cache)
                       ├── detect price spreads (group by symbol, find min/max)
                       ├── detect funding spreads (normalize to 8h, find min/max)
                       ├── check cooldowns (Vercel KV)
                       ├── load user preferences (Vercel KV)
                       └── send Telegram alerts (Bot API HTTP POST)

Telegram Webhook → /api/telegram/webhook
                       ├── /start — subscribe (save chatId to KV)
                       ├── /stop — unsubscribe
                       ├── /set threshold 0.5 — price spread threshold
                       ├── /set funding 0.02 — funding spread threshold
                       ├── /watchlist BTC ETH SOL — symbol filter
                       ├── /status — show current settings
                       └── /scan — force immediate scan
```

### Data Storage (Vercel KV / Redis)

```
Key: user:{chatId}
Value: {
  active: boolean,
  priceThreshold: number,    // default 0.5%
  fundingThreshold: number,  // default 0.02%
  watchlist: string[],       // empty = all symbols
  createdAt: number
}

Key: cooldown:{symbol}:{type}
Value: timestamp
TTL: 900 (15 minutes)
```

### Alert Detection Logic

**Price Arbitrage:**
1. Fetch all tickers, group by symbol
2. For each symbol with 2+ exchanges and $500K+ volume on both sides:
   - Find lowest and highest price exchanges
   - Calculate spread: `(high - low) / low * 100`
   - Deduct 0.1% round-trip fees
   - If net spread > user threshold → alert

**Funding Arbitrage:**
1. Fetch all funding rates, group by symbol
2. Normalize to 8h basis (1h × 8, 4h × 2)
3. For each symbol with 2+ exchanges:
   - Find min and max rate exchanges
   - Calculate spread: `maxRate - minRate`
   - If spread > user threshold → alert

**Cooldown:** After alerting a symbol, wait 15min before re-alerting unless spread widens by 50%+.

### Telegram Message Format

```
🔀 PRICE ARB: ETH
━━━━━━━━━━━━━━━━
📉 gTrade:  $1,820.00
📈 MEXC:    $1,824.00
💰 Spread:  $4.00 (0.22%)

📊 FUNDING ARB: ETH
━━━━━━━━━━━━━━━━
🟢 Hyperliquid: -0.0042%
🔴 Binance:     +0.0185%
💰 8h Spread:   0.0227%

⚡ Long gTrade / Short MEXC
📈 Est. profit: 0.12% after fees
```

### Bot Commands

| Command | Description | Default |
|---------|-------------|---------|
| `/start` | Subscribe to alerts | — |
| `/stop` | Pause alerts | — |
| `/set threshold <n>` | Min price spread % | 0.5 |
| `/set funding <n>` | Min funding spread % | 0.02 |
| `/watchlist <symbols>` | Filter symbols (empty=all) | all |
| `/status` | Show settings + stats | — |
| `/scan` | Force immediate scan | — |

### Environment Variables

```
TELEGRAM_BOT_TOKEN=<from @BotFather>
TELEGRAM_WEBHOOK_SECRET=<random string for webhook verification>
KV_REST_API_URL=<Vercel KV URL>
KV_REST_API_TOKEN=<Vercel KV token>
```

### Files to Create/Modify

- Create: `src/app/api/cron/arbitrage-alerts/route.ts`
- Create: `src/app/api/telegram/webhook/route.ts`
- Create: `src/lib/telegram.ts` (Bot API helper + message formatting)
- Create: `src/lib/arbitrage-detector.ts` (price + funding spread detection)
- Modify: `vercel.json` (add cron config)

### Constraints

- Vercel Cron free tier: 1 invocation/day on Hobby, needs Pro for per-minute
- Vercel KV free tier: 30K requests/month, 256MB storage
- Telegram Bot API: 30 messages/second limit
- No new npm dependencies — Telegram Bot API is plain HTTP fetch
