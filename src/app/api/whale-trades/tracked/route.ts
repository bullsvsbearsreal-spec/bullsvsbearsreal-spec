/**
 * GET /api/whale-trades/tracked — List user's tracked wallets with latest trade info
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isDBConfigured, initDB, getTrackedWalletsForOwner, getRecentTradesForWallet } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  await initDB();
  const wallets = await getTrackedWalletsForOwner(session.user.id);

  // Attach latest trade for each wallet
  const withTrades = await Promise.all(
    wallets.map(async (w) => {
      const trades = await getRecentTradesForWallet(w.address, w.chain, 1);
      return {
        ...w,
        latestTrade: trades[0] || null,
      };
    }),
  );

  return NextResponse.json({ wallets: withTrades }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
