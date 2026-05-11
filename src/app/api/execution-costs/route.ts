import { NextRequest, NextResponse } from 'next/server';
import { calculateAllVenueCosts } from '@/lib/execution-costs/calculator';
import { Direction, ExecutionCostResponse } from '@/lib/execution-costs/types';
import { FEE_MODEL_VERSION, FEE_MODEL_UPDATED_AT } from '@/lib/constants/exchanges';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

interface CachedResult {
  data: ExecutionCostResponse;
  timestamp: number;
}
const resultCache = new Map<string, CachedResult>();
const CACHE_TTL = 10_000;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawAsset = (searchParams.get('asset') || 'BTC').toUpperCase();
  const asset = /^[A-Z0-9]+$/.test(rawAsset) ? rawAsset : 'BTC';
  const size = Math.max(1000, Math.min(10_000_000, Number(searchParams.get('size')) || 100_000));
  const direction = (searchParams.get('direction') || 'long') as Direction;

  if (!['long', 'short'].includes(direction)) {
    return NextResponse.json({ error: 'Invalid direction' }, { status: 400 });
  }

  const cacheKey = `${asset}:${direction}:${size}`;
  const cached = resultCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' },
    });
  }

  try {
    const venues = await calculateAllVenueCosts(asset, size, direction);
    const response: ExecutionCostResponse = { asset, size, direction, timestamp: Date.now(), venues };

    resultCache.set(cacheKey, { data: response, timestamp: Date.now() });
    if (resultCache.size > 200) {
      const now = Date.now();
      const keys = Array.from(resultCache.keys());
      keys.forEach(key => {
        const val = resultCache.get(key);
        if (val && now - val.timestamp > CACHE_TTL * 6) resultCache.delete(key);
      });
    }

    return NextResponse.json(response, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
        // Surface the fee-model identifier so cost-calc consumers know
        // which fee table the venue.fee values came from. Same convention
        // as /api/v1/arbitrage and /api/v1/spreads.
        'X-Fee-Model-Version': FEE_MODEL_VERSION,
        'X-Fee-Model-Updated-At': FEE_MODEL_UPDATED_AT,
      },
    });
  } catch (error) {
    console.error('Execution cost API error:', error);
    if (cached) {
      return NextResponse.json(cached.data, { headers: { 'X-Cache': 'STALE' } });
    }
    return NextResponse.json({ error: 'Failed to calculate execution costs' }, { status: 502 });
  }
}
