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
 * Cache: per-user 60s L1 map. The dashboard fetches this on every
 * mount + the /invite page fetches it on visit, so a power-user
 * could hit the route multiple times per minute. New referrals
 * arriving inside the 60s window stay invisible until the cache
 * expires, but 60s is fast enough to feel real-time without
 * hammering the DB. Cannot use a public CF cache here — per-user
 * data.
 */

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isDBConfigured, getSQL, initDB } from '@/lib/db';
import { computeInviteCode } from '@/lib/invite';

interface CacheEntry {
  data: { code: string; shareUrl: string; signups: number; verified: number };
  ts: number;
}
const L1: Map<string, CacheEntry> = new Map();
const L1_TTL_MS = 60_000;
// Cap to prevent unbounded growth in long-running processes. If we
// blow past this in a single TTL window the cache effectively becomes
// per-instance-LRU; not great, but safer than holding millions of
// users in memory.
const L1_MAX_ENTRIES = 5_000;

function getCached(userId: string): CacheEntry['data'] | null {
  const e = L1.get(userId);
  if (!e) return null;
  if (Date.now() - e.ts > L1_TTL_MS) {
    L1.delete(userId);
    return null;
  }
  return e.data;
}

function setCached(userId: string, data: CacheEntry['data']): void {
  if (L1.size >= L1_MAX_ENTRIES) {
    // Drop the oldest entry. Map iteration order = insertion order
    // for keys never re-set, so first() is the oldest.
    const oldest = L1.keys().next().value;
    if (oldest !== undefined) L1.delete(oldest);
  }
  L1.set(userId, { data, ts: Date.now() });
}

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

  // Fast path: in-memory hit.
  const cached = getCached(userId);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'private, max-age=30' },
    });
  }

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

    const payload = { code, shareUrl, signups, verified };
    setCached(userId, payload);

    return NextResponse.json(payload, {
      headers: { 'X-Cache': 'MISS', 'Cache-Control': 'private, max-age=30' },
    });
  } catch (e) {
    console.error('[invite/stats]', e);
    return NextResponse.json(
      { code, shareUrl, signups: 0, verified: 0, error: 'Failed to load stats' },
      { status: 200 }, // partial response — UI still gets the share link
    );
  }
}
