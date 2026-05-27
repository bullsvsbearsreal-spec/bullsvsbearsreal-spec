/**
 * GET /api/admin/users?limit=500
 *
 * Returns users with extended stats for the admin user-table tab.
 * Admin or advisor only.
 *
 * Extended in May 2026 to surface the columns the new admin dashboard
 * Users tab consumes:
 *   · billing_tier, role, suspended_at, last_seen, created_at, email_verified
 *   · alertCount             (jsonb array length on users.alerts)
 *   · watchedWalletsCount    (hl_watched_wallets per-user count)
 *   · connectedKeysCount     (user_exchange_keys per-user count)
 *   · connectedWalletsCount  (user_wallets per-user count)
 *   · notificationsSent      (alert_notifications per-user count, last 30d)
 *
 * Defaults to a 500-row cap (was 5000) because the new table renders all
 * rows client-side — past 500 the browser starts to feel sluggish. The
 * filter chips + search box do the narrowing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrAdvisor } from '@/lib/auth';
import { isDBConfigured, getSQL } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const denied = await requireAdminOrAdvisor();
  if (denied) return denied;

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const url = new URL(request.url);
    const rawLimit = parseInt(url.searchParams.get('limit') || '500', 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 5000) : 500;

    const db = getSQL();
    const users = await db`
      SELECT
        u.id, u.name, u.email, u.image,
        u.email_verified, u.created_at, u.last_seen, u.suspended_at,
        COALESCE(u.role, 'user')      AS role,
        COALESCE(u.billing_tier, 'free') AS billing_tier,
        u.referral_code, u.referred_by_user_id,
        (CASE WHEN jsonb_typeof(u.alerts) = 'array'
              THEN jsonb_array_length(u.alerts) ELSE 0 END) AS alert_count,
        (SELECT COUNT(*) FROM hl_watched_wallets w WHERE w.user_id = u.id) AS watched_wallets_count,
        (SELECT COUNT(*) FROM user_exchange_keys k WHERE k.user_id = u.id) AS connected_keys_count,
        (SELECT COUNT(*) FROM user_wallets w WHERE w.user_id = u.id)       AS connected_wallets_count,
        (SELECT COUNT(*) FROM alert_notifications an
           WHERE an.user_id = u.id AND an.sent_at > NOW() - INTERVAL '30 days') AS notifications_sent
      FROM users u
      ORDER BY u.created_at DESC NULLS LAST
      LIMIT ${limit}
    `;

    const result = users.map((u: any) => ({
      id: String(u.id),
      name: u.name ?? null,
      email: u.email ?? null,
      image: u.image ?? null,
      emailVerified: u.email_verified,
      createdAt: u.created_at instanceof Date ? u.created_at.toISOString() : u.created_at ? String(u.created_at) : null,
      lastSeen:  u.last_seen   instanceof Date ? u.last_seen.toISOString()   : u.last_seen   ? String(u.last_seen)   : null,
      suspendedAt: u.suspended_at instanceof Date ? u.suspended_at.toISOString() : u.suspended_at ? String(u.suspended_at) : null,
      role: u.role,
      billingTier: u.billing_tier,
      referralCode: u.referral_code ?? null,
      referredByUserId: u.referred_by_user_id ?? null,
      alertCount: Number(u.alert_count ?? 0),
      watchedWalletsCount: Number(u.watched_wallets_count ?? 0),
      connectedKeysCount: Number(u.connected_keys_count ?? 0),
      connectedWalletsCount: Number(u.connected_wallets_count ?? 0),
      notificationsSent: Number(u.notifications_sent ?? 0),
    }));

    return NextResponse.json({ users: result, count: result.length });
  } catch (e) {
    console.error('Admin users error:', e);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
