/**
 * Telegram Webhook — InfoHub Radar Bot
 *
 * Commands:
 *   /start CODE    Link your InfoHub account
 *   /stop          Pause notifications
 *   /start         Resume notifications (if already linked)
 *   /status        Show link status & mute info
 *   /mute 1h       Mute notifications (1h, 2h, 4h, 8h, 12h, 24h)
 *   /unmute         Resume notifications early
 *
 * Security: Verifies x-telegram-bot-api-secret-token header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendMessage } from '@/lib/telegram';
import {
  initDB, isDBConfigured,
  consumeTelegramLinkCode, linkTelegramChat, unlinkTelegramChat,
  reactivateTelegramChat, muteTelegramChat, unmuteTelegramChat, getTelegramLink,
  pruneExpiredLinkCodes,
} from '@/lib/db';
import { timingSafeEqual } from 'crypto';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

const WEBHOOK_SECRET = (process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

const MUTE_DURATIONS: Record<string, number> = {
  '1h': 1, '2h': 2, '4h': 4, '8h': 8, '12h': 12, '24h': 24,
};

export async function POST(request: NextRequest) {
  // Verify webhook secret — fail closed if not configured
  if (!WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }
  const header = request.headers.get('x-telegram-bot-api-secret-token') || '';
  if (!safeCompare(header, WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isDBConfigured()) {
    return NextResponse.json({ ok: true }); // silently skip
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const message = body?.message;
  if (!message?.text || !message?.chat?.id) {
    return NextResponse.json({ ok: true });
  }

  const chatId = message.chat.id;
  const text = message.text.trim();

  await initDB();

  // Prune expired codes ~10% of the time
  if (Math.random() < 0.1) {
    pruneExpiredLinkCodes().catch(() => {});
  }

  // ─── /start CODE — Link account ───────────────────────────────────────────
  if (text.startsWith('/start')) {
    const code = text.split(/\s+/)[1]?.toUpperCase();

    if (code) {
      // Verify the link code
      const userId = await consumeTelegramLinkCode(code);
      if (!userId) {
        await sendMessage(chatId,
          '❌ Invalid or expired code.\n\n' +
          'Get a fresh code from <b>info-hub.io/settings</b> → Telegram section.',
        );
        return NextResponse.json({ ok: true });
      }

      await linkTelegramChat(chatId, userId);
      await sendMessage(chatId,
        '✅ <b>Account linked!</b>\n\n' +
        'You\'ll now receive notifications here for:\n' +
        '• Price, funding & OI alerts\n' +
        '• Whale trade alerts\n' +
        '• Daily market summary\n\n' +
        'Commands:\n' +
        '/status — Check your link status\n' +
        '/mute 1h — Mute for 1/2/4/8/12/24h\n' +
        '/unmute — Resume early\n' +
        '/stop — Pause all notifications',
      );
      return NextResponse.json({ ok: true });
    }

    // /start with no code — check if already linked
    const existing = await getTelegramLink(chatId);
    if (existing) {
      if (!existing.active) {
        await reactivateTelegramChat(chatId);
        await sendMessage(chatId, '✅ Notifications resumed! You\'re back online.');
      } else {
        await sendMessage(chatId,
          '👋 You\'re already linked!\n\n' +
          'Use /status to check your settings or /stop to pause.',
        );
      }
    } else {
      await sendMessage(chatId,
        '👋 <b>Welcome to InfoHub Radar!</b>\n\n' +
        'To get started:\n' +
        '1. Log in at <b>info-hub.io</b>\n' +
        '2. Go to <b>Settings</b> → Telegram\n' +
        '3. Click <b>Generate Code</b>\n' +
        '4. Send <code>/start CODE</code> here\n\n' +
        'Your alerts, whale trades & daily summaries will appear here.',
      );
    }
    return NextResponse.json({ ok: true });
  }

  // ─── /stop — Pause notifications ──────────────────────────────────────────
  if (text === '/stop') {
    const link = await getTelegramLink(chatId);
    if (!link) {
      await sendMessage(chatId, 'You\'re not linked yet. Use /start to get started.');
      return NextResponse.json({ ok: true });
    }
    await unlinkTelegramChat(chatId);
    await sendMessage(chatId,
      '⏸ Notifications paused.\n\n' +
      'Send /start to resume anytime. Your account link is preserved.',
    );
    return NextResponse.json({ ok: true });
  }

  // ─── /status — Show link status ───────────────────────────────────────────
  if (text === '/status') {
    const link = await getTelegramLink(chatId);
    if (!link) {
      await sendMessage(chatId, '❌ Not linked. Use /start to connect your InfoHub account.');
      return NextResponse.json({ ok: true });
    }

    const now = new Date();
    const isMuted = link.muted_until && link.muted_until > now;
    const lines = [
      '📡 <b>InfoHub Radar Status</b>',
      '',
      `Active: ${link.active ? '✅ Yes' : '⏸ Paused'}`,
    ];

    if (isMuted) {
      const mins = Math.ceil((link.muted_until!.getTime() - now.getTime()) / 60000);
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      lines.push(`Muted: until ${hrs > 0 ? `${hrs}h ` : ''}${remMins}m from now`);
    }

    lines.push('', 'Commands: /mute 1h · /unmute · /stop');
    await sendMessage(chatId, lines.join('\n'));
    return NextResponse.json({ ok: true });
  }

  // ─── /mute DURATION — Temporarily mute ────────────────────────────────────
  if (text.startsWith('/mute')) {
    const link = await getTelegramLink(chatId);
    if (!link) {
      await sendMessage(chatId, 'Not linked yet. Use /start first.');
      return NextResponse.json({ ok: true });
    }

    const arg = text.split(/\s+/)[1]?.toLowerCase();
    const hours = arg ? MUTE_DURATIONS[arg] : undefined;
    if (!hours) {
      await sendMessage(chatId,
        'Usage: <code>/mute 1h</code>\n\nOptions: 1h, 2h, 4h, 8h, 12h, 24h',
      );
      return NextResponse.json({ ok: true });
    }

    const until = new Date(Date.now() + hours * 3600_000);
    await muteTelegramChat(chatId, until);
    await sendMessage(chatId, `🔇 Muted for ${hours}h. Send /unmute to resume early.`);
    return NextResponse.json({ ok: true });
  }

  // ─── /unmute — Resume early (only clears mute, does NOT reactivate stopped chats) ──
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
    await sendMessage(chatId, '🔔 Unmuted! Notifications are back on.');
    return NextResponse.json({ ok: true });
  }

  // ─── /help or unknown ─────────────────────────────────────────────────────
  if (text === '/help' || text.startsWith('/')) {
    await sendMessage(chatId,
      '📡 <b>InfoHub Radar</b>\n\n' +
      '/start — Link account or resume\n' +
      '/stop — Pause notifications\n' +
      '/status — Check status\n' +
      '/mute 1h — Mute (1h/2h/4h/8h/12h/24h)\n' +
      '/unmute — Resume early\n' +
      '/help — Show this message',
    );
  }

  return NextResponse.json({ ok: true });
}
