/**
 * Telegram Webhook Handler — processes incoming bot commands.
 *
 * Commands:
 *   /start                 Register & activate alerts
 *   /stop                  Pause alerts
 *   /status                Show current settings
 *   /set threshold N       Set price-arb threshold (0-10%)
 *   /set funding N         Set funding-arb threshold (0-10%)
 *   /watchlist ...         Set symbol watchlist (or "clear" to reset)
 *   /scan                  Force immediate arb scan
 *   /history BTC [7d]      Funding rate history summary
 *   /oi BTC                Open interest breakdown by exchange
 *   /liq [BTC]             Top liquidations (24h)
 *   /alert list            List your active alerts
 *   /alert add BTC price gt 100000   Create price/funding/OI alert
 *   /alert remove 1        Remove alert by number
 *   /alert clear            Remove all alerts
 *
 * Security: Verifies x-telegram-bot-api-secret-token header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendMessage, formatPriceAlert, formatFundingAlert } from '@/lib/telegram';
import {
  initDB, isDBConfigured, getTelegramUser, upsertTelegramUser,
  getTelegramAlerts, addTelegramAlert, removeTelegramAlert, clearTelegramAlerts,
} from '@/lib/db';
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
    '<b>Welcome to InfoHub Bot!</b>',
    '',
    'Real-time crypto data from 24+ exchanges.',
    '',
    '<b>Arbitrage:</b>',
    '/scan — Force immediate arb scan',
    '/set threshold &lt;n&gt; — Price-arb threshold (0-10%)',
    '/set funding &lt;n&gt; — Funding-arb threshold (0-10%)',
    '/watchlist BTC ETH SOL — Set symbol watchlist',
    '/watchlist clear — Clear watchlist (all symbols)',
    '',
    '<b>Market Data:</b>',
    '/history BTC [7d] — Funding rate history',
    '/oi BTC — Open interest by exchange',
    '/liq [BTC] — Top liquidations (24h)',
    '',
    '<b>Custom Alerts:</b>',
    '/alert add BTC price gt 100000',
    '/alert list — Show your alerts',
    '/alert remove &lt;n&gt; — Remove alert by number',
    '/alert clear — Remove all alerts',
    '',
    '<b>General:</b>',
    '/start — Activate alerts',
    '/stop — Pause alerts',
    '/status — Show your current settings',
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
// /history — funding rate history summary
// ---------------------------------------------------------------------------

async function handleHistory(chatId: number, args: string[], origin: string): Promise<void> {
  if (args.length === 0) {
    await sendMessage(chatId, 'Usage: /history BTC [7d]\nTimeframes: 1d, 7d, 30d');
    return;
  }

  const symbol = args[0].toUpperCase();

  // Parse timeframe (default 7d)
  let days = 7;
  if (args.length >= 2) {
    const tf = args[1].toLowerCase();
    if (tf === '1d') days = 1;
    else if (tf === '7d') days = 7;
    else if (tf === '30d') days = 30;
    else {
      await sendMessage(chatId, 'Invalid timeframe. Use: 1d, 7d, or 30d');
      return;
    }
  }

  try {
    const res = await fetch(
      `${origin}/api/history/funding?symbol=${encodeURIComponent(symbol)}&days=${days}`,
      { signal: AbortSignal.timeout(25000) },
    );

    if (!res.ok) {
      await sendMessage(chatId, `Failed to fetch funding history (HTTP ${res.status}).`);
      return;
    }

    const json = await res.json();
    const data: Array<{ exchange: string; day: string; rate: number }> = json.data || [];

    if (data.length === 0) {
      await sendMessage(chatId, `No funding history found for <b>${symbol}</b> in the last ${days}d.`);
      return;
    }

    // Compute stats
    const rates = data.map((d) => d.rate);
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
    const high = Math.max(...rates);
    const low = Math.min(...rates);

    // Recent 3 data points (latest first)
    const recent = data.slice(-3).reverse();

    const lines = [
      `<b>Funding History: ${symbol} (${days}d)</b>`,
      '━━━━━━━━━━━━━━━━',
      `Avg rate:  ${fmtRate(avg)}`,
      `High:      ${fmtRate(high)}`,
      `Low:       ${fmtRate(low)}`,
      `Data points: ${data.length}`,
      '',
      '<b>Recent:</b>',
      ...recent.map((d) => `  ${d.day} | ${d.exchange}: ${fmtRate(d.rate)}`),
    ];

    await sendMessage(chatId, lines.join('\n'));
  } catch (err) {
    console.error('[telegram] handleHistory error:', err);
    await sendMessage(chatId, 'Error fetching funding history. Please try again later.');
  }
}

// ---------------------------------------------------------------------------
// /oi — open interest breakdown
// ---------------------------------------------------------------------------

async function handleOI(chatId: number, args: string[], origin: string): Promise<void> {
  if (args.length === 0) {
    await sendMessage(chatId, 'Usage: /oi BTC');
    return;
  }

  const symbol = args[0].toUpperCase();

  try {
    const res = await fetch(
      `${origin}/api/openinterest`,
      { signal: AbortSignal.timeout(25000) },
    );

    if (!res.ok) {
      await sendMessage(chatId, `Failed to fetch OI data (HTTP ${res.status}).`);
      return;
    }

    const json = await res.json();
    const allData: Array<{ symbol: string; exchange: string; openInterest: number }> = json.data || [];

    // Filter for the requested symbol
    const entries = allData.filter(
      (d) => d.symbol.toUpperCase() === symbol,
    );

    if (entries.length === 0) {
      await sendMessage(chatId, `No OI data found for <b>${symbol}</b>.`);
      return;
    }

    // Sort by OI descending
    entries.sort((a, b) => b.openInterest - a.openInterest);

    const totalOI = entries.reduce((acc, e) => acc + e.openInterest, 0);
    const top5 = entries.slice(0, 5);

    // Calculate max exchange name length for alignment
    const maxNameLen = Math.max(...top5.map((e) => e.exchange.length));

    const lines = [
      `<b>Open Interest: ${symbol}</b>`,
      '━━━━━━━━━━━━━━━━',
      `Total OI: <b>${fmtUsd(totalOI)}</b>`,
      `Exchanges: ${entries.length}`,
      '',
      '<b>Top 5 Exchanges:</b>',
      '<code>',
      ...top5.map((e) => {
        const name = e.exchange + ' '.repeat(Math.max(1, maxNameLen - e.exchange.length));
        const pct = ((e.openInterest / totalOI) * 100).toFixed(1);
        return `  ${name}  ${fmtUsd(e.openInterest).padStart(12)}  (${pct}%)`;
      }),
      '</code>',
    ];

    await sendMessage(chatId, lines.join('\n'));
  } catch (err) {
    console.error('[telegram] handleOI error:', err);
    await sendMessage(chatId, 'Error fetching OI data. Please try again later.');
  }
}

// ---------------------------------------------------------------------------
// /liq — liquidations summary
// ---------------------------------------------------------------------------

async function handleLiq(chatId: number, args: string[], origin: string): Promise<void> {
  const symbol = args.length > 0 ? args[0].toUpperCase() : null;

  try {
    const url = symbol
      ? `${origin}/api/liquidation-heatmap?symbol=${encodeURIComponent(symbol)}&timeframe=24h`
      : `${origin}/api/liquidation-heatmap?timeframe=24h`;

    const res = await fetch(url, { signal: AbortSignal.timeout(25000) });

    if (!res.ok) {
      await sendMessage(chatId, `Failed to fetch liquidation data (HTTP ${res.status}).`);
      return;
    }

    const json = await res.json();

    if (symbol) {
      // Per-exchange breakdown for a specific symbol
      const summary = json.summary;
      const byExchange: Array<{ exchange: string; value: number; count: number; longValue: number; shortValue: number }> =
        json.byExchange || [];

      if (!summary || summary.totalCount === 0) {
        await sendMessage(chatId, `No liquidations for <b>${symbol}</b> in the last 24h.`);
        return;
      }

      byExchange.sort((a, b) => b.value - a.value);
      const top5 = byExchange.slice(0, 5);
      const maxNameLen = top5.length > 0 ? Math.max(...top5.map((e) => e.exchange.length)) : 0;

      const lines = [
        `<b>Liquidations: ${symbol} (24h)</b>`,
        '━━━━━━━━━━━━━━━━',
        `Total: <b>${fmtUsd(summary.totalVolume)}</b> (${summary.totalCount} events)`,
        `Longs:  ${fmtUsd(summary.longVolume)}`,
        `Shorts: ${fmtUsd(summary.shortVolume)}`,
      ];

      if (top5.length > 0) {
        lines.push('', '<b>By Exchange:</b>', '<code>');
        for (const e of top5) {
          const name = e.exchange + ' '.repeat(Math.max(1, maxNameLen - e.exchange.length));
          lines.push(`  ${name}  ${fmtUsd(e.value).padStart(12)}`);
        }
        lines.push('</code>');
      }

      await sendMessage(chatId, lines.join('\n'));
    } else {
      // Top liquidated symbols
      const topSymbols: Array<{ symbol: string; value: number; count: number; longValue: number; shortValue: number }> =
        json.topSymbols || [];

      if (topSymbols.length === 0) {
        await sendMessage(chatId, 'No liquidation data available for the last 24h.');
        return;
      }

      const top5 = topSymbols.slice(0, 5);
      const maxSymLen = Math.max(...top5.map((s) => s.symbol.length));

      const lines = [
        '<b>Top Liquidations (24h)</b>',
        '━━━━━━━━━━━━━━━━',
        '<code>',
        ...top5.map((s, i) => {
          const sym = s.symbol + ' '.repeat(Math.max(1, maxSymLen - s.symbol.length));
          const longPct = s.value > 0 ? ((s.longValue / s.value) * 100).toFixed(0) : '0';
          return `${i + 1}. ${sym}  ${fmtUsd(s.value).padStart(12)}  L:${longPct}%`;
        }),
        '</code>',
        '',
        'Use /liq BTC for per-exchange breakdown.',
      ];

      await sendMessage(chatId, lines.join('\n'));
    }
  } catch (err) {
    console.error('[telegram] handleLiq error:', err);
    await sendMessage(chatId, 'Error fetching liquidation data. Please try again later.');
  }
}

// ---------------------------------------------------------------------------
// /alert — custom alert management
// ---------------------------------------------------------------------------

const VALID_METRICS = new Set(['price', 'fundingrate', 'openinterest', 'change24h']);
const VALID_OPERATORS = new Set(['gt', 'lt']);

async function handleAlert(chatId: number, args: string[]): Promise<void> {
  if (args.length === 0) {
    await sendMessage(
      chatId,
      [
        '<b>Alert Commands:</b>',
        '/alert list — Show your alerts',
        '/alert add BTC price gt 100000',
        '/alert remove &lt;n&gt; — Remove by number',
        '/alert clear — Remove all',
        '',
        '<b>Metrics:</b> price, fundingRate, openInterest, change24h',
        '<b>Operators:</b> gt (greater than), lt (less than)',
      ].join('\n'),
    );
    return;
  }

  const subcommand = args[0].toLowerCase();

  switch (subcommand) {
    case 'list': {
      const alerts = await getTelegramAlerts(chatId);
      if (alerts.length === 0) {
        await sendMessage(chatId, 'You have no active alerts.\nUse /alert add BTC price gt 100000 to create one.');
        return;
      }

      const lines = [
        `<b>Your Alerts (${alerts.length})</b>`,
        '━━━━━━━━━━━━━━━━',
      ];
      alerts.forEach((a, i) => {
        const op = a.operator === 'gt' ? '>' : '<';
        lines.push(`${i + 1}. <b>${a.symbol}</b> ${a.metric} ${op} ${a.threshold}`);
      });
      lines.push('', 'Use /alert remove &lt;n&gt; to delete.');

      await sendMessage(chatId, lines.join('\n'));
      break;
    }

    case 'add': {
      // /alert add BTC price gt 100000
      if (args.length < 5) {
        await sendMessage(
          chatId,
          'Usage: /alert add &lt;symbol&gt; &lt;metric&gt; &lt;gt|lt&gt; &lt;value&gt;\nExample: /alert add BTC price gt 100000',
        );
        return;
      }

      const symbol = args[1].toUpperCase();
      const metric = args[2].toLowerCase();
      const operator = args[3].toLowerCase();
      const threshold = parseFloat(args[4]);

      if (!VALID_METRICS.has(metric)) {
        await sendMessage(chatId, `Invalid metric: ${args[2]}\nValid: price, fundingRate, openInterest, change24h`);
        return;
      }
      if (!VALID_OPERATORS.has(operator)) {
        await sendMessage(chatId, `Invalid operator: ${args[3]}\nUse: gt (greater than) or lt (less than)`);
        return;
      }
      if (isNaN(threshold)) {
        await sendMessage(chatId, `Invalid threshold value: ${args[4]}`);
        return;
      }

      await addTelegramAlert(chatId, symbol, metric, operator, threshold);

      const op = operator === 'gt' ? '>' : '<';
      await sendMessage(chatId, `Alert created: <b>${symbol}</b> ${metric} ${op} ${threshold}`);
      break;
    }

    case 'remove': {
      if (args.length < 2) {
        await sendMessage(chatId, 'Usage: /alert remove &lt;number&gt;\nUse /alert list to see numbers.');
        return;
      }

      const idx = parseInt(args[1], 10);
      if (isNaN(idx) || idx < 1) {
        await sendMessage(chatId, 'Please provide a valid alert number. Use /alert list to see your alerts.');
        return;
      }

      const removed = await removeTelegramAlert(chatId, idx);
      if (removed) {
        await sendMessage(chatId, `Alert #${idx} removed.`);
      } else {
        await sendMessage(chatId, `Alert #${idx} not found. Use /alert list to see your alerts.`);
      }
      break;
    }

    case 'clear': {
      const count = await clearTelegramAlerts(chatId);
      await sendMessage(chatId, count > 0 ? `Cleared ${count} alert(s).` : 'You have no alerts to clear.');
      break;
    }

    default:
      await sendMessage(
        chatId,
        'Unknown alert command.\nUse: /alert list, /alert add, /alert remove, /alert clear',
      );
  }
}

// ---------------------------------------------------------------------------
// Shared formatting helpers
// ---------------------------------------------------------------------------

/** Format a funding rate with explicit sign and 4 decimal places. */
function fmtRate(r: number): string {
  return (r >= 0 ? '+' : '') + r.toFixed(4) + '%';
}

/** Format a USD amount with compact notation for large values. */
function fmtUsd(n: number): string {
  if (n >= 1_000_000_000) return '$' + (n / 1_000_000_000).toFixed(2) + 'B';
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(1) + 'K';
  return '$' + n.toFixed(2);
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

      case '/history':
        await handleHistory(chatId, args, request.nextUrl.origin);
        break;

      case '/oi':
        await handleOI(chatId, args, request.nextUrl.origin);
        break;

      case '/liq':
        await handleLiq(chatId, args, request.nextUrl.origin);
        break;

      case '/alert':
        await handleAlert(chatId, args);
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
