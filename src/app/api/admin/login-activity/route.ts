/**
 * GET /api/admin/login-activity?limit=30
 *
 * Returns recent sign-in / sign-out audit events written by the
 * NextAuth events.signIn / events.signOut callbacks. Newest first.
 *
 * Source: admin_monitoring where metric IN ('audit_auth_signin',
 * 'audit_auth_signout'). Joins users for the most-recent email lookup
 * in case the audit row's email was stale.
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

  const raw = parseInt(request.nextUrl.searchParams.get('limit') || '30', 10);
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 200) : 30;
  // Per-user filter — admin user drawer pulls a single user's history.
  // Cheap to filter inline: details->>'userId' is a JSON path and the
  // matching set is tiny.
  const userIdFilter = request.nextUrl.searchParams.get('userId');

  try {
    await initDB();
    const db = getSQL();
    const rows = userIdFilter
      ? await db`
          SELECT m.id, m.metric, m.details, m.recorded_at
            FROM admin_monitoring m
           WHERE m.metric IN ('audit_auth_signin', 'audit_auth_signout')
             AND m.details->>'userId' = ${userIdFilter}
             AND m.recorded_at > NOW() - INTERVAL '90 days'
           ORDER BY m.recorded_at DESC
           LIMIT ${limit}
        `
      : await db`
          SELECT m.id, m.metric, m.details, m.recorded_at
            FROM admin_monitoring m
           WHERE m.metric IN ('audit_auth_signin', 'audit_auth_signout')
             AND m.recorded_at > NOW() - INTERVAL '7 days'
           ORDER BY m.recorded_at DESC
           LIMIT ${limit}
        `;
    return NextResponse.json({
      events: (rows as any[]).map(r => {
        const d = (r.details ?? {}) as Record<string, unknown>;
        return {
          id: Number(r.id),
          kind: r.metric === 'audit_auth_signin' ? 'signin' : 'signout',
          userId: typeof d.userId === 'string' ? d.userId : null,
          email: typeof d.email === 'string' ? d.email : null,
          provider: typeof d.provider === 'string' ? d.provider : null,
          isNewUser: !!d.isNewUser,
          timestamp: r.recorded_at instanceof Date ? r.recorded_at.toISOString() : String(r.recorded_at),
        };
      }),
    });
  } catch (e) {
    console.error('Login-activity error:', e);
    return NextResponse.json({ error: 'Failed to load login activity' }, { status: 500 });
  }
}
