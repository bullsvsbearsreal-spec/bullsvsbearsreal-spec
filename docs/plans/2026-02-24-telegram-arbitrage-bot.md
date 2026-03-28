# Telegram Arbitrage Bot Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Telegram bot to InfoHub that monitors price spreads and funding rate divergences across 28 exchanges and sends personalized alerts to subscribed users.

**Architecture:** Two new API routes inside the existing Next.js app — a cron endpoint that runs every 60s to detect arbitrage and send alerts, and a webhook endpoint that handles Telegram commands. User preferences stored in existing PostgreSQL database. No new npm dependencies — Telegram Bot API is plain HTTP.

**Tech Stack:** Next.js 14, TypeScript, PostgreSQL (existing `postgres` driver), Telegram Bot API (raw fetch), Vercel Cron

---

## Task 1: Create Telegram Bot API Helper

**Files:**
- Create: `src/lib/telegram.ts`

**Step 1: Create the Telegram API helper module**

```typescript
// src/lib/telegram.ts
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

export async function sendMessage(chatId: number | string, text: string, parseMode: 'HTML' | 'Markdown' = 'HTML') {
  const res = await fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode, disable_web_page_preview: true }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`Telegram sendMessage failed (${res.status}):`, err);
  }
  return res.ok;
}

export async function setWebhook(url: string, secret: string) {
  const res = await fetch(`${API}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, secret_token: secret }),
  });
  return res.json();
}

// Format price arbitrage alert as HTML
export function formatPriceAlert(arb: {
  symbol: string;
  lowExchange: string; lowPrice: number;
  highExchange: string; highPrice: number;
  spreadPct: number; spreadUsd: number;
  netPct: number;
}) {
  return [
    `🔀 <b>PRICE ARB: ${arb.symbol}</b>`,
    `━━━━━━━━━━━━━━━━`,
    `📉 ${arb.lowExchange}: <code>$${arb.lowPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</code>`,
    `📈 ${arb.highExchange}: <code>$${arb.highPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</code>`,
    `💰 Spread: $${arb.spreadUsd.toFixed(2)} (${arb.spreadPct.toFixed(3)}%)`,
    `📈 Net after fees: ${arb.netPct.toFixed(3)}%`,
    ``,
    `⚡ <b>Long ${arb.lowExchange} / Short ${arb.highExchange}</b>`,
  ].join('\n');
}

// Format funding arbitrage alert as HTML
export function formatFundingAlert(arb: {
  symbol: string;
  lowExchange: string; lowRate: number;
  highExchange: string; highRate: number;
  spread8h: number;
}) {
  const fmt = (r: number) => (r >= 0 ? '+' : '') + r.toFixed(4) + '%';
  return [
    `📊 <b>FUNDING ARB: ${arb.symbol}</b>`,
    `━━━━━━━━━━━━━━━━`,
    `🟢 ${arb.lowExchange}: <code>${fmt(arb.lowRate)}</code>`,
    `🔴 ${arb.highExchange}: <code>${fmt(arb.highRate)}</code>`,
    `💰 8h Spread: ${arb.spread8h.toFixed(4)}%`,
    ``,
    `⚡ <b>Long ${arb.lowExchange} / Short ${arb.highExchange}</b>`,
  ].join('\n');
}
```

**Step 2: Verify file compiles**

Run: `npx tsc --noEmit src/lib/telegram.ts` (or just `npm run build`)

**Commit:** `feat: add Telegram Bot API helper with message formatters`

---

## Task 2: Add Database Schema for Bot Users

**Files:**
- Modify: `src/lib/db/index.ts` — add telegram_users table + CRUD

**Step 1: Add schema + functions to db/index.ts**

Add after existing schema initialization:

```typescript
// ─── Telegram bot tables ────────────────────────────────────────────────────

async function initTelegramTables() {
  const db = getSQL();
  await db`
    CREATE TABLE IF NOT EXISTS telegram_users (
      chat_id BIGINT PRIMARY KEY,
      active BOOLEAN DEFAULT true,
      price_threshold REAL DEFAULT 0.5,
      funding_threshold REAL DEFAULT 0.02,
      watchlist TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await db`
    CREATE TABLE IF NOT EXISTS arb_cooldowns (
      key TEXT PRIMARY KEY,
      alerted_at TIMESTAMPTZ DEFAULT NOW(),
      spread REAL DEFAULT 0
    )
  `;
}

export interface TelegramUser {
  chat_id: number;
  active: boolean;
  price_threshold: number;
  funding_threshold: number;
  watchlist: string;
}

export async function getTelegramUser(chatId: number): Promise<TelegramUser | null> {
  const db = getSQL();
  const rows = await db`SELECT * FROM telegram_users WHERE chat_id = ${chatId}`;
  return rows.length > 0 ? rows[0] as TelegramUser : null;
}

export async function upsertTelegramUser(chatId: number, fields?: Partial<Omit<TelegramUser, 'chat_id'>>) {
  const db = getSQL();
  await db`
    INSERT INTO telegram_users (chat_id, active, price_threshold, funding_threshold, watchlist, updated_at)
    VALUES (
      ${chatId},
      ${fields?.active ?? true},
      ${fields?.price_threshold ?? 0.5},
      ${fields?.funding_threshold ?? 0.02},
      ${fields?.watchlist ?? ''},
      NOW()
    )
    ON CONFLICT (chat_id) DO UPDATE SET
      active = COALESCE(${fields?.active ?? null}, telegram_users.active),
      price_threshold = COALESCE(${fields?.price_threshold ?? null}, telegram_users.price_threshold),
      funding_threshold = COALESCE(${fields?.funding_threshold ?? null}, telegram_users.funding_threshold),
      watchlist = COALESCE(${fields?.watchlist ?? null}, telegram_users.watchlist),
      updated_at = NOW()
  `;
}

export async function getActiveTelegramUsers(): Promise<TelegramUser[]> {
  const db = getSQL();
  return await db`SELECT * FROM telegram_users WHERE active = true` as TelegramUser[];
}

// Cooldown management
export async function getCooldown(key: string): Promise<{ alertedAt: Date; spread: number } | null> {
  const db = getSQL();
  const rows = await db`SELECT * FROM arb_cooldowns WHERE key = ${key} AND alerted_at > NOW() - INTERVAL '15 minutes'`;
  return rows.length > 0 ? { alertedAt: rows[0].alerted_at, spread: rows[0].spread } : null;
}

export async function setCooldown(key: string, spread: number) {
  const db = getSQL();
  await db`
    INSERT INTO arb_cooldowns (key, alerted_at, spread) VALUES (${key}, NOW(), ${spread})
    ON CONFLICT (key) DO UPDATE SET alerted_at = NOW(), spread = ${spread}
  `;
}

export async function cleanupCooldowns() {
  const db = getSQL();
  await db`DELETE FROM arb_cooldowns WHERE alerted_at < NOW() - INTERVAL '1 hour'`;
}
```

Also add `initTelegramTables()` call inside the existing `initDB()` function.

**Step 2: Build to verify**

Run: `npm run build`

**Commit:** `feat: add telegram_users and arb_cooldowns database tables`

---

## Task 3: Create Arbitrage Detector Module

**Files:**
- Create: `src/lib/arbitrage-detector.ts`

**Step 1: Create the detector**

```typescript
// src/lib/arbitrage-detector.ts

export interface PriceArb {
  symbol: string;
  lowExchange: string;
  lowPrice: number;
  highExchange: string;
  highPrice: number;
  spreadPct: number;
  spreadUsd: number;
  netPct: number;       // after 0.1% round-trip fees
  lowVolume: number;
  highVolume: number;
}

export interface FundingArb {
  symbol: string;
  lowExchange: string;
  lowRate: number;       // 8h normalized
  highExchange: string;
  highRate: number;      // 8h normalized
  spread8h: number;
}

const ROUND_TRIP_FEE = 0.10; // 0.1% total (0.05% per side)
const MIN_VOLUME = 500_000;  // $500K min volume on each side

export function detectPriceArbitrage(
  tickers: Array<{ symbol: string; exchange: string; lastPrice: number; quoteVolume24h: number }>,
  threshold: number = 0.5
): PriceArb[] {
  // Group by symbol
  const bySymbol = new Map<string, typeof tickers>();
  for (const t of tickers) {
    if (!t.lastPrice || t.lastPrice <= 0) continue;
    const arr = bySymbol.get(t.symbol) || [];
    arr.push(t);
    bySymbol.set(t.symbol, arr);
  }

  const arbs: PriceArb[] = [];

  for (const [symbol, entries] of bySymbol) {
    if (entries.length < 2) continue;

    // Find min and max price entries with sufficient volume
    let low = entries[0], high = entries[0];
    for (const e of entries) {
      if (e.lastPrice < low.lastPrice) low = e;
      if (e.lastPrice > high.lastPrice) high = e;
    }

    // Volume filter
    if (low.quoteVolume24h < MIN_VOLUME || high.quoteVolume24h < MIN_VOLUME) continue;
    // Same exchange = not arb
    if (low.exchange === high.exchange) continue;

    const spreadPct = ((high.lastPrice - low.lastPrice) / low.lastPrice) * 100;
    const netPct = spreadPct - ROUND_TRIP_FEE;

    if (netPct >= threshold) {
      arbs.push({
        symbol,
        lowExchange: low.exchange,
        lowPrice: low.lastPrice,
        highExchange: high.exchange,
        highPrice: high.lastPrice,
        spreadPct,
        spreadUsd: high.lastPrice - low.lastPrice,
        netPct,
        lowVolume: low.quoteVolume24h,
        highVolume: high.quoteVolume24h,
      });
    }
  }

  return arbs.sort((a, b) => b.netPct - a.netPct);
}

export function detectFundingArbitrage(
  rates: Array<{ symbol: string; exchange: string; fundingRate: number; fundingInterval: string }>,
  threshold: number = 0.02
): FundingArb[] {
  // Group by symbol, normalize to 8h
  const bySymbol = new Map<string, Array<{ exchange: string; rate8h: number }>>();
  for (const r of rates) {
    if (r.fundingRate == null) continue;
    const mult = r.fundingInterval === '1h' ? 8 : r.fundingInterval === '4h' ? 2 : 1;
    const rate8h = r.fundingRate * mult;
    const arr = bySymbol.get(r.symbol) || [];
    arr.push({ exchange: r.exchange, rate8h });
    bySymbol.set(r.symbol, arr);
  }

  const arbs: FundingArb[] = [];

  for (const [symbol, entries] of bySymbol) {
    if (entries.length < 2) continue;

    let low = entries[0], high = entries[0];
    for (const e of entries) {
      if (e.rate8h < low.rate8h) low = e;
      if (e.rate8h > high.rate8h) high = e;
    }

    const spread8h = high.rate8h - low.rate8h;
    if (spread8h >= threshold) {
      arbs.push({
        symbol,
        lowExchange: low.exchange,
        lowRate: low.rate8h,
        highExchange: high.exchange,
        highRate: high.rate8h,
        spread8h,
      });
    }
  }

  return arbs.sort((a, b) => b.spread8h - a.spread8h);
}
```

**Step 2: Build to verify**

Run: `npm run build`

**Commit:** `feat: add arbitrage detection module for price and funding spreads`

---

## Task 4: Create Telegram Webhook Handler

**Files:**
- Create: `src/app/api/telegram/webhook/route.ts`

**Step 1: Create the webhook route**

```typescript
// src/app/api/telegram/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sendMessage } from '@/lib/telegram';
import { initDB, isDBConfigured, getTelegramUser, upsertTelegramUser, getActiveTelegramUsers } from '@/lib/db';
import { detectPriceArbitrage, detectFundingArbitrage } from '@/lib/arbitrage-detector';
import { formatPriceAlert, formatFundingAlert } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';

export async function POST(request: NextRequest) {
  // Verify webhook secret
  if (WEBHOOK_SECRET) {
    const secret = request.headers.get('x-telegram-bot-api-secret-token');
    if (secret !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'DB not configured' }, { status: 503 });
  }

  try {
    await initDB();
    const body = await request.json();
    const message = body?.message;
    if (!message?.text || !message?.chat?.id) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = message.text.trim();
    const [cmd, ...args] = text.split(/\s+/);

    switch (cmd.toLowerCase()) {
      case '/start': {
        await upsertTelegramUser(chatId, { active: true });
        await sendMessage(chatId, [
          '🚀 <b>InfoHub Arbitrage Bot</b>',
          '',
          'You\'re now subscribed to price & funding rate arbitrage alerts across 28+ exchanges.',
          '',
          '<b>Commands:</b>',
          '/status — Show your current settings',
          '/set threshold 0.5 — Min price spread %',
          '/set funding 0.02 — Min funding spread %',
          '/watchlist BTC ETH SOL — Only these symbols',
          '/watchlist clear — Watch all symbols',
          '/scan — Force scan now',
          '/stop — Pause alerts',
        ].join('\n'));
        break;
      }

      case '/stop': {
        await upsertTelegramUser(chatId, { active: false });
        await sendMessage(chatId, '⏸ Alerts paused. Send /start to resume.');
        break;
      }

      case '/status': {
        const user = await getTelegramUser(chatId);
        if (!user) {
          await sendMessage(chatId, 'Not subscribed. Send /start first.');
          break;
        }
        await sendMessage(chatId, [
          '⚙️ <b>Your Settings</b>',
          '',
          `Status: ${user.active ? '🟢 Active' : '🔴 Paused'}`,
          `Price threshold: ${user.price_threshold}%`,
          `Funding threshold: ${user.funding_threshold}%`,
          `Watchlist: ${user.watchlist || 'All symbols'}`,
        ].join('\n'));
        break;
      }

      case '/set': {
        const [key, val] = args;
        if (!key || !val || isNaN(Number(val))) {
          await sendMessage(chatId, 'Usage: /set threshold 0.5 or /set funding 0.02');
          break;
        }
        const num = Math.max(0, Math.min(10, Number(val)));
        if (key === 'threshold') {
          await upsertTelegramUser(chatId, { price_threshold: num });
          await sendMessage(chatId, `✅ Price spread threshold set to ${num}%`);
        } else if (key === 'funding') {
          await upsertTelegramUser(chatId, { funding_threshold: num });
          await sendMessage(chatId, `✅ Funding spread threshold set to ${num}%`);
        } else {
          await sendMessage(chatId, 'Unknown setting. Use: /set threshold or /set funding');
        }
        break;
      }

      case '/watchlist': {
        if (args[0] === 'clear' || args.length === 0) {
          await upsertTelegramUser(chatId, { watchlist: '' });
          await sendMessage(chatId, '✅ Watchlist cleared — watching all symbols.');
        } else {
          const symbols = args.map(s => s.toUpperCase()).join(',');
          await upsertTelegramUser(chatId, { watchlist: symbols });
          await sendMessage(chatId, `✅ Watchlist: ${symbols.split(',').join(', ')}`);
        }
        break;
      }

      case '/scan': {
        const user = await getTelegramUser(chatId);
        if (!user) {
          await sendMessage(chatId, 'Not subscribed. Send /start first.');
          break;
        }

        const origin = request.nextUrl.origin;
        const [tickerRes, fundingRes] = await Promise.all([
          fetch(`${origin}/api/tickers`).then(r => r.json()),
          fetch(`${origin}/api/funding`).then(r => r.json()),
        ]);

        const priceArbs = detectPriceArbitrage(tickerRes.data || [], user.price_threshold);
        const fundingArbs = detectFundingArbitrage(fundingRes.data || [], user.funding_threshold);

        const watchlist = user.watchlist ? user.watchlist.split(',') : null;
        const filteredPrice = watchlist ? priceArbs.filter(a => watchlist.includes(a.symbol)) : priceArbs;
        const filteredFunding = watchlist ? fundingArbs.filter(a => watchlist.includes(a.symbol)) : fundingArbs;

        if (filteredPrice.length === 0 && filteredFunding.length === 0) {
          await sendMessage(chatId, '📊 No arbitrage opportunities above your thresholds right now.');
          break;
        }

        const messages: string[] = [];
        for (const arb of filteredPrice.slice(0, 5)) {
          messages.push(formatPriceAlert(arb));
        }
        for (const arb of filteredFunding.slice(0, 5)) {
          messages.push(formatFundingAlert(arb));
        }

        await sendMessage(chatId, messages.join('\n\n'));
        break;
      }

      default: {
        await sendMessage(chatId, 'Unknown command. Send /start for available commands.');
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

**Step 2: Build to verify**

Run: `npm run build`

**Commit:** `feat: add Telegram webhook route with bot commands`

---

## Task 5: Create Cron Arbitrage Alert Route

**Files:**
- Create: `src/app/api/cron/arbitrage-alerts/route.ts`
- Modify: `vercel.json` — add cron schedule

**Step 1: Create the cron route**

```typescript
// src/app/api/cron/arbitrage-alerts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sendMessage, formatPriceAlert, formatFundingAlert } from '@/lib/telegram';
import { initDB, isDBConfigured, getActiveTelegramUsers, getCooldown, setCooldown, cleanupCooldowns } from '@/lib/db';
import { detectPriceArbitrage, detectFundingArbitrage } from '@/lib/arbitrage-detector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const CRON_SECRET = (process.env.CRON_SECRET || '').trim();

export async function GET(request: NextRequest) {
  // Auth check
  if (CRON_SECRET) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'DB not configured' }, { status: 503 });
  }

  try {
    await initDB();

    // Fetch data from own APIs
    const origin = request.nextUrl.origin;
    const [tickerRes, fundingRes] = await Promise.all([
      fetch(`${origin}/api/tickers`, { signal: AbortSignal.timeout(15000) }),
      fetch(`${origin}/api/funding`, { signal: AbortSignal.timeout(15000) }),
    ]);

    if (!tickerRes.ok && !fundingRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch data' }, { status: 502 });
    }

    const tickerJson = tickerRes.ok ? await tickerRes.json() : { data: [] };
    const fundingJson = fundingRes.ok ? await fundingRes.json() : { data: [] };

    // Get all active users
    const users = await getActiveTelegramUsers();
    if (users.length === 0) {
      return NextResponse.json({ ok: true, alerts: 0, reason: 'no active users' });
    }

    let totalAlerts = 0;

    for (const user of users) {
      const priceArbs = detectPriceArbitrage(tickerJson.data || [], user.price_threshold);
      const fundingArbs = detectFundingArbitrage(fundingJson.data || [], user.funding_threshold);

      const watchlist = user.watchlist ? user.watchlist.split(',') : null;
      const filteredPrice = watchlist ? priceArbs.filter(a => watchlist.includes(a.symbol)) : priceArbs;
      const filteredFunding = watchlist ? fundingArbs.filter(a => watchlist.includes(a.symbol)) : fundingArbs;

      const messages: string[] = [];

      // Check cooldowns for price arbs
      for (const arb of filteredPrice.slice(0, 3)) {
        const key = `price:${arb.symbol}`;
        const cd = await getCooldown(key);
        // Alert if no cooldown, or spread widened 50%+
        if (!cd || arb.spreadPct > cd.spread * 1.5) {
          messages.push(formatPriceAlert(arb));
          await setCooldown(key, arb.spreadPct);
        }
      }

      // Check cooldowns for funding arbs
      for (const arb of filteredFunding.slice(0, 3)) {
        const key = `funding:${arb.symbol}`;
        const cd = await getCooldown(key);
        if (!cd || arb.spread8h > cd.spread * 1.5) {
          messages.push(formatFundingAlert(arb));
          await setCooldown(key, arb.spread8h);
        }
      }

      if (messages.length > 0) {
        await sendMessage(user.chat_id, messages.join('\n\n'));
        totalAlerts += messages.length;
      }
    }

    // Cleanup stale cooldowns ~10% of the time
    if (Math.random() < 0.1) {
      await cleanupCooldowns();
    }

    return NextResponse.json({ ok: true, alerts: totalAlerts, users: users.length });
  } catch (error) {
    console.error('Arbitrage alert cron error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
```

**Step 2: Update vercel.json with cron config**

```json
{
  "functions": {
    "app/api/**/*": {
      "maxDuration": 30
    }
  },
  "crons": [
    {
      "path": "/api/cron/arbitrage-alerts",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/cron/snapshot",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

**Step 3: Build to verify**

Run: `npm run build`

**Commit:** `feat: add cron arbitrage alert route + Vercel cron config`

---

## Task 6: Setup & Deploy

**Step 1: Create Telegram bot via @BotFather**
- Message @BotFather on Telegram → /newbot
- Name: "InfoHub Arb Bot" (or similar)
- Save the bot token

**Step 2: Set environment variables on Vercel**

```bash
vercel env add TELEGRAM_BOT_TOKEN       # from BotFather
vercel env add TELEGRAM_WEBHOOK_SECRET  # generate random string
vercel env add CRON_SECRET              # if not already set
```

**Step 3: Add to .env.local for local testing**

```
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...
```

**Step 4: Build and deploy**

```bash
npm run build
npx vercel --prod
```

**Step 5: Set webhook URL**

After deploy, register the webhook with Telegram:

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://info-hub.io/api/telegram/webhook&secret_token=<WEBHOOK_SECRET>"
```

**Step 6: Test**
- DM the bot /start
- Send /scan to see current opportunities
- Verify cron fires and delivers alerts

**Commit:** `chore: configure Telegram bot environment and webhook`

---

## Implementation Order

1. Task 1 — Telegram helper (standalone, no deps)
2. Task 2 — Database schema (extends existing db module)
3. Task 3 — Arbitrage detector (standalone, no deps)
4. Task 4 — Webhook handler (depends on 1, 2, 3)
5. Task 5 — Cron route (depends on 1, 2, 3)
6. Task 6 — Setup & deploy (depends on all above)

Tasks 1, 2, 3 are independent and can be done in parallel.

## Notes

- **Vercel Cron Pro plan required** for per-minute cron. Hobby plan only gets 1 cron/day. If on Hobby, use an external cron service (cron-job.org, Upstash) to hit the endpoint every 60s.
- **No new npm deps.** Telegram Bot API is just fetch POST calls.
- **PostgreSQL reuse.** User prefs and cooldowns go in existing DigitalOcean Postgres — no Vercel KV needed.
- **upsertTelegramUser COALESCE pattern:** Only updates fields that are explicitly passed, preserving other settings.
