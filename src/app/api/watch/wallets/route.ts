/**
 * GET  /api/watch/wallets — list current user's watched HL wallets,
 *                           with their last-seen state + recent events.
 * POST /api/watch/wallets — add an address to the user's watchlist
 *                           (creates row in hl_watched_wallets).
 *
 * Auth: required (NextAuth session).
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSQL, isDBConfigured } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

function ensureSession() {
  return auth();
}

export async function GET() {
  const session = await ensureSession();
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isDBConfigured()) return NextResponse.json({ wallets: [], events: [] });

  const sql = getSQL();
  const userId = session.user.id;

  const wallets = await sql`
    SELECT id, address, label,
           trigger_opened, trigger_closed, trigger_size_changed,
           trigger_liq_danger, trigger_realized_pnl, trigger_funding_paid,
           size_change_pct, liq_danger_pct, realized_pnl_usd, funding_paid_usd,
           created_at
    FROM hl_watched_wallets
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  ` as Array<{ id: number; address: string; label: string | null; created_at: string }>;

  // Pull the latest 50 events across all the user's watched addresses
  // (across both venues — gTrade + Hyperliquid)
  const addrs = wallets.map(w => w.address);
  const events = addrs.length === 0 ? [] : await sql`
    SELECT id, address, venue, symbol, kind, payload, ts
    FROM hl_position_events
    WHERE address = ANY(${sql.array(addrs)}::text[])
    ORDER BY ts DESC
    LIMIT 50
  `;

  // Latest snapshot per (address, venue). Defensively parse the
  // positions JSONB — postgres.js sometimes returns it as a string.
  // Without the parse, the UI sees positions=string and `.length` gives
  // a character count instead of position count (showed "16821 pos"
  // for a 2-position wallet).
  const rawSnapshots = addrs.length === 0 ? [] : await sql`
    SELECT address, venue, positions, account_value, ts
    FROM hl_position_snapshots
    WHERE address = ANY(${sql.array(addrs)}::text[])
  ` as Array<{ address: string; venue: string; positions: unknown; account_value: number | null; ts: string }>;
  const snapshots = rawSnapshots.map(s => ({
    ...s,
    positions: typeof s.positions === 'string'
      ? (() => { try { return JSON.parse(s.positions as string); } catch { return []; } })()
      : (Array.isArray(s.positions) ? s.positions : []),
  }));

  return NextResponse.json({ wallets, events, snapshots });
}

export async function POST(req: NextRequest) {
  const session = await ensureSession();
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isDBConfigured()) return NextResponse.json({ error: 'database not configured' }, { status: 503 });

  let body: { address?: string; label?: string };
  try { body = await req.json(); } catch { body = {}; }

  const address = (body.address ?? '').trim().toLowerCase();
  if (!ADDR_RE.test(address)) {
    return NextResponse.json({ error: 'invalid EVM address' }, { status: 400 });
  }
  const label = (body.label ?? '').trim().slice(0, 80) || null;

  const sql = getSQL();
  const userId = session.user.id;

  // Cap per-user watchlist at 25 to keep cron load bounded
  const [{ count }] = await sql`
    SELECT COUNT(*)::int AS count FROM hl_watched_wallets WHERE user_id = ${userId}
  ` as Array<{ count: number }>;
  if (count >= 25) {
    return NextResponse.json({ error: 'Watchlist limit reached (25). Remove one to add another.' }, { status: 409 });
  }

  try {
    const [row] = await sql`
      INSERT INTO hl_watched_wallets (user_id, address, label)
      VALUES (${userId}, ${address}, ${label})
      ON CONFLICT (user_id, address) DO UPDATE SET label = EXCLUDED.label
      RETURNING id, address, label, created_at
    ` as Array<{ id: number; address: string; label: string | null; created_at: string }>;
    return NextResponse.json({ wallet: row });
  } catch (e) {
    console.error('[watch/wallets POST] insert failed:', e);
    return NextResponse.json({ error: 'failed to add wallet' }, { status: 500 });
  }
}
