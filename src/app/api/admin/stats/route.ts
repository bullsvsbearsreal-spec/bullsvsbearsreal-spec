/**
 * GET /api/admin/stats
 *
 * Returns site-wide metrics. Admin only.
 */

import { NextResponse } from 'next/server';
import { requireAdminOrAdvisor } from '@/lib/auth';
import { isDBConfigured } from '@/lib/db';
import postgres from 'postgres';

export const runtime = 'nodejs';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';

const DATABASE_URL = process.env.DATABASE_URL || '';
let sql: ReturnType<typeof postgres> | null = null;
function getSQL() {
  if (!sql) sql = postgres(DATABASE_URL, { max: 5, idle_timeout: 20, ssl: 'require' });
  return sql;
}

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

    // Recent activity (last 24h) + 7-day trends
    const [recentNotifs, recentFunding, recentLiqs, trendAlerts, trendFunding, trendOI, trendLiqs] = await Promise.all([
      db`SELECT COUNT(*) as count FROM alert_notifications WHERE sent_at > NOW() - INTERVAL '24 hours'`,
      db`SELECT COUNT(*) as count FROM funding_snapshots WHERE ts > NOW() - INTERVAL '24 hours'`,
      db`SELECT COUNT(*) as count FROM liquidation_snapshots WHERE ts > NOW() - INTERVAL '24 hours'`,
      // 7-day daily counts for sparklines
      db`SELECT d::date as day, COALESCE(c, 0) as count FROM generate_series(NOW() - INTERVAL '6 days', NOW(), '1 day') d LEFT JOIN LATERAL (SELECT COUNT(*) as c FROM alert_notifications WHERE sent_at::date = d::date) x ON true ORDER BY d`,
      db`SELECT d::date as day, COALESCE(c, 0) as count FROM generate_series(NOW() - INTERVAL '6 days', NOW(), '1 day') d LEFT JOIN LATERAL (SELECT COUNT(*) as c FROM funding_snapshots WHERE ts::date = d::date) x ON true ORDER BY d`,
      db`SELECT d::date as day, COALESCE(c, 0) as count FROM generate_series(NOW() - INTERVAL '6 days', NOW(), '1 day') d LEFT JOIN LATERAL (SELECT COUNT(*) as c FROM oi_snapshots WHERE ts::date = d::date) x ON true ORDER BY d`,
      db`SELECT d::date as day, COALESCE(c, 0) as count FROM generate_series(NOW() - INTERVAL '6 days', NOW(), '1 day') d LEFT JOIN LATERAL (SELECT COUNT(*) as c FROM liquidation_snapshots WHERE ts::date = d::date) x ON true ORDER BY d`,
    ]);

    const toArr = (rows: any[]) => rows.map((r: any) => Number(r.count));

    return NextResponse.json({
      totals: {
        users: Number(userCount[0].count),
        alertNotifications: Number(alertNotifCount[0].count),
        fundingSnapshots: Number(fundingRows[0].count),
        oiSnapshots: Number(oiRows[0].count),
        liquidationSnapshots: Number(liqRows[0].count),
        telegramUsers: Number(telegramUsers[0].count),
        pushSubscriptions: Number(pushSubs[0].count),
      },
      last24h: {
        alertNotifications: Number(recentNotifs[0].count),
        fundingSnapshots: Number(recentFunding[0].count),
        liquidationSnapshots: Number(recentLiqs[0].count),
      },
      trends: {
        alerts: toArr(trendAlerts),
        funding: toArr(trendFunding),
        oi: toArr(trendOI),
        liquidations: toArr(trendLiqs),
      },
      dbSize: dbSize[0].size,
    });
  } catch (e) {
    console.error('Admin stats error:', e);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
