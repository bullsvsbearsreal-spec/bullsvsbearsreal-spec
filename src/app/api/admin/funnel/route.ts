/**
 * GET /api/admin/funnel
 *
 * Activation funnel — Signup → Verified → First alert → Connected.
 * Returns steps with absolute count + % of top + % of immediately
 * previous step so the UI can render either funnel style without
 * recomputing.
 */
import { NextResponse } from 'next/server';
import { requireAdminOrAdvisor } from '@/lib/auth';
import { initDB, isDBConfigured, getActivationFunnel } from '@/lib/db';

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
    // initDB is idempotent (cached via initPromise). Ensures the new
    // users.suspended_at column + page_views table exist before any
    // query references them — critical on cold-start after this build.
    await initDB();
    const f = await getActivationFunnel();
    const steps = [
      { key: 'signedUp',     label: 'Signed up',         count: f.signedUp     },
      { key: 'verified',     label: 'Email verified',    count: f.verified     },
      { key: 'alertCreated', label: 'Created an alert',  count: f.alertCreated },
      { key: 'connected',    label: 'Connected key/wallet', count: f.connected },
    ];

    const top = steps[0].count;
    let prev = top;
    const out = steps.map(s => {
      const pctOfTop  = top  > 0 ? (s.count / top)  * 100 : 0;
      const pctOfPrev = prev > 0 ? (s.count / prev) * 100 : 0;
      prev = s.count;
      return { ...s, pctOfTop, pctOfPrev };
    });

    return NextResponse.json({ steps: out });
  } catch (e) {
    console.error('Admin funnel error:', e);
    return NextResponse.json({ error: 'Failed to compute funnel' }, { status: 500 });
  }
}
