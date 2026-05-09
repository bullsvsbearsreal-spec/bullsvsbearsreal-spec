/**
 * POST /api/watch/test-ping
 *
 * Sends a synthetic "test ping" to the authenticated user's linked
 * Telegram chat. Lets users verify end-to-end delivery (linked chat
 * → InfoHub bot → cron path → Telegram message) without waiting for
 * a real watched-wallet event to fire.
 *
 * Returns:
 *   { ok: true, sent: true }   if the Telegram API accepted the message
 *   { ok: false, error: ... }  with a reason if it failed
 *
 * Reasons it can fail:
 *   - User isn't signed in (401)
 *   - User hasn't linked a Telegram account (400, with a guide link)
 *   - Telegram API rejects the message (500)
 */
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTelegramLinkByUser, isDBConfigured } from '@/lib/db';
import { sendMessage } from '@/lib/telegram';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

/** Sliding-window in-memory rate limiter — 5 test pings per user per
 *  minute. Telegram itself rate-limits at ~30 msg/sec per chat, but
 *  before we hit that the user's own chat would get spammed. Cap each
 *  user at 5/min so a stuck retry loop or a curious finger can't fire
 *  100 messages by accident. */
const TEST_PING_LIMIT = 5;
const TEST_PING_WINDOW_MS = 60_000;
const recentPings = new Map<string, number[]>();

function checkRateLimit(userId: string): { allowed: boolean; resetInSec?: number } {
  const now = Date.now();
  const cutoff = now - TEST_PING_WINDOW_MS;
  const prev = recentPings.get(userId) ?? [];
  const recent = prev.filter(ts => ts > cutoff);
  if (recent.length >= TEST_PING_LIMIT) {
    const oldest = recent[0];
    return { allowed: false, resetInSec: Math.ceil((oldest + TEST_PING_WINDOW_MS - now) / 1000) };
  }
  recent.push(now);
  recentPings.set(userId, recent);
  // Opportunistic GC — keep the map from growing unboundedly across many users
  if (recentPings.size > 1000) {
    Array.from(recentPings.entries()).forEach(([k, v]) => {
      if (v.every(ts => ts <= cutoff)) recentPings.delete(k);
    });
  }
  return { allowed: true };
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  if (!isDBConfigured()) {
    return NextResponse.json({ ok: false, error: 'database not configured' }, { status: 503 });
  }

  const limit = checkRateLimit(session.user.id);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: `Too many test pings — try again in ${limit.resetInSec ?? 60}s.` },
      { status: 429, headers: { 'Retry-After': String(limit.resetInSec ?? 60) } },
    );
  }

  const link = await getTelegramLinkByUser(session.user.id);
  if (!link?.chat_id) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Telegram is not linked to this account. Open /profile?tab=notifications to link.',
        linkUrl: '/profile?tab=notifications',
      },
      { status: 400 },
    );
  }

  // Build a recognisable test message. Markdown-escape literal stars in
  // case the user sees this in a chat with formatting interpreters.
  const text = [
    '🟡 *InfoHub Wallet Watch — test ping*',
    '',
    'If you can read this, alerts will deliver. The real ones look like:',
    '',
    '🟢 LONG opened · _Hyperliquid_',
    '`0xabc1…2def`',
    '*BTC* · $40.0K',
  ].join('\n');

  try {
    const ok = await sendMessage(link.chat_id, text, 'Markdown');
    if (!ok) {
      return NextResponse.json(
        { ok: false, error: 'Telegram API rejected the message — your bot link may have been revoked.' },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, sent: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'send failed' },
      { status: 500 },
    );
  }
}
