/**
 * Wallet-watcher tick — extracted from the cron route so it can be
 * called both via the public `/api/cron/watch-hl-wallets` endpoint
 * AND directly by `/api/cron/snapshot` (which runs every 60s on the
 * droplet) without an extra HTTP roundtrip + fire-and-forget reliability
 * concerns.
 *
 * Per CLAUDE.md: don't fetch your own routes from another route handler
 * — import the underlying logic from `lib/`. This file is the lib.
 */
import { getSQL, isDBConfigured, getTelegramLinkByUser } from '@/lib/db';
import { sendMessage } from '@/lib/telegram';
import {
  fetchVenueState, diffSnapshots, applyThresholds, formatEvent,
  VENUES, type AccountSnapshot, type Thresholds, type Venue,
} from '@/lib/hl-watch';

export interface WatchTickStats {
  ok: boolean;
  addresses: number;
  snapshots_fetched: number;
  events_emitted: number;
  notifications_sent: number;
  errors: string[];
  durationMs: number;
}

interface SubscriberRow {
  id: number;
  user_id: string;
  address: string;
  label: string | null;
  trigger_opened: boolean;
  trigger_closed: boolean;
  trigger_size_changed: boolean;
  trigger_liq_danger: boolean;
  trigger_realized_pnl: boolean;
  trigger_funding_paid: boolean;
  size_change_pct: number;
  liq_danger_pct: number;
  realized_pnl_usd: number;
  funding_paid_usd: number;
}

interface SnapshotRow { address: string; venue: string; positions: unknown; account_value: number | null; ts: string }

function rowToThresholds(r: SubscriberRow): Thresholds {
  return {
    triggerOpened: r.trigger_opened,
    triggerClosed: r.trigger_closed,
    triggerSizeChanged: r.trigger_size_changed,
    triggerLiqDanger: r.trigger_liq_danger,
    triggerRealizedPnl: r.trigger_realized_pnl,
    triggerFundingPaid: r.trigger_funding_paid,
    sizeChangePct: r.size_change_pct,
    liqDangerPct: r.liq_danger_pct,
    realizedPnlUsd: r.realized_pnl_usd,
    fundingPaidUsd: r.funding_paid_usd,
  };
}

/** Process-local mutex — prevents two runWatchTick calls from racing on
 *  the same address (which would cause both to read the same prevSnap,
 *  diff the same delta, insert TWO event rows, and fire duplicate
 *  Telegram pings since dedup is keyed on event_id and the rows have
 *  different ids). The piggyback from /api/cron/snapshot is the canonical
 *  trigger; this guard is defensive against:
 *    - Manual /admin-panel#actions trigger while a snapshot tick is running
 *    - A future systemd timer ever being added without removing the piggyback
 *    - Multiple snapshot crons accidentally overlapping (e.g. timer drift)
 *  Cooldown of 30s also acts as a soft rate-limit against admin spam. */
let lastTickAt = 0;
let inFlight: Promise<WatchTickStats> | null = null;
const MIN_TICK_INTERVAL_MS = 30_000;

/** Run one watcher tick — scan watched addresses, diff, fan out events to
 *  subscribed users, and update the snapshots. Returns stats so the caller
 *  can log / surface them. Safe to call from either an HTTP handler or
 *  another cron route. */
export async function runWatchTick(): Promise<WatchTickStats> {
  // Re-entry guard: if a tick is currently running, return its in-flight
  // promise so the second caller waits for the first one to finish rather
  // than spawning a duplicate.
  if (inFlight) return inFlight;

  // Soft cooldown: skip if the last tick completed less than 30s ago.
  // Returns a "skipped" stats object so callers know nothing new happened.
  const sinceLast = Date.now() - lastTickAt;
  if (sinceLast < MIN_TICK_INTERVAL_MS) {
    return {
      ok: true,
      addresses: 0,
      snapshots_fetched: 0,
      events_emitted: 0,
      notifications_sent: 0,
      errors: [`skipped: last tick ${Math.round(sinceLast / 1000)}s ago (min ${MIN_TICK_INTERVAL_MS / 1000}s)`],
      durationMs: 0,
    };
  }

  inFlight = runTickInner();
  try {
    const result = await inFlight;
    lastTickAt = Date.now();
    return result;
  } finally {
    inFlight = null;
  }
}

async function runTickInner(): Promise<WatchTickStats> {
  const t0 = Date.now();
  const stats: Omit<WatchTickStats, 'durationMs'> = {
    ok: true,
    addresses: 0,
    snapshots_fetched: 0,
    events_emitted: 0,
    notifications_sent: 0,
    errors: [],
  };

  if (!isDBConfigured()) {
    return { ...stats, ok: false, errors: ['database not configured'], durationMs: Date.now() - t0 };
  }

  const sql = getSQL();

  const addrRows = await sql`
    SELECT DISTINCT address FROM hl_watched_wallets
  ` as Array<{ address: string }>;
  stats.addresses = addrRows.length;
  if (addrRows.length === 0) return { ...stats, durationMs: Date.now() - t0 };

  const subRows = await sql`
    SELECT id, user_id, address, label,
           trigger_opened, trigger_closed, trigger_size_changed,
           trigger_liq_danger, trigger_realized_pnl, trigger_funding_paid,
           size_change_pct, liq_danger_pct, realized_pnl_usd, funding_paid_usd
    FROM hl_watched_wallets
  ` as SubscriberRow[];
  const subsByAddr = new Map<string, SubscriberRow[]>();
  for (const r of subRows) {
    const list = subsByAddr.get(r.address) ?? [];
    list.push(r);
    subsByAddr.set(r.address, list);
  }

  const snapRows = await sql`
    SELECT address, venue, positions, account_value, ts FROM hl_position_snapshots
    WHERE address = ANY(${sql.array(addrRows.map(r => r.address))}::text[])
  ` as SnapshotRow[];
  const snapByKey = new Map<string, AccountSnapshot>();
  for (const r of snapRows) {
    const venue = (r.venue || 'hyperliquid') as Venue;
    snapByKey.set(`${r.address}|${venue}`, {
      address: r.address,
      venue,
      positions: Array.isArray(r.positions) ? r.positions as AccountSnapshot['positions'] : [],
      accountValue: r.account_value ?? 0,
      ts: new Date(r.ts).getTime(),
    });
  }

  const CONCURRENCY = 8;
  type Job = { address: string; venue: Venue };
  const queue: Job[] = [];
  for (const r of addrRows) for (const v of VENUES) queue.push({ address: r.address, venue: v });
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (true) {
      const job = queue.shift();
      if (!job) return;
      const key = `${job.address}|${job.venue}`;
      try {
        await processAddressVenue(job.address, job.venue, subsByAddr.get(job.address) ?? [], snapByKey.get(key) ?? null, sql, stats);
      } catch (e) {
        stats.errors.push(`${job.address.slice(0, 8)}/${job.venue}: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    }
  });
  await Promise.all(workers);

  return { ...stats, durationMs: Date.now() - t0 };
}

async function processAddressVenue(
  addr: string,
  venue: Venue,
  subs: SubscriberRow[],
  prevSnap: AccountSnapshot | null,
  sql: ReturnType<typeof getSQL>,
  stats: { snapshots_fetched: number; events_emitted: number; notifications_sent: number; errors: string[] },
) {
  const curr = await fetchVenueState(addr, venue);
  if (!curr) {
    stats.errors.push(`fetch failed: ${addr.slice(0, 8)}/${venue}`);
    return;
  }
  stats.snapshots_fetched++;

  const events = diffSnapshots(prevSnap, curr);

  await sql`
    INSERT INTO hl_position_snapshots (address, venue, positions, account_value, ts)
    VALUES (${addr}, ${venue}, ${JSON.stringify(curr.positions)}::jsonb, ${curr.accountValue}, NOW())
    ON CONFLICT (address, venue) DO UPDATE SET
      positions = EXCLUDED.positions,
      account_value = EXCLUDED.account_value,
      ts = EXCLUDED.ts
  `;

  if (events.length === 0) return;

  const insertedIds: Array<{ id: number; eventIdx: number }> = [];
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    try {
      const [row] = await sql`
        INSERT INTO hl_position_events (address, venue, symbol, kind, payload, ts)
        VALUES (${addr}, ${venue}, ${e.symbol}, ${e.kind}, ${JSON.stringify(e.payload)}::jsonb, NOW())
        RETURNING id
      ` as Array<{ id: number }>;
      insertedIds.push({ id: row.id, eventIdx: i });
      stats.events_emitted++;
    } catch (err) {
      stats.errors.push(`insert event ${addr.slice(0, 8)}/${venue}/${e.kind}: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  for (const sub of subs) {
    const tholds = rowToThresholds(sub);
    const filtered = applyThresholds(events, tholds);
    if (filtered.length === 0) continue;

    const link = await getTelegramLinkByUser(sub.user_id);
    if (!link?.chat_id) continue;

    let sentInTick = 0;
    for (const e of filtered) {
      if (sentInTick >= 5) break;
      const matchedIdx = events.indexOf(e);
      const inserted = insertedIds.find(x => x.eventIdx === matchedIdx);
      if (!inserted) continue;

      const dupRows = await sql`
        SELECT 1 FROM hl_event_notifications
        WHERE user_id = ${sub.user_id} AND event_id = ${inserted.id} AND channel = 'telegram'
        LIMIT 1
      ` as Array<{ '?column?': number }>;
      if (dupRows.length > 0) continue;

      const text = formatEvent(e, addr, sub.label ?? undefined, venue);
      try {
        const ok = await sendMessage(link.chat_id, text, 'Markdown');
        if (ok) {
          await sql`
            INSERT INTO hl_event_notifications (user_id, event_id, channel)
            VALUES (${sub.user_id}, ${inserted.id}, 'telegram')
            ON CONFLICT (user_id, event_id, channel) DO NOTHING
          `;
          stats.notifications_sent++;
          sentInTick++;
        }
      } catch (err) {
        stats.errors.push(`tg ${sub.user_id.slice(0, 6)}: ${err instanceof Error ? err.message : 'unknown'}`);
      }
    }
  }
}
