/**
 * GET /api/admin/analytics
 *
 * Server-side proxy to the self-hosted Umami instance. Holds the
 * UMAMI_API_TOKEN so it never touches the browser. Admin / marketer /
 * owner only.
 *
 * Query params:
 *   window      — '24h' | '7d' | '30d' (default '7d')
 *
 * Response:
 *   {
 *     window,
 *     activeNow,                       // currently active visitors
 *     stats: { pageviews, visitors, visits, bouncesPct, avgVisitSec },
 *     timeseries: [{ ts, pageviews, visitors }],
 *     topPages: [{ url, count }],
 *     topReferrers: [{ referrer, count }],
 *     topCountries: [{ country, count }],
 *     configured: true                 // false if Umami env vars are missing
 *   }
 *
 * If Umami isn't configured (env vars unset), returns
 * { configured: false } with 200 OK so the UI can render a "not set up
 * yet" empty state cleanly without an error toast.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth, getUserRole } from '@/lib/auth';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

type Window = '24h' | '7d' | '30d';

function parseWindow(s: string | null): Window {
  return s === '24h' || s === '30d' ? s : '7d';
}

interface MetricRow { x: string; y: number }
interface PageviewRow { x: string; y: number }

const UMAMI_HOST = process.env.UMAMI_HOST || process.env.NEXT_PUBLIC_UMAMI_HOST || '';
const UMAMI_TOKEN = process.env.UMAMI_API_TOKEN || '';
const UMAMI_WEBSITE_ID = process.env.UMAMI_WEBSITE_ID || process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID || '';

async function umamiFetch<T>(path: string, params: Record<string, string | number>): Promise<T | null> {
  const url = new URL(`${UMAMI_HOST}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${UMAMI_TOKEN}`,
        'Content-Type': 'application/json',
      },
      // Cache 30s — admin dashboard polling at 60s intervals shares one
      // fetch per minute. Stale-while-revalidate is fine; the numbers
      // don't move in seconds.
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (e) {
    console.warn('umami fetch failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

export async function GET(request: NextRequest) {
  // Gate — admin / marketer / owner. (Mirrors the access decision: same
  // surface that hosts /marketing-panel.)
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const role = await getUserRole(session.user.id);
  if (role !== 'owner' && role !== 'admin' && role !== 'marketer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Umami not configured — return a clean "empty" payload the UI
  // recognises so it can show a setup-required state instead of an
  // error toast. Same shape on success-but-no-data too.
  if (!UMAMI_HOST || !UMAMI_TOKEN || !UMAMI_WEBSITE_ID) {
    return NextResponse.json({
      configured: false,
      window: '7d',
      activeNow: 0,
      stats: { pageviews: 0, visitors: 0, visits: 0, bouncesPct: 0, avgVisitSec: 0 },
      timeseries: [],
      topPages: [],
      topReferrers: [],
      topCountries: [],
    });
  }

  const { searchParams } = new URL(request.url);
  const win = parseWindow(searchParams.get('window'));
  const now = Date.now();
  const startAt = now - (win === '24h' ? 24 : win === '30d' ? 30 * 24 : 7 * 24) * 3600_000;
  const unit = win === '24h' ? 'hour' : 'day';

  // Fan out — six requests in parallel. Each returns null on failure
  // and the response stitches whatever came back together.
  const [
    active,
    stats,
    timeseries,
    pages,
    referrers,
    countries,
  ] = await Promise.all([
    umamiFetch<{ visitors: number } | { x: number }>(`/api/websites/${UMAMI_WEBSITE_ID}/active`, {}),
    umamiFetch<{
      pageviews: { value: number };
      visitors:  { value: number };
      visits:    { value: number };
      bounces:   { value: number };
      totaltime: { value: number };
    }>(`/api/websites/${UMAMI_WEBSITE_ID}/stats`, { startAt, endAt: now }),
    umamiFetch<{ pageviews: PageviewRow[]; sessions: PageviewRow[] }>(`/api/websites/${UMAMI_WEBSITE_ID}/pageviews`, {
      startAt, endAt: now, unit, timezone: 'UTC',
    }),
    umamiFetch<MetricRow[]>(`/api/websites/${UMAMI_WEBSITE_ID}/metrics`, {
      startAt, endAt: now, type: 'url', limit: 12,
    }),
    umamiFetch<MetricRow[]>(`/api/websites/${UMAMI_WEBSITE_ID}/metrics`, {
      startAt, endAt: now, type: 'referrer', limit: 12,
    }),
    umamiFetch<MetricRow[]>(`/api/websites/${UMAMI_WEBSITE_ID}/metrics`, {
      startAt, endAt: now, type: 'country', limit: 12,
    }),
  ]);

  const sv = stats?.visits?.value ?? 0;
  const sb = stats?.bounces?.value ?? 0;
  const st = stats?.totaltime?.value ?? 0;

  // Umami's /active endpoint returns either { visitors: N } or { x: N }
  // depending on the version; tolerate both.
  const activeNow = (active as any)?.visitors ?? (active as any)?.x ?? 0;

  // Stitch timeseries — pageviews + visitor counts joined on bucket.
  const buckets = new Map<string, { pageviews: number; visitors: number }>();
  for (const p of timeseries?.pageviews ?? []) {
    buckets.set(p.x, { pageviews: p.y, visitors: 0 });
  }
  for (const v of timeseries?.sessions ?? []) {
    const cur = buckets.get(v.x) ?? { pageviews: 0, visitors: 0 };
    cur.visitors = v.y;
    buckets.set(v.x, cur);
  }
  const tsArr = Array.from(buckets.entries())
    .map(([ts, v]) => ({ ts, pageviews: v.pageviews, visitors: v.visitors }))
    .sort((a, b) => a.ts.localeCompare(b.ts));

  return NextResponse.json({
    configured: true,
    window: win,
    activeNow: Number(activeNow) || 0,
    stats: {
      pageviews:   stats?.pageviews?.value ?? 0,
      visitors:    stats?.visitors?.value ?? 0,
      visits:      sv,
      bouncesPct:  sv > 0 ? Math.round((sb / sv) * 1000) / 10 : 0,
      avgVisitSec: sv > 0 ? Math.round(st / sv) : 0,
    },
    timeseries: tsArr,
    topPages:     (pages     ?? []).map(r => ({ url:      r.x, count: r.y })),
    topReferrers: (referrers ?? []).filter(r => r.x).map(r => ({ referrer: r.x, count: r.y })),
    topCountries: (countries ?? []).map(r => ({ country:  r.x, count: r.y })),
  });
}
