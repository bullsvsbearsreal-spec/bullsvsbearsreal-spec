/**
 * /api/admin/users/[id]/notes
 *
 *   GET     → list notes for the user (admin or advisor)
 *   POST    → add a note (admin only). Body: { body: string }
 *   DELETE  → delete a note. Query: ?noteId=N (admin only)
 *
 * Notes are SHARED — every admin sees every note. Each note has an
 * author so a UUID-less audit trail is still readable. Body is
 * truncated at 2000 chars in the DB helper.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireAdminOrAdvisor, verifySameOrigin, auth } from '@/lib/auth';
import {
  initDB, isDBConfigured,
  listUserNotes, addUserNote, deleteUserNote, recordAuditEvent,
} from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdminOrAdvisor();
  if (denied) return denied;
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const { id } = await params;
  try {
    await initDB();
    const notes = await listUserNotes(id);
    return NextResponse.json({ notes });
  } catch (e) {
    console.error('User notes GET error:', e);
    return NextResponse.json({ error: 'Failed to load notes' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const originErr = verifySameOrigin(request);
  if (originErr) return originErr;
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const { id } = await params;
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const noteBody = typeof body?.body === 'string' ? body.body.trim() : '';
  if (noteBody.length < 1 || noteBody.length > 2000) {
    return NextResponse.json({ error: 'body must be 1-2000 chars' }, { status: 400 });
  }

  const session = await auth();
  const authorId = session?.user?.id ?? null;

  try {
    await initDB();
    const noteId = await addUserNote(id, authorId, noteBody);
    if (!noteId) {
      return NextResponse.json({ error: 'Failed to insert note' }, { status: 500 });
    }
    // Light audit entry — note bodies aren't logged in audit_log to
    // keep the audit table from bloating; only the action + targetUserId.
    await recordAuditEvent('admin_add_user_note', {
      admin: session?.user?.email ?? null,
      actorEmail: session?.user?.email ?? null,
      targetUserId: id,
      noteId,
    }).catch(() => {});
    return NextResponse.json({ noteId });
  } catch (e) {
    console.error('User notes POST error:', e);
    return NextResponse.json({ error: 'Failed to add note' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const originErr = verifySameOrigin(request);
  if (originErr) return originErr;
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const { id } = await params;
  const noteId = parseInt(request.nextUrl.searchParams.get('noteId') || '', 10);
  if (!Number.isFinite(noteId) || noteId <= 0) {
    return NextResponse.json({ error: 'Invalid noteId' }, { status: 400 });
  }

  const session = await auth();

  try {
    await initDB();
    const ok = await deleteUserNote(noteId);
    if (!ok) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }
    await recordAuditEvent('admin_delete_user_note', {
      admin: session?.user?.email ?? null,
      actorEmail: session?.user?.email ?? null,
      targetUserId: id,
      noteId,
    }).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('User notes DELETE error:', e);
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}
