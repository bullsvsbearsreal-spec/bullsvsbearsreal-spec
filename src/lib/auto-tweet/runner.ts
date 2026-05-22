/**
 * Auto-tweet runner — wires detectors → composer → dedup → Twitter.
 *
 * Entry point: `runAutoTweetTick()`. Designed to be called by the
 * `/api/cron/auto-tweet` route every 5 min. Safe to invoke manually
 * from /admin-panel for testing.
 *
 * Flow:
 *   1. Pull latest funding / OI / liq snapshots from the DB.
 *   2. Run pure detectors → list of AutoTweetEvents.
 *   3. Apply daily rate limit (max 12 tweets / 24h) and per-kind
 *      cooldown (30 min between tweets of same kind).
 *   4. For each surviving event: compose text, insert with UNIQUE
 *      event_id (dedup), post to Twitter (or dry-run), update row.
 *
 * Notes:
 *   - All DB writes are best-effort — a failed insert means we'll
 *     retry on the next tick. UNIQUE constraint prevents duplicates.
 *   - The runner returns stats so /api/cron/auto-tweet can log them.
 */

import { getSQL, isDBConfigured } from '@/lib/db';
import { detectFundingExtremes, detectOISpikes, detectLiqCascades } from './events';
import { composeTweet } from './templates';
import { postTweet } from './twitter';
import type {
  AutoTweetEvent,
  FundingSnapshot,
  OIDataPoint,
  LiquidationDataPoint,
} from './types';

/** Max tweets per 24h. Conservative — we want the @infohub feed to
 *  feel curated, not spammy. Bump later if needed. */
const MAX_TWEETS_PER_DAY = 12;
/** Min wall-clock ms between tweets of the same kind. */
const PER_KIND_COOLDOWN_MS = 30 * 60_000;

export interface AutoTweetTickStats {
  ok: boolean;
  detected: number;
  posted: number;
  dryRun: number;
  skipped: number;
  errors: string[];
  durationMs: number;
}

/* ─── Data loaders ────────────────────────────────────────────────── */

/** Pull the latest funding snapshot for each (symbol, exchange) pair
 *  taken in the last 15 min (matches snapshot cron cadence). */
async function loadFundingSnapshots(): Promise<FundingSnapshot[]> {
  const sql = getSQL();
  // interval_h was added to funding_snapshots (lib/db/index.ts:101) so the
  // detector can normalize venue-specific cadences (HL=1h, Kraken=4h,
  // Blofin=24h) to 8h before applying THRESHOLDS.fundingExtreme. Without
  // pulling it the detector treated everything as 8h — HL rates were
  // 8x-overstated and Blofin rates 3x-overstated when crossing the
  // threshold, producing noisy/false-positive tweets.
  const rows = await sql`
    SELECT DISTINCT ON (symbol, exchange)
      symbol, exchange, rate, interval_h, ts
    FROM funding_snapshots
    WHERE ts > NOW() - INTERVAL '15 minutes'
      AND rate IS NOT NULL
    ORDER BY symbol, exchange, ts DESC
  ` as Array<{ symbol: string; exchange: string; rate: number; interval_h: number | null; ts: Date }>;
  return rows.map(r => ({
    symbol: r.symbol,
    exchange: r.exchange,
    rate: r.rate,
    fundingInterval: null,
    intervalHours: r.interval_h,
    ts: new Date(r.ts).getTime(),
  }));
}

/** Aggregate OI per symbol at two timepoints — now and ~1h ago. */
async function loadOIBuckets(): Promise<{ current: OIDataPoint[]; oneHourAgo: OIDataPoint[] }> {
  const sql = getSQL();

  const currentRows = await sql`
    SELECT symbol, SUM(oi_usd) AS total
    FROM (
      SELECT DISTINCT ON (symbol, exchange) symbol, exchange, oi_usd
      FROM oi_snapshots
      WHERE ts > NOW() - INTERVAL '10 minutes'
      ORDER BY symbol, exchange, ts DESC
    ) latest
    GROUP BY symbol
  ` as Array<{ symbol: string; total: number }>;

  const pastRows = await sql`
    SELECT symbol, SUM(oi_usd) AS total
    FROM (
      SELECT DISTINCT ON (symbol, exchange) symbol, exchange, oi_usd
      FROM oi_snapshots
      WHERE ts > NOW() - INTERVAL '70 minutes'
        AND ts < NOW() - INTERVAL '50 minutes'
      ORDER BY symbol, exchange, ts DESC
    ) past
    GROUP BY symbol
  ` as Array<{ symbol: string; total: number }>;

  const now = Date.now();
  const past = now - 60 * 60_000;
  return {
    current: currentRows.map(r => ({ symbol: r.symbol, oiUsd: r.total, ts: now })),
    oneHourAgo: pastRows.map(r => ({ symbol: r.symbol, oiUsd: r.total, ts: past })),
  };
}

/** Pull liquidations from the last 6 minutes (gives the 5-min window
 *  detector a little slack for clock drift). */
async function loadRecentLiquidations(): Promise<LiquidationDataPoint[]> {
  const sql = getSQL();
  const rows = await sql`
    SELECT symbol, side, value_usd, ts
    FROM liquidation_snapshots
    WHERE ts > NOW() - INTERVAL '6 minutes'
      AND value_usd > 0
  ` as Array<{ symbol: string; side: string; value_usd: number; ts: Date }>;
  return rows.map(r => ({
    symbol: r.symbol,
    side: (r.side === 'long' || r.side === 'short') ? r.side : 'long',
    valueUsd: r.value_usd,
    ts: new Date(r.ts).getTime(),
  }));
}

/* ─── Throttle helpers ────────────────────────────────────────────── */

interface ThrottleState {
  postedLast24h: number;
  lastPostByKind: Map<string, number>;
}

async function loadThrottleState(): Promise<ThrottleState> {
  const sql = getSQL();
  // Count only real posts (dry-run rows don't take a slot).
  const [{ count }] = await sql`
    SELECT COUNT(*)::int AS count
    FROM auto_tweets
    WHERE posted_at IS NOT NULL
      AND posted_at > NOW() - INTERVAL '24 hours'
  ` as Array<{ count: number }>;

  const recentByKind = await sql`
    SELECT event_kind, MAX(created_at) AS last_at
    FROM auto_tweets
    WHERE posted_at IS NOT NULL
    GROUP BY event_kind
  ` as Array<{ event_kind: string; last_at: Date }>;

  const lastByKind = new Map<string, number>();
  for (const r of recentByKind) lastByKind.set(r.event_kind, new Date(r.last_at).getTime());

  return { postedLast24h: count, lastPostByKind: lastByKind };
}

function isThrottled(ev: AutoTweetEvent, state: ThrottleState, nowMs: number): string | null {
  if (state.postedLast24h >= MAX_TWEETS_PER_DAY) {
    return `daily cap reached (${state.postedLast24h}/${MAX_TWEETS_PER_DAY})`;
  }
  const last = state.lastPostByKind.get(ev.kind);
  if (last != null && nowMs - last < PER_KIND_COOLDOWN_MS) {
    const remainSec = Math.ceil((PER_KIND_COOLDOWN_MS - (nowMs - last)) / 1000);
    return `kind '${ev.kind}' on cooldown (${remainSec}s left)`;
  }
  return null;
}

/* ─── Persistence ─────────────────────────────────────────────────── */

/** Try to insert + post one event. Returns the outcome for stats. */
async function processEvent(ev: AutoTweetEvent): Promise<'posted' | 'dry-run' | 'duplicate' | 'error'> {
  const sql = getSQL();
  const text = composeTweet(ev);

  try {
    // Insert with dry_run=true initially; we'll flip it after the
    // postTweet call succeeds.
    const inserted = await sql`
      INSERT INTO auto_tweets (event_id, event_kind, symbol, venue, value, tweet_text, metadata, dry_run)
      VALUES (${ev.eventId}, ${ev.kind}, ${ev.symbol}, ${ev.venue}, ${ev.value},
              ${text}, ${JSON.stringify(ev.metadata)}::jsonb, TRUE)
      ON CONFLICT (event_id) DO NOTHING
      RETURNING id
    ` as Array<{ id: number }>;

    if (inserted.length === 0) {
      // Dedup hit — already seen this event_id.
      return 'duplicate';
    }
    const rowId = inserted[0].id;

    const result = await postTweet(text);

    if (result.dryRun) {
      // Leave dry_run=true; admin panel will show as queued.
      return 'dry-run';
    }
    if (!result.ok) {
      await sql`
        UPDATE auto_tweets
        SET error = ${result.error ?? 'unknown'}, dry_run = FALSE
        WHERE id = ${rowId}
      `;
      return 'error';
    }
    await sql`
      UPDATE auto_tweets
      SET posted_at = NOW(),
          twitter_id = ${result.tweetId},
          dry_run = FALSE
      WHERE id = ${rowId}
    `;
    return 'posted';
  } catch (e) {
    console.error('[auto-tweet] processEvent error:', e);
    return 'error';
  }
}

/* ─── Public entry point ──────────────────────────────────────────── */

export async function runAutoTweetTick(): Promise<AutoTweetTickStats> {
  const t0 = Date.now();
  const stats: AutoTweetTickStats = {
    ok: true, detected: 0, posted: 0, dryRun: 0, skipped: 0, errors: [], durationMs: 0,
  };

  if (!isDBConfigured()) {
    stats.ok = false;
    stats.errors.push('database not configured');
    stats.durationMs = Date.now() - t0;
    return stats;
  }

  try {
    const [funding, oi, liqs, throttle] = await Promise.all([
      loadFundingSnapshots(),
      loadOIBuckets(),
      loadRecentLiquidations(),
      loadThrottleState(),
    ]);

    const events: AutoTweetEvent[] = [
      ...detectFundingExtremes(funding),
      ...detectOISpikes(oi.current, oi.oneHourAgo),
      ...detectLiqCascades(liqs),
    ];
    stats.detected = events.length;

    // Sort newest detection first; we want the most timely event to get
    // the first available throttle slot if multiple kinds fire at once.
    events.sort((a, b) => b.detectedAt - a.detectedAt);

    const now = Date.now();
    for (const ev of events) {
      const reason = isThrottled(ev, throttle, now);
      if (reason) {
        stats.skipped++;
        continue;
      }
      const result = await processEvent(ev);
      switch (result) {
        case 'posted':
          stats.posted++;
          throttle.postedLast24h++;
          throttle.lastPostByKind.set(ev.kind, now);
          break;
        case 'dry-run':
          stats.dryRun++;
          break;
        case 'duplicate':
          stats.skipped++;
          break;
        case 'error':
          stats.ok = false;
          stats.errors.push(`processEvent failed for ${ev.eventId}`);
          break;
      }
    }
  } catch (e) {
    stats.ok = false;
    stats.errors.push(e instanceof Error ? e.message : 'unknown');
  }

  stats.durationMs = Date.now() - t0;
  return stats;
}
