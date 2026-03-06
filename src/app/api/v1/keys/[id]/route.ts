import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { revokeApiKey, initDB } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * DELETE /api/v1/keys/:id — Revoke an API key (requires session auth)
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const { id } = await params;
  await initDB();
  const revoked = await revokeApiKey(id, session.user.id);

  if (!revoked) {
    return NextResponse.json(
      { success: false, error: 'Key not found or already revoked' },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, message: 'API key revoked' });
}
