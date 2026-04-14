/**
 * Generate a Telegram link code for the authenticated user.
 * POST /api/telegram/link-code
 *
 * Returns { code: "ABC123" } — user sends /start ABC123 to the bot.
 * Also GET to check current link status.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { initDB, isDBConfigured, createTelegramLinkCode, getTelegramLinkByUser, unlinkTelegramChat } from '@/lib/db';
import { generateLinkCode } from '@/lib/telegram';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';

/** POST — Generate a new link code */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  await initDB();

  const code = generateLinkCode();
  await createTelegramLinkCode(session.user.id, code);

  return NextResponse.json({ code, expiresIn: 600 }); // 10 minutes
}

/** GET — Check current link status */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  await initDB();

  const link = await getTelegramLinkByUser(session.user.id);
  if (!link) {
    return NextResponse.json({ linked: false });
  }

  return NextResponse.json({
    linked: true,
    active: link.active,
    mutedUntil: link.muted_until?.toISOString() || null,
  });
}

/** DELETE — Unlink Telegram */
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  await initDB();

  const link = await getTelegramLinkByUser(session.user.id);
  if (link) {
    await unlinkTelegramChat(link.chat_id);
  }

  return NextResponse.json({ ok: true });
}
