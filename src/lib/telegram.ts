// Telegram Bot API helper — zero dependencies, native fetch only

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PriceArbitrage {
  symbol: string;
  lowExchange: string;
  lowPrice: number;
  highExchange: string;
  highPrice: number;
  spreadPct: number;
  spreadUsd: number;
  netPct: number;
}

export interface FundingArbitrage {
  symbol: string;
  lowExchange: string;
  lowRate: number;
  highExchange: string;
  highRate: number;
  spread8h: number;
}

// ---------------------------------------------------------------------------
// Core API helpers
// ---------------------------------------------------------------------------

/**
 * Send a text message via Telegram Bot API.
 * Logs errors to the console but never throws.
 */
export async function sendMessage(
  chatId: string | number,
  text: string,
  parseMode: 'HTML' | 'Markdown' | 'MarkdownV2' = 'HTML',
): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[telegram] sendMessage failed (${res.status}): ${body}`);
    }
  } catch (err) {
    console.error('[telegram] sendMessage error:', err);
  }
}

/**
 * Register a webhook URL with the Telegram Bot API.
 * Returns the parsed JSON response from Telegram.
 */
export async function setWebhook(
  url: string,
  secret?: string,
): Promise<Record<string, unknown>> {
  const payload: Record<string, unknown> = { url };
  if (secret) {
    payload.secret_token = secret;
  }

  const res = await fetch(`${API_BASE}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return res.json() as Promise<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Photo helper (for chart images)
// ---------------------------------------------------------------------------

/**
 * Send a photo via Telegram Bot API using multipart/form-data.
 * Accepts a Buffer (PNG) and optional caption.
 */
export async function sendPhoto(
  chatId: string | number,
  imageBuffer: Buffer,
  caption?: string,
  parseMode: 'HTML' | 'Markdown' | 'MarkdownV2' = 'HTML',
): Promise<void> {
  try {
    const formData = new FormData();
    formData.append('chat_id', String(chatId));
    formData.append('photo', new Blob([new Uint8Array(imageBuffer)], { type: 'image/png' }), 'chart.png');
    if (caption) {
      formData.append('caption', caption);
      formData.append('parse_mode', parseMode);
    }

    const res = await fetch(`${API_BASE}/sendPhoto`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[telegram] sendPhoto failed (${res.status}): ${body}`);
    }
  } catch (err) {
    console.error('[telegram] sendPhoto error:', err);
  }
}

// ---------------------------------------------------------------------------
// Inline keyboard helpers
// ---------------------------------------------------------------------------

export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

/**
 * Send a text message with an inline keyboard via Telegram Bot API.
 */
export async function sendMessageWithKeyboard(
  chatId: string | number,
  text: string,
  keyboard: InlineKeyboardButton[][],
  parseMode: 'HTML' | 'Markdown' | 'MarkdownV2' = 'HTML',
): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: keyboard },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[telegram] sendMessageWithKeyboard failed (${res.status}): ${body}`);
    }
  } catch (err) {
    console.error('[telegram] sendMessageWithKeyboard error:', err);
  }
}

/**
 * Acknowledge a callback query (inline button press).
 * Required by Telegram API to dismiss the loading indicator on the button.
 */
export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
): Promise<void> {
  try {
    await fetch(`${API_BASE}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text || '',
      }),
    });
  } catch (err) {
    console.error('[telegram] answerCallbackQuery error:', err);
  }
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Format a USD price for Telegram messages (dynamic fraction digits). */
function fmtPrice(n: number): string {
  return '$' + n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

/** Format a funding rate with explicit sign and 4 decimal places. */
function fmtRate(r: number): string {
  return (r >= 0 ? '+' : '') + r.toFixed(4) + '%';
}

/** Pad an exchange name to align columns (Telegram uses monospace inside <code>). */
function padExchange(name: string, width: number): string {
  return name + ':' + ' '.repeat(Math.max(1, width - name.length));
}

/**
 * Format a price arbitrage opportunity as an HTML Telegram message.
 *
 * Example output:
 * ```
 * <b>🔀 PRICE ARB: ETH</b>
 * ━━━━━━━━━━━━━━━━
 * 📉 gTrade:  $1,820.00
 * 📈 MEXC:    $1,824.00
 * 💰 Spread:  $4.00 (0.22%)
 * 📈 Net after fees: 0.12%
 *
 * ⚡ Long gTrade / Short MEXC
 * ```
 */
export function formatPriceAlert(arb: PriceArbitrage): string {
  const colWidth = Math.max(arb.lowExchange.length, arb.highExchange.length, 'Spread'.length);

  const lines = [
    `<b>🔀 PRICE ARB: ${arb.symbol}</b>`,
    '━━━━━━━━━━━━━━━━',
    `📉 ${padExchange(arb.lowExchange, colWidth)} ${fmtPrice(arb.lowPrice)}`,
    `📈 ${padExchange(arb.highExchange, colWidth)} ${fmtPrice(arb.highPrice)}`,
    `💰 ${padExchange('Spread', colWidth)} ${fmtPrice(arb.spreadUsd)} (${arb.spreadPct.toFixed(2)}%)`,
    `📈 Net after fees: ${arb.netPct.toFixed(2)}%`,
    '',
    `⚡ Long ${arb.lowExchange} / Short ${arb.highExchange}`,
  ];

  return lines.join('\n');
}

/**
 * Format a funding rate arbitrage opportunity as an HTML Telegram message.
 *
 * Example output:
 * ```
 * <b>📊 FUNDING ARB: ETH</b>
 * ━━━━━━━━━━━━━━━━
 * 🟢 Hyperliquid: -0.0042%
 * 🔴 Binance:     +0.0185%
 * 💰 8h Spread:   0.0227%
 *
 * ⚡ Long Hyperliquid / Short Binance
 * ```
 */
export function formatFundingAlert(arb: FundingArbitrage): string {
  const colWidth = Math.max(arb.lowExchange.length, arb.highExchange.length, '8h Spread'.length);

  const lines = [
    `<b>📊 FUNDING ARB: ${arb.symbol}</b>`,
    '━━━━━━━━━━━━━━━━',
    `🟢 ${padExchange(arb.lowExchange, colWidth)} ${fmtRate(arb.lowRate)}`,
    `🔴 ${padExchange(arb.highExchange, colWidth)} ${fmtRate(arb.highRate)}`,
    `💰 ${padExchange('8h Spread', colWidth)} ${arb.spread8h.toFixed(4)}%`,
    '',
    `⚡ Long ${arb.lowExchange} / Short ${arb.highExchange}`,
  ];

  return lines.join('\n');
}
