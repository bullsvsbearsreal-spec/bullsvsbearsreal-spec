/**
 * /api/support/my-tickets/[id]
 *
 * Customer-side endpoint scoped to the calling user's OWN tickets.
 *
 * GET   — ticket detail + non-internal messages. Returns 404 if the
 *         ticket isn't owned by the caller (no enumeration).
 * PATCH — supports two actions for the customer:
 *           { action: 'reply', body }     → append a non-internal message
 *           { action: 'close' }           → mark resolved (customer
 *                                            closes their own ticket)
 *         Anything else returns 400 — admin-only actions live on
 *         /api/support/tickets/[id] and are gated by requireSupport.
 *
 * Internal mod-only messages are filtered out — customers never see them.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth, verifySameOrigin } from '@/lib/auth';
import { initDB, isDBConfigured, getSQL, recordAuditEvent } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

const MAX_MESSAGE_LEN = 10_000;

async function loadOwnedTicket(userId: string, ticketId: number) {
  const db = getSQL();
  const rows = await db`
    SELECT t.id, t.user_id, t.subject, t.body, t.status, t.priority,
           t.assignee_user_id, t.claimed_at, t.resolved_at, t.created_at,
           a.name AS assignee_name
    FROM support_tickets t
    LEFT JOIN users a ON a.id = t.assignee_user_id
    WHERE t.id = ${ticketId} AND t.user_id = ${userId}
    LIMIT 1
  ` as any[];
  return rows[0] ?? null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'DB not configured' }, { status: 503 });
  }

  const { id } = await params;
  const tid = Number(id);
  if (!Number.isFinite(tid)) {
    return NextResponse.json({ error: 'Invalid ticket id' }, { status: 400 });
  }

  await initDB();
  const db = getSQL();
  const t = await loadOwnedTicket(session.user.id, tid);
  if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const msgs = await db`
      SELECT m.id, m.author_user_id, m.body, m.created_at,
             u.name AS author_name, u.role AS author_role
      FROM support_ticket_messages m
      LEFT JOIN users u ON u.id = m.author_user_id
      WHERE m.ticket_id = ${tid}
        AND m.is_internal = false
      ORDER BY m.created_at ASC
    ` as any[];
    return NextResponse.json({
      ticket: {
        id: Number(t.id),
        subject: t.subject,
        body: t.body,
        status: t.status,
        priority: t.priority,
        hasAssignee: !!t.assignee_user_id,
        assigneeName: t.assignee_name,
        createdAt: t.created_at,
        resolvedAt: t.resolved_at,
      },
      messages: msgs.map(m => ({
        id: Number(m.id),
        // Don't expose the author user id to the customer; just the
        // name + whether they're staff.
        authorName: m.author_name,
        isStaff: !!m.author_role && m.author_role !== 'user',
        body: m.body,
        createdAt: m.created_at,
      })),
    });
  } catch (e) {
    console.warn('my-ticket detail failed:', e);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const originErr = verifySameOrigin(request);
  if (originErr) return originErr;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'DB not configured' }, { status: 503 });
  }

  const { id } = await params;
  const tid = Number(id);
  if (!Number.isFinite(tid)) {
    return NextResponse.json({ error: 'Invalid ticket id' }, { status: 400 });
  }

  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const action = String(body?.action ?? '');

  await initDB();
  const db = getSQL();
  const t = await loadOwnedTicket(session.user.id, tid);
  if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    if (action === 'reply') {
      const text = typeof body?.body === 'string' ? body.body.trim().slice(0, MAX_MESSAGE_LEN) : '';
      if (!text) {
        return NextResponse.json({ error: 'message body required' }, { status: 400 });
      }
      // Customers can reply on open/claimed tickets. If the ticket was
      // resolved, replying re-opens it so staff sees the new message.
      if (t.status === 'resolved' || t.status === 'wontfix') {
        await db`
          UPDATE support_tickets
             SET status = 'open', resolved_at = NULL, updated_at = NOW()
           WHERE id = ${tid}
        `;
      } else {
        await db`UPDATE support_tickets SET updated_at = NOW() WHERE id = ${tid}`;
      }
      await db`
        INSERT INTO support_ticket_messages (ticket_id, author_user_id, body, is_internal)
        VALUES (${tid}, ${session.user.id}, ${text}, false)
      `;
      await recordAuditEvent('support_ticket_action', {
        ticketId: tid,
        action: 'customer_reply',
        actorId: session.user.id,
        actorEmail: session?.user?.email ?? null,
      }).catch(e => console.warn('audit log failed:', e));
      return NextResponse.json({ ok: true });
    }

    if (action === 'close') {
      // Customer closes their own ticket — "Thanks, that fixed it"
      // self-service. Doesn't put it in 'wontfix' (that's a staff state).
      await db`
        UPDATE support_tickets
           SET status = 'resolved', resolved_at = NOW(), updated_at = NOW()
         WHERE id = ${tid} AND user_id = ${session.user.id}
      `;
      await recordAuditEvent('support_ticket_action', {
        ticketId: tid,
        action: 'customer_close',
        actorId: session.user.id,
        actorEmail: session?.user?.email ?? null,
      }).catch(e => console.warn('audit log failed:', e));
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    console.warn('my-ticket patch failed:', e);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
