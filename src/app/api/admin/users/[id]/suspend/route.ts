/**
 * /api/admin/users/[id]/suspend
 *
 *   POST   body: { reason: string }  → suspend (sets suspended_at = NOW())
 *   DELETE body: { reason: string }  → unsuspend (clears suspended_at)
 *
 * Both require a non-empty reason for the audit trail and write an
 * audit_log entry. Admin only; self-suspension is blocked.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, verifySameOrigin, auth } from '@/lib/auth';
import { isDBConfigured, suspendUser, unsuspendUser, recordAuditEvent, getSQL } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

async function readReason(request: NextRequest): Promise<string | null> {
  try {
    const body = await request.json();
    const r = typeof body?.reason === 'string' ? body.reason.trim() : '';
    return r ? r : null;
  } catch {
    return null;
  }
}

async function preflight(request: NextRequest, id: string): Promise<Response | { session: any; reason: string; email: string | null }> {
  const originErr = verifySameOrigin(request);
  if (originErr) return originErr;
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  const session = await auth();
  if (id === session?.user?.id) {
    return NextResponse.json({ error: 'Cannot suspend yourself' }, { status: 403 });
  }
  const reason = await readReason(request);
  if (!reason) {
    return NextResponse.json({ error: 'reason is required (audit trail)' }, { status: 400 });
  }
  // Pull email for audit (no-op if user already gone)
  const db = getSQL();
  const rows = await db`SELECT email FROM users WHERE id = ${id} LIMIT 1`;
  const email = (rows[0]?.email as string | undefined) ?? null;
  return { session, reason, email };
}

function isHttpResponse(v: unknown): v is Response {
  return v instanceof Response;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const pre = await preflight(request, id);
  if (isHttpResponse(pre)) return pre;
  const { session, reason, email } = pre;

  const ok = await suspendUser(id);
  if (!ok) {
    return NextResponse.json({ error: 'User not found or already suspended' }, { status: 404 });
  }
  await recordAuditEvent('admin_suspend_user', {
    actorId: session?.user?.id ?? null,
    admin: session?.user?.email ?? null,
    actorEmail: session?.user?.email ?? null,
    targetUserId: id,
    targetEmail: email,
    reason,
  }).catch(e => console.warn('audit log failed:', e));

  return NextResponse.json({ suspended: true, reason });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const pre = await preflight(request, id);
  if (isHttpResponse(pre)) return pre;
  const { session, reason, email } = pre;

  const ok = await unsuspendUser(id);
  if (!ok) {
    return NextResponse.json({ error: 'User not found or not suspended' }, { status: 404 });
  }
  await recordAuditEvent('admin_unsuspend_user', {
    actorId: session?.user?.id ?? null,
    admin: session?.user?.email ?? null,
    actorEmail: session?.user?.email ?? null,
    targetUserId: id,
    targetEmail: email,
    reason,
  }).catch(e => console.warn('audit log failed:', e));

  return NextResponse.json({ suspended: false, reason });
}
