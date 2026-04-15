/**
 * GET /api/admin/monitoring/workers
 *
 * Returns worker/cron heartbeat status.
 * Admin only (session or ADMIN_API_KEY).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrAdvisor } from '@/lib/auth';
import { isDBConfigured, initDB, getWorkerHeartbeats } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

const ADMIN_API_KEY = (process.env.ADMIN_API_KEY || '').trim();

export async function GET(request: NextRequest) {
  // Auth: admin session OR API key
  const apiKey = request.headers.get('x-api-key') || request.nextUrl.searchParams.get('key');
  const keyMatch = apiKey && ADMIN_API_KEY && apiKey.length === ADMIN_API_KEY.length
    && require('crypto').timingSafeEqual(Buffer.from(apiKey), Buffer.from(ADMIN_API_KEY));
  if (keyMatch) {
    // authorized via API key (timing-safe comparison)
  } else {
    const authResult = await requireAdminOrAdvisor();
    if (authResult) return authResult;
  }

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  await initDB();
  const heartbeats = await getWorkerHeartbeats(15);

  const healthy = heartbeats.filter(h => !h.stale).length;
  const stale = heartbeats.filter(h => h.stale).length;

  return NextResponse.json({
    ok: true,
    summary: { total: heartbeats.length, healthy, stale },
    workers: heartbeats,
  });
}
