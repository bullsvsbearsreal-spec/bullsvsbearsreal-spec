/**
 * GET /api/admin/invites — aggregate referral analytics.
 *
 * Admin-only. Surfaces the data the team wants on launch + ongoing:
 *   - totalReferred: how many users came in via a ?ref link
 *   - totalVerified: subset that completed email verification
 *   - distinctReferrers: how many unique inviters have at least 1 signup
 *   - topReferrers: top 10 (code-prefix, signups, verified) for at-a-
 *     glance "who's winning?"
 *   - last7d: { signups, verified } for the last 7 days specifically
 *
 * Read-only; never modifies anything. No L1 cache because it's
 * admin-only and we want fresh numbers when the team checks.
 */

import { NextResponse } from 'next/server';
import { requireAdminOrAdvisor } from '@/lib/auth';
import { isDBConfigured, getSQL, initDB } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

interface TopReferrer {
  codePrefix: string;
  signups: number;
  verified: number;
}

export async function GET() {
  const denied = await requireAdminOrAdvisor();
  if (denied) return denied;

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    await initDB();
    const db = getSQL();

    const [totals, last7, top] = await Promise.all([
      db<{ total_referred: string; total_verified: string; distinct_referrers: string }[]>`
        SELECT
          COUNT(*)::text AS total_referred,
          COUNT(*) FILTER (WHERE email_verified IS NOT NULL)::text AS total_verified,
          COUNT(DISTINCT referred_by_code)::text AS distinct_referrers
        FROM users
        WHERE referred_by_code IS NOT NULL
      `,
      // NextAuth's users table doesn't always have created_at, so we
      // proxy the 7-day window via email_verified. That measures
      // "verified referred users in the last 7d" which is what we
      // actually care about for launch metrics anyway — unverified
      // signups aren't real users yet.
      db<{ verified: string }[]>`
        SELECT
          COUNT(*) FILTER (WHERE email_verified >= NOW() - INTERVAL '7 days')::text AS verified
        FROM users
        WHERE referred_by_code IS NOT NULL
      `,
      db<{ code_prefix: string; signups: string; verified: string }[]>`
        SELECT
          LEFT(referred_by_code, 4) AS code_prefix,
          COUNT(*)::text AS signups,
          COUNT(*) FILTER (WHERE email_verified IS NOT NULL)::text AS verified
        FROM users
        WHERE referred_by_code IS NOT NULL
        GROUP BY LEFT(referred_by_code, 4)
        ORDER BY COUNT(*) FILTER (WHERE email_verified IS NOT NULL) DESC,
                 COUNT(*) DESC
        LIMIT 10
      `,
    ]);

    const t = totals[0];
    const w = last7[0];

    const topReferrers: TopReferrer[] = top.map((r) => ({
      codePrefix: r.code_prefix,
      signups: Number(r.signups),
      verified: Number(r.verified),
    }));

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      totalReferred: Number(t?.total_referred ?? 0),
      totalVerified: Number(t?.total_verified ?? 0),
      distinctReferrers: Number(t?.distinct_referrers ?? 0),
      verifiedLast7d: Number(w?.verified ?? 0),
      topReferrers,
    });
  } catch (e) {
    console.error('[admin/invites]', e);
    return NextResponse.json({ error: 'Failed to load invite analytics' }, { status: 500 });
  }
}
