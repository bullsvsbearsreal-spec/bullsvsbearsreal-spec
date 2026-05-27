/**
 * GET /api/admin/stats
 *
 * Returns site-wide metrics. Admin only.
 *
 * Powers the new /admin-panel dashboard:
 *   - `totals`           — cumulative counts (users, snapshots, telegram, push)
 *   - `last24h`          — last-day activity for the activity volume section
 *   - `trends`           — 7-day daily arrays for sparklines
 *   - `users`            — tier mix + verification mix + role mix + signup
 *                          velocity (7d/30d) + most recent signups
 *   - `retention`        — D1/D7/D30 cohort retention based on
 *                          last_seen vs created_at columns
 *   - `engagement`       — active alerts, watched wallets, connected keys,
 *                          wallets, per-user averages
 *   - `notifications`    — last-7d sends by channel + 7-day success rate
 *   - `affiliate`        — total signups via referrals + count of users
 *                          with a non-default usdt_payout_wallet
 *   - `dbSize`           — postgres database size (pretty)
 */

import { NextResponse } from 'next/server';
import { requireAdminOrAdvisor } from '@/lib/auth';
import { isDBConfigured, getSQL } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await requireAdminOrAdvisor();
  if (denied) return denied;

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const db = getSQL();

    const [
      userCount,
      alertNotifCount,
      fundingRows,
      oiRows,
      liqRows,
      telegramUsers,
      pushSubs,
      dbSize,
    ] = await Promise.all([
      db`SELECT COUNT(*) as count FROM users`,
      db`SELECT COUNT(*) as count FROM alert_notifications`,
      db`SELECT COUNT(*) as count FROM funding_snapshots`,
      db`SELECT COUNT(*) as count FROM oi_snapshots`,
      db`SELECT COUNT(*) as count FROM liquidation_snapshots`,
      db`SELECT COUNT(*) as count FROM telegram_users WHERE active = true`.catch(() => [{ count: 0 }]),
      db`SELECT COUNT(*) as count FROM push_subscriptions`.catch(() => [{ count: 0 }]),
      db`SELECT pg_size_pretty(pg_database_size(current_database())) as size`.catch(() => [{ size: 'unknown' }]),
    ]);

    // Recent activity (last 24h) + 7-day trends for sparklines.
    const [
      recentNotifs, recentFunding, recentLiqs,
      trendAlerts, trendFunding, trendOI, trendLiqs,
    ] = await Promise.all([
      db`SELECT COUNT(*) as count FROM alert_notifications WHERE sent_at > NOW() - INTERVAL '24 hours'`,
      db`SELECT COUNT(*) as count FROM funding_snapshots WHERE ts > NOW() - INTERVAL '24 hours'`,
      db`SELECT COUNT(*) as count FROM liquidation_snapshots WHERE ts > NOW() - INTERVAL '24 hours'`,
      db`SELECT d::date as day, COALESCE(c, 0) as count FROM generate_series(NOW() - INTERVAL '6 days', NOW(), '1 day') d LEFT JOIN LATERAL (SELECT COUNT(*) as c FROM alert_notifications WHERE sent_at::date = d::date) x ON true ORDER BY d`,
      db`SELECT d::date as day, COALESCE(c, 0) as count FROM generate_series(NOW() - INTERVAL '6 days', NOW(), '1 day') d LEFT JOIN LATERAL (SELECT COUNT(*) as c FROM funding_snapshots WHERE ts::date = d::date) x ON true ORDER BY d`,
      db`SELECT d::date as day, COALESCE(c, 0) as count FROM generate_series(NOW() - INTERVAL '6 days', NOW(), '1 day') d LEFT JOIN LATERAL (SELECT COUNT(*) as c FROM oi_snapshots WHERE ts::date = d::date) x ON true ORDER BY d`,
      db`SELECT d::date as day, COALESCE(c, 0) as count FROM generate_series(NOW() - INTERVAL '6 days', NOW(), '1 day') d LEFT JOIN LATERAL (SELECT COUNT(*) as c FROM liquidation_snapshots WHERE ts::date = d::date) x ON true ORDER BY d`,
    ]);

    const toArr = (rows: any[]) => rows.map((r: any) => Number(r.count));

    // ─── NEW: user-side metrics ────────────────────────────────────
    // Some columns are optional / new — wrap each in .catch so a
    // missing column doesn't take down the whole endpoint. Returning
    // an empty array makes the UI gracefully fall back to "—".

    const [
      tierMix, roleMix, verifiedMix,
      signups7d, signups30d, signups90d,
      recentSignups,
      // Retention cohort: % of signups in window W that have been
      // seen >= D days after signup. Requires `last_seen` column on
      // users (set in /api/user/heartbeat or session refresh).
      // Falls back to "no data" if missing.
      retentionRows,
      // DAU/WAU/MAU from last_seen.
      dauWauMau,
    ] = await Promise.all([
      db`SELECT COALESCE(billing_tier, 'free') as tier, COUNT(*) as count FROM users GROUP BY billing_tier`.catch(() => []),
      db`SELECT COALESCE(role, 'user') as role, COUNT(*) as count FROM users GROUP BY role`.catch(() => []),
      db`SELECT (email_verified IS NOT NULL) as verified, COUNT(*) as count FROM users GROUP BY verified`.catch(() => []),
      db`SELECT COUNT(*) as count FROM users WHERE created_at > NOW() - INTERVAL '7 days'`.catch(() => [{ count: 0 }]),
      db`SELECT COUNT(*) as count FROM users WHERE created_at > NOW() - INTERVAL '30 days'`.catch(() => [{ count: 0 }]),
      db`SELECT COUNT(*) as count FROM users WHERE created_at > NOW() - INTERVAL '90 days'`.catch(() => [{ count: 0 }]),
      db`SELECT id, email, name, created_at, billing_tier, role FROM users ORDER BY created_at DESC LIMIT 10`.catch(() => []),
      // D1 / D7 / D30 retention: of users created BETWEEN (e.g.) 7-37d
      // ago for D30, what fraction have last_seen >= 30d after their
      // created_at? The "cohort window" is offset so partial cohorts
      // don't drag the number down (users created yesterday can't
      // have D30 retention yet).
      db`
        WITH cohorts AS (
          SELECT
            COUNT(*) FILTER (WHERE created_at BETWEEN NOW() - INTERVAL '30 days' AND NOW() - INTERVAL '1 day')                                              AS d1_total,
            COUNT(*) FILTER (WHERE created_at BETWEEN NOW() - INTERVAL '30 days' AND NOW() - INTERVAL '1 day' AND last_seen >= created_at + INTERVAL '1 day')  AS d1_retained,
            COUNT(*) FILTER (WHERE created_at BETWEEN NOW() - INTERVAL '37 days' AND NOW() - INTERVAL '7 days')                                              AS d7_total,
            COUNT(*) FILTER (WHERE created_at BETWEEN NOW() - INTERVAL '37 days' AND NOW() - INTERVAL '7 days' AND last_seen >= created_at + INTERVAL '7 days')  AS d7_retained,
            COUNT(*) FILTER (WHERE created_at BETWEEN NOW() - INTERVAL '60 days' AND NOW() - INTERVAL '30 days')                                             AS d30_total,
            COUNT(*) FILTER (WHERE created_at BETWEEN NOW() - INTERVAL '60 days' AND NOW() - INTERVAL '30 days' AND last_seen >= created_at + INTERVAL '30 days') AS d30_retained
          FROM users
        )
        SELECT * FROM cohorts
      `.catch(() => []),
      db`
        SELECT
          COUNT(*) FILTER (WHERE last_seen > NOW() - INTERVAL '1 day')   AS dau,
          COUNT(*) FILTER (WHERE last_seen > NOW() - INTERVAL '7 days')  AS wau,
          COUNT(*) FILTER (WHERE last_seen > NOW() - INTERVAL '30 days') AS mau
        FROM users
      `.catch(() => []),
    ]);

    // ─── Engagement (per-user activity scale) ───────────────────────
    const [
      alertsActive, alertsTotal,
      watchedWallets, connectedKeys, connectedWallets,
    ] = await Promise.all([
      // alerts is a jsonb column on users; an "active" alert has enabled=true.
      db`SELECT COALESCE(SUM(jsonb_array_length(alerts)), 0) as count FROM users WHERE jsonb_typeof(alerts) = 'array'`.catch(() => [{ count: 0 }]),
      db`SELECT COUNT(*) as count FROM users WHERE jsonb_typeof(alerts) = 'array' AND jsonb_array_length(alerts) > 0`.catch(() => [{ count: 0 }]),
      db`SELECT COUNT(*) as count FROM hl_watched_wallets`.catch(() => [{ count: 0 }]),
      db`SELECT COUNT(*) as count FROM user_exchange_keys`.catch(() => [{ count: 0 }]),
      db`SELECT COUNT(*) as count FROM user_wallets`.catch(() => [{ count: 0 }]),
    ]);

    // ─── Notifications by channel + success rate (last 7d) ──────────
    const [notifsByChannel, notifsSuccess] = await Promise.all([
      db`SELECT channel, COUNT(*) as count FROM alert_notifications WHERE sent_at > NOW() - INTERVAL '7 days' GROUP BY channel ORDER BY count DESC`.catch(() => []),
      db`SELECT COUNT(*) FILTER (WHERE status = 'sent') as sent, COUNT(*) FILTER (WHERE status = 'failed') as failed, COUNT(*) as total FROM alert_notifications WHERE sent_at > NOW() - INTERVAL '7 days'`.catch(() => []),
    ]);

    // ─── Affiliate program metrics ──────────────────────────────────
    const [referredUsers, payoutsConfigured] = await Promise.all([
      db`SELECT COUNT(*) as count FROM users WHERE referred_by_user_id IS NOT NULL`.catch(() => [{ count: 0 }]),
      db`SELECT COUNT(*) as count FROM users WHERE usdt_payout_wallet IS NOT NULL AND usdt_payout_wallet <> ''`.catch(() => [{ count: 0 }]),
    ]);

    return NextResponse.json({
      totals: {
        users: Number(userCount[0]?.count ?? 0),
        alertNotifications: Number(alertNotifCount[0]?.count ?? 0),
        fundingSnapshots: Number(fundingRows[0]?.count ?? 0),
        oiSnapshots: Number(oiRows[0]?.count ?? 0),
        liquidationSnapshots: Number(liqRows[0]?.count ?? 0),
        telegramUsers: Number(telegramUsers[0]?.count ?? 0),
        pushSubscriptions: Number(pushSubs[0]?.count ?? 0),
      },
      last24h: {
        alertNotifications: Number(recentNotifs[0]?.count ?? 0),
        fundingSnapshots: Number(recentFunding[0]?.count ?? 0),
        liquidationSnapshots: Number(recentLiqs[0]?.count ?? 0),
      },
      trends: {
        alerts: toArr(trendAlerts),
        funding: toArr(trendFunding),
        oi: toArr(trendOI),
        liquidations: toArr(trendLiqs),
      },
      users: {
        tiers: (tierMix as any[]).map(r => ({ tier: String(r.tier), count: Number(r.count) })),
        roles: (roleMix as any[]).map(r => ({ role: String(r.role), count: Number(r.count) })),
        verified: (verifiedMix as any[]).reduce((acc, r) => {
          acc[r.verified ? 'verified' : 'unverified'] = Number(r.count);
          return acc;
        }, { verified: 0, unverified: 0 } as Record<string, number>),
        signups: {
          last7d:  Number(signups7d[0]?.count  ?? 0),
          last30d: Number(signups30d[0]?.count ?? 0),
          last90d: Number(signups90d[0]?.count ?? 0),
        },
        recent: (recentSignups as any[]).map(r => ({
          id: String(r.id),
          email: r.email ? String(r.email) : null,
          name: r.name ? String(r.name) : null,
          createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
          tier: r.billing_tier ? String(r.billing_tier) : 'free',
          role: r.role ? String(r.role) : 'user',
        })),
        active: {
          dau: Number((dauWauMau as any[])[0]?.dau ?? 0),
          wau: Number((dauWauMau as any[])[0]?.wau ?? 0),
          mau: Number((dauWauMau as any[])[0]?.mau ?? 0),
        },
      },
      retention: {
        d1:  pctRetention((retentionRows as any[])[0]?.d1_total,  (retentionRows as any[])[0]?.d1_retained),
        d7:  pctRetention((retentionRows as any[])[0]?.d7_total,  (retentionRows as any[])[0]?.d7_retained),
        d30: pctRetention((retentionRows as any[])[0]?.d30_total, (retentionRows as any[])[0]?.d30_retained),
      },
      engagement: {
        activeAlertsTotal: Number(alertsActive[0]?.count ?? 0),
        usersWithAlerts:   Number(alertsTotal[0]?.count  ?? 0),
        watchedWallets:    Number(watchedWallets[0]?.count   ?? 0),
        connectedKeys:     Number(connectedKeys[0]?.count    ?? 0),
        connectedWallets:  Number(connectedWallets[0]?.count ?? 0),
      },
      notifications: {
        byChannel: (notifsByChannel as any[]).map(r => ({ channel: String(r.channel), count: Number(r.count) })),
        sent:   Number((notifsSuccess as any[])[0]?.sent   ?? 0),
        failed: Number((notifsSuccess as any[])[0]?.failed ?? 0),
        total:  Number((notifsSuccess as any[])[0]?.total  ?? 0),
      },
      affiliate: {
        referredUsers:     Number(referredUsers[0]?.count    ?? 0),
        payoutsConfigured: Number(payoutsConfigured[0]?.count ?? 0),
      },
      dbSize: dbSize[0]?.size ?? 'unknown',
    });
  } catch (e) {
    console.error('Admin stats error:', e);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}

/** Compute retention %, returning null when the cohort is empty (avoids
 *  the "0% retention" misread on a brand-new install with no qualifying
 *  cohort). The UI renders null as "—". */
function pctRetention(total: unknown, retained: unknown): { pct: number; total: number } | null {
  const t = Number(total ?? 0);
  const r = Number(retained ?? 0);
  if (!t) return null;
  return { pct: (r / t) * 100, total: t };
}
