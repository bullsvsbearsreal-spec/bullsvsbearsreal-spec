/**
 * GET /api/account/tax
 *
 * Returns the caller's FIFO cost-basis summary computed over their entire
 * user_trades history. Authenticated. The heavy lift happens in
 * lib/cost-basis.ts; this route just orchestrates and shapes the response.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isDBConfigured, listUserTrades } from '@/lib/db';
import { computeCostBasis } from '@/lib/cost-basis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(_request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'DB unavailable' }, { status: 503, headers: NO_STORE });
  }

  // Pull every fill the user has — limit large enough for an active
  // trader's full history. Cap matches the DB-level ceiling so a user
  // who somehow has more would see a "truncated" note instead of
  // silent loss.
  const FULL_HISTORY_CAP = 50_000;
  const trades = await listUserTrades(session.user.id, { limit: FULL_HISTORY_CAP });

  // Sort ASC for FIFO walk (DB returns DESC).
  const asc = [...trades].sort((a, b) => a.ts.getTime() - b.ts.getTime());

  const summary = computeCostBasis(asc);

  return NextResponse.json({
    success: true,
    summary,
    tradeCount: trades.length,
    note: trades.length >= FULL_HISTORY_CAP
      ? `Only the most recent ${FULL_HISTORY_CAP.toLocaleString()} fills are included. Contact support if you need a deeper export.`
      : null,
    ts: Date.now(),
  }, { headers: NO_STORE });
}
