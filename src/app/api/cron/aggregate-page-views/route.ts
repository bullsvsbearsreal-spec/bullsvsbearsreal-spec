/**
 * Cron endpoint: prune old page_views rows + re-tighten indexes.
 *
 * Runs daily (suggested 02:00 UTC). page_views keeps 90d of data; older
 * rows are deleted to keep the table bounded. The route also returns a
 * small summary for the cron runner's logs.
 *
 * Security: CRON_SECRET Bearer token (same as every other /api/cron/*).
 */
import { NextRequest, NextResponse } from 'next/server';
import { isDBConfigured, prunePageViews, recordAuditEvent } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const { verifyCronAuth } = await import('../_auth');
  const authErr = verifyCronAuth(request);
  if (authErr) return authErr;

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const startedAt = Date.now();
  const pruned = await prunePageViews(90);
  const elapsedMs = Date.now() - startedAt;

  await recordAuditEvent('cron_aggregate_page_views', { pruned, elapsedMs }).catch(() => {});

  return NextResponse.json({ success: true, pruned, elapsedMs });
}
