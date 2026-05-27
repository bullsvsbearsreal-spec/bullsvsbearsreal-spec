/**
 * GET /api/admin/cron-history?hours=24
 *
 * Returns the last-24h run record for every cron known to the
 * trigger-cron allowlist. Source: admin_monitoring rows whose metric
 * starts with `audit_trigger_cron:` (admin-triggered) plus the
 * `cron_aggregate_page_views` audit event the daily cron writes.
 *
 * Worker-heartbeat data is fetched separately by the Ops tab — this
 * endpoint is for the per-cron success-rate sparkline / last-N
 * outcomes drilldown.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrAdvisor } from '@/lib/auth';
import { initDB, isDBConfigured, getSQL } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

interface CronRun {
  ok: boolean;
  timestamp: string;
  durationMs?: number;
  trigger: 'manual' | 'scheduled';
  reason?: string;
  actorEmail?: string;
}

export async function GET(request: NextRequest) {
  const denied = await requireAdminOrAdvisor();
  if (denied) return denied;
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const rawHours = parseInt(request.nextUrl.searchParams.get('hours') || '24', 10);
  const hours = Number.isFinite(rawHours) && rawHours > 0 ? Math.min(rawHours, 168) : 24;

  try {
    await initDB();
    const db = getSQL();
    const interval = `${hours} hours`;
    // Pull every cron-related audit event in the window. Each row has
    // metric like 'audit_trigger_cron:snapshot' or 'audit_cron_<name>'.
    const rows = await db`
      SELECT id, metric, details, recorded_at
        FROM admin_monitoring
       WHERE (metric LIKE 'audit_trigger_cron:%' OR metric LIKE 'audit_cron_%')
         AND recorded_at > NOW() - ${interval}::interval
       ORDER BY recorded_at ASC
    `;

    // Group by cron id (the part after "trigger_cron:" or "cron_")
    const byCron: Record<string, CronRun[]> = {};
    for (const r of rows as any[]) {
      const m = String(r.metric);
      let cronId: string | null = null;
      let trigger: 'manual' | 'scheduled' = 'scheduled';
      if (m.startsWith('audit_trigger_cron:')) {
        cronId = m.slice('audit_trigger_cron:'.length);
        trigger = 'manual';
      } else if (m.startsWith('audit_cron_')) {
        cronId = m.slice('audit_cron_'.length);
        trigger = 'scheduled';
      }
      if (!cronId) continue;
      const d = (r.details ?? {}) as Record<string, unknown>;
      (byCron[cronId] ||= []).push({
        ok: typeof d.ok === 'boolean' ? d.ok : true,
        timestamp: r.recorded_at instanceof Date ? r.recorded_at.toISOString() : String(r.recorded_at),
        durationMs: typeof d.durationMs === 'number' ? d.durationMs : undefined,
        trigger,
        reason: typeof d.reason === 'string' ? d.reason : undefined,
        actorEmail: typeof d.actorEmail === 'string' ? d.actorEmail : typeof d.admin === 'string' ? d.admin as string : undefined,
      });
    }

    return NextResponse.json({
      hours,
      crons: Object.entries(byCron).map(([id, runs]) => {
        const ok = runs.filter(r => r.ok).length;
        const total = runs.length;
        return {
          id,
          total,
          ok,
          failed: total - ok,
          successRate: total > 0 ? ok / total : null,
          runs: runs.slice(-60), // last 60 runs (one row in UI)
        };
      }).sort((a, b) => a.id.localeCompare(b.id)),
    });
  } catch (e) {
    console.error('Cron history error:', e);
    return NextResponse.json({ error: 'Failed to load history' }, { status: 500 });
  }
}
