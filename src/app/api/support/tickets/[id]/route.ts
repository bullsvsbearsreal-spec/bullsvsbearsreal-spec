/**
 * /api/support/tickets/[id]
 *
 * GET   — single ticket + full message thread.
 * PATCH — update ticket state. Supported ops:
 *           { action: 'claim' }              → status=claimed, assignee=me
 *           { action: 'unclaim' }            → status=open, assignee=NULL
 *           { action: 'resolve' }            → status=resolved
 *           { action: 'reopen' }             → status=open, assignee=NULL
 *           { action: 'wontfix' }            → status=wontfix
 *           { action: 'priority', priority } → set priority
 *           { action: 'message', body, isInternal? } → append message
 *
 * All paths require requireSupport.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth, verifySameOrigin, requireSupport } from '@/lib/auth';
import { initDB, isDBConfigured, getSQL, recordAuditEvent } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

const VALID_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireSupport();
  if (denied) return denied;
  if (!isDBConfigured()) return NextResponse.json({ error: 'DB not configured' }, { status: 503 });

  const { id } = await params;
  const tid = Number(id);
  if (!Number.isFinite(tid)) {
    return NextResponse.json({ error: 'Invalid ticket id' }, { status: 400 });
  }

  await initDB();
  const db = getSQL();
  try {
    const ticketRows = await db`
      SELECT t.id, t.user_id, t.subject, t.body, t.status, t.priority,
             t.assignee_user_id, t.claimed_at, t.resolved_at, t.created_at, t.updated_at,
             u.email AS user_email, u.name AS user_name, u.role AS user_role,
             a.email AS assignee_email, a.name AS assignee_name
      FROM support_tickets t
      LEFT JOIN users u ON u.id = t.user_id
      LEFT JOIN users a ON a.id = t.assignee_user_id
      WHERE t.id = ${tid}
      LIMIT 1
    ` as any[];
    if (ticketRows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const msgs = await db`
      SELECT m.id, m.author_user_id, m.body, m.is_internal, m.created_at,
             u.email AS author_email, u.name AS author_name, u.role AS author_role
      FROM support_ticket_messages m
      LEFT JOIN users u ON u.id = m.author_user_id
      WHERE m.ticket_id = ${tid}
      ORDER BY m.created_at ASC
    ` as any[];
    const t = ticketRows[0];
    return NextResponse.json({
      ticket: {
        id: Number(t.id),
        userId: t.user_id,
        userEmail: t.user_email,
        userName: t.user_name,
        userRole: t.user_role,
        subject: t.subject,
        body: t.body,
        status: t.status,
        priority: t.priority,
        assigneeId: t.assignee_user_id,
        assigneeEmail: t.assignee_email,
        assigneeName: t.assignee_name,
        claimedAt: t.claimed_at,
        resolvedAt: t.resolved_at,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      },
      messages: msgs.map(m => ({
        id: Number(m.id),
        authorId: m.author_user_id,
        authorEmail: m.author_email,
        authorName: m.author_name,
        authorRole: m.author_role,
        body: m.body,
        isInternal: !!m.is_internal,
        createdAt: m.created_at,
      })),
    });
  } catch (e) {
    console.warn('ticket detail query failed:', e);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const originErr = verifySameOrigin(request);
  if (originErr) return originErr;
  const denied = await requireSupport();
  if (denied) return denied;
  if (!isDBConfigured()) return NextResponse.json({ error: 'DB not configured' }, { status: 503 });

  const { id } = await params;
  const tid = Number(id);
  if (!Number.isFinite(tid)) {
    return NextResponse.json({ error: 'Invalid ticket id' }, { status: 400 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const action = String(body?.action ?? '');
  const session = await auth();
  const me = session?.user?.id ?? null;
  if (!me) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await initDB();
  const db = getSQL();

  try {
    switch (action) {
      case 'claim': {
        // Only allowed if open + not claimed
        const r = await db`
          UPDATE support_tickets
          SET status = 'claimed', assignee_user_id = ${me}, claimed_at = NOW(), updated_at = NOW()
          WHERE id = ${tid} AND status = 'open' AND assignee_user_id IS NULL
          RETURNING id
        `;
        if (r.length === 0) {
          return NextResponse.json({ error: 'Ticket already claimed or not open' }, { status: 409 });
        }
        break;
      }
      case 'unclaim': {
        await db`
          UPDATE support_tickets
          SET status = 'open', assignee_user_id = NULL, claimed_at = NULL, updated_at = NOW()
          WHERE id = ${tid} AND assignee_user_id = ${me}
        `;
        break;
      }
      case 'resolve': {
        await db`
          UPDATE support_tickets
          SET status = 'resolved', resolved_at = NOW(), updated_at = NOW()
          WHERE id = ${tid}
        `;
        break;
      }
      case 'reopen': {
        await db`
          UPDATE support_tickets
          SET status = 'open', resolved_at = NULL, assignee_user_id = NULL, claimed_at = NULL, updated_at = NOW()
          WHERE id = ${tid}
        `;
        break;
      }
      case 'wontfix': {
        await db`
          UPDATE support_tickets
          SET status = 'wontfix', resolved_at = NOW(), updated_at = NOW()
          WHERE id = ${tid}
        `;
        break;
      }
      case 'priority': {
        const p = String(body?.priority ?? '');
        if (!VALID_PRIORITIES.includes(p as any)) {
          return NextResponse.json({ error: `priority must be one of: ${VALID_PRIORITIES.join(', ')}` }, { status: 400 });
        }
        await db`UPDATE support_tickets SET priority = ${p}, updated_at = NOW() WHERE id = ${tid}`;
        break;
      }
      case 'message': {
        const text = typeof body?.body === 'string' ? body.body.trim().slice(0, 10_000) : '';
        if (!text) {
          return NextResponse.json({ error: 'message body required' }, { status: 400 });
        }
        const isInternal = body?.isInternal === true;
        await db`
          INSERT INTO support_ticket_messages (ticket_id, author_user_id, body, is_internal)
          VALUES (${tid}, ${me}, ${text}, ${isInternal})
        `;
        await db`UPDATE support_tickets SET updated_at = NOW() WHERE id = ${tid}`;
        break;
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    await recordAuditEvent('support_ticket_action', {
      ticketId: tid,
      action,
      actorId: me,
      actorEmail: session?.user?.email ?? null,
      payload: action === 'priority' ? { priority: body?.priority } : undefined,
    }).catch(e => console.warn('audit log failed:', e));

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.warn('ticket patch failed:', e);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
