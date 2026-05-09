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

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  if (!isDBConfigured()) {
    return NextResponse.json({ ok: false, error: 'database not configured' }, { status: 503 });
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
