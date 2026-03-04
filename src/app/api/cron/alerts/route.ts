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
  getAllActiveTelegramAlerts,
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
  type TriggeredAlertInfo,
} from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export const preferredRegion = 'sin1';

const CRON_SECRET = (process.env.CRON_SECRET || '').trim();

export async function GET(request: NextRequest) {
  // Auth check
  if (CRON_SECRET) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    await initDB();

    const origin = request.nextUrl.origin;

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

    for (const user of users) {
      try {
        const enabledAlerts = (user.alerts as Alert[]).filter((a) => a.enabled);
        if (enabledAlerts.length === 0) continue;

        const cooldownMins = user.notificationPrefs?.cooldownMinutes ?? 60;
        const emailEnabled = user.notificationPrefs?.email !== false; // default true

        const triggered: TriggeredAlertInfo[] = [];

        for (const alert of enabledAlerts) {
          const data = marketData.get(alert.symbol);
          if (!data) continue;

          if (checkAlert(alert, data)) {
            // Check cooldown
            const inCooldown = await getAlertCooldown(user.userId, alert.id, cooldownMins);
            if (inCooldown) continue;

            const actualValue = getMetricValue(data, alert.metric);
            triggered.push({
              alertId: alert.id,
              symbol: alert.symbol,
              metric: alert.metric,
              operator: alert.operator,
              threshold: alert.value,
              actualValue,
            });
            totalTriggered++;
          }
        }

        if (triggered.length === 0) continue;

        // Send email notification
        if (emailEnabled && user.email) {
          const sent = await sendAlertEmail(user.email, triggered);
          if (sent) {
            for (const t of triggered) {
              await logAlertNotification(user.userId, t.alertId, t.symbol, t.metric, t.threshold, t.actualValue, 'email');
            }
            totalNotifications += triggered.length;
          }
        }

        // Send web push notification
        const pushSubs = await getPushSubscriptionsForUser(user.userId);
        if (pushSubs.length > 0) {
          const { sent, expiredEndpoints } = await sendAlertPush(pushSubs, triggered);
          // Clean up expired subscriptions
          for (const ep of expiredEndpoints) {
            await deletePushSubscription(ep);
          }
          if (sent > 0) {
            for (const t of triggered) {
              await logAlertNotification(user.userId, t.alertId, t.symbol, t.metric, t.threshold, t.actualValue, 'push');
            }
            totalNotifications += triggered.length;
          }
        }
      } catch (err) {
        console.error(`[alert-cron] error processing user ${user.userId}:`, err);
      }
    }

    // ─── Telegram alerts ────────────────────────────────────────────────────
    let telegramTriggered = 0;
    let telegramNotifications = 0;
    try {
      const tgAlerts = await getAllActiveTelegramAlerts();
      if (tgAlerts.length > 0) {
        // Group by chat_id
        const byChatId = new Map<number, typeof tgAlerts>();
        for (const ta of tgAlerts) {
          const arr = byChatId.get(ta.chat_id) || [];
          arr.push(ta);
          byChatId.set(ta.chat_id, arr);
        }

        for (const [chatId, alerts] of Array.from(byChatId.entries())) {
          const triggered: TriggeredAlertInfo[] = [];
          for (const ta of alerts) {
            const data = marketData.get(ta.symbol);
            if (!data) continue;

            // Map TelegramAlert to Alert shape for checkAlert()
            const asAlert: Alert = {
              id: String(ta.id),
              symbol: ta.symbol,
              metric: ta.metric as AlertMetric,
              operator: ta.operator as AlertOperator,
              value: ta.threshold,
              enabled: true,
              createdAt: Date.now(),
            };

            if (checkAlert(asAlert, data)) {
              // Use chat_id as the userId key for cooldown
              const inCooldown = await getAlertCooldown(
                `tg_${chatId}`,
                String(ta.id),
                60,
              );
              if (inCooldown) continue;

              const actualValue = getMetricValue(data, ta.metric as AlertMetric);
              triggered.push({
                alertId: String(ta.id),
                symbol: ta.symbol,
                metric: ta.metric,
                operator: ta.operator,
                threshold: ta.threshold,
                actualValue,
              });
              telegramTriggered++;
            }
          }

          if (triggered.length > 0) {
            const sent = await sendAlertTelegram(chatId, triggered);
            if (sent) {
              for (const t of triggered) {
                await logAlertNotification(
                  `tg_${chatId}`,
                  t.alertId,
                  t.symbol,
                  t.metric,
                  t.threshold,
                  t.actualValue,
                  'telegram',
                );
              }
              telegramNotifications += triggered.length;
            }
          }
        }
      }
    } catch (err) {
      console.error('[alert-cron] error processing telegram alerts:', err);
    }

    // Prune old notifications ~5% of the time
    if (Math.random() < 0.05) {
      await pruneAlertNotifications();
    }

    return NextResponse.json({
      ok: true,
      users: users.length,
      triggered: totalTriggered + telegramTriggered,
      notifications: totalNotifications + telegramNotifications,
      telegramTriggered,
      telegramNotifications,
    });
  } catch (error) {
    console.error('[alert-cron] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
