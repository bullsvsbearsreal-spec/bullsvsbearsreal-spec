import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrAdvisor } from '@/lib/auth';
import { getAuditLog, isDBConfigured } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/audit-log?limit=50&offset=0
 *
 * Returns the admin_monitoring audit tail. The new admin dashboard
 * consumes `entries[]` (friendlier shape with actorEmail / actorName
 * pulled from details). Older callers can still read `events[]` which
 * preserves the raw {id,type,details,timestamp} from the DB helper.
 */
export async function GET(request: NextRequest) {
  const adminErr = await requireAdminOrAdvisor();
  if (adminErr) return adminErr;

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const url = new URL(request.url);
    const rawLimit  = parseInt(url.searchParams.get('limit')  || '50', 10);
    const rawOffset = parseInt(url.searchParams.get('offset') || '0',  10);
    const limit  = Number.isFinite(rawLimit)  && rawLimit  > 0 ? Math.min(rawLimit, 200) : 50;
    const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.min(rawOffset, 10_000) : 0;
    const events = await getAuditLog(limit, offset);

    // Map to the dashboard's friendlier shape. The historic convention
    // is `details.admin` for the actor email — surface it as actorEmail
    // so the UI doesn't have to special-case every audit type.
    const entries = events.map(e => {
      const d = (e.details ?? {}) as Record<string, unknown>;
      const actorEmail = typeof d.admin === 'string' ? d.admin as string
                       : typeof d.actorEmail === 'string' ? d.actorEmail as string
                       : typeof d.email === 'string' ? d.email as string  // auth_signin/signout uses `email`
                       : null;
      const actorName  = typeof d.actorName === 'string' ? d.actorName as string : null;
      return {
        id: String(e.id),
        action: e.type,
        actorEmail,
        actorName,
        timestamp: e.timestamp,
        metadata: e.details,
      };
    });

    return NextResponse.json({ events, entries });
  } catch (e) {
    console.error('Audit log error:', e);
    return NextResponse.json({ error: 'Failed to fetch audit log' }, { status: 500 });
  }
}
