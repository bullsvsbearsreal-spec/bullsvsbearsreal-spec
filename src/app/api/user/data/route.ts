export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserData, setUserData, UserData } from '@/lib/db';

/**
 * GET /api/user/data — fetch the authenticated user's synced data
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await getUserData(session.user.id);
  return NextResponse.json(data ?? {});
}

/**
 * PUT /api/user/data — save/merge the authenticated user's synced data
 * Body: partial UserData — only provided keys are merged, others preserved.
 */
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const incoming: Partial<UserData> = await request.json();

    // Merge with existing data (so partial updates work)
    const existing = (await getUserData(session.user.id)) ?? {};
    const merged: UserData = {
      ...existing,
      ...incoming,
    };

    await setUserData(session.user.id, merged);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
