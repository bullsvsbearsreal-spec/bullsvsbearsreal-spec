export const runtime = 'nodejs';
export const preferredRegion = 'bom1';

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
    const rawBody = await request.text();
    // Reject payloads over 512KB to prevent storage abuse
    if (rawBody.length > 512 * 1024) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }
    const incoming: Partial<UserData> = JSON.parse(rawBody);

    // Guard: incoming must be a plain object, not a string or array
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 });
    }

    // Limit bio length
    if (typeof incoming.bio === 'string' && incoming.bio.length > 500) {
      return NextResponse.json({ error: 'Bio must be 500 characters or less' }, { status: 400 });
    }

    // Whitelist allowed keys to prevent arbitrary JSON key injection
    const ALLOWED_KEYS = ['watchlist', 'portfolio', 'alerts', 'screenerPresets', 'wallets', 'notificationPrefs', 'theme', 'fundingPrefs', 'bio', 'displayPrefs', 'dashboardLayout'];
    const sanitized = Object.fromEntries(
      Object.entries(incoming).filter(([k]) => ALLOWED_KEYS.includes(k))
    ) as Partial<UserData>;

    // Merge with existing data (so partial updates work)
    const existing = (await getUserData(session.user.id)) ?? {};

    // Guard: only spread if existing is a proper object (not a string/corrupted)
    const safeExisting = (existing && typeof existing === 'object' && !Array.isArray(existing))
      ? existing
      : {};
    const merged: UserData = {
      ...safeExisting,
      ...sanitized,
    };

    await setUserData(session.user.id, merged);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
