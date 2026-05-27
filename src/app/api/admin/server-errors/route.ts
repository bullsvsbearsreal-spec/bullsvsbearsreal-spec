/**
 * GET /api/admin/server-errors?minutes=60&limit=50
 *
 * Returns recent server-error events captured by withErrorCapture /
 * recordServerError (lib/error-capture.ts). Source: admin_monitoring
 * where metric LIKE 'server_error:%'.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrAdvisor } from '@/lib/auth';
import { initDB, isDBConfigured, getSQL } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const denied = await requireAdminOrAdvisor();
  if (denied) return denied;
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const rawMin = parseInt(request.nextUrl.searchParams.get('minutes') || '60', 10);
  const minutes = Number.isFinite(rawMin) && rawMin > 0 ? Math.min(rawMin, 1440) : 60;
  const rawLimit = parseInt(request.nextUrl.searchParams.get('limit') || '50', 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;

  try {
    await initDB();
    const db = getSQL();
    const interval = `${minutes} minutes`;
    const [rows, summary] = await Promise.all([
      db`
        SELECT id, metric, details, recorded_at
          FROM admin_monitoring
         WHERE metric LIKE 'server_error:%'
           AND recorded_at > NOW() - ${interval}::interval
         ORDER BY recorded_at DESC
         LIMIT ${limit}
      `,
      db`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE recorded_at > NOW() - INTERVAL '1 minute')::int AS last_1m,
          COUNT(*) FILTER (WHERE recorded_at > NOW() - INTERVAL '5 minutes')::int AS last_5m
          FROM admin_monitoring
         WHERE metric LIKE 'server_error:%'
           AND recorded_at > NOW() - ${interval}::interval
      `,
    ]);

    return NextResponse.json({
      errors: (rows as any[]).map(r => {
        const d = (r.details ?? {}) as Record<string, unknown>;
        return {
          id: Number(r.id),
          route: String(d.route ?? r.metric).slice(0, 200),
          message: String(d.message ?? '').slice(0, 500),
          stack: typeof d.stack === 'string' ? d.stack.slice(0, 800) : null,
          timestamp: r.recorded_at instanceof Date ? r.recorded_at.toISOString() : String(r.recorded_at),
        };
      }),
      summary: {
        windowMin: minutes,
        total: Number((summary as any[])[0]?.total ?? 0),
        last1m: Number((summary as any[])[0]?.last_1m ?? 0),
        last5m: Number((summary as any[])[0]?.last_5m ?? 0),
      },
    });
  } catch (e) {
    console.error('Server-errors route error:', e);
    return NextResponse.json({ error: 'Failed to load errors' }, { status: 500 });
  }
}
