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
import { sendMessage, sendMessageWithKeyboard, sendPhoto, answerCallbackQuery, formatPriceAlert, formatFundingAlert } from '@/lib/telegram';
import {
  initDB, isDBConfigured, getTelegramUser, upsertTelegramUser,
  getTelegramAlerts, addTelegramAlert, removeTelegramAlert, clearTelegramAlerts,
  updateReportSchedule,
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
    '/price BTC — Current price &amp; 24h change',
    '/funding BTC — Funding rates across exchanges',
    '/basis [BTC] — Funding basis (premium/discount)',
    '/top — Top 5 gainers &amp; losers',
    '/rsi BTC — RSI-14 across 1h/4h/1d',
    '/history BTC [7d] — Funding rate history',
    '/oi BTC — Open interest by exchange',
    '/liq [BTC] — Top liquidations (24h)',
    '/whale — Top Hyperliquid whale positions',
    '/dominance — BTC/ETH/SOL dominance %',
    '/feargreed — Fear &amp; Greed Index + trend',
    '/yields — Top DeFi yields by APY',
    '/menu — Interactive command menu',
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
    '/help — Show this message',
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

  const scanKeyboard = [
    [
      { text: '🔄 Scan Again', callback_data: 'cmd:scan' },
      { text: '🌐 InfoHub', url: 'https://info-hub.io/screener' },
    ],
  ];

  // Send price arbs (attach keyboard if this is the last section)
  if (topPrice.length > 0) {
    const header = `<b>Top ${topPrice.length} Price Arbs</b>\n`;
    const body = header + topPrice.map((arb) => formatPriceAlert(arb)).join('\n\n');
    if (topFunding.length === 0) {
      await sendMessageWithKeyboard(chatId, body, scanKeyboard);
    } else {
      await sendMessage(chatId, body);
    }
  }

  // Send funding arbs (always last, always gets keyboard)
  if (topFunding.length > 0) {
    const header = `<b>Top ${topFunding.length} Funding Arbs</b>\n`;
    const body = header + topFunding.map((arb) => formatFundingAlert(arb)).join('\n\n');
    await sendMessageWithKeyboard(chatId, body, scanKeyboard);
  }
}

// ---------------------------------------------------------------------------
// /price — quick price lookup
// ---------------------------------------------------------------------------

async function handlePrice(chatId: number, args: string[], origin: string): Promise<void> {
  if (args.length === 0) {
    await sendMessage(chatId, 'Usage: /price BTC');
    return;
  }

  const symbol = args[0].toUpperCase();

  try {
    const res = await fetch(
      `${origin}/api/tickers?symbols=${encodeURIComponent(symbol)}`,
      { signal: AbortSignal.timeout(25000) },
    );

    if (!res.ok) {
      await sendMessage(chatId, `Failed to fetch price data (HTTP ${res.status}).`);
      return;
    }

    const json = await res.json();
    const entries: Array<{ exchange: string; lastPrice: number; priceChangePercent24h: number; quoteVolume24h: number }> = json.data || [];

    if (entries.length === 0) {
      await sendMessage(chatId, `No price data found for <b>${symbol}</b>.`);
      return;
    }

    // Best source = highest volume
    const best = entries.reduce((a, b) => (b.quoteVolume24h > a.quoteVolume24h ? b : a));
    const totalVolume = entries.reduce((acc, e) => acc + (e.quoteVolume24h || 0), 0);

    const changeEmoji = best.priceChangePercent24h >= 0 ? '🟢' : '🔴';
    const changeStr = (best.priceChangePercent24h >= 0 ? '+' : '') + best.priceChangePercent24h.toFixed(2) + '%';

    const lines = [
      `<b>${symbol} Price</b>`,
      '━━━━━━━━━━━━━━━━',
      `💰 Price: <b>${fmtUsd(best.lastPrice)}</b>`,
      `${changeEmoji} 24h: ${changeStr}`,
      `📊 Volume: ${fmtUsd(totalVolume)}`,
      `🏦 Source: ${best.exchange} (${entries.length} exchanges)`,
    ];

    await sendMessageWithKeyboard(chatId, lines.join('\n'), [
      [
        { text: '📊 Funding', callback_data: `cmd:funding:${symbol}` },
        { text: '📈 OI', callback_data: `cmd:oi:${symbol}` },
      ],
      [
        { text: '🔔 Set Alert', callback_data: `cmd:alert_prompt:${symbol}` },
        { text: '💧 Liqs', callback_data: `cmd:liq:${symbol}` },
      ],
      [{ text: '📉 Price Chart', callback_data: `chart:price:${symbol}` }],
    ]);
  } catch (err) {
    console.error('[telegram] handlePrice error:', err);
    await sendMessage(chatId, 'Error fetching price data. Please try again later.');
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
// /funding — current funding rates for a symbol across exchanges
// ---------------------------------------------------------------------------

async function handleFundingRates(chatId: number, args: string[], origin: string): Promise<void> {
  if (args.length === 0) {
    await sendMessage(chatId, 'Usage: /funding BTC');
    return;
  }

  const symbol = args[0].toUpperCase();

  try {
    const res = await fetch(`${origin}/api/funding`, { signal: AbortSignal.timeout(25000) });
    if (!res.ok) {
      await sendMessage(chatId, `Failed to fetch funding data (HTTP ${res.status}).`);
      return;
    }

    const json = await res.json();
    const all: Array<{ symbol: string; exchange: string; fundingRate: number | null; fundingInterval: string }> = json.data || [];
    const entries = all.filter((e) => e.symbol.toUpperCase() === symbol && e.fundingRate != null);

    if (entries.length === 0) {
      await sendMessage(chatId, `No funding data found for <b>${symbol}</b>.`);
      return;
    }

    // Sort by rate ascending (most negative = best for longs first)
    entries.sort((a, b) => (a.fundingRate ?? 0) - (b.fundingRate ?? 0));

    const maxNameLen = Math.max(...entries.slice(0, 10).map((e) => e.exchange.length));

    const lines = [
      `<b>Funding Rates: ${symbol}</b>`,
      '━━━━━━━━━━━━━━━━',
      `Exchanges: ${entries.length}`,
      '',
      '<code>',
      ...entries.slice(0, 10).map((e) => {
        const name = e.exchange + ' '.repeat(Math.max(1, maxNameLen - e.exchange.length));
        const rate = fmtRate(e.fundingRate!);
        const interval = e.fundingInterval || '8h';
        return `  ${name}  ${rate.padStart(10)}  (${interval})`;
      }),
      '</code>',
    ];

    if (entries.length > 10) {
      lines.push(`\n...and ${entries.length - 10} more exchanges.`);
    }

    await sendMessageWithKeyboard(chatId, lines.join('\n'), [
      [
        { text: '💰 Price', callback_data: `cmd:price:${symbol}` },
        { text: '📈 OI', callback_data: `cmd:oi:${symbol}` },
      ],
      [{ text: '📊 Funding Chart', callback_data: `chart:funding:${symbol}` }],
    ]);
  } catch (err) {
    console.error('[telegram] handleFundingRates error:', err);
    await sendMessage(chatId, 'Error fetching funding data. Please try again later.');
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
    const allData: Array<{ symbol: string; exchange: string; openInterest: number; openInterestValue: number }> = json.data || [];

    // Filter for the requested symbol
    const entries = allData.filter(
      (d) => d.symbol.toUpperCase() === symbol,
    );

    if (entries.length === 0) {
      await sendMessage(chatId, `No OI data found for <b>${symbol}</b>.`);
      return;
    }

    // Sort by OI descending
    entries.sort((a, b) => b.openInterestValue - a.openInterestValue);

    const totalOI = entries.reduce((acc, e) => acc + e.openInterestValue, 0);
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
        const pct = ((e.openInterestValue / totalOI) * 100).toFixed(1);
        return `  ${name}  ${fmtUsd(e.openInterestValue).padStart(12)}  (${pct}%)`;
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
// /top — top gainers & losers
// ---------------------------------------------------------------------------

async function handleTop(chatId: number, origin: string): Promise<void> {
  try {
    const res = await fetch(`${origin}/api/tickers`, { signal: AbortSignal.timeout(25000) });
    if (!res.ok) {
      await sendMessage(chatId, `Failed to fetch ticker data (HTTP ${res.status}).`);
      return;
    }

    const json = await res.json();
    const data: Array<{ symbol: string; exchange: string; lastPrice: number; priceChangePercent24h: number; quoteVolume24h: number }> = json.data || [];

    // Deduplicate: keep highest-volume entry per symbol
    const bySymbol = new Map<string, (typeof data)[0]>();
    for (const entry of data) {
      if (!entry.lastPrice || entry.priceChangePercent24h == null) continue;
      const existing = bySymbol.get(entry.symbol);
      if (!existing || entry.quoteVolume24h > existing.quoteVolume24h) {
        bySymbol.set(entry.symbol, entry);
      }
    }

    const symbols = Array.from(bySymbol.values()).filter((e) => e.quoteVolume24h >= 500_000);

    if (symbols.length === 0) {
      await sendMessage(chatId, 'No sufficient ticker data available.');
      return;
    }

    const sorted = [...symbols].sort((a, b) => b.priceChangePercent24h - a.priceChangePercent24h);
    const half = Math.min(5, Math.floor(sorted.length / 2));
    const gainers = sorted.slice(0, half);
    const losers = sorted.slice(-half).reverse();

    const fmt = (e: (typeof data)[0], i: number) => {
      const change = (e.priceChangePercent24h >= 0 ? '+' : '') + e.priceChangePercent24h.toFixed(2) + '%';
      return `${i + 1}. <b>${e.symbol}</b>  ${change}  ${fmtUsd(e.lastPrice)}`;
    };

    const lines = [
      '<b>🟢 Top 5 Gainers (24h)</b>',
      ...gainers.map((e, i) => fmt(e, i)),
      '',
      '<b>🔴 Top 5 Losers (24h)</b>',
      ...losers.map((e, i) => fmt(e, i)),
    ];

    await sendMessageWithKeyboard(chatId, lines.join('\n'), [
      [{ text: '🔄 Refresh', callback_data: 'cmd:top' }],
    ]);
  } catch (err) {
    console.error('[telegram] handleTop error:', err);
    await sendMessage(chatId, 'Error fetching market data. Please try again later.');
  }
}

// ---------------------------------------------------------------------------
// /alert — custom alert management
// ---------------------------------------------------------------------------

// Map lowercase user input to canonical metric names used by the system
const METRIC_ALIASES: Record<string, string> = {
  price: 'price',
  fundingrate: 'fundingRate',
  openinterest: 'openInterest',
  change24h: 'change24h',
  oi: 'openInterest',
  funding: 'fundingRate',
};
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
      const metricInput = args[2].toLowerCase();
      const operator = args[3].toLowerCase();
      const threshold = parseFloat(args[4]);

      const metric = METRIC_ALIASES[metricInput];
      if (!metric) {
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
// /subscribe & /unsubscribe — daily report opt-in
// ---------------------------------------------------------------------------

async function handleSubscribe(chatId: number, args: string[]): Promise<void> {
  const schedule = (args[0] || 'daily').toLowerCase();
  if (schedule !== 'daily') {
    await sendMessage(chatId, 'Currently only daily reports are available.\nUsage: /subscribe daily');
    return;
  }
  await updateReportSchedule(chatId, schedule);
  await sendMessage(chatId, 'Subscribed to <b>daily market reports</b>.\nYou will receive a summary every day at 8 AM UTC.\n\nUse /unsubscribe daily to stop.');
}

async function handleUnsubscribe(chatId: number, args: string[]): Promise<void> {
  const schedule = (args[0] || 'daily').toLowerCase();
  if (schedule !== 'daily') {
    await sendMessage(chatId, 'Usage: /unsubscribe daily');
    return;
  }
  await updateReportSchedule(chatId, null);
  await sendMessage(chatId, 'Unsubscribed from daily reports.');
}

// ---------------------------------------------------------------------------
// /menu — interactive main menu with categories
// ---------------------------------------------------------------------------

async function handleMenu(chatId: number): Promise<void> {
  await sendMessageWithKeyboard(
    chatId,
    '<b>InfoHub Bot Menu</b>\n\nChoose a category:',
    [
      [
        { text: '📈 Trading', callback_data: 'cmd:menu:trading' },
        { text: '🌍 Markets', callback_data: 'cmd:menu:markets' },
      ],
      [
        { text: '🔔 Alerts', callback_data: 'cmd:menu:alerts' },
        { text: '📋 Reports', callback_data: 'cmd:menu:reports' },
      ],
    ],
  );
}

async function handleMenuCallback(chatId: number, args: string[]): Promise<void> {
  const category = args[0];

  switch (category) {
    case 'trading':
      await sendMessageWithKeyboard(
        chatId,
        '<b>📈 Trading Commands</b>\n\nSelect a command:',
        [
          [
            { text: '💰 Price', callback_data: 'cmd:menu_prompt:price' },
            { text: '📊 Funding', callback_data: 'cmd:menu_prompt:funding' },
            { text: '📐 Basis', callback_data: 'cmd:menu_prompt:basis' },
          ],
          [
            { text: '📈 OI', callback_data: 'cmd:menu_prompt:oi' },
            { text: '💧 Liqs', callback_data: 'cmd:liq' },
          ],
          [{ text: '⬅️ Back', callback_data: 'cmd:menu_back' }],
        ],
      );
      break;

    case 'markets':
      await sendMessageWithKeyboard(
        chatId,
        '<b>🌍 Markets Commands</b>\n\nSelect a command:',
        [
          [
            { text: '🏆 Top Movers', callback_data: 'cmd:top' },
            { text: '📊 RSI', callback_data: 'cmd:menu_prompt:rsi' },
          ],
          [
            { text: '🥇 Dominance', callback_data: 'cmd:dominance' },
            { text: '😱 Fear/Greed', callback_data: 'cmd:feargreed' },
          ],
          [
            { text: '💰 Yields', callback_data: 'cmd:yields' },
            { text: '🐋 Whales', callback_data: 'cmd:whale' },
          ],
          [{ text: '⬅️ Back', callback_data: 'cmd:menu_back' }],
        ],
      );
      break;

    case 'alerts':
      await sendMessageWithKeyboard(
        chatId,
        '<b>🔔 Alerts Commands</b>\n\nSelect a command:',
        [
          [
            { text: '📋 List Alerts', callback_data: 'cmd:alert_list' },
            { text: '🔍 Scan', callback_data: 'cmd:scan' },
          ],
          [
            { text: '❓ Help', callback_data: 'cmd:help' },
          ],
          [{ text: '⬅️ Back', callback_data: 'cmd:menu_back' }],
        ],
      );
      break;

    case 'reports':
      await sendMessageWithKeyboard(
        chatId,
        '<b>📋 Reports</b>\n\nDaily market reports delivered to your chat.',
        [
          [
            { text: '✅ Subscribe Daily', callback_data: 'cmd:subscribe:daily' },
            { text: '❌ Unsubscribe', callback_data: 'cmd:unsubscribe:daily' },
          ],
          [
            { text: '📊 Status', callback_data: 'cmd:status_check' },
          ],
          [{ text: '⬅️ Back', callback_data: 'cmd:menu_back' }],
        ],
      );
      break;

    default:
      await handleMenu(chatId);
  }
}

// ---------------------------------------------------------------------------
// /basis — funding basis (premium/discount) across exchanges
// ---------------------------------------------------------------------------

async function handleBasis(chatId: number, args: string[], origin: string): Promise<void> {
  const symbol = args.length > 0 ? args[0].toUpperCase() : null;

  try {
    const res = await fetch(`${origin}/api/funding`, { signal: AbortSignal.timeout(25000) });
    if (!res.ok) {
      await sendMessage(chatId, `Failed to fetch funding data (HTTP ${res.status}).`);
      return;
    }

    const json = await res.json();
    const all: Array<{ symbol: string; exchange: string; markPrice: number; indexPrice: number; fundingRate: number | null }> = json.data || [];

    // Filter to entries with valid prices for basis calculation
    let entries = all.filter(e => e.markPrice > 0 && e.indexPrice > 0);

    if (symbol) {
      entries = entries.filter(e => e.symbol.toUpperCase() === symbol);
      if (entries.length === 0) {
        await sendMessage(chatId, `No basis data found for <b>${symbol}</b>.`);
        return;
      }

      // Compute basis per exchange
      const withBasis = entries.map(e => ({
        ...e,
        basis: ((e.markPrice - e.indexPrice) / e.indexPrice) * 100,
      })).sort((a, b) => b.basis - a.basis);

      const maxNameLen = Math.max(...withBasis.slice(0, 10).map(e => e.exchange.length));
      const lines = [
        `<b>Basis: ${symbol}</b>`,
        '━━━━━━━━━━━━━━━━',
        `Exchanges: ${withBasis.length}`,
        '',
        '<code>',
        ...withBasis.slice(0, 10).map(e => {
          const name = e.exchange + ' '.repeat(Math.max(1, maxNameLen - e.exchange.length));
          const basisStr = (e.basis >= 0 ? '+' : '') + e.basis.toFixed(4) + '%';
          return `  ${name}  ${basisStr.padStart(10)}`;
        }),
        '</code>',
      ];

      await sendMessageWithKeyboard(chatId, lines.join('\n'), [
        [
          { text: '💰 Price', callback_data: `cmd:price:${symbol}` },
          { text: '📊 Funding', callback_data: `cmd:funding:${symbol}` },
        ],
      ]);
    } else {
      // No symbol — show top 5 premium + top 5 discount
      // Deduplicate: keep highest volume or first per symbol
      const bySymbol = new Map<string, typeof entries[0] & { basis: number }>();
      for (const e of entries) {
        const basis = ((e.markPrice - e.indexPrice) / e.indexPrice) * 100;
        const existing = bySymbol.get(e.symbol);
        if (!existing || Math.abs(basis) > Math.abs(existing.basis)) {
          bySymbol.set(e.symbol, { ...e, basis });
        }
      }
      const sorted = Array.from(bySymbol.values()).sort((a, b) => b.basis - a.basis);
      const premium = sorted.slice(0, 5);
      const discount = sorted.filter(e => e.basis < 0).sort((a, b) => a.basis - b.basis).slice(0, 5);

      const fmt = (e: { symbol: string; exchange: string; basis: number }) => {
        const basisStr = (e.basis >= 0 ? '+' : '') + e.basis.toFixed(4) + '%';
        return `  <b>${e.symbol}</b>  ${basisStr}  (${e.exchange})`;
      };

      const lines = [
        '<b>Funding Basis Overview</b>',
        '━━━━━━━━━━━━━━━━',
        '',
        '<b>Top Premium:</b>',
        ...premium.map(fmt),
        '',
        '<b>Top Discount:</b>',
        ...discount.map(fmt),
      ];

      await sendMessageWithKeyboard(chatId, lines.join('\n'), [
        [{ text: '🔄 Refresh', callback_data: 'cmd:basis' }],
      ]);
    }
  } catch (err) {
    console.error('[telegram] handleBasis error:', err);
    await sendMessage(chatId, 'Error fetching basis data. Please try again later.');
  }
}

// ---------------------------------------------------------------------------
// /rsi — RSI-14 across timeframes
// ---------------------------------------------------------------------------

async function handleRsi(chatId: number, args: string[], origin: string): Promise<void> {
  if (args.length === 0) {
    await sendMessage(chatId, 'Usage: /rsi BTC');
    return;
  }

  const symbol = args[0].toUpperCase();

  try {
    const res = await fetch(`${origin}/api/rsi`, { signal: AbortSignal.timeout(25000) });
    if (!res.ok) {
      await sendMessage(chatId, `Failed to fetch RSI data (HTTP ${res.status}).`);
      return;
    }

    const json = await res.json();
    const all: Array<{ symbol: string; rsi1h: number | null; rsi4h: number | null; rsi1d: number | null; price: number | null; change24h: number | null }> = json.data || [];
    const entry = all.find(e => e.symbol.toUpperCase() === symbol);

    if (!entry) {
      await sendMessage(chatId, `No RSI data found for <b>${symbol}</b>. Available for top 50 symbols only.`);
      return;
    }

    const rsiLabel = (v: number | null) => {
      if (v === null) return '  N/A';
      const emoji = v < 30 ? '🟢' : v > 70 ? '🔴' : '⚪';
      const tag = v < 30 ? ' (oversold)' : v > 70 ? ' (overbought)' : '';
      return `${emoji} ${v.toFixed(1)}${tag}`;
    };

    const changeStr = entry.change24h != null
      ? (entry.change24h >= 0 ? '+' : '') + entry.change24h.toFixed(2) + '%'
      : 'N/A';

    const lines = [
      `<b>RSI-14: ${symbol}</b>`,
      '━━━━━━━━━━━━━━━━',
      entry.price ? `💰 Price: ${fmtUsd(entry.price)} (${changeStr})` : '',
      '',
      `1h:  ${rsiLabel(entry.rsi1h)}`,
      `4h:  ${rsiLabel(entry.rsi4h)}`,
      `1d:  ${rsiLabel(entry.rsi1d)}`,
    ].filter(Boolean);

    await sendMessageWithKeyboard(chatId, lines.join('\n'), [
      [
        { text: '💰 Price', callback_data: `cmd:price:${symbol}` },
        { text: '📊 Funding', callback_data: `cmd:funding:${symbol}` },
      ],
      [{ text: '🔥 RSI Chart', callback_data: `chart:rsi:${symbol}` }],
    ]);
  } catch (err) {
    console.error('[telegram] handleRsi error:', err);
    await sendMessage(chatId, 'Error fetching RSI data. Please try again later.');
  }
}

// ---------------------------------------------------------------------------
// /whale — top Hyperliquid whale positions
// ---------------------------------------------------------------------------

async function handleWhale(chatId: number, origin: string): Promise<void> {
  try {
    const res = await fetch(`${origin}/api/hl-whales`, { signal: AbortSignal.timeout(25000) });
    if (!res.ok) {
      await sendMessage(chatId, `Failed to fetch whale data (HTTP ${res.status}).`);
      return;
    }

    const whales: Array<{
      label: string;
      accountValue: number;
      positionCount: number;
      dayPnl?: number;
      positions: Array<{ coin: string; side: string; positionValue: number; unrealizedPnl: number }>;
    }> = await res.json();

    if (!Array.isArray(whales) || whales.length === 0) {
      await sendMessage(chatId, 'No whale data available right now.');
      return;
    }

    const top5 = whales.slice(0, 5);
    const lines = [
      '<b>Top 5 Hyperliquid Whales</b>',
      '━━━━━━━━━━━━━━━━',
    ];

    top5.forEach((w, i) => {
      const topPos = w.positions?.[0];
      const dayPnlStr = w.dayPnl != null
        ? ` | Day PnL: ${w.dayPnl >= 0 ? '+' : ''}${fmtUsd(w.dayPnl)}`
        : '';
      lines.push(
        `\n${i + 1}. <b>${w.label}</b>`,
        `   AV: ${fmtUsd(w.accountValue)} | ${w.positionCount} pos${dayPnlStr}`,
      );
      if (topPos) {
        const pnlStr = topPos.unrealizedPnl >= 0 ? `+${fmtUsd(topPos.unrealizedPnl)}` : fmtUsd(topPos.unrealizedPnl);
        lines.push(`   Top: ${topPos.coin} ${topPos.side.toUpperCase()} ${fmtUsd(topPos.positionValue)} (${pnlStr})`);
      }
    });

    await sendMessageWithKeyboard(chatId, lines.join('\n'), [
      [{ text: '🔄 Refresh', callback_data: 'cmd:whale' }],
    ]);
  } catch (err) {
    console.error('[telegram] handleWhale error:', err);
    await sendMessage(chatId, 'Error fetching whale data. Please try again later.');
  }
}

// ---------------------------------------------------------------------------
// /dominance — BTC/ETH/SOL market dominance
// ---------------------------------------------------------------------------

async function handleDominance(chatId: number, origin: string): Promise<void> {
  try {
    const res = await fetch(`${origin}/api/dominance`, { signal: AbortSignal.timeout(25000) });
    if (!res.ok) {
      await sendMessage(chatId, `Failed to fetch dominance data (HTTP ${res.status}).`);
      return;
    }

    const d: {
      btcDominance: number | null;
      ethDominance: number | null;
      totalMarketCap: number | null;
      totalVolume24h: number | null;
      marketCapChange24h: number | null;
      dominanceBreakdown: Record<string, number>;
    } = await res.json();

    const solDom = d.dominanceBreakdown?.sol;
    const changeStr = d.marketCapChange24h != null
      ? (d.marketCapChange24h >= 0 ? '+' : '') + d.marketCapChange24h.toFixed(2) + '%'
      : 'N/A';

    const lines = [
      '<b>Market Dominance</b>',
      '━━━━━━━━━━━━━━━━',
      `🟠 BTC: <b>${d.btcDominance?.toFixed(1) ?? 'N/A'}%</b>`,
      `🔷 ETH: <b>${d.ethDominance?.toFixed(1) ?? 'N/A'}%</b>`,
      solDom != null ? `🟣 SOL: <b>${solDom.toFixed(1)}%</b>` : '',
      '',
      `📊 Total Market Cap: ${d.totalMarketCap ? fmtUsd(d.totalMarketCap) : 'N/A'}`,
      `📈 24h Change: ${changeStr}`,
      `📊 24h Volume: ${d.totalVolume24h ? fmtUsd(d.totalVolume24h) : 'N/A'}`,
    ].filter(Boolean);

    await sendMessageWithKeyboard(chatId, lines.join('\n'), [
      [{ text: '🔄 Refresh', callback_data: 'cmd:dominance' }],
    ]);
  } catch (err) {
    console.error('[telegram] handleDominance error:', err);
    await sendMessage(chatId, 'Error fetching dominance data. Please try again later.');
  }
}

// ---------------------------------------------------------------------------
// /feargreed — Fear & Greed Index
// ---------------------------------------------------------------------------

async function handleFearGreed(chatId: number, origin: string): Promise<void> {
  try {
    const res = await fetch(`${origin}/api/fear-greed?history=true&limit=7`, { signal: AbortSignal.timeout(25000) });
    if (!res.ok) {
      await sendMessage(chatId, `Failed to fetch Fear & Greed data (HTTP ${res.status}).`);
      return;
    }

    const json: {
      current: { value: number; classification: string; timestamp: number };
      history: Array<{ value: number; classification: string; timestamp: number }>;
    } = await res.json();

    const c = json.current;
    const emoji = c.value <= 25 ? '😱' : c.value <= 45 ? '😰' : c.value <= 55 ? '😐' : c.value <= 75 ? '😊' : '🤑';

    // 7-day trend line using block chars
    const hist = json.history.slice(0, 7).reverse();
    const trendLine = hist.map(h => {
      if (h.value >= 70) return '▇';
      if (h.value >= 50) return '▅';
      if (h.value >= 30) return '▃';
      return '▁';
    }).join('');

    const lines = [
      '<b>Fear & Greed Index</b>',
      '━━━━━━━━━━━━━━━━',
      `${emoji} <b>${c.value}</b> — ${c.classification}`,
      '',
      `7-day trend: <code>${trendLine}</code>`,
      '',
    ];

    if (hist.length > 0) {
      lines.push('<b>Last 7 days:</b>');
      hist.forEach(h => {
        const date = new Date(h.timestamp).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        lines.push(`  ${date}: ${h.value} (${h.classification})`);
      });
    }

    await sendMessageWithKeyboard(chatId, lines.join('\n'), [
      [{ text: '🔄 Refresh', callback_data: 'cmd:feargreed' }],
    ]);
  } catch (err) {
    console.error('[telegram] handleFearGreed error:', err);
    await sendMessage(chatId, 'Error fetching Fear & Greed data. Please try again later.');
  }
}

// ---------------------------------------------------------------------------
// /yields — top DeFi yields by APY
// ---------------------------------------------------------------------------

async function handleYields(chatId: number, origin: string): Promise<void> {
  try {
    const res = await fetch(`${origin}/api/yields?limit=10`, { signal: AbortSignal.timeout(25000) });
    if (!res.ok) {
      await sendMessage(chatId, `Failed to fetch yield data (HTTP ${res.status}).`);
      return;
    }

    const json: {
      data: Array<{ project: string; symbol: string; chain: string; apy: number; tvl: number; stablecoin: boolean }>;
      count: number;
    } = await res.json();

    const pools = json.data || [];
    if (pools.length === 0) {
      await sendMessage(chatId, 'No yield data available right now.');
      return;
    }

    const top5 = pools.slice(0, 5);

    const lines = [
      '<b>Top DeFi Yields</b>',
      '━━━━━━━━━━━━━━━━',
      '',
    ];

    top5.forEach((p, i) => {
      const stable = p.stablecoin ? ' 🛡️' : '';
      lines.push(
        `${i + 1}. <b>${p.symbol}</b>${stable}`,
        `   ${p.project} (${p.chain})`,
        `   APY: <b>${p.apy.toFixed(2)}%</b> | TVL: ${fmtUsd(p.tvl)}`,
        '',
      );
    });

    await sendMessageWithKeyboard(chatId, lines.join('\n'), [
      [{ text: '🔄 Refresh', callback_data: 'cmd:yields' }],
    ]);
  } catch (err) {
    console.error('[telegram] handleYields error:', err);
    await sendMessage(chatId, 'Error fetching yield data. Please try again later.');
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
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return sign + '$' + (abs / 1_000_000_000).toFixed(2) + 'B';
  if (abs >= 1_000_000) return sign + '$' + (abs / 1_000_000).toFixed(2) + 'M';
  if (abs >= 1_000) return sign + '$' + (abs / 1_000).toFixed(1) + 'K';
  return sign + '$' + abs.toFixed(2);
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

    // 2a. Handle callback queries (inline keyboard button presses)
    const callbackQuery = body?.callback_query;
    if (callbackQuery?.data && callbackQuery?.message?.chat?.id) {
      const cbChatId: number = callbackQuery.message.chat.id;
      const cbData: string = callbackQuery.data;

      await answerCallbackQuery(callbackQuery.id);

      if (isDBConfigured()) {
        await initDB();
      } else {
        return NextResponse.json({ ok: true });
      }

      const cbParts = cbData.split(':');
      const cbPrefix = cbParts[0]; // 'cmd', 'chart', 'menu', etc.
      const cbCmd = cbParts[1];
      const cbArgs = cbParts.slice(2);
      const cbOrigin = request.nextUrl.origin;

      // Handle chart image callbacks
      if (cbPrefix === 'chart' && cbCmd && cbArgs[0]) {
        try {
          const chartRes = await fetch(
            `${cbOrigin}/api/charts/telegram?type=${cbCmd}&symbol=${encodeURIComponent(cbArgs[0])}`,
            { signal: AbortSignal.timeout(20000) },
          );
          if (chartRes.ok) {
            const buf = Buffer.from(await chartRes.arrayBuffer());
            await sendPhoto(cbChatId, buf, `${cbArgs[0]} ${cbCmd} chart`);
          } else {
            await sendMessage(cbChatId, 'Chart generation failed. Try again later.');
          }
        } catch (err) {
          console.error('[telegram] chart callback error:', err);
          await sendMessage(cbChatId, 'Chart generation timed out. Try again later.');
        }
        return NextResponse.json({ ok: true });
      }

      switch (cbCmd) {
        case 'price':
          await handlePrice(cbChatId, cbArgs, cbOrigin);
          break;
        case 'funding':
          await handleFundingRates(cbChatId, cbArgs, cbOrigin);
          break;
        case 'oi':
          await handleOI(cbChatId, cbArgs, cbOrigin);
          break;
        case 'liq':
          await handleLiq(cbChatId, cbArgs, cbOrigin);
          break;
        case 'scan':
          await handleScan(cbChatId, cbOrigin);
          break;
        case 'top':
          await handleTop(cbChatId, cbOrigin);
          break;
        case 'alert_prompt':
          if (cbArgs[0]) {
            await sendMessage(cbChatId,
              `To create an alert for <b>${cbArgs[0]}</b>:\n` +
              `/alert add ${cbArgs[0]} price gt &lt;value&gt;\n` +
              `/alert add ${cbArgs[0]} funding gt &lt;value&gt;`,
            );
          }
          break;
        case 'basis':
          await handleBasis(cbChatId, cbArgs, cbOrigin);
          break;
        case 'rsi':
          await handleRsi(cbChatId, cbArgs, cbOrigin);
          break;
        case 'whale':
          await handleWhale(cbChatId, cbOrigin);
          break;
        case 'dominance':
          await handleDominance(cbChatId, cbOrigin);
          break;
        case 'feargreed':
          await handleFearGreed(cbChatId, cbOrigin);
          break;
        case 'yields':
          await handleYields(cbChatId, cbOrigin);
          break;
        case 'menu':
          await handleMenuCallback(cbChatId, cbArgs);
          break;
        case 'menu_back':
          await handleMenu(cbChatId);
          break;
        case 'menu_prompt':
          // Prompt user to enter a symbol for the given command
          if (cbArgs[0]) {
            await sendMessage(cbChatId, `Type: /${cbArgs[0]} &lt;symbol&gt;\n\nExample: /${cbArgs[0]} BTC`);
          }
          break;
        case 'alert_list':
          await handleAlert(cbChatId, ['list']);
          break;
        case 'help':
          await handleStart(cbChatId);
          break;
        case 'status_check':
          await handleStatus(cbChatId);
          break;
        case 'subscribe':
          await handleSubscribe(cbChatId, cbArgs);
          break;
        case 'unsubscribe':
          await handleUnsubscribe(cbChatId, cbArgs);
          break;
        default:
          break;
      }

      return NextResponse.json({ ok: true });
    }

    const message = body?.message;

    // No text message — acknowledge silently
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

      case '/price':
        await handlePrice(chatId, args, request.nextUrl.origin);
        break;

      case '/funding':
        await handleFundingRates(chatId, args, request.nextUrl.origin);
        break;

      case '/top':
        await handleTop(chatId, request.nextUrl.origin);
        break;

      case '/help':
        await handleStart(chatId);
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

      case '/basis':
        await handleBasis(chatId, args, request.nextUrl.origin);
        break;

      case '/rsi':
        await handleRsi(chatId, args, request.nextUrl.origin);
        break;

      case '/whale':
        await handleWhale(chatId, request.nextUrl.origin);
        break;

      case '/dominance':
        await handleDominance(chatId, request.nextUrl.origin);
        break;

      case '/feargreed':
        await handleFearGreed(chatId, request.nextUrl.origin);
        break;

      case '/yields':
        await handleYields(chatId, request.nextUrl.origin);
        break;

      case '/menu':
        await handleMenu(chatId);
        break;

      case '/subscribe':
        await handleSubscribe(chatId, args);
        break;

      case '/unsubscribe':
        await handleUnsubscribe(chatId, args);
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
