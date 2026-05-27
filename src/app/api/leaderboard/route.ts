/**
 * GET /api/leaderboard
 *
 * PUBLIC referral leaderboard. No auth. Aggregates referral_events per
 * affiliate within an optional time window.
 *
 * Query params:
 *   window  — 'all' | '30d' | '7d'   (default 'all')
 *   limit   — 1..100                  (default 100)
 *
 * Response shape:
 *   {
 *     window: 'all' | '30d' | '7d',
 *     updatedAt: ISO,
 *     rows: [{
 *       rank, displayName, isNamed,    // 'Affiliate #1234' if not named
 *       earned, pending,               // USD numbers (cents-precision)
 *       signups, conversions,
 *     }],
 *     yours?: { rank, ... }            // only if Authorization cookie present
 *   }
 *
 * Privacy: we never expose email, id, or referral_code. If user has set
 * users.name we use it; otherwise we synthesize 'Affiliate #N' where N is
 * a stable hash of the affiliate_user_id (not the rank — so the same user
 * has the same numeric handle across windows).
 *
 * Caching: revalidate 60s. This is the kind of board where 1-minute
 * freshness is plenty and the cache shields us from leaderboard scrape.
 */
import { NextRequest, NextResponse } from 'next/server';
import { initDB, isDBConfigured, getSQL } from '@/lib/db';
import { auth } from '@/lib/auth';
import { createHash } from 'node:crypto';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const revalidate = 60;

type Window = 'all' | '30d' | '7d';

function parseWindow(s: string | null): Window {
  return s === '30d' || s === '7d' ? s : 'all';
}

/**
 * Stable numeric handle for an unnamed affiliate. Hash the user id and
 * mod into a 4-digit space. Collisions are possible but rare and the
 * leaderboard is small (top 100), so we tolerate it.
 */
function synthHandle(userId: string): string {
  const h = createHash('sha256').update(userId).digest();
  const n = (h[0] << 8 | h[1]) % 10000;
  return `Affiliate #${String(n).padStart(4, '0')}`;
}

interface AggRow {
  affiliate_user_id: string;
  affiliate_name: string | null;
  earned: string | number;     // postgres NUMERIC can come back as string
  pending: string | number;
  signups: string | number;
  conversions: string | number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const win = parseWindow(searchParams.get('window'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '100', 10) || 100));

  if (!isDBConfigured()) {
    return NextResponse.json({ window: win, updatedAt: new Date().toISOString(), rows: [] });
  }
  await initDB();
  const db = getSQL();

  // Window filter — split into two branches to avoid the interval
  // interpolation pitfalls we hit before (commit caafefaa). Direct
  // integer interpolation into '${days}::int * INTERVAL...' works.
  const days = win === '30d' ? 30 : win === '7d' ? 7 : 0;

  let rows: AggRow[] = [];
  try {
    rows = days > 0
      ? await db`
          SELECT
            re.affiliate_user_id,
            u.name AS affiliate_name,
            COALESCE(SUM(CASE WHEN re.event_type = 'payout'     THEN re.commission_usd END), 0) AS earned,
            COALESCE(SUM(CASE WHEN re.event_type = 'conversion' THEN re.commission_usd END), 0) AS pending,
            COUNT(DISTINCT CASE WHEN re.event_type = 'signup'     THEN re.referred_user_id END) AS signups,
            COUNT(*) FILTER (WHERE re.event_type = 'conversion') AS conversions
          FROM referral_events re
          LEFT JOIN users u ON u.id = re.affiliate_user_id
          WHERE re.created_at > NOW() - (${days}::int * INTERVAL '1 day')
          GROUP BY re.affiliate_user_id, u.name
          HAVING COUNT(*) FILTER (WHERE re.event_type IN ('conversion', 'payout', 'signup')) > 0
          ORDER BY
            (COALESCE(SUM(CASE WHEN re.event_type = 'payout'     THEN re.commission_usd END), 0)
           + COALESCE(SUM(CASE WHEN re.event_type = 'conversion' THEN re.commission_usd END), 0)) DESC,
            COUNT(*) FILTER (WHERE re.event_type = 'conversion') DESC
          LIMIT ${limit}
        ` as unknown as AggRow[]
      : await db`
          SELECT
            re.affiliate_user_id,
            u.name AS affiliate_name,
            COALESCE(SUM(CASE WHEN re.event_type = 'payout'     THEN re.commission_usd END), 0) AS earned,
            COALESCE(SUM(CASE WHEN re.event_type = 'conversion' THEN re.commission_usd END), 0) AS pending,
            COUNT(DISTINCT CASE WHEN re.event_type = 'signup'     THEN re.referred_user_id END) AS signups,
            COUNT(*) FILTER (WHERE re.event_type = 'conversion') AS conversions
          FROM referral_events re
          LEFT JOIN users u ON u.id = re.affiliate_user_id
          GROUP BY re.affiliate_user_id, u.name
          HAVING COUNT(*) FILTER (WHERE re.event_type IN ('conversion', 'payout', 'signup')) > 0
          ORDER BY
            (COALESCE(SUM(CASE WHEN re.event_type = 'payout'     THEN re.commission_usd END), 0)
           + COALESCE(SUM(CASE WHEN re.event_type = 'conversion' THEN re.commission_usd END), 0)) DESC,
            COUNT(*) FILTER (WHERE re.event_type = 'conversion') DESC
          LIMIT ${limit}
        ` as unknown as AggRow[];
  } catch (e) {
    console.warn('leaderboard query failed:', e);
    return NextResponse.json({ window: win, updatedAt: new Date().toISOString(), rows: [], error: 'query_failed' }, { status: 500 });
  }

  const top = rows.map((r, i) => {
    const named = (r.affiliate_name || '').trim();
    return {
      rank: i + 1,
      displayName: named || synthHandle(r.affiliate_user_id),
      isNamed: !!named,
      earned: Number(r.earned) || 0,
      pending: Math.max(0, Number(r.pending) - Number(r.earned)) || 0,
      signups: Number(r.signups) || 0,
      conversions: Number(r.conversions) || 0,
    };
  });

  // "Your rank" — only computed if a session exists. Don't expose
  // affiliate_user_id; just rank + my-own row data. If the caller is in
  // the top N, we suppress yours (they can see themselves in the table).
  let yours: typeof top[number] | null = null;
  try {
    const session = await auth();
    const selfId = session?.user?.id ?? null;
    if (selfId) {
      const inList = rows.findIndex(r => r.affiliate_user_id === selfId);
      if (inList === -1) {
        // Fetch a single row for self + count of rows ranked above.
        const self = days > 0
          ? await db`
              WITH agg AS (
                SELECT
                  re.affiliate_user_id,
                  COALESCE(SUM(CASE WHEN re.event_type = 'payout'     THEN re.commission_usd END), 0) AS earned,
                  COALESCE(SUM(CASE WHEN re.event_type = 'conversion' THEN re.commission_usd END), 0) AS pending,
                  COUNT(DISTINCT CASE WHEN re.event_type = 'signup'     THEN re.referred_user_id END) AS signups,
                  COUNT(*) FILTER (WHERE re.event_type = 'conversion') AS conversions
                FROM referral_events re
                WHERE re.created_at > NOW() - (${days}::int * INTERVAL '1 day')
                GROUP BY re.affiliate_user_id
              )
              SELECT
                a.affiliate_user_id, u.name AS affiliate_name,
                a.earned, a.pending, a.signups, a.conversions,
                (SELECT COUNT(*) FROM agg b WHERE (b.earned + b.pending) > (a.earned + a.pending)) + 1 AS rank
              FROM agg a
              LEFT JOIN users u ON u.id = a.affiliate_user_id
              WHERE a.affiliate_user_id = ${selfId}
              LIMIT 1
            ` as unknown as Array<AggRow & { rank: string | number }>
          : await db`
              WITH agg AS (
                SELECT
                  re.affiliate_user_id,
                  COALESCE(SUM(CASE WHEN re.event_type = 'payout'     THEN re.commission_usd END), 0) AS earned,
                  COALESCE(SUM(CASE WHEN re.event_type = 'conversion' THEN re.commission_usd END), 0) AS pending,
                  COUNT(DISTINCT CASE WHEN re.event_type = 'signup'     THEN re.referred_user_id END) AS signups,
                  COUNT(*) FILTER (WHERE re.event_type = 'conversion') AS conversions
                FROM referral_events re
                GROUP BY re.affiliate_user_id
              )
              SELECT
                a.affiliate_user_id, u.name AS affiliate_name,
                a.earned, a.pending, a.signups, a.conversions,
                (SELECT COUNT(*) FROM agg b WHERE (b.earned + b.pending) > (a.earned + a.pending)) + 1 AS rank
              FROM agg a
              LEFT JOIN users u ON u.id = a.affiliate_user_id
              WHERE a.affiliate_user_id = ${selfId}
              LIMIT 1
            ` as unknown as Array<AggRow & { rank: string | number }>;
        if (self[0]) {
          const r = self[0];
          const named = (r.affiliate_name || '').trim();
          yours = {
            rank: Number(r.rank) || 0,
            displayName: named || synthHandle(r.affiliate_user_id),
            isNamed: !!named,
            earned: Number(r.earned) || 0,
            pending: Math.max(0, Number(r.pending) - Number(r.earned)) || 0,
            signups: Number(r.signups) || 0,
            conversions: Number(r.conversions) || 0,
          };
        }
      }
    }
  } catch (e) {
    // Don't fail the whole response if "your rank" lookup blows up.
    console.warn('leaderboard self-rank failed:', e);
  }

  return NextResponse.json({
    window: win,
    updatedAt: new Date().toISOString(),
    rows: top,
    yours,
  });
}
