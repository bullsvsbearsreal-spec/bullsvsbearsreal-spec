/**
 * Register the Telegram webhook with Telegram's API.
 * GET /api/telegram/setup?secret=CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { setWebhook, getChatBotToken } from '@/lib/telegram';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret') || '';
  const expected = process.env.CRON_SECRET || '';
  if (!expected || secret.length !== expected.length || !timingSafeEqual(Buffer.from(secret), Buffer.from(expected))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const webhookUrl = `${process.env.NEXTAUTH_URL || 'https://info-hub.io'}/api/telegram/webhook`;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || '';

  // Register the webhook against the CHAT bot (TELEGRAM_CHAT_BOT_TOKEN).
  // In single-bot deployments getChatBotToken() falls back to the default
  // TELEGRAM_BOT_TOKEN. In two-bot mode the alert bot stays webhook-less
  // (it only sends outbound).
  const chatToken = getChatBotToken();
  const result = await setWebhook(webhookUrl, webhookSecret || undefined, chatToken);

  return NextResponse.json({ ok: true, webhookUrl, result });
}
