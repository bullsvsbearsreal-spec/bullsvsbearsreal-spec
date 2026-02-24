/**
 * Telegram Webhook Handler — processes incoming bot commands.
 *
 * Commands:
 *   /start            Register & activate alerts
 *   /stop             Pause alerts
 *   /status           Show current settings
 *   /set threshold N  Set price-arb threshold (0-10%)
 *   /set funding N    Set funding-arb threshold (0-10%)
 *   /watchlist ...    Set symbol watchlist (or "clear" to reset)
 *   /scan             Force immediate arb scan
 *
 * Security: Verifies x-telegram-bot-api-secret-token header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendMessage, formatPriceAlert, formatFundingAlert } from '@/lib/telegram';
import { initDB, isDBConfigured, getTelegramUser, upsertTelegramUser } from '@/lib/db';
import { detectPriceArbitrage, detectFundingArbitrage } from '@/lib/arbitrage-detector';
import type { TickerEntry, FundingEntry } from '@/lib/arbitrage-detector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WEBHOOK_SECRET = (process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp a numeric value between min and max. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------

async function handleStart(chatId: number): Promise<void> {
  await upsertTelegramUser(chatId, { active: true });

  const welcome = [
    '<b>Welcome to InfoHub Arb Bot!</b>',
    '',
    'You will receive alerts for price and funding-rate arbitrage opportunities.',
    '',
    '<b>Commands:</b>',
    '/start — Activate alerts',
    '/stop — Pause alerts',
    '/status — Show your current settings',
    '/set threshold &lt;n&gt; — Price-arb threshold (0-10%)',
    '/set funding &lt;n&gt; — Funding-arb threshold (0-10%)',
    '/watchlist BTC ETH SOL — Set symbol watchlist',
    '/watchlist clear — Clear watchlist (all symbols)',
    '/scan — Force immediate arb scan',
  ].join('\n');

  await sendMessage(chatId, welcome);
}

async function handleStop(chatId: number): Promise<void> {
  await upsertTelegramUser(chatId, { active: false });
  await sendMessage(chatId, 'Alerts paused. Send /start to resume.');
}

async function handleStatus(chatId: number): Promise<void> {
  const user = await getTelegramUser(chatId);

  if (!user) {
    await sendMessage(chatId, 'You are not registered yet. Send /start to begin.');
    return;
  }

  const watchlistDisplay = user.watchlist
    ? user.watchlist.split(',').join(', ')
    : '<i>all symbols</i>';

  const status = [
    '<b>Your Settings</b>',
    '',
    `Active: ${user.active ? 'Yes' : 'No (paused)'}`,
    `Price threshold: ${user.price_threshold}%`,
    `Funding threshold: ${user.funding_threshold}%`,
    `Watchlist: ${watchlistDisplay}`,
  ].join('\n');

  await sendMessage(chatId, status);
}

async function handleSet(chatId: number, args: string[]): Promise<void> {
  // Expected: /set threshold <n> OR /set funding <n>
  if (args.length < 2) {
    await sendMessage(
      chatId,
      'Usage:\n/set threshold &lt;n&gt; — Price threshold (0-10%)\n/set funding &lt;n&gt; — Funding threshold (0-10%)',
    );
    return;
  }

  const subcommand = args[0].toLowerCase();
  const value = parseFloat(args[1]);

  if (isNaN(value)) {
    await sendMessage(chatId, 'Invalid number. Usage: /set threshold 0.5');
    return;
  }

  const clamped = clamp(value, 0, 10);

  if (subcommand === 'threshold') {
    await upsertTelegramUser(chatId, { price_threshold: clamped });
    await sendMessage(chatId, `Price-arb threshold set to <b>${clamped}%</b>.`);
  } else if (subcommand === 'funding') {
    await upsertTelegramUser(chatId, { funding_threshold: clamped });
    await sendMessage(chatId, `Funding-arb threshold set to <b>${clamped}%</b>.`);
  } else {
    await sendMessage(
      chatId,
      'Unknown setting. Use:\n/set threshold &lt;n&gt;\n/set funding &lt;n&gt;',
    );
  }
}

async function handleWatchlist(chatId: number, args: string[]): Promise<void> {
  // No args or "clear" => clear watchlist
  if (args.length === 0 || (args.length === 1 && args[0].toLowerCase() === 'clear')) {
    await upsertTelegramUser(chatId, { watchlist: '' });
    await sendMessage(chatId, 'Watchlist cleared. You will receive alerts for all symbols.');
    return;
  }

  // Parse symbols — accept space-separated or comma-separated
  const symbols = args
    .join(' ')
    .split(/[\s,]+/)
    .map((s) => s.toUpperCase().trim())
    .filter(Boolean);

  const watchlist = Array.from(new Set(symbols)).join(',');
  await upsertTelegramUser(chatId, { watchlist });

  await sendMessage(
    chatId,
    `Watchlist set to: <b>${symbols.join(', ')}</b>\nAlerts will be filtered to these symbols only.`,
  );
}

async function handleScan(chatId: number, origin: string): Promise<void> {
  const user = await getTelegramUser(chatId);
  if (!user) {
    await sendMessage(chatId, 'You are not registered yet. Send /start first.');
    return;
  }

  await sendMessage(chatId, 'Scanning for arbitrage opportunities...');

  // Fetch tickers and funding data from internal API routes
  const [tickersRes, fundingRes] = await Promise.all([
    fetch(`${origin}/api/tickers`, { signal: AbortSignal.timeout(25000) }),
    fetch(`${origin}/api/funding`, { signal: AbortSignal.timeout(25000) }),
  ]);

  let priceArbs: ReturnType<typeof detectPriceArbitrage> = [];
  let fundingArbs: ReturnType<typeof detectFundingArbitrage> = [];

  if (tickersRes.ok) {
    const tickersJson = await tickersRes.json();
    const tickers: TickerEntry[] = tickersJson.data || [];
    priceArbs = detectPriceArbitrage(tickers, user.price_threshold);
  }

  if (fundingRes.ok) {
    const fundingJson = await fundingRes.json();
    const rates: FundingEntry[] = fundingJson.data || [];
    fundingArbs = detectFundingArbitrage(rates, user.funding_threshold);
  }

  // Filter by watchlist if set
  if (user.watchlist) {
    const symbols = new Set(user.watchlist.split(',').map((s) => s.trim().toUpperCase()));
    priceArbs = priceArbs.filter((a) => symbols.has(a.symbol));
    fundingArbs = fundingArbs.filter((a) => symbols.has(a.symbol));
  }

  // Take top 5 of each
  const topPrice = priceArbs.slice(0, 5);
  const topFunding = fundingArbs.slice(0, 5);

  if (topPrice.length === 0 && topFunding.length === 0) {
    await sendMessage(chatId, 'No opportunities above your thresholds.');
    return;
  }

  // Send price arbs
  if (topPrice.length > 0) {
    const header = `<b>Top ${topPrice.length} Price Arbs</b>\n`;
    const messages = topPrice.map((arb) => formatPriceAlert(arb));
    await sendMessage(chatId, header + messages.join('\n\n'));
  }

  // Send funding arbs
  if (topFunding.length > 0) {
    const header = `<b>Top ${topFunding.length} Funding Arbs</b>\n`;
    const messages = topFunding.map((arb) => formatFundingAlert(arb));
    await sendMessage(chatId, header + messages.join('\n\n'));
  }
}

// ---------------------------------------------------------------------------
// Main POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // 1. Verify webhook secret
    if (WEBHOOK_SECRET) {
      const token = request.headers.get('x-telegram-bot-api-secret-token');
      if (token !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // 2. Parse Telegram update
    const body = await request.json();
    const message = body?.message;

    // No message (e.g. edited_message, callback_query, etc.) — acknowledge
    if (!message?.text || !message?.chat?.id) {
      return NextResponse.json({ ok: true });
    }

    const chatId: number = message.chat.id;
    const text: string = message.text.trim();

    // 3. Ensure DB is ready
    if (isDBConfigured()) {
      await initDB();
    } else {
      await sendMessage(chatId, 'Bot is not fully configured yet. Please try again later.');
      return NextResponse.json({ ok: true });
    }

    // 4. Parse command and arguments
    const parts = text.split(/\s+/);
    const command = parts[0].toLowerCase().replace(/@\w+$/, ''); // strip @botname suffix
    const args = parts.slice(1);

    // 5. Route commands
    switch (command) {
      case '/start':
        await handleStart(chatId);
        break;

      case '/stop':
        await handleStop(chatId);
        break;

      case '/status':
        await handleStatus(chatId);
        break;

      case '/set':
        await handleSet(chatId, args);
        break;

      case '/watchlist':
        await handleWatchlist(chatId, args);
        break;

      case '/scan':
        await handleScan(chatId, request.nextUrl.origin);
        break;

      default:
        await sendMessage(
          chatId,
          'Unknown command. Send /start to see available commands.',
        );
        break;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[telegram/webhook] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
