// Telegram Bot API helper — Hub (InfoHub AI Agent)

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface SendMessageResult {
  ok: boolean;
  result?: { message_id: number; chat: { id: number } };
}

// ─── Send Message ────────────────────────────────────────────────────────────

/**
 * Send a text message via Telegram Bot API.
 * Returns the message_id on success (for later editing), or 0 on failure.
 */
export async function sendMessage(
  chatId: string | number,
  text: string,
  parseMode: 'HTML' | 'Markdown' | 'MarkdownV2' = 'HTML',
  replyMarkup?: InlineKeyboardMarkup,
): Promise<boolean> {
  try {
    const payload: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: parseMode,
      disable_web_page_preview: true,
    };
    if (replyMarkup) payload.reply_markup = replyMarkup;

    const res = await fetch(`${API_BASE}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[telegram] sendMessage failed (${res.status}): ${body}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[telegram] sendMessage error:', err);
    return false;
  }
}

/**
 * Send a message and return the message_id (for later editing/replying).
 */
export async function sendMessageWithId(
  chatId: string | number,
  text: string,
  parseMode: 'HTML' | 'Markdown' | 'MarkdownV2' = 'HTML',
  replyMarkup?: InlineKeyboardMarkup,
): Promise<number> {
  try {
    const payload: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: parseMode,
      disable_web_page_preview: true,
    };
    if (replyMarkup) payload.reply_markup = replyMarkup;

    const res = await fetch(`${API_BASE}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return 0;
    const data = (await res.json()) as SendMessageResult;
    return data.result?.message_id ?? 0;
  } catch {
    return 0;
  }
}

// ─── Edit Message ────────────────────────────────────────────────────────────

/**
 * Edit a previously sent message's text.
 */
export async function editMessage(
  chatId: string | number,
  messageId: number,
  text: string,
  parseMode: 'HTML' | 'Markdown' | 'MarkdownV2' = 'HTML',
  replyMarkup?: InlineKeyboardMarkup,
): Promise<boolean> {
  try {
    const payload: Record<string, unknown> = {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: parseMode,
      disable_web_page_preview: true,
    };
    if (replyMarkup) payload.reply_markup = replyMarkup;

    const res = await fetch(`${API_BASE}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Answer Callback Query ───────────────────────────────────────────────────

/**
 * Answer an inline keyboard callback query (dismisses the loading spinner).
 */
export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
  showAlert?: boolean,
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: showAlert,
      }),
      signal: AbortSignal.timeout(5_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Register a webhook URL with the Telegram Bot API.
 */
export async function setWebhook(
  url: string,
  secret?: string,
): Promise<Record<string, unknown>> {
  const payload: Record<string, unknown> = { url };
  if (secret) payload.secret_token = secret;

  const res = await fetch(`${API_BASE}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });

  return res.json() as Promise<Record<string, unknown>>;
}

/**
 * Generate a 6-char alphanumeric link code using crypto-secure randomness.
 */
export function generateLinkCode(): string {
  const { randomBytes } = require('crypto') as typeof import('crypto');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I confusion
  const bytes = randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}
