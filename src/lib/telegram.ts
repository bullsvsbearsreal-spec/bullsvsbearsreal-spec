// Telegram Bot API helper — InfoHub Radar alert bot

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

/**
 * Send a text message via Telegram Bot API.
 * Logs errors but never throws.
 */
export async function sendMessage(
  chatId: string | number,
  text: string,
  parseMode: 'HTML' | 'Markdown' | 'MarkdownV2' = 'HTML',
): Promise<boolean> {
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
