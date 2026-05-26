/**
 * GET /api/admin/affiliates
 *
 * Admin-only endpoint surfacing the full affiliate program: headline
 * counters, top affiliates by signups + by commission, and recent
 * activity. Pure read — no writes; safe to call as often as the
 * dashboard polls.
 *
 * Auth: requireAdmin (re-checks DB on every call to defeat stale JWT).
 */
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { initDB, isDBConfigured, getAdminAffiliateOverview } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET() {
  const adminErr = await requireAdmin();
  if (adminErr) return adminErr;
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'DB unavailable' }, { status: 503, headers: NO_STORE });
  }
  await initDB();
  const overview = await getAdminAffiliateOverview();
  return NextResponse.json(overview, { headers: NO_STORE });
}
