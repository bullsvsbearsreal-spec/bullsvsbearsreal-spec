/**
 * PUT    /api/watch/wallets/[id] — update label / triggers / thresholds.
 * DELETE /api/watch/wallets/[id] — remove wallet from user's watchlist.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSQL, isDBConfigured } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

interface UpdateBody {
  label?: string | null;
  triggerOpened?: boolean;
  triggerClosed?: boolean;
  triggerSizeChanged?: boolean;
  triggerLiqDanger?: boolean;
  triggerRealizedPnl?: boolean;
  triggerFundingPaid?: boolean;
  sizeChangePct?: number;
  liqDangerPct?: number;
  realizedPnlUsd?: number;
  fundingPaidUsd?: number;
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isDBConfigured()) return NextResponse.json({ error: 'database not configured' }, { status: 503 });

  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });

  let body: UpdateBody;
  try { body = await req.json(); } catch { body = {}; }

  const sql = getSQL();
  const userId = session.user.id;

  // Verify ownership before update
  const [own] = await sql`SELECT id FROM hl_watched_wallets WHERE id = ${id} AND user_id = ${userId}` as Array<{ id: number }>;
  if (!own) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // Build patch — only update fields the caller sent, keep the rest
  const label = body.label === undefined ? undefined : (body.label ?? '').trim().slice(0, 80) || null;
  const clamp01 = (n: number | undefined, fallback: number) =>
    n === undefined ? fallback : Math.max(0, Math.min(1, Number(n) || fallback));
  const clampUsd = (n: number | undefined, fallback: number) =>
    n === undefined ? fallback : Math.max(0, Number(n) || fallback);

  // Read existing thresholds so we don't have to send everything every PUT
  const [existing] = await sql`
    SELECT trigger_opened, trigger_closed, trigger_size_changed,
           trigger_liq_danger, trigger_realized_pnl, trigger_funding_paid,
           size_change_pct, liq_danger_pct, realized_pnl_usd, funding_paid_usd, label
    FROM hl_watched_wallets WHERE id = ${id}
  ` as Array<{
    trigger_opened: boolean; trigger_closed: boolean; trigger_size_changed: boolean;
    trigger_liq_danger: boolean; trigger_realized_pnl: boolean; trigger_funding_paid: boolean;
    size_change_pct: number; liq_danger_pct: number; realized_pnl_usd: number; funding_paid_usd: number;
    label: string | null;
  }>;
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const next = {
    label: label === undefined ? existing.label : label,
    triggerOpened: body.triggerOpened ?? existing.trigger_opened,
    triggerClosed: body.triggerClosed ?? existing.trigger_closed,
    triggerSizeChanged: body.triggerSizeChanged ?? existing.trigger_size_changed,
    triggerLiqDanger: body.triggerLiqDanger ?? existing.trigger_liq_danger,
    triggerRealizedPnl: body.triggerRealizedPnl ?? existing.trigger_realized_pnl,
    triggerFundingPaid: body.triggerFundingPaid ?? existing.trigger_funding_paid,
    sizeChangePct: clamp01(body.sizeChangePct, existing.size_change_pct),
    liqDangerPct: clamp01(body.liqDangerPct, existing.liq_danger_pct),
    realizedPnlUsd: clampUsd(body.realizedPnlUsd, existing.realized_pnl_usd),
    fundingPaidUsd: clampUsd(body.fundingPaidUsd, existing.funding_paid_usd),
  };

  await sql`
    UPDATE hl_watched_wallets SET
      label = ${next.label},
      trigger_opened = ${next.triggerOpened},
      trigger_closed = ${next.triggerClosed},
      trigger_size_changed = ${next.triggerSizeChanged},
      trigger_liq_danger = ${next.triggerLiqDanger},
      trigger_realized_pnl = ${next.triggerRealizedPnl},
      trigger_funding_paid = ${next.triggerFundingPaid},
      size_change_pct = ${next.sizeChangePct},
      liq_danger_pct = ${next.liqDangerPct},
      realized_pnl_usd = ${next.realizedPnlUsd},
      funding_paid_usd = ${next.fundingPaidUsd}
    WHERE id = ${id} AND user_id = ${userId}
  `;
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isDBConfigured()) return NextResponse.json({ error: 'database not configured' }, { status: 503 });

  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });

  const sql = getSQL();
  await sql`DELETE FROM hl_watched_wallets WHERE id = ${id} AND user_id = ${session.user.id}`;
  return NextResponse.json({ ok: true });
}
