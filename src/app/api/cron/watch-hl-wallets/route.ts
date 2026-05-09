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
  fetchHLState, diffSnapshots, applyThresholds, formatEvent,
  type AccountSnapshot, type Thresholds, type WatchEventKind,
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

interface SnapshotRow { address: string; positions: unknown; account_value: number | null; ts: string }

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

  // 3. Load last snapshots in one query
  const snapRows = await sql`
    SELECT address, positions, account_value, ts FROM hl_position_snapshots
    WHERE address = ANY(${sql.array(addrRows.map(r => r.address))}::text[])
  ` as SnapshotRow[];
  const snapByAddr = new Map<string, AccountSnapshot>();
  for (const r of snapRows) {
    snapByAddr.set(r.address, {
      address: r.address,
      positions: Array.isArray(r.positions) ? r.positions as AccountSnapshot['positions'] : [],
      accountValue: r.account_value ?? 0,
      ts: new Date(r.ts).getTime(),
    });
  }

  // 4. Process each address — fetch in parallel for speed, but cap concurrency to 8
  const CONCURRENCY = 8;
  const queue = addrRows.map(r => r.address);
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (true) {
      const addr = queue.shift();
      if (!addr) return;
      try {
        await processAddress(addr, subsByAddr.get(addr) ?? [], snapByAddr.get(addr) ?? null, sql, stats);
      } catch (e) {
        stats.errors.push(`${addr.slice(0, 8)}: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    }
  });
  await Promise.all(workers);

  return NextResponse.json({ ok: true, ...stats, durationMs: Date.now() - t0 });
}

async function processAddress(
  addr: string,
  subs: SubscriberRow[],
  prevSnap: AccountSnapshot | null,
  sql: ReturnType<typeof getSQL>,
  stats: { snapshots_fetched: number; events_emitted: number; notifications_sent: number; errors: string[] },
) {
  const curr = await fetchHLState(addr);
  if (!curr) {
    stats.errors.push(`fetch failed: ${addr.slice(0, 8)}`);
    return;
  }
  stats.snapshots_fetched++;

  const events = diffSnapshots(prevSnap, curr);

  // Always upsert the new snapshot — even if no events, we want the
  // baseline written so the next cron tick has something to diff against.
  await sql`
    INSERT INTO hl_position_snapshots (address, positions, account_value, ts)
    VALUES (${addr}, ${JSON.stringify(curr.positions)}::jsonb, ${curr.accountValue}, NOW())
    ON CONFLICT (address) DO UPDATE SET
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
        INSERT INTO hl_position_events (address, symbol, kind, payload, ts)
        VALUES (${addr}, ${e.symbol}, ${e.kind}, ${JSON.stringify(e.payload)}::jsonb, NOW())
        RETURNING id
      ` as Array<{ id: number }>;
      insertedIds.push({ id: row.id, eventIdx: i });
      stats.events_emitted++;
    } catch (err) {
      stats.errors.push(`insert event ${addr.slice(0, 8)}/${e.kind}: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  // Per-subscriber fan-out
  for (const sub of subs) {
    const tholds = rowToThresholds(sub);
    const filtered = applyThresholds(events, tholds);
    if (filtered.length === 0) continue;

    const link = await getTelegramLinkByUser(sub.user_id);
    if (!link?.chat_id) continue; // No telegram linked — skip silently

    // Send one message per event so the user can act on each one
    // individually. Cap at 5 per cron tick per user to avoid spamming.
    let sentInTick = 0;
    for (const e of filtered) {
      if (sentInTick >= 5) break;
      const matchedIdx = events.indexOf(e);
      const inserted = insertedIds.find(x => x.eventIdx === matchedIdx);
      if (!inserted) continue;

      // Dedup — skip if we already pinged this user for this event
      const dupRows = await sql`
        SELECT 1 FROM hl_event_notifications
        WHERE user_id = ${sub.user_id} AND event_id = ${inserted.id} AND channel = 'telegram'
        LIMIT 1
      ` as Array<{ '?column?': number }>;
      if (dupRows.length > 0) continue;

      const text = formatEvent(e, addr, sub.label ?? undefined);
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
