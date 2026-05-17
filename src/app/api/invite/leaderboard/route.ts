/**
 * GET /api/invite/leaderboard — public top-N referrer ranking.
 *
 * Anonymized: returns only the first 4 chars of each invite code +
 * counts. The full code never crosses the wire (would let anyone
 * else use someone's link to attribute), and we don't return user
 * email / name / id.
 *
 * Cache: 5min L1 + 5min CF s-maxage with 10min SWR. Leaderboard
 * rankings move slowly (a few referrals per hour at peak); 5min
 * stale is fine and saves a COUNT-GROUP-BY query for every visit.
 *
 * Public no-auth. Add the /api/v1/openapi-style header so partners
 * who eventually wrap this in their own UI know what they're getting.
 */

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';

import { NextResponse } from 'next/server';
import { isDBConfigured, getSQL, initDB } from '@/lib/db';

interface LeaderboardEntry {
  rank: number;
  /** First 4 chars of the inviter's code — opaque enough to dedupe rows,
   *  short enough to not reveal the full link. */
  codePrefix: string;
  /** Total signups attributed via this code. */
  signups: number;
  /** Subset that completed email verification. */
  verified: number;
}

interface LeaderboardResp {
  generatedAt: string;
  topN: number;
  entries: LeaderboardEntry[];
}

const PUBLIC_CACHE = 'public, s-maxage=300, stale-while-revalidate=600';

let l1: { body: LeaderboardResp; ts: number } | null = null;
const L1_TTL_MS = 5 * 60 * 1000;
const TOP_N = 20;

function withHeaders(body: LeaderboardResp, cacheTag: 'HIT' | 'MISS') {
  return NextResponse.json(body, {
    headers: {
      'X-Cache': cacheTag,
      'Cache-Control': PUBLIC_CACHE,
    },
  });
}

export async function GET() {
  // Fast path
  if (l1 && Date.now() - l1.ts < L1_TTL_MS) {
    return withHeaders(l1.body, 'HIT');
  }

  const empty: LeaderboardResp = {
    generatedAt: new Date().toISOString(),
    topN: TOP_N,
    entries: [],
  };

  if (!isDBConfigured()) return withHeaders(empty, 'MISS');

  try {
    await initDB();
    const db = getSQL();

    const rows = await db<{ code_prefix: string; signups: string; verified: string }[]>`
      SELECT
        LEFT(referred_by_code, 4) AS code_prefix,
        COUNT(*)::text AS signups,
        COUNT(*) FILTER (WHERE email_verified IS NOT NULL)::text AS verified
      FROM users
      WHERE referred_by_code IS NOT NULL
      GROUP BY LEFT(referred_by_code, 4)
      ORDER BY COUNT(*) FILTER (WHERE email_verified IS NOT NULL) DESC,
               COUNT(*) DESC
      LIMIT ${TOP_N}
    `;

    const entries: LeaderboardEntry[] = rows.map((r, i) => ({
      rank: i + 1,
      codePrefix: r.code_prefix,
      signups: Number(r.signups),
      verified: Number(r.verified),
    }));

    const body: LeaderboardResp = {
      generatedAt: new Date().toISOString(),
      topN: TOP_N,
      entries,
    };

    // Only pin a non-empty payload to L1 — the empty state could be
    // transient (e.g. column not yet seeded) and we don't want to
    // serve "no referrers yet" for 5 min if a fresh referral lands.
    if (entries.length > 0) l1 = { body, ts: Date.now() };

    return withHeaders(body, 'MISS');
  } catch (e) {
    console.error('[invite/leaderboard]', e);
    return withHeaders(empty, 'MISS');
  }
}
