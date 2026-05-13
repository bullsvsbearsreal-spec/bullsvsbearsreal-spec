/**
 * Cron: pull KOL Twitter posts via nitter RSS and upsert into Postgres.
 *
 * Schedule: every 15 minutes via the droplet's systemd timer
 *   /etc/systemd/system/infohub-cron-social-fetch.timer
 *
 * Auth: standard `Authorization: Bearer <CRON_SECRET>` header (same as the
 * other crons — see src/app/api/cron/_auth.ts).
 *
 * The fetcher is intentionally swappable: this route hardcodes the nitter
 * implementation today, but if nitter dies, swap the import for an RSSHub-
 * or rss.app-backed fetcher and the rest of the pipeline keeps working.
 */
import { NextRequest, NextResponse } from 'next/server';
import { initDB, isDBConfigured, saveSocialPosts, getStaleSocialHandles, upsertWorkerHeartbeat } from '@/lib/db';
import { TWITTER_KOLS } from '@/lib/social/kols';
import { nitterFetcher } from '@/lib/social/nitter';
import { verifyCronAuth } from '../_auth';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Concurrency knobs. Polling 19 handles every 15 min is well under nitter's
// rate limits, but we batch + pause between batches anyway to be polite.
const BATCH = 5;
const INTER_BATCH_PAUSE_MS = 1500;
const STALE_HOURS = 12;

interface PerHandleStat {
  handle: string;
  fetched: number;
  inserted: number;
  error?: string;
}

export async function GET(request: NextRequest) {
  const authErr = verifyCronAuth(request);
  if (authErr) return authErr;

  if (!isDBConfigured()) {
    return NextResponse.json(
      { error: 'DATABASE_URL not configured' },
      { status: 503 },
    );
  }

  // Wrap initDB + the entire batch in try/catch — without this, an
  // unhandled throw (rotated DSN, schema migration error) returns 500
  // HTML and the cron monitor's `grep "HTTP 200"` silently misses it.
  try {
  await initDB();

  const fetcher = nitterFetcher;
  const stats: PerHandleStat[] = [];

  for (let i = 0; i < TWITTER_KOLS.length; i += BATCH) {
    const batch = TWITTER_KOLS.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(async (handle): Promise<PerHandleStat> => {
        const posts = await fetcher.fetchHandle(handle);
        if (posts.length === 0) {
          return { handle, fetched: 0, inserted: 0 };
        }
        const inserted = await saveSocialPosts(
          posts.map(p => ({
            id: p.id,
            handle: p.handle,
            displayName: p.displayName,
            body: p.body,
            bodyHtml: p.bodyHtml,
            link: p.link,
            pubDate: p.pubDate,
            source: fetcher.name,
          })),
        );
        return { handle, fetched: posts.length, inserted };
      }),
    );

    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      if (r.status === 'fulfilled') {
        stats.push(r.value);
      } else {
        stats.push({
          handle: batch[j],
          fetched: 0,
          inserted: 0,
          error: String(r.reason instanceof Error ? r.reason.message : r.reason),
        });
      }
    }

    if (i + BATCH < TWITTER_KOLS.length) {
      await new Promise(resolve => setTimeout(resolve, INTER_BATCH_PAUSE_MS));
    }
  }

  // Watchdog: any handle with no fresh post in >12h. Surfaced in the response
  // and logged to Sentry-friendly stderr so on-call can see it without trawling.
  const stale = await getStaleSocialHandles(TWITTER_KOLS, STALE_HOURS);
  if (stale.length > 0) {
    console.warn(
      `[social-fetch] STALE HANDLES (>${STALE_HOURS}h since last post): ` +
      stale.map(s => `${s.handle}=${s.latestPubDate?.toISOString() ?? 'never'}`).join(', '),
    );
  }

  const totalFetched = stats.reduce((s, x) => s + x.fetched, 0);
  const totalInserted = stats.reduce((s, x) => s + x.inserted, 0);
  const errors = stats.filter(s => s.error);

  // Heartbeat — degraded if every handle errored OR more than half are
  // stale, since either indicates the underlying nitter feed is broken.
  // Was: no heartbeat — admin pipeline panel couldn't tell nitter had
  // died until users noticed missing KOL posts on /social.
  const isDegraded =
    errors.length === stats.length ||
    (stale.length > 0 && stale.length >= TWITTER_KOLS.length / 2);
  await upsertWorkerHeartbeat(
    'cron:social-fetch',
    isDegraded ? 'degraded' : 'ok',
    {
      handles: TWITTER_KOLS.length,
      totalFetched,
      totalInserted,
      errorCount: errors.length,
      staleCount: stale.length,
    },
  ).catch(e => console.error('[social-fetch] heartbeat error:', e));

  return NextResponse.json(
    {
      source: fetcher.name,
      handles: TWITTER_KOLS.length,
      totalFetched,
      totalInserted,
      errorCount: errors.length,
      staleCount: stale.length,
      staleHandles: stale.map(s => s.handle),
      stats,
      timestamp: Date.now(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[social-fetch] cron failed:', msg);
    await upsertWorkerHeartbeat('cron:social-fetch', 'degraded', {
      error: msg.slice(0, 200),
    }).catch(() => { /* heartbeat best-effort */ });
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
