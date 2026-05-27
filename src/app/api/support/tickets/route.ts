/**
 * /api/support/tickets
 *
 * GET — list tickets. Optional filters:
 *   ?status=open|claimed|resolved|wontfix|all   (default: open + claimed)
 *   ?mine=1                                     (only tickets I own)
 * Returns rows with denormalised user email/name + assignee email for
 * the UI table.
 *
 * POST — create a ticket. Customer-facing path: a logged-in user files
 *   a ticket against themselves. Mods can also file on behalf of a
 *   specific user by passing { userId } (admin/mod-only escalation).
 *   Body: { subject, body, userId?, priority? }
 *
 * Gated by requireSupport for GET (support|mod|admin|owner). POST is
 * looser — any authenticated user can file their own ticket; mod role
 * required to file on another user's behalf.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth, verifySameOrigin, requireSupport, getUserRole } from '@/lib/auth';
import { initDB, isDBConfigured, getSQL, recordAuditEvent } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['open', 'claimed', 'resolved', 'wontfix'] as const;
const VALID_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
const MAX_SUBJECT_LEN = 200;
const MAX_BODY_LEN = 10_000;

export async function GET(request: NextRequest) {
  const denied = await requireSupport();
  if (denied) return denied;
  if (!isDBConfigured()) return NextResponse.json({ tickets: [] });

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status');
  const mineOnly = searchParams.get('mine') === '1';

  await initDB();
  const db = getSQL();
  const session = await auth();
  const me = session?.user?.id ?? null;

  // Build a single SELECT with optional WHERE branches. postgres.js
  // doesn't compose conditional SQL well, so split into 4 paths.
  let rows: any[] = [];
  try {
    const mineId = me;
    if (mineOnly && mineId && statusFilter && VALID_STATUSES.includes(statusFilter as any)) {
      rows = await db`
        SELECT t.id, t.user_id, t.subject, t.body, t.status, t.priority,
               t.assignee_user_id, t.claimed_at, t.resolved_at, t.created_at, t.updated_at,
               u.email AS user_email, u.name AS user_name,
               a.email AS assignee_email, a.name AS assignee_name
        FROM support_tickets t
        LEFT JOIN users u ON u.id = t.user_id
        LEFT JOIN users a ON a.id = t.assignee_user_id
        WHERE t.assignee_user_id = ${mineId} AND t.status = ${statusFilter}
        ORDER BY t.created_at DESC
        LIMIT 200
      ` as any[];
    } else if (mineOnly && mineId) {
      rows = await db`
        SELECT t.id, t.user_id, t.subject, t.body, t.status, t.priority,
               t.assignee_user_id, t.claimed_at, t.resolved_at, t.created_at, t.updated_at,
               u.email AS user_email, u.name AS user_name,
               a.email AS assignee_email, a.name AS assignee_name
        FROM support_tickets t
        LEFT JOIN users u ON u.id = t.user_id
        LEFT JOIN users a ON a.id = t.assignee_user_id
        WHERE t.assignee_user_id = ${mineId}
        ORDER BY t.created_at DESC
        LIMIT 200
      ` as any[];
    } else if (statusFilter && VALID_STATUSES.includes(statusFilter as any)) {
      rows = await db`
        SELECT t.id, t.user_id, t.subject, t.body, t.status, t.priority,
               t.assignee_user_id, t.claimed_at, t.resolved_at, t.created_at, t.updated_at,
               u.email AS user_email, u.name AS user_name,
               a.email AS assignee_email, a.name AS assignee_name
        FROM support_tickets t
        LEFT JOIN users u ON u.id = t.user_id
        LEFT JOIN users a ON a.id = t.assignee_user_id
        WHERE t.status = ${statusFilter}
        ORDER BY t.created_at DESC
        LIMIT 200
      ` as any[];
    } else if (statusFilter === 'all') {
      rows = await db`
        SELECT t.id, t.user_id, t.subject, t.body, t.status, t.priority,
               t.assignee_user_id, t.claimed_at, t.resolved_at, t.created_at, t.updated_at,
               u.email AS user_email, u.name AS user_name,
               a.email AS assignee_email, a.name AS assignee_name
        FROM support_tickets t
        LEFT JOIN users u ON u.id = t.user_id
        LEFT JOIN users a ON a.id = t.assignee_user_id
        ORDER BY t.created_at DESC
        LIMIT 200
      ` as any[];
    } else {
      // Default: open + claimed (i.e. anything not resolved/wontfix)
      rows = await db`
        SELECT t.id, t.user_id, t.subject, t.body, t.status, t.priority,
               t.assignee_user_id, t.claimed_at, t.resolved_at, t.created_at, t.updated_at,
               u.email AS user_email, u.name AS user_name,
               a.email AS assignee_email, a.name AS assignee_name
        FROM support_tickets t
        LEFT JOIN users u ON u.id = t.user_id
        LEFT JOIN users a ON a.id = t.assignee_user_id
        WHERE t.status IN ('open', 'claimed')
        ORDER BY
          CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
          t.created_at ASC
        LIMIT 200
      ` as any[];
    }
  } catch (e) {
    console.warn('support tickets list query failed:', e);
    return NextResponse.json({ tickets: [], error: 'query_failed' }, { status: 500 });
  }

  // Counts by status for the queue header
  let counts: Record<string, number> = {};
  try {
    const c = await db`
      SELECT status, COUNT(*)::int AS n FROM support_tickets GROUP BY status
    ` as Array<{ status: string; n: number }>;
    counts = Object.fromEntries(c.map(r => [r.status, r.n]));
  } catch { /* swallow */ }

  return NextResponse.json({
    tickets: rows.map(r => ({
      id: Number(r.id),
      userId: r.user_id,
      userEmail: r.user_email,
      userName: r.user_name,
      subject: r.subject,
      body: r.body,
      status: r.status,
      priority: r.priority,
      assigneeId: r.assignee_user_id,
      assigneeEmail: r.assignee_email,
      assigneeName: r.assignee_name,
      claimedAt: r.claimed_at,
      resolvedAt: r.resolved_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
    counts,
  });
}

export async function POST(request: NextRequest) {
  const originErr = verifySameOrigin(request);
  if (originErr) return originErr;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const subject = typeof body?.subject === 'string' ? body.subject.trim().slice(0, MAX_SUBJECT_LEN) : '';
  const messageBody = typeof body?.body === 'string' ? body.body.trim().slice(0, MAX_BODY_LEN) : '';
  const priority = typeof body?.priority === 'string' && VALID_PRIORITIES.includes(body.priority as any)
    ? body.priority
    : 'normal';
  let targetUserId = session.user.id;

  if (!subject || !messageBody) {
    return NextResponse.json({ error: 'subject and body are required' }, { status: 400 });
  }

  // Mod-only escalation: file on someone else's behalf.
  if (typeof body?.userId === 'string' && body.userId !== session.user.id) {
    const callerRole = await getUserRole(session.user.id);
    if (callerRole !== 'support' && callerRole !== 'moderator' && callerRole !== 'admin' && callerRole !== 'owner') {
      return NextResponse.json({ error: 'Only support/mod can file on another user\'s behalf' }, { status: 403 });
    }
    targetUserId = body.userId;
  }

  await initDB();
  const db = getSQL();
  try {
    const rows = await db`
      INSERT INTO support_tickets (user_id, subject, body, priority)
      VALUES (${targetUserId}, ${subject}, ${messageBody}, ${priority})
      RETURNING id, created_at
    ` as Array<{ id: number; created_at: string }>;

    await recordAuditEvent('support_ticket_created', {
      ticketId: Number(rows[0].id),
      actorId: session.user.id,
      actorEmail: session?.user?.email ?? null,
      targetUserId,
      subject,
      priority,
    }).catch(e => console.warn('audit log failed:', e));

    return NextResponse.json({
      id: Number(rows[0].id),
      createdAt: rows[0].created_at,
    }, { status: 201 });
  } catch (e) {
    console.warn('support ticket insert failed:', e);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
