/**
 * GET /api/admin/users
 *
 * Returns all users with account stats. Admin only.
 */

import { NextResponse } from 'next/server';
import { requireAdminOrAdvisor } from '@/lib/auth';
import { isDBConfigured } from '@/lib/db';
import postgres from 'postgres';

export const runtime = 'nodejs';
export const preferredRegion = 'sin1';
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
    const users = await db`
      SELECT
        u.id,
        u.name,
        u.email,
        u.image,
        u.email_verified,
        COALESCE(u.role, 'user') as role,
        (SELECT COUNT(*) FROM accounts a WHERE a.user_id = u.id) as provider_count,
        (SELECT prefs->'watchlist' FROM user_prefs WHERE user_id = u.id) as watchlist,
        (SELECT prefs->'alerts' FROM user_prefs WHERE user_id = u.id) as alerts,
        (SELECT prefs->'portfolio' FROM user_prefs WHERE user_id = u.id) as portfolio,
        (SELECT COUNT(*) FROM alert_notifications an WHERE an.user_id = u.id) as notifications_sent
      FROM users u
      ORDER BY u.email_verified DESC NULLS LAST, u.email
    `;

    const result = users.map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      image: u.image,
      emailVerified: u.email_verified,
      role: u.role,
      providerCount: Number(u.provider_count),
      watchlistCount: Array.isArray(u.watchlist) ? u.watchlist.length : 0,
      alertCount: Array.isArray(u.alerts) ? u.alerts.filter((a: any) => a.enabled).length : 0,
      portfolioCount: Array.isArray(u.portfolio) ? u.portfolio.length : 0,
      notificationsSent: Number(u.notifications_sent),
    }));

    return NextResponse.json({ users: result, count: result.length });
  } catch (e) {
    console.error('Admin users error:', e);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
