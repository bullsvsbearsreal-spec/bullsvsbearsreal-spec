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
} from '@/lib/db';
import {
  fetchMarketDataServer,
  checkAlert,
  getMetricValue,
  type Alert,
} from '@/lib/market-data';
import {
  sendAlertEmail,
  sendAlertTelegram,
  type TriggeredAlertInfo,
} from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export const preferredRegion = 'dxb1';

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
      } catch (err) {
        console.error(`[alert-cron] error processing user ${user.userId}:`, err);
      }
    }

    // Prune old notifications ~5% of the time
    if (Math.random() < 0.05) {
      await pruneAlertNotifications();
    }

    return NextResponse.json({
      ok: true,
      users: users.length,
      triggered: totalTriggered,
      notifications: totalNotifications,
    });
  } catch (error) {
    console.error('[alert-cron] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
