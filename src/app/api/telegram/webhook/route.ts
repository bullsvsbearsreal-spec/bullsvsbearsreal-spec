/**
 * Telegram Webhook — @InfoHubRadarBot (notifications-only)
 *
 * Reverted from the Hub v2 AI-chat experiment back to a slim, alert-focused
 * bot. AI chat now lives at info-hub.io/chat instead — the Telegram bot
 * exists to deliver pushes (whale-watch, funding alerts, daily summary)
 * and to let users link their account so we know where to send those.
 *
 * Commands:
 *   /start CODE   Link your InfoHub account
 *   /start        Resume notifications (if already linked)
 *   /stop         Pause notifications
 *   /status       Show link status + mute info
 *   /mute 1h      Mute notifications (1h, 2h, 4h, 8h, 12h, 24h)
 *   /unmute       Resume notifications early
 *   /help         Show commands
 *   <any text>    Polite redirect — chat lives on the website
 *
 * Security: verifies x-telegram-bot-api-secret-token header.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  sendMessage,
  answerCallbackQuery,
  type InlineKeyboardMarkup,
} from '@/lib/telegram';
import { ALL_EXCHANGES } from '@/lib/constants/exchanges';
import {
  initDB, isDBConfigured,
  consumeTelegramLinkCode, linkTelegramChat, unlinkTelegramChat,
  reactivateTelegramChat, muteTelegramChat, unmuteTelegramChat, getTelegramLink,
  pruneExpiredLinkCodes,
} from '@/lib/db';
import { timingSafeEqual, createHash } from 'crypto';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

const WEBHOOK_SECRET = (process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();

function safeCompare(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

const MUTE_DURATIONS: Record<string, number> = {
  '1h': 1, '2h': 2, '4h': 4, '8h': 8, '12h': 12, '24h': 24,
};

// Cheap per-chat throttle so a user mashing buttons can't flood the bot.
const chatLastRequest = new Map<number, number>();
const RATE_LIMIT_MS = 2_000;

// ─── Webhook entrypoint ────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }
  const header = request.headers.get('x-telegram-bot-api-secret-token') || '';
  if (!safeCompare(header, WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isDBConfigured()) {
    return NextResponse.json({ ok: true });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  // Inline keyboard taps — we don't use them in the slim bot, but
  // acknowledge so Telegram's spinner clears.
  const callbackQuery = body?.callback_query;
  if (callbackQuery) {
    await answerCallbackQuery(callbackQuery.id);
    return NextResponse.json({ ok: true });
  }

  const message = body?.message;
  if (!message?.chat?.id) return NextResponse.json({ ok: true });

  const chatId = message.chat.id;

  // Reject group messages — this is a 1:1 alerts bot
  if (message.chat.type !== 'private') return NextResponse.json({ ok: true });

  if (message.photo || message.document || message.video || message.sticker || message.animation) {
    await sendMessage(chatId, "I'm a notifications bot — text only. Type /help for commands.");
    return NextResponse.json({ ok: true });
  }
  if (!message.text) return NextResponse.json({ ok: true });

  // Throttle
  const now = Date.now();
  const last = chatLastRequest.get(chatId) ?? 0;
  if (now - last < RATE_LIMIT_MS) return NextResponse.json({ ok: true });
  chatLastRequest.set(chatId, now);
  // Trim the map periodically
  if (chatLastRequest.size > 1000) {
    const cutoff = now - 60_000;
    Array.from(chatLastRequest.entries()).forEach(([id, ts]) => {
      if (ts < cutoff) chatLastRequest.delete(id);
    });
  }

  const text = message.text.trim();

  await initDB();
  // Prune expired link codes ~10% of the time
  if (Math.random() < 0.1) {
    pruneExpiredLinkCodes().catch((e) => console.warn('[telegram] prune codes:', e));
  }

  // ─── Commands ──────────────────────────────────────────────────────

  // /start [CODE] — link an account or resume notifications
  if (text.startsWith('/start')) {
    const code = text.split(/\s+/)[1]?.toUpperCase();

    if (code) {
      const userId = await consumeTelegramLinkCode(code);
      if (!userId) {
        await sendMessage(chatId,
          '❌ Invalid or expired code.\n\nGet a fresh code from <b>info-hub.io/settings</b> → Telegram section.',
        );
        return NextResponse.json({ ok: true });
      }
      await linkTelegramChat(chatId, userId);
      await sendMessage(chatId,
        '✅ <b>Account linked!</b>\n\n' +
        "You'll get pings here for:\n" +
        '• Funding, OI & price alerts you set up\n' +
        '• Whale trades from wallets you watch\n' +
        '• Daily market summary\n\n' +
        'Manage: /status · /mute 1h · /stop\n' +
        'AI chat lives at <a href="https://info-hub.io/chat">info-hub.io/chat</a>.',
      );
      return NextResponse.json({ ok: true });
    }

    const existing = await getTelegramLink(chatId);
    if (existing) {
      if (!existing.active) {
        await reactivateTelegramChat(chatId);
        await sendMessage(chatId, "✅ Notifications resumed! You're back online.");
      } else {
        await sendMessage(chatId,
          "👋 You're already linked.\n\nUse /status to check, /stop to pause.",
        );
      }
    } else {
      await sendMessage(chatId,
        '👋 <b>InfoHub Radar Bot</b>\n\n' +
        `I deliver your alerts from ${ALL_EXCHANGES.length} exchanges — funding, OI, whale trades, daily summary. ` +
        "I'm notifications-only; for AI chat use <a href=\"https://info-hub.io/chat\">info-hub.io/chat</a>.\n\n" +
        '<b>To link:</b>\n' +
        '1. Log in at info-hub.io\n' +
        '2. Settings → Telegram → Generate Code\n' +
        '3. Send <code>/start CODE</code> back here',
      );
    }
    return NextResponse.json({ ok: true });
  }

  // /stop
  if (text === '/stop') {
    const link = await getTelegramLink(chatId);
    if (!link) {
      await sendMessage(chatId, "You're not linked yet. Use /start to get started.");
      return NextResponse.json({ ok: true });
    }
    await unlinkTelegramChat(chatId);
    await sendMessage(chatId, '⏸ Notifications paused.\n\nSend /start to resume.');
    return NextResponse.json({ ok: true });
  }

  // /status
  if (text === '/status') {
    const link = await getTelegramLink(chatId);
    if (!link) {
      await sendMessage(chatId, '❌ Not linked. Use /start to connect your InfoHub account.');
      return NextResponse.json({ ok: true });
    }
    const nowD = new Date();
    const isMuted = link.muted_until && link.muted_until > nowD;
    const lines = [
      '📡 <b>Radar Status</b>',
      '',
      `Active: ${link.active ? '✅ Yes' : '⏸ Paused'}`,
    ];
    if (isMuted) {
      const mins = Math.ceil((link.muted_until!.getTime() - nowD.getTime()) / 60_000);
      const hrs = Math.floor(mins / 60);
      const rem = mins % 60;
      lines.push(`Muted: until ${hrs > 0 ? `${hrs}h ` : ''}${rem}m from now`);
    }
    lines.push('', 'Commands: /mute 1h · /unmute · /stop');
    await sendMessage(chatId, lines.join('\n'));
    return NextResponse.json({ ok: true });
  }

  // /mute DURATION
  if (text.startsWith('/mute')) {
    const link = await getTelegramLink(chatId);
    if (!link) {
      await sendMessage(chatId, 'Not linked yet. Use /start first.');
      return NextResponse.json({ ok: true });
    }
    const arg = text.split(/\s+/)[1]?.toLowerCase();
    const hours = arg ? MUTE_DURATIONS[arg] : undefined;
    if (!hours) {
      await sendMessage(chatId, 'Usage: <code>/mute 1h</code>\n\nOptions: 1h, 2h, 4h, 8h, 12h, 24h');
      return NextResponse.json({ ok: true });
    }
    const until = new Date(Date.now() + hours * 3600_000);
    await muteTelegramChat(chatId, until);
    await sendMessage(chatId, `🔇 Muted for ${hours}h. Send /unmute to resume early.`);
    return NextResponse.json({ ok: true });
  }

  // /unmute
  if (text === '/unmute') {
    const link = await getTelegramLink(chatId);
    if (!link) {
      await sendMessage(chatId, 'Not linked yet. Use /start first.');
      return NextResponse.json({ ok: true });
    }
    if (!link.active) {
      await sendMessage(chatId, '⏸ Your notifications are paused. Send /start to resume first.');
      return NextResponse.json({ ok: true });
    }
    await unmuteTelegramChat(chatId);
    await sendMessage(chatId, '🔔 Unmuted! Notifications back on.');
    return NextResponse.json({ ok: true });
  }

  // /help
  if (text === '/help') {
    await sendMessage(chatId,
      '📡 <b>InfoHub Radar Bot — alerts only</b>\n\n' +
      '/start — Link account / resume\n' +
      '/stop — Pause notifications\n' +
      '/status — Check status\n' +
      '/mute 1h — Mute (1h/2h/4h/8h/12h/24h)\n' +
      '/unmute — Resume early\n' +
      '/help — This message\n\n' +
      '💬 For AI chat: <a href="https://info-hub.io/chat">info-hub.io/chat</a>',
    );
    return NextResponse.json({ ok: true });
  }

  // Unknown / chat — polite redirect (this is the AI-chat sunset)
  if (text.startsWith('/')) {
    await sendMessage(chatId, 'Unknown command. Send /help for options.');
  } else {
    await sendMessage(chatId,
      "I'm a notifications-only bot. For AI chat use <a href=\"https://info-hub.io/chat\">info-hub.io/chat</a>.\n\n" +
      'Type /help to see what I can do.',
    );
  }
  return NextResponse.json({ ok: true });
}
