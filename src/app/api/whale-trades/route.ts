/**
 * GET /api/whale-trades?address=0x...&chain=ethereum&limit=20
 *
 * Returns recent DEX trades for a wallet address.
 * Pulls from DB if available, otherwise live-fetches.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isDBConfigured, initDB, getRecentTradesForWallet } from '@/lib/db';
import { detectTrades, detectChain } from '@/lib/whale-trades';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const rawAddr = (searchParams.get('address') || '').trim();
  const chain = searchParams.get('chain') || detectChain(rawAddr);
  const limit = Math.min(parseInt(searchParams.get('limit') || '20') || 20, 50);

  if (!rawAddr || (!/^0x[a-fA-F0-9]{40}$/i.test(rawAddr) && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(rawAddr))) {
    return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
  }

  // Try DB first
  if (isDBConfigured()) {
    await initDB();
    const dbTrades = await getRecentTradesForWallet(rawAddr, chain, limit);
    if (dbTrades.length > 0) {
      return NextResponse.json({
        address: rawAddr.toLowerCase(),
        chain,
        trades: dbTrades,
        source: 'db',
      }, {
        headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
      });
    }
  }

  // Live fetch
  try {
    const trades = await detectTrades(rawAddr, chain);
    return NextResponse.json({
      address: rawAddr.toLowerCase(),
      chain,
      trades: trades.map(t => ({
        txHash: t.txHash, dex: t.dex, action: t.action,
        tokenInSymbol: t.tokenInSymbol, amountIn: t.amountIn,
        tokenOutSymbol: t.tokenOutSymbol, amountOut: t.amountOut,
        valueUsd: t.valueUsd, blockTime: t.blockTime.toISOString(),
        chain: t.chain,
      })),
      source: 'live',
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch trades' }, { status: 502 });
  }
}
