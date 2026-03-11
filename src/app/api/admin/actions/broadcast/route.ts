import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, auth } from '@/lib/auth';
import { recordAuditEvent, getAllPushSubscriptions, getAllActiveTelegramChatIds } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'dxb1';

export async function POST(request: NextRequest) {
  const adminErr = await requireAdmin();
  if (adminErr) return adminErr;

  const session = await auth();

  let body: { message?: string; channels?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { message, channels } = body;
  if (!message || typeof message !== 'string' || message.length > 500) {
    return NextResponse.json({ error: 'Message required (max 500 chars)' }, { status: 400 });
  }
  if (!channels || !Array.isArray(channels) || channels.length === 0) {
    return NextResponse.json({ error: 'At least one channel required' }, { status: 400 });
  }

  const result = { push: { sent: 0, failed: 0 }, telegram: { sent: 0, failed: 0 } };

  // Push notifications
  if (channels.includes('push')) {
    try {
      const webpush = await import('web-push');
      const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
      const vapidPrivate = process.env.VAPID_PRIVATE_KEY || '';
      if (vapidPublic && vapidPrivate) {
        webpush.setVapidDetails('mailto:admin@info-hub.io', vapidPublic, vapidPrivate);
        const subs = await getAllPushSubscriptions();
        for (const sub of subs) {
          try {
            await webpush.sendNotification(sub.subscription, JSON.stringify({
              title: 'InfoHub Admin',
              body: message,
              icon: '/icon-192.png',
            }));
            result.push.sent++;
          } catch {
            result.push.failed++;
          }
        }
      }
    } catch {
      result.push.failed++;
    }
  }

  // Telegram notifications
  if (channels.includes('telegram')) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    if (botToken) {
      const chatIds = await getAllActiveTelegramChatIds();
      for (const { chatId } of chatIds) {
        try {
          const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: `📢 <b>Admin Broadcast</b>\n\n${message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}`, parse_mode: 'HTML' }),
            signal: AbortSignal.timeout(10000),
          });
          if (res.ok) result.telegram.sent++;
          else result.telegram.failed++;
        } catch {
          result.telegram.failed++;
        }
        // Throttle to stay under Telegram's ~30 msg/sec rate limit
        await new Promise(r => setTimeout(r, 100));
      }
    }
  }

  await recordAuditEvent('broadcast', {
    admin: session?.user?.email ?? 'unknown',
    message: message.slice(0, 100),
    channels,
    pushSent: result.push.sent,
    pushFailed: result.push.failed,
    telegramSent: result.telegram.sent,
    telegramFailed: result.telegram.failed,
  });

  return NextResponse.json({
    success: true,
    ...result,
    timestamp: new Date().toISOString(),
  });
}
