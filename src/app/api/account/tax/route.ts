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

  // Pull every fill the user has — limit large for the FIFO walk.
  const trades = await listUserTrades(session.user.id, { limit: 1000 });

  // Sort ASC for FIFO walk (DB returns DESC).
  const asc = [...trades].sort((a, b) => a.ts.getTime() - b.ts.getTime());

  const summary = computeCostBasis(asc);

  return NextResponse.json({
    success: true,
    summary,
    tradeCount: trades.length,
    note: trades.length >= 1000
      ? 'Only the most recent 1000 fills are included. Full historical export coming soon.'
      : null,
    ts: Date.now(),
  }, { headers: NO_STORE });
}
