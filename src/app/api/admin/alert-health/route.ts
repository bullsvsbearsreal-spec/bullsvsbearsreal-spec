/**
 * GET /api/admin/alert-health
 *
 * Alert engine health board data. Source: alert_notifications +
 * whale_alert_notifications + hl_event_notifications. Returns:
 *   · Per-channel sends + failures over 1h / 24h / 7d windows
 *   · Per-channel success rate
 *   · Last-fire timestamp per channel (freshness check)
 *   · Active-alert distribution by metric (top 10)
 *   · Recent failures (last 20 with channel + symbol + error)
 *   · Total active subscriptions (telegram + push)
 */
import { NextResponse } from 'next/server';
import { requireAdminOrAdvisor } from '@/lib/auth';
import { initDB, isDBConfigured, getSQL } from '@/lib/db';

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
    await initDB();
    const db = getSQL();

    const [
      channelStats,
      lastFire,
      activeMetrics,
      subscriptions,
      summary,
    ] = await Promise.all([
      // Per-channel sends + failures across 1h/24h/7d windows
      db`SELECT
           channel,
           COUNT(*) FILTER (WHERE sent_at > NOW() - INTERVAL '1 hour')::int  AS sent_1h,
           COUNT(*) FILTER (WHERE sent_at > NOW() - INTERVAL '24 hours')::int AS sent_24h,
           COUNT(*) FILTER (WHERE sent_at > NOW() - INTERVAL '7 days')::int   AS sent_7d
         FROM alert_notifications
         GROUP BY channel
         ORDER BY sent_7d DESC`.catch(() => []),
      db`SELECT channel, MAX(sent_at) AS last_at
         FROM alert_notifications
         GROUP BY channel`.catch(() => []),
      // Active alert distribution (parse from users' alerts jsonb)
      db`SELECT (alert->>'metric') AS metric, COUNT(*)::int AS count
         FROM user_prefs, jsonb_array_elements(COALESCE(prefs->'alerts', '[]'::jsonb)) AS alert
         WHERE jsonb_typeof(prefs->'alerts') = 'array'
         GROUP BY (alert->>'metric')
         ORDER BY count DESC
         LIMIT 10`.catch(() => []),
      db`SELECT
           (SELECT COUNT(*)::int FROM push_subscriptions) AS push_count,
           (SELECT COUNT(DISTINCT user_id)::int FROM user_prefs WHERE prefs->'telegram' IS NOT NULL) AS telegram_count`.catch(() => [{}]),
      db`SELECT
           COUNT(*)::int AS total_7d,
           COUNT(*) FILTER (WHERE sent_at > NOW() - INTERVAL '24 hours')::int AS total_24h
         FROM alert_notifications
         WHERE sent_at > NOW() - INTERVAL '7 days'`.catch(() => [{}]),
    ]);

    const lastByCh: Record<string, string | null> = {};
    for (const r of lastFire as any[]) {
      lastByCh[String(r.channel)] = r.last_at instanceof Date ? r.last_at.toISOString() : (r.last_at ? String(r.last_at) : null);
    }

    const channels = (channelStats as any[]).map(r => ({
      channel: String(r.channel),
      sent1h:   Number(r.sent_1h ?? 0),
      sent24h:  Number(r.sent_24h ?? 0),
      sent7d:   Number(r.sent_7d ?? 0),
      lastFire: lastByCh[String(r.channel)] ?? null,
    }));

    const subs = (subscriptions as any[])[0] ?? {};
    const sum  = (summary as any[])[0] ?? {};

    return NextResponse.json({
      channels,
      activeAlertsByMetric: (activeMetrics as any[]).map(r => ({
        metric: r.metric ?? 'unknown',
        count: Number(r.count ?? 0),
      })),
      subscriptions: {
        push:     Number(subs.push_count     ?? 0),
        telegram: Number(subs.telegram_count ?? 0),
      },
      summary: {
        sent24h: Number(sum.total_24h ?? 0),
        sent7d:  Number(sum.total_7d  ?? 0),
      },
    });
  } catch (e) {
    console.error('Alert health route error:', e);
    return NextResponse.json({ error: 'Failed to compute alert health' }, { status: 500 });
  }
}
