/**
 * Register the Telegram webhook with Telegram's API.
 * GET /api/telegram/setup?secret=CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { setWebhook } from '@/lib/telegram';

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

  // Register the webhook against the default TELEGRAM_BOT_TOKEN —
  // which is now @InfoHubRadarBot after the v2 AI-chat rollback.
  const result = await setWebhook(webhookUrl, webhookSecret || undefined);

  return NextResponse.json({ ok: true, webhookUrl, result });
}
