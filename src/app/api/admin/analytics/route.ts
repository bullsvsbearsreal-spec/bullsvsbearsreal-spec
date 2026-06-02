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
const UMAMI_TOKEN_SEED = process.env.UMAMI_API_TOKEN || '';
const UMAMI_USERNAME = process.env.UMAMI_USERNAME || '';
const UMAMI_PASSWORD = process.env.UMAMI_PASSWORD || '';
const UMAMI_WEBSITE_ID = process.env.UMAMI_WEBSITE_ID || process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID || '';

// In-memory token cache. Umami's JWT expires (~7d by default) and the
// open-source build has no persistent API-key surface, so we auto-refresh
// by logging in with the admin creds when our cached token starts
// returning 401s. UMAMI_API_TOKEN seeds the cache so we can ship without
// the username/password env vars set; once they're set, the loop is
// self-healing forever.
let cachedToken: string | null = UMAMI_TOKEN_SEED || null;
let loginInFlight: Promise<string | null> | null = null;
// After a failed login (wrong creds, Umami down, etc), refuse to retry
// for 60s. Without this, a misconfigured UMAMI_PASSWORD would turn
// every admin-panel refresh into a 6-shot credential-stuffing burst
// against our own Umami: each refresh fans out to 6 parallel
// umamiFetch calls, each 401s, each tries to login. The backoff caps
// the damage at one login attempt per minute until the operator
// notices and fixes it.
let loginFailedUntil = 0;

async function loginToUmami(): Promise<string | null> {
  if (!UMAMI_USERNAME || !UMAMI_PASSWORD || !UMAMI_HOST) return null;
  if (Date.now() < loginFailedUntil) return null;
  // De-dupe parallel login attempts — many in-flight requests should
  // share one network round-trip. We deliberately do NOT null
  // loginInFlight in a `finally`: that would race a second wave of
  // 401s into starting a brand-new login before the first wave's
  // callers had awaited the resolved promise, re-introducing the
  // duplicate-login bug. The 401 handler clears loginInFlight under
  // the same gate that clears cachedToken, so exactly one fresh
  // login happens per token-expiry cycle and stragglers reuse the
  // resolved promise.
  if (loginInFlight) return loginInFlight;
  loginInFlight = (async () => {
    try {
      const res = await fetch(`${UMAMI_HOST}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: UMAMI_USERNAME, password: UMAMI_PASSWORD }),
      });
      if (!res.ok) {
        loginFailedUntil = Date.now() + 60_000;
        return null;
      }
      const json = await res.json() as { token?: string };
      const tok = json.token ?? null;
      if (tok) {
        cachedToken = tok;
        loginFailedUntil = 0;
      } else {
        loginFailedUntil = Date.now() + 60_000;
      }
      return tok;
    } catch {
      loginFailedUntil = Date.now() + 60_000;
      return null;
    }
  })();
  return loginInFlight;
}

async function umamiFetch<T>(path: string, params: Record<string, string | number>): Promise<T | null> {
  const url = new URL(`${UMAMI_HOST}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const doFetch = async (token: string | null) => fetch(url.toString(), {
    headers: token
      ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' },
    // Cache 30s — admin dashboard polling at 60s intervals shares one
    // fetch per minute. Stale-while-revalidate is fine; the numbers
    // don't move in seconds.
    next: { revalidate: 30 },
  });

  try {
    let res = await doFetch(cachedToken);
    // 401/403 → token expired/invalid. Try a fresh login + one retry.
    // Only the first concurrent 401 to discover staleness triggers a
    // fresh login: it clears cachedToken + loginInFlight under one
    // gate, the rest find loginInFlight already pointing at the
    // winner's in-flight (or already-resolved) login and reuse it.
    // Without the `cachedToken !== null` gate, a parallel 401 could
    // clobber a fresh token that another worker installed two ms ago.
    if ((res.status === 401 || res.status === 403) && UMAMI_USERNAME && UMAMI_PASSWORD) {
      if (cachedToken !== null) {
        cachedToken = null;
        loginInFlight = null;
      }
      const fresh = await loginToUmami();
      if (fresh) res = await doFetch(fresh);
    }
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
  // error toast. Same shape on success-but-no-data too. We accept
  // EITHER a seed token (UMAMI_API_TOKEN) OR username+password creds
  // (which auto-login + cache a fresh token).
  const hasAuth = !!UMAMI_TOKEN_SEED || (!!UMAMI_USERNAME && !!UMAMI_PASSWORD);
  if (!UMAMI_HOST || !hasAuth || !UMAMI_WEBSITE_ID) {
    return NextResponse.json({
      configured: false,
      window: '7d',
      activeNow: 0,
      stats: { pageviews: 0, visitors: 0, visits: 0, bouncesPct: 0, avgVisitSec: 0 },
      timeseries: [],
      topPages: [],
      topReferrers: [],
      topCountries: [],
      stickiness: { dau: 0, wau: 0, ratioPct: 0 },
    });
  }

  // If we have creds but no seed token, login proactively before the
  // fan-out so all 6 requests share one warm token.
  if (!cachedToken && UMAMI_USERNAME && UMAMI_PASSWORD) {
    await loginToUmami();
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
    stats24h,
    stats7d,
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
    // DAU/WAU stickiness — unique visitors over fixed 24h + 7d windows,
    // independent of the selected `window` (it's always today-over-this-week).
    umamiFetch<{ visitors: { value: number } }>(`/api/websites/${UMAMI_WEBSITE_ID}/stats`, { startAt: now - 24 * 3600_000, endAt: now }),
    umamiFetch<{ visitors: { value: number } }>(`/api/websites/${UMAMI_WEBSITE_ID}/stats`, { startAt: now - 7 * 24 * 3600_000, endAt: now }),
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

  // Umami inconsistency observed in production (2026-05-28): /stats
  // returns all zeros while /pageviews returns the right counts. To
  // avoid showing operators a misleading "0 Pageviews" tile when
  // there are actually 40+ pageviews today, derive headline pageviews
  // + visitors from the timeseries when /stats came back empty. The
  // diagnostic console.warn logs the raw /stats response so we can
  // pinpoint the upstream cause next time someone reads the logs.
  const tsTotalPv = tsArr.reduce((s, t) => s + t.pageviews, 0);
  const tsTotalVi = tsArr.reduce((s, t) => s + t.visitors, 0);
  const statsTotalPv = stats?.pageviews?.value ?? 0;
  if (tsTotalPv > 0 && statsTotalPv === 0) {
    console.warn(
      `[umami] /stats returned 0 pageviews for ${UMAMI_WEBSITE_ID} window=${win} ` +
      `while /pageviews shows ${tsTotalPv}. Raw /stats response: ${JSON.stringify(stats)}`
    );
  }
  const pvOut = statsTotalPv || tsTotalPv;
  const viOut = (stats?.visitors?.value ?? 0) || tsTotalVi;

  // Likewise log empty top-pages when there should be data so we can
  // pinpoint whether it's the metrics?type=url query that's busted
  // or the URL tracking itself.
  if (tsTotalPv > 0 && (pages ?? []).length === 0) {
    console.warn(
      `[umami] /metrics?type=url returned empty for ${UMAMI_WEBSITE_ID} window=${win} ` +
      `despite ${tsTotalPv} pageviews. Raw: ${JSON.stringify(pages)}`
    );
  }

  // DAU/WAU stickiness — what fraction of the week's unique visitors also
  // showed up in the last 24h. <30% reads as occasional reference; 50%+ is
  // every-other-day habit (the activation signal Ben wanted to track).
  const dau = stats24h?.visitors?.value ?? 0;
  const wau = stats7d?.visitors?.value ?? 0;
  const stickinessRatioPct = wau > 0 ? Math.round((dau / wau) * 1000) / 10 : 0;

  return NextResponse.json({
    configured: true,
    window: win,
    activeNow: Number(activeNow) || 0,
    stats: {
      pageviews:   pvOut,
      visitors:    viOut,
      // visits ≈ visitors when most users have one session; falling
      // back to viOut keeps the tile from showing 0 when the data
      // clearly says otherwise.
      visits:      sv || viOut,
      bouncesPct:  sv > 0 ? Math.round((sb / sv) * 1000) / 10 : 0,
      avgVisitSec: sv > 0 ? Math.round(st / sv) : 0,
    },
    timeseries: tsArr,
    topPages:     (pages     ?? []).map(r => ({ url:      r.x, count: r.y })),
    topReferrers: (referrers ?? []).filter(r => r.x).map(r => ({ referrer: r.x, count: r.y })),
    topCountries: (countries ?? []).map(r => ({ country:  r.x, count: r.y })),
    stickiness: { dau, wau, ratioPct: stickinessRatioPct },
  });
}
