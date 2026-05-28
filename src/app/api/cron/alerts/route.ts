/**
 * Cron endpoint: server-side user alert checking.
 * Standard cadence: every 5 minutes via systemd timer.
 *
 * Checks each logged-in user's alerts against live market data,
 * sends email and/or Telegram notifications for triggered alerts.
 *
 * Tier-aware path split (May 2026):
 *   - GET (no flag)         → process Free + Trader + Pro users
 *   - GET ?priority=1       → process Whale users ONLY (low-latency
 *                              queue, see /api/cron/whale-alerts which
 *                              runs this same handler more frequently)
 * Without the split, whale users would double-fire (once from each cron).
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
import { getUserTier } from '@/lib/auth';
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

  // Tier-mode flag (see file header). `priorityOnly=true` means we ONLY
  // process Whale users (low-latency queue path). `priorityOnly=false`
  // is the standard 5min path and skips Whale users so they don't
  // double-fire.
  const priorityOnly = request.nextUrl.searchParams.get('priority') === '1';

  try {
    await initDB();

    const origin = process.env.NEXTAUTH_URL || 'https://info-hub.io';

    // Fetch market data
    const marketData = await fetchMarketDataServer(origin);
    if (marketData.size === 0) {
      return NextResponse.json({ ok: true, skipped: 'no market data', priorityOnly });
    }

    // Get users with alerts
    const users = await getAllUsersWithAlerts();
    if (users.length === 0) {
      return NextResponse.json({ ok: true, alerts: 0, users: 0, skipped: 'no users with alerts', priorityOnly });
    }

    let totalTriggered = 0;
    let totalNotifications = 0;
    let userErrors = 0;
    let skippedByTier = 0;

    for (const user of users) {
      try {
        const enabledAlerts = (user.alerts as Alert[]).filter((a) => a.enabled);
        if (enabledAlerts.length === 0) continue;

        // Tier filter (see file header). Without this, Whale users
        // would either be skipped entirely or get duplicate alerts.
        const userTierForFilter = await getUserTier(user.userId);
        const isWhaleUser = userTierForFilter === 'whale';
        if (priorityOnly && !isWhaleUser) { skippedByTier += 1; continue; }
        if (!priorityOnly && isWhaleUser) { skippedByTier += 1; continue; }

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
        // The CRUD endpoint tier-gates the SET path, but the cron must
        // re-check at delivery time too: a whale user who downgrades to
        // Pro/Free still has their webhook config sitting in user_prefs.
        // Without this gate they'd keep getting a paid-tier feature for
        // free post-downgrade.
        if (user.notificationPrefs?.webhook?.url && user.notificationPrefs?.webhook?.secret) {
          const tier = await getUserTier(user.userId);
          if (tier === 'whale') {
            const { url, secret } = user.notificationPrefs.webhook;
            channels.push({ name: 'webhook', send: (a) => sendAlertWebhook(url, secret, a) });
          }
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
    // Separate heartbeat key for the priority path so admin can monitor both
    // ladders independently in /admin-panel.
    const heartbeatKey = priorityOnly ? 'cron:whale-alerts' : 'cron:alerts';
    const heartbeatStatus: 'ok' | 'degraded' = userErrors === 0 ? 'ok' : 'degraded';
    await upsertWorkerHeartbeat(heartbeatKey, heartbeatStatus, {
      users: users.length, triggered: totalTriggered, notifications: totalNotifications,
      userErrors, skippedByTier, mode: priorityOnly ? 'priority' : 'standard',
    }).catch(e => console.error(`[${heartbeatKey}] heartbeat error:`, e));

    return NextResponse.json({
      ok: true,
      users: users.length,
      triggered: totalTriggered,
      notifications: totalNotifications,
      mode: priorityOnly ? 'priority' : 'standard',
      skippedByTier,
    });
  } catch (error) {
    console.error('[alert-cron] error:', error);
    // Failure-path heartbeat: previously the catch returned without
    // touching upsertWorkerHeartbeat, so a single thrown exception
    // would silently disappear the cron from /admin-panel#ops
    // (no Ops row → looks like the systemd timer is dead). Heartbeat
    // 'degraded' with the error message so operators see *something*
    // and the cron stays visible even when broken.
    const heartbeatKey = priorityOnly ? 'cron:whale-alerts' : 'cron:alerts';
    await upsertWorkerHeartbeat(heartbeatKey, 'degraded', {
      error: error instanceof Error ? error.message : String(error),
      mode: priorityOnly ? 'priority' : 'standard',
    }).catch(() => {});
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
