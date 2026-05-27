/**
 * GET /api/developer/usage
 *
 * Returns the CURRENT user's own API usage. Self-serve — no admin role
 * needed. Reads api_request_log for the calling user only.
 *
 * Response:
 *   { window, totalRequests, errors, perEndpoint: [{endpoint, hits}],
 *     perDay: [{date, hits}], lastRequestAt }
 *
 * Window: ?window=24h|7d|30d (default 7d).
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { initDB, isDBConfigured, getSQL } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

type Window = '24h' | '7d' | '30d';
function parseWindow(s: string | null): Window {
  return s === '24h' || s === '30d' ? s : '7d';
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (!isDBConfigured()) {
    return NextResponse.json({ totalRequests: 0, errors: 0, perEndpoint: [], perDay: [] });
  }

  const { searchParams } = new URL(request.url);
  const win = parseWindow(searchParams.get('window'));
  const hours = win === '24h' ? 24 : win === '30d' ? 24 * 30 : 24 * 7;
  const userId = session.user.id;

  await initDB();
  const db = getSQL();
  try {
    const [summary, perEndpoint, perDay] = await Promise.all([
      db`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status_code >= 400)::int AS errors,
          MAX(created_at)::text AS last_at
        FROM api_request_log
        WHERE user_id = ${userId}
          AND created_at > NOW() - (${hours}::int * INTERVAL '1 hour')
      `,
      db`
        SELECT endpoint, COUNT(*)::int AS hits
        FROM api_request_log
        WHERE user_id = ${userId}
          AND created_at > NOW() - (${hours}::int * INTERVAL '1 hour')
        GROUP BY endpoint
        ORDER BY hits DESC
        LIMIT 12
      `,
      db`
        SELECT DATE(created_at)::text AS date, COUNT(*)::int AS hits
        FROM api_request_log
        WHERE user_id = ${userId}
          AND created_at > NOW() - (${hours}::int * INTERVAL '1 hour')
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `,
    ]);

    const s = (summary as any[])[0] ?? { total: 0, errors: 0, last_at: null };
    return NextResponse.json({
      window: win,
      sampled: true,
      sampleRate: 0.2,
      totalRequests: Number(s.total) || 0,
      errors: Number(s.errors) || 0,
      lastRequestAt: s.last_at,
      perEndpoint: (perEndpoint as any[]).map(r => ({ endpoint: r.endpoint, hits: Number(r.hits) || 0 })),
      perDay:      (perDay as any[]).map(r => ({ date: r.date, hits: Number(r.hits) || 0 })),
    });
  } catch (e) {
    console.warn('developer usage query failed:', e);
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }
}
