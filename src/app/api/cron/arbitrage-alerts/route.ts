/**
 * Cron endpoint: detect arbitrage opportunities and send Telegram alerts.
 * Runs every minute via Vercel Cron.
 *
 * Security: Verifies CRON_SECRET Bearer token.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  initDB,
  isDBConfigured,
  getActiveTelegramUsers,
  getCooldown,
  setCooldown,
  cleanupCooldowns,
  type TelegramUser,
} from '@/lib/db';
import { detectPriceArbitrage, detectFundingArbitrage } from '@/lib/arbitrage-detector';
import type { PriceArb, FundingArb } from '@/lib/arbitrage-detector';
import { sendMessage, formatPriceAlert, formatFundingAlert } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export const preferredRegion = 'dxb1';

const CRON_SECRET = (process.env.CRON_SECRET || '').trim();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fetch JSON from an internal API with a 15s timeout. Returns null on failure. */
async function fetchJSON<T = any>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      console.error(`[arb-cron] fetch ${url} failed: ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error(`[arb-cron] fetch ${url} error:`, err);
    return null;
  }
}

/** Check if a symbol matches the user's watchlist. Empty watchlist = match all. */
function matchesWatchlist(symbol: string, watchlist: string): boolean {
  if (!watchlist || !watchlist.trim()) return true;
  const symbols = watchlist
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  if (symbols.length === 0) return true;
  return symbols.includes(symbol.toUpperCase());
}

/** Build and send a combined alert message for a single user. */
async function processUser(
  user: TelegramUser,
  tickerData: any[],
  fundingData: any[],
): Promise<number> {
  const priceArbs = detectPriceArbitrage(tickerData, user.price_threshold);
  const fundingArbs = detectFundingArbitrage(fundingData, user.funding_threshold);

  // Filter by watchlist
  const filteredPrice = priceArbs.filter((a) => matchesWatchlist(a.symbol, user.watchlist));
  const filteredFunding = fundingArbs.filter((a) => matchesWatchlist(a.symbol, user.watchlist));

  // Take top 3 of each
  const topPrice = filteredPrice.slice(0, 3);
  const topFunding = filteredFunding.slice(0, 3);

  const messageParts: string[] = [];
  let alertCount = 0;

  // Check cooldowns for price arbs
  for (const arb of topPrice) {
    const key = `price:${arb.symbol}`;
    const cd = await getCooldown(key);
    if (!cd || arb.spreadPct > cd.spread * 1.5) {
      messageParts.push(formatPriceAlert(arb));
      await setCooldown(key, arb.spreadPct);
      alertCount++;
    }
  }

  // Check cooldowns for funding arbs
  for (const arb of topFunding) {
    const key = `funding:${arb.symbol}`;
    const cd = await getCooldown(key);
    if (!cd || arb.spread8h > cd.spread * 1.5) {
      messageParts.push(formatFundingAlert(arb));
      await setCooldown(key, arb.spread8h);
      alertCount++;
    }
  }

  // Send combined message if anything passed cooldown
  if (messageParts.length > 0) {
    const message = messageParts.join('\n\n');
    await sendMessage(user.chat_id, message, 'HTML');
  }

  return alertCount;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // Auth check
  if (CRON_SECRET) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    await initDB();

    const origin = request.nextUrl.origin;

    // Fetch ticker and funding data in parallel
    const [tickerJson, fundingJson] = await Promise.all([
      fetchJSON<{ data: any[] }>(`${origin}/api/tickers`),
      fetchJSON<{ data: any[] }>(`${origin}/api/funding`),
    ]);

    const tickerData: any[] = tickerJson?.data ?? [];
    const fundingData: any[] = fundingJson?.data ?? [];

    // Get active Telegram users
    const users = await getActiveTelegramUsers();
    if (users.length === 0) {
      return NextResponse.json({ ok: true, alerts: 0, users: 0, skipped: 'no active users' });
    }

    // Process each user
    let totalAlerts = 0;
    for (const user of users) {
      try {
        totalAlerts += await processUser(user, tickerData, fundingData);
      } catch (err) {
        console.error(`[arb-cron] error processing user ${user.chat_id}:`, err);
      }
    }

    // Cleanup old cooldowns ~10% of the time
    if (Math.random() < 0.10) {
      await cleanupCooldowns();
    }

    return NextResponse.json({
      ok: true,
      alerts: totalAlerts,
      users: users.length,
    });
  } catch (error) {
    console.error('[arb-cron] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
