/**
 * One-time Telegram webhook registration.
 * GET /api/telegram/setup?secret=<WEBHOOK_SECRET>
 *
 * Registers the webhook URL with the Telegram Bot API and returns bot info.
 */
import { NextRequest, NextResponse } from 'next/server';
import { setWebhook } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const WEBHOOK_SECRET = (process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();

export async function GET(req: NextRequest) {
  // Simple auth: require the webhook secret as query param
  const secret = req.nextUrl.searchParams.get('secret');
  if (!secret || secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!BOT_TOKEN) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 });
  }

  try {
    // Get bot info
    const meRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
    const me = await meRes.json();

    // Check current webhook
    const whInfoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    const whInfo = await whInfoRes.json();

    // Register webhook
    const webhookUrl = `https://info-hub.io/api/telegram/webhook`;
    const result = await setWebhook(webhookUrl, WEBHOOK_SECRET);

    return NextResponse.json({
      bot: me.result,
      previousWebhook: whInfo.result,
      registration: result,
      webhookUrl,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
