/**
 * GET /api/user/stats
 *
 * Returns account summary stats for the logged-in user:
 * memberSince, watchlist/alert/portfolio counts, recent notifications, connected providers.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  isDBConfigured,
  getUserData,
  getUserCreatedAt,
  getRecentAlertNotifications,
  getUserConnectedProviders,
} from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const userId = session.user.id;

  const [userData, memberSince, recentNotifications, connectedProviders] = await Promise.all([
    getUserData(userId),
    getUserCreatedAt(userId),
    getRecentAlertNotifications(userId, 10),
    getUserConnectedProviders(userId),
  ]);

  const watchlistCount = Array.isArray(userData?.watchlist) ? userData.watchlist.length : 0;
  const alertCount = Array.isArray(userData?.alerts)
    ? userData.alerts.filter((a: Record<string, unknown>) => a.enabled).length
    : 0;
  const portfolioCount = Array.isArray(userData?.portfolio) ? userData.portfolio.length : 0;

  return NextResponse.json({
    memberSince,
    watchlistCount,
    alertCount,
    portfolioCount,
    connectedProviders,
    recentNotifications,
  });
}
