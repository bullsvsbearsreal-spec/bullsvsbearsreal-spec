/**
 * Cron: every 60s, scan every Hyperliquid address being watched by any
 * user, diff its clearinghouseState against the last snapshot we stored,
 * and fire Telegram alerts to subscribed users for events that match
 * their per-wallet trigger settings.
 *
 * Process per address:
 *   1. fetchHLState(addr)
 *   2. Load last snapshot from hl_position_snapshots
 *   3. diffSnapshots(prev, curr) → array of WatchEvent
 *   4. For each event: insert into hl_position_events
 *   5. For each subscriber of this address:
 *      - filter events through their thresholds
 *      - dedup against hl_event_notifications
 *      - sendMessage via Telegram (if linked)
 *      - record in hl_event_notifications
 *   6. Replace the snapshot row with the new state
 *
 * Fan-out is per-event-per-user, but the HL fetch itself is per-address
 * regardless of how many users subscribe — so adding the 5th user
 * watching an address is free in terms of upstream API load.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSQL, isDBConfigured, getTelegramLinkByUser } from '@/lib/db';
import { sendMessage } from '@/lib/telegram';
import { verifyCronAuth } from '../_auth';
import {
  fetchVenueState, diffSnapshots, applyThresholds, formatEvent,
  VENUES, type AccountSnapshot, type Thresholds, type Venue, type WatchEventKind,
} from '@/lib/hl-watch';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

export async function GET(req: NextRequest) {
  const authErr = verifyCronAuth(req);
  if (authErr) return authErr;

  if (!isDBConfigured()) {
    return NextResponse.json({ ok: false, error: 'database not configured' }, { status: 503 });
  }

  const sql = getSQL();
  const t0 = Date.now();
  const stats = {
    addresses: 0,
    snapshots_fetched: 0,
    events_emitted: 0,
    notifications_sent: 0,
    errors: [] as string[],
  };

  // 1. Get unique addresses being watched
  const addrRows = await sql`
    SELECT DISTINCT address FROM hl_watched_wallets
  ` as Array<{ address: string }>;
  stats.addresses = addrRows.length;
  if (addrRows.length === 0) {
    return NextResponse.json({ ok: true, ...stats, durationMs: Date.now() - t0 });
  }

  // 2. Load all subscribers in one query (we'll group in JS)
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

  // 3. Load last snapshots in one query (across all venues for these addrs)
  const snapRows = await sql`
    SELECT address, venue, positions, account_value, ts FROM hl_position_snapshots
    WHERE address = ANY(${sql.array(addrRows.map(r => r.address))}::text[])
  ` as SnapshotRow[];
  const snapByKey = new Map<string, AccountSnapshot>();   // key = address|venue
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

  // 4. Build the (address × venue) work queue. Each (address, venue) pair
  //    is one fetch + diff job. So with 2 venues + N addresses we'll do
  //    2N HL/gTrade calls per tick, capped at concurrency 8.
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

  return NextResponse.json({ ok: true, ...stats, durationMs: Date.now() - t0 });
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

  // Always upsert the new snapshot — even if no events, we want the
  // baseline written so the next cron tick has something to diff against.
  await sql`
    INSERT INTO hl_position_snapshots (address, venue, positions, account_value, ts)
    VALUES (${addr}, ${venue}, ${JSON.stringify(curr.positions)}::jsonb, ${curr.accountValue}, NOW())
    ON CONFLICT (address, venue) DO UPDATE SET
      positions = EXCLUDED.positions,
      account_value = EXCLUDED.account_value,
      ts = EXCLUDED.ts
  `;

  if (events.length === 0) return;

  // Insert each event into the global events log; capture inserted IDs
  // for the per-user fan-out + dedup
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

  // Per-subscriber fan-out
  for (const sub of subs) {
    const tholds = rowToThresholds(sub);
    const filtered = applyThresholds(events, tholds);
    if (filtered.length === 0) continue;

    const link = await getTelegramLinkByUser(sub.user_id);
    if (!link?.chat_id) continue; // No telegram linked — skip silently

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

// Also accept POST so the admin "Trigger cron" panel can reach it
export const POST = GET;

// Tiny enum guard so we don't ship dead-code warnings if WatchEventKind
// changes — purely for compile-time validation
type _Sanity = WatchEventKind;
