/**
 * GET /api/invite/stats — returns the current user's invite code +
 * counts of who signed up through it.
 *
 * Auth-required. The code is computed deterministically from the
 * user's ID via HMAC (see lib/invite.ts) — same user always gets
 * the same code, no DB column needed for storage.
 *
 * Counts are scoped to:
 *   - signups       — anyone who hit /signup?ref=CODE (rows in users)
 *   - verified      — same set but filtered to users.email_verified IS NOT NULL
 *
 * Cache: none. The data is per-user and changes infrequently but
 * showing yesterday's count when a fresh referral just landed feels
 * worse than a fresh round-trip.
 */

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isDBConfigured, getSQL, initDB } from '@/lib/db';
import { computeInviteCode } from '@/lib/invite';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const userId = session.user.id;
  const code = computeInviteCode(userId);

  // Build the share URL on the server so we don't bake a wrong base
  // into the client bundle for self-hosted forks.
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://info-hub.io';
  const shareUrl = `${base}/signup?ref=${code}`;

  if (!isDBConfigured()) {
    return NextResponse.json({
      code,
      shareUrl,
      signups: 0,
      verified: 0,
      degraded: true,
    });
  }

  try {
    // Ensure the referred_by_code column / index exist before COUNTing
    // against them — the first /invite visit after a fresh deploy might
    // otherwise hit a 42703 (undefined column). initDB is idempotent +
    // cached, so the cost is just one Promise resolution after the
    // first call in this process.
    await initDB();

    const db = getSQL();
    const rows = await db<{ signups: string; verified: string }[]>`
      SELECT
        COUNT(*)::text AS signups,
        COUNT(*) FILTER (WHERE email_verified IS NOT NULL)::text AS verified
      FROM users
      WHERE referred_by_code = ${code}
    `;
    const signups = Number(rows[0]?.signups ?? 0);
    const verified = Number(rows[0]?.verified ?? 0);

    return NextResponse.json({
      code,
      shareUrl,
      signups,
      verified,
    });
  } catch (e) {
    console.error('[invite/stats]', e);
    return NextResponse.json(
      { code, shareUrl, signups: 0, verified: 0, error: 'Failed to load stats' },
      { status: 200 }, // partial response — UI still gets the share link
    );
  }
}
