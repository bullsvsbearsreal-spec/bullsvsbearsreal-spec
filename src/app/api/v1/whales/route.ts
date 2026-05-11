import { NextRequest, NextResponse } from 'next/server';
import { authenticateV1Request } from '@/lib/api/v1-auth';
import { isDBConfigured, getRecentTradesForWallet, getRecentWhaleTradesGlobal } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * GET /api/v1/whales
 *
 * Recent on-chain DEX whale trades. Two modes:
 *   ?address=0x...         → trades for a specific wallet (paginated newest-first)
 *   (no address)           → global recent whale trade feed across every
 *                            tracked wallet
 *
 * Query params:
 *   ?address=0x...      — optional, lower-cased EVM address or Solana base58
 *   ?chain=ethereum     — optional, restrict to one chain
 *                         (ethereum|bsc|arbitrum|base|polygon|optimism|solana)
 *   ?minValueUsd=10000  — optional, only return trades >= this notional
 *                         (ignored when ?address is set)
 *   ?limit=50           — 1..200, default 50
 *
 * Response shape:
 *   {
 *     success: true,
 *     data: [{ txHash, dex, action, address, chain, valueUsd, ... }],
 *     meta: { timestamp, entries, limit, mode: "wallet"|"global" }
 *   }
 *
 * Auth: Bearer ih_xxx (free tier OK).
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateV1Request(request);
  if (!auth.ok) return auth.response;

  if (!isDBConfigured()) {
    return NextResponse.json(
      { success: false, error: 'Database not configured' },
      { status: 503 },
    );
  }

  const { searchParams } = request.nextUrl;
  const rawAddr = (searchParams.get('address') || '').trim();
  const chain = searchParams.get('chain')?.toLowerCase() || undefined;
  const minValueUsd = Math.max(0, parseFloat(searchParams.get('minValueUsd') || '0') || 0);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 200);

  // Address-mode: validate shape before hitting the DB.
  if (rawAddr) {
    const isEvm = /^0x[a-fA-F0-9]{40}$/.test(rawAddr);
    const isSol = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(rawAddr);
    if (!isEvm && !isSol) {
      return NextResponse.json(
        { success: false, error: 'Invalid wallet address (expected EVM 0x... or Solana base58)' },
        { status: 400 },
      );
    }
    try {
      const trades = await getRecentTradesForWallet(rawAddr, chain, limit);
      return NextResponse.json({
        success: true,
        data: trades.map(t => ({
          address: t.address,
          chain: t.chain,
          txHash: t.txHash,
          dex: t.dex,
          action: t.action,
          tokenInSymbol: t.tokenInSymbol,
          amountIn: t.amountIn,
          tokenOutSymbol: t.tokenOutSymbol,
          amountOut: t.amountOut,
          valueUsd: t.valueUsd,
          blockNumber: t.blockNumber,
          blockTime: typeof t.blockTime === 'string' ? t.blockTime : new Date(t.blockTime).toISOString(),
        })),
        meta: { timestamp: Date.now(), entries: trades.length, limit, mode: 'wallet' as const },
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
          ...auth.headers,
        },
      });
    } catch (e) {
      console.error('v1/whales (wallet) error:', e);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  }

  // Global-feed mode.
  try {
    const trades = await getRecentWhaleTradesGlobal({ limit, minValueUsd, chain });
    return NextResponse.json({
      success: true,
      data: trades.map(t => ({
        address: t.address,
        chain: t.chain,
        txHash: t.txHash,
        dex: t.dex,
        action: t.action,
        tokenInSymbol: t.tokenInSymbol,
        amountIn: t.amountIn,
        tokenOutSymbol: t.tokenOutSymbol,
        amountOut: t.amountOut,
        valueUsd: t.valueUsd,
        blockNumber: t.blockNumber,
        blockTime: typeof t.blockTime === 'string' ? t.blockTime : new Date(t.blockTime).toISOString(),
      })),
      meta: { timestamp: Date.now(), entries: trades.length, limit, minValueUsd, mode: 'global' as const },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        ...auth.headers,
      },
    });
  } catch (e) {
    console.error('v1/whales (global) error:', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
