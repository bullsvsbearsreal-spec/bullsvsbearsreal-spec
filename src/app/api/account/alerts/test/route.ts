/**
 * POST /api/account/alerts/test
 *
 * Sends a one-shot test notification to every channel the calling user has
 * configured + has live credentials for. Lets users verify their channel
 * setup (esp. browser push, where you don't see whether anything works
 * until a real alert fires).
 *
 * Response shape mirrors the alert cron's debug field:
 *   { results: ['telegram=sent', 'email=no verified address', 'browser_push=2/2 delivered'] }
 *
 * Doesn't trigger the cooldown — this is a manual user action, not the
 * scheduled rule firing.
 */
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  isDBConfigured,
  listUserAlertRules,
  getTelegramLinkByUser,
  getUserEmail,
  getPushSubscriptionsForUser,
  deletePushSubscription,
} from '@/lib/db';
import { sendMessage } from '@/lib/telegram';
import { Resend } from 'resend';
import webpush from 'web-push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

let _vapidConfigured = false;
function ensureVapid(): boolean {
  if (_vapidConfigured) return true;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false;
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:noreply@info-hub.io',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );
    _vapidConfigured = true;
    return true;
  } catch {
    return false;
  }
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'DB unavailable' }, { status: 503, headers: NO_STORE });
  }

  const rules = await listUserAlertRules(session.user.id);
  const fundingFlip = rules.find(r => r.kind === 'funding_flip');
  if (!fundingFlip || !fundingFlip.enabled) {
    return NextResponse.json(
      { error: 'No alert rules configured. Enable funding-flip alerts first.' },
      { status: 400, headers: NO_STORE },
    );
  }

  const channels = fundingFlip.channels;
  const results: string[] = [];
  let anyDelivered = false;

  // ─── Telegram ───────────────────────────────────────
  if (channels.includes('telegram')) {
    const link = await getTelegramLinkByUser(session.user.id);
    if (!link?.active) {
      results.push('telegram=not linked');
    } else if (link.muted_until && link.muted_until.getTime() > Date.now()) {
      results.push('telegram=muted');
    } else {
      const ok = await sendMessage(
        link.chat_id,
        '✅ <b>Test notification from InfoHub</b>\n\nIf you can read this, your Telegram channel is wired correctly. The next real funding-flip alert will land here.',
        'HTML',
      );
      results.push(`telegram=${ok ? 'sent' : 'failed'}`);
      if (ok) anyDelivered = true;
    }
  }

  // ─── Email ──────────────────────────────────────────
  if (channels.includes('email')) {
    const email = await getUserEmail(session.user.id);
    const resend = getResend();
    if (!email) {
      results.push('email=no verified address');
    } else if (!resend) {
      results.push('email=RESEND_API_KEY unset');
    } else {
      try {
        await resend.emails.send({
          from: 'InfoHub Alerts <noreply@info-hub.io>',
          to: email,
          subject: '✅ Test notification — funding-flip alerts wired',
          html: `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0b0d12;color:#e5e7eb;padding:24px;max-width:560px;margin:0 auto">
            <div style="font-size:11px;letter-spacing:2px;color:#34d399;font-weight:700;margin-bottom:8px">✅ TEST NOTIFICATION</div>
            <h1 style="margin:0 0 12px;font-size:18px;color:#fff">Email channel is working</h1>
            <p style="font-size:14px;line-height:1.5;color:#9ca3af">If you can read this, real funding-flip alerts will arrive here too. Manage at <a href="https://info-hub.io/account/connections" style="color:#fbbf24">/account/connections</a>.</p>
          </div>`,
        });
        results.push('email=sent');
        anyDelivered = true;
      } catch (e) {
        results.push(`email=failed (${e instanceof Error ? e.message.slice(0, 60) : 'err'})`);
      }
    }
  }

  // ─── Browser push ───────────────────────────────────
  if (channels.includes('browser_push')) {
    const subs = await getPushSubscriptionsForUser(session.user.id);
    if (subs.length === 0) {
      results.push('browser_push=no subscriptions (click the chip to subscribe first)');
    } else if (!ensureVapid()) {
      results.push('browser_push=VAPID env not set');
    } else {
      const payload = JSON.stringify({
        title: '✅ InfoHub test notification',
        body: 'Browser push is working. Real funding-flip alerts will appear here.',
        tag: `test-${Date.now()}`,
        url: '/positions',
      });
      let pushSent = 0;
      await Promise.all(subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
          pushSent++;
        } catch (err: any) {
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            await deletePushSubscription(sub.endpoint).catch(() => undefined);
          }
        }
      }));
      results.push(`browser_push=${pushSent}/${subs.length} delivered`);
      if (pushSent > 0) anyDelivered = true;
    }
  }

  return NextResponse.json(
    { ok: anyDelivered, channels, results, ts: Date.now() },
    { headers: NO_STORE },
  );
}
