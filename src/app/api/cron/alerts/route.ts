/**
 * Cron endpoint: server-side user alert checking.
 * Runs every 5 minutes via Vercel Cron.
 *
 * Checks each logged-in user's alerts against live market data,
 * sends email and/or Telegram notifications for triggered alerts.
 *
 * Security: Verifies CRON_SECRET Bearer token.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  initDB,
  isDBConfigured,
  getAllUsersWithAlerts,
  getAlertCooldown,
  logAlertNotification,
  pruneAlertNotifications,
  getPushSubscriptionsForUser,
  deletePushSubscription,
  getTelegramLinkByUser,
  upsertWorkerHeartbeat,
} from '@/lib/db';
import {
  fetchMarketDataServer,
  checkAlert,
  getMetricValue,
  type Alert,
  type AlertMetric,
  type AlertOperator,
} from '@/lib/market-data';
import {
  sendAlertEmail,
  sendAlertTelegram,
  sendAlertPush,
  sendAlertDiscord,
  sendAlertWhatsApp,
  sendAlertWebhook,
  type TriggeredAlertInfo,
} from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export const preferredRegion = 'bom1';

export async function GET(request: NextRequest) {
  // Auth check — timing-safe comparison
  {
    const { verifyCronAuth } = await import('../_auth');
    const authErr = verifyCronAuth(request);
    if (authErr) return authErr;
  }

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    await initDB();

    const origin = process.env.NEXTAUTH_URL || 'https://info-hub.io';

    // Fetch market data
    const marketData = await fetchMarketDataServer(origin);
    if (marketData.size === 0) {
      return NextResponse.json({ ok: true, skipped: 'no market data' });
    }

    // Get users with alerts
    const users = await getAllUsersWithAlerts();
    if (users.length === 0) {
      return NextResponse.json({ ok: true, alerts: 0, users: 0, skipped: 'no users with alerts' });
    }

    let totalTriggered = 0;
    let totalNotifications = 0;
    let userErrors = 0;

    for (const user of users) {
      try {
        const enabledAlerts = (user.alerts as Alert[]).filter((a) => a.enabled);
        if (enabledAlerts.length === 0) continue;

        const cooldownMins = user.notificationPrefs?.cooldownMinutes ?? 60;
        const emailEnabled = user.notificationPrefs?.email !== false; // default true

        // Collect all alerts that fired (metric check only — no cooldown yet)
        const firedAlerts: TriggeredAlertInfo[] = [];

        for (const alert of enabledAlerts) {
          const data = marketData.get(alert.symbol);
          if (!data) continue;

          if (checkAlert(alert, data)) {
            const actualValue = getMetricValue(data, alert.metric, alert);
            firedAlerts.push({
              alertId: alert.id,
              symbol: alert.symbol,
              metric: alert.metric,
              operator: alert.operator,
              threshold: alert.value,
              actualValue,
              ...(alert.exchange ? { exchange: alert.exchange } : {}),
              ...(alert.proximityPct ? { proximityPct: alert.proximityPct } : {}),
            });
          }
        }

        if (firedAlerts.length === 0) continue;
        totalTriggered += firedAlerts.length;

        // Determine which channels are enabled for this user
        const channels: { name: string; send: (alerts: TriggeredAlertInfo[]) => Promise<boolean> }[] = [];
        if (emailEnabled && user.email) {
          channels.push({ name: 'email', send: (a) => sendAlertEmail(user.email!, a) });
        }
        if (user.notificationPrefs?.discordEnabled && user.notificationPrefs?.discordWebhookUrl) {
          const url = user.notificationPrefs.discordWebhookUrl;
          channels.push({ name: 'discord', send: (a) => sendAlertDiscord(url, a) });
        }
        // Whale-tier generic HTTPS webhook. URL + HMAC secret stored
        // under notificationPrefs.webhook (set via /api/account/webhook).
        // The tier-gate is enforced at the alerts-CRUD endpoint, so by
        // the time we get here the user is whale + the webhook is
        // configured. We still defensively check both fields are
        // present.
        if (user.notificationPrefs?.webhook?.url && user.notificationPrefs?.webhook?.secret) {
          const { url, secret } = user.notificationPrefs.webhook;
          channels.push({ name: 'webhook', send: (a) => sendAlertWebhook(url, secret, a) });
        }
        if (user.notificationPrefs?.whatsappEnabled && user.notificationPrefs?.whatsappPhone) {
          const phone = user.notificationPrefs.whatsappPhone;
          channels.push({ name: 'whatsapp', send: (a) => sendAlertWhatsApp(phone, a) });
        }

        // Telegram channel (linked via /start code flow)
        const tgLink = await getTelegramLinkByUser(user.userId);
        if (tgLink?.active && (!tgLink.muted_until || tgLink.muted_until < new Date())) {
          const tgChatId = tgLink.chat_id;
          channels.push({ name: 'telegram', send: (a) => sendAlertTelegram(tgChatId, a) });
        }

        // Push channel (always check if subscriptions exist)
        const pushSubs = await getPushSubscriptionsForUser(user.userId);
        const hasPush = pushSubs.length > 0;

        // Build a map from alertId → original alert (to access per-alert channels)
        const alertMap = new Map<string, Alert>();
        for (const a of enabledAlerts) alertMap.set(a.id, a);

        // Per-channel delivery with per-channel cooldown
        for (const ch of channels) {
          // Filter to alerts not in cooldown for THIS channel, respecting per-alert channel routing
          const toSend: TriggeredAlertInfo[] = [];
          for (const alert of firedAlerts) {
            const orig = alertMap.get(alert.alertId);
            // If the alert has per-alert channels set, skip channels not in the list
            if (orig?.channels?.length && !orig.channels.includes(ch.name)) continue;
            const inCooldown = await getAlertCooldown(user.userId, alert.alertId, cooldownMins, ch.name);
            if (!inCooldown) toSend.push(alert);
          }
          if (toSend.length === 0) continue;

          const sent = await ch.send(toSend);
          if (sent) {
            for (const t of toSend) {
              await logAlertNotification(user.userId, t.alertId, t.symbol, t.metric, t.threshold, t.actualValue, ch.name);
            }
            totalNotifications += toSend.length;
          }
        }

        // Push notifications — separate handling due to different API
        if (hasPush) {
          const toSend: TriggeredAlertInfo[] = [];
          for (const alert of firedAlerts) {
            const orig = alertMap.get(alert.alertId);
            if (orig?.channels?.length && !orig.channels.includes('push')) continue;
            const inCooldown = await getAlertCooldown(user.userId, alert.alertId, cooldownMins, 'push');
            if (!inCooldown) toSend.push(alert);
          }
          if (toSend.length > 0) {
            const { sent, expiredEndpoints } = await sendAlertPush(pushSubs, toSend);
            for (const ep of expiredEndpoints) {
              await deletePushSubscription(ep);
            }
            if (sent > 0) {
              for (const t of toSend) {
                await logAlertNotification(user.userId, t.alertId, t.symbol, t.metric, t.threshold, t.actualValue, 'push');
              }
              totalNotifications += toSend.length;
            }
          }
        }
      } catch (err) {
        console.error(`[alert-cron] error processing user ${user.userId}:`, err);
        userErrors += 1;
      }
    }

    // Prune old notifications ~5% of the time. Wrap so prune failure
    // (DB connection drop, perm issue) doesn't crash the whole cron — alerts
    // were already sent above, prune is best-effort.
    if (Math.random() < 0.05) {
      await pruneAlertNotifications().catch(e =>
        console.error('[cron:alerts] prune error:', e),
      );
    }

    // Heartbeat reflects per-user error count — previously hardcoded 'ok' so
    // admin pipeline showed green even when half the users were erroring out.
    const heartbeatStatus: 'ok' | 'degraded' = userErrors === 0 ? 'ok' : 'degraded';
    await upsertWorkerHeartbeat('cron:alerts', heartbeatStatus, {
      users: users.length, triggered: totalTriggered, notifications: totalNotifications,
      userErrors,
    }).catch(e => console.error('[cron:alerts] heartbeat error:', e));

    return NextResponse.json({
      ok: true,
      users: users.length,
      triggered: totalTriggered,
      notifications: totalNotifications,
    });
  } catch (error) {
    console.error('[alert-cron] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
