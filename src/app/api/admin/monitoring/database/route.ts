/**
 * GET /api/admin/monitoring/database
 *
 * Returns DB size, table stats, and growth rates. Admin only.
 */

import { NextResponse } from 'next/server';
import { requireAdminOrAdvisor } from '@/lib/auth';
import { isDBConfigured, getDatabaseMetrics } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await requireAdminOrAdvisor();
  if (denied) return denied;

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const metrics = await getDatabaseMetrics();
    return NextResponse.json(metrics, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('Admin database metrics error:', e);
    return NextResponse.json({ error: 'Failed to fetch database metrics' }, { status: 500 });
  }
}
