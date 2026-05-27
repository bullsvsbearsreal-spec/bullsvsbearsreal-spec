/**
 * GET /api/admin/audit-log/csv
 *
 * CSV export of the full admin_monitoring audit tail. Used by the Ops
 * tab "Download audit log" link. Caps at 5000 rows — anything older
 * lives in the table and can still be queried in the DB directly.
 */
import { NextResponse } from 'next/server';
import { requireAdminOrAdvisor } from '@/lib/auth';
import { isDBConfigured, getAuditLog } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

function csvEsc(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'string' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const denied = await requireAdminOrAdvisor();
  if (denied) return denied;
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const events = await getAuditLog(5000, 0);
    const headers = ['id', 'action', 'actor_email', 'target_email', 'target_user_id', 'reason', 'timestamp', 'details_json'];
    const lines = [headers.join(',')];
    for (const e of events) {
      const d = (e.details ?? {}) as Record<string, unknown>;
      lines.push([
        e.id,
        e.type,
        d.admin ?? d.actorEmail ?? '',
        d.targetEmail ?? '',
        d.targetUserId ?? '',
        d.reason ?? '',
        e.timestamp,
        e.details,
      ].map(csvEsc).join(','));
    }
    const csv = lines.join('\n');
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="infohub-audit-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('Audit CSV export error:', e);
    return NextResponse.json({ error: 'Failed to export audit log' }, { status: 500 });
  }
}
