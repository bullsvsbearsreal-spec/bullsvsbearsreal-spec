/**
 * /api/support/my-tickets
 *
 * Customer-side endpoint for the InfoHub support chat widget.
 *
 * GET  — return the calling user's own tickets, newest first. No support-
 *        staff gating; just standard auth.
 * POST — create a new ticket on the user's own account. Body:
 *        { subject, body, priority? }
 *
 * Separate from /api/support/tickets (which is requireSupport-gated)
 * so the customer side never accidentally bleeds into the operator
 * tools surface.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth, verifySameOrigin } from '@/lib/auth';
import { initDB, isDBConfigured, getSQL, recordAuditEvent } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

const MAX_SUBJECT_LEN = 200;
const MAX_BODY_LEN = 10_000;
const VALID_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isDBConfigured()) return NextResponse.json({ tickets: [] });

  await initDB();
  const db = getSQL();
  try {
    const rows = await db`
      SELECT t.id, t.subject, t.status, t.priority, t.assignee_user_id,
             t.created_at, t.updated_at, t.resolved_at,
             a.name AS assignee_name,
             (SELECT COUNT(*)::int FROM support_ticket_messages m
                WHERE m.ticket_id = t.id AND m.is_internal = false) AS reply_count,
             (SELECT MAX(created_at) FROM support_ticket_messages m
                WHERE m.ticket_id = t.id AND m.is_internal = false) AS last_reply_at
      FROM support_tickets t
      LEFT JOIN users a ON a.id = t.assignee_user_id
      WHERE t.user_id = ${session.user.id}
      ORDER BY t.updated_at DESC
      LIMIT 50
    ` as any[];
    return NextResponse.json({
      tickets: rows.map(r => ({
        id: Number(r.id),
        subject: r.subject,
        status: r.status,
        priority: r.priority,
        hasAssignee: !!r.assignee_user_id,
        assigneeName: r.assignee_name,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        resolvedAt: r.resolved_at,
        replyCount: Number(r.reply_count) || 0,
        lastReplyAt: r.last_reply_at,
      })),
    });
  } catch (e) {
    console.warn('my-tickets list failed:', e);
    return NextResponse.json({ tickets: [], error: 'query_failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const originErr = verifySameOrigin(request);
  if (originErr) return originErr;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'DB not configured' }, { status: 503 });
  }

  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const subject = typeof body?.subject === 'string' ? body.subject.trim().slice(0, MAX_SUBJECT_LEN) : '';
  const messageBody = typeof body?.body === 'string' ? body.body.trim().slice(0, MAX_BODY_LEN) : '';
  const priority = typeof body?.priority === 'string' && VALID_PRIORITIES.includes(body.priority as any)
    ? body.priority : 'normal';
  if (!subject || !messageBody) {
    return NextResponse.json({ error: 'subject and body are required' }, { status: 400 });
  }

  await initDB();
  const db = getSQL();
  try {
    const rows = await db`
      INSERT INTO support_tickets (user_id, subject, body, priority)
      VALUES (${session.user.id}, ${subject}, ${messageBody}, ${priority})
      RETURNING id, created_at
    ` as Array<{ id: number; created_at: string }>;
    await recordAuditEvent('support_ticket_created', {
      ticketId: Number(rows[0].id),
      actorId: session.user.id,
      actorEmail: session?.user?.email ?? null,
      targetUserId: session.user.id,
      via: 'support-chat',
      subject,
      priority,
    }).catch(e => console.warn('audit log failed:', e));
    return NextResponse.json({ id: Number(rows[0].id), createdAt: rows[0].created_at }, { status: 201 });
  } catch (e) {
    console.warn('my-ticket insert failed:', e);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
