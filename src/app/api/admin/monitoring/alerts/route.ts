/**
 * GET /api/admin/monitoring/alerts
 *
 * Returns alert system health metrics. Admin only.
 */

import { NextResponse } from 'next/server';
import { requireAdminOrAdvisor } from '@/lib/auth';
import { isDBConfigured, getAlertHealthMetrics } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'sin1';
export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await requireAdminOrAdvisor();
  if (denied) return denied;

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const metrics = await getAlertHealthMetrics();
    return NextResponse.json(metrics, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('Admin alert metrics error:', e);
    return NextResponse.json({ error: 'Failed to fetch alert metrics' }, { status: 500 });
  }
}
