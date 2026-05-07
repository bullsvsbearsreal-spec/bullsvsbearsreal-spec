import { NextRequest, NextResponse } from 'next/server';
import { authenticateV1Request } from '@/lib/api/v1-auth';
import { fetchRestakingPools } from '@/lib/restaking';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/restaking
 *
 * Restaking yield aggregator across EigenLayer, Symbiotic, Karak, Babylon,
 * and the LRT ecosystem (Renzo, EtherFi, Kelp, Puffer, etc.). Source:
 * DeFi Llama yields.
 *
 * Query params:
 *   ?protocol=eigenlayer|symbiotic|karak|babylon|renzo|etherfi|kelp|puffer
 *   ?chain=Ethereum|Arbitrum|Base
 *   ?minTvl=1000000   — exclude pools below N USD TVL (default 1e6)
 *   ?sort=tvl|apy     — sort key (default: tvl)
 *   ?limit=100        — max rows
 *
 * Auth: Bearer ih_xxx (free tier OK).
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateV1Request(request);
  if (!auth.ok) return auth.response;

  const protoFilter = request.nextUrl.searchParams.get('protocol')?.toLowerCase() || undefined;
  const chainFilter = request.nextUrl.searchParams.get('chain') || undefined;
  const minTvl = Math.max(0, parseFloat(request.nextUrl.searchParams.get('minTvl') ?? '1000000') || 0);
  const sort = request.nextUrl.searchParams.get('sort') === 'apy' ? 'apy' : 'tvl';
  const limit = Math.min(Math.max(parseInt(request.nextUrl.searchParams.get('limit') ?? '100', 10) || 100, 1), 500);

  try {
    const feed = await fetchRestakingPools();
    let pools = feed.pools;
    if (protoFilter) pools = pools.filter(p => p.protocol.toLowerCase().includes(protoFilter));
    if (chainFilter) pools = pools.filter(p => p.chain === chainFilter);
    pools = pools.filter(p => p.tvlUsd >= minTvl);
    pools = sort === 'apy'
      ? [...pools].sort((a, b) => b.apy - a.apy)
      : [...pools].sort((a, b) => b.tvlUsd - a.tvlUsd);
    pools = pools.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: pools,
      summary: feed.summary,
      meta: { timestamp: feed.ts, sort, limit, protocol: protoFilter ?? null, chain: chainFilter ?? null, minTvl },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800',
        ...auth.headers,
      },
    });
  } catch (e) {
    console.error('v1/restaking error:', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
