/**
 * DELETE /api/account/exchange-keys/[id]
 *
 * Removes a connected key. Auth-gated; the WHERE clause includes user_id so
 * users can't delete each other's keys even if they guess the id.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isDBConfigured, deleteUserExchangeKey } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503, headers: NO_STORE });
  }

  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400, headers: NO_STORE });
  }

  const removed = await deleteUserExchangeKey(session.user.id, id);
  if (!removed) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
