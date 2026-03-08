import { NextRequest, NextResponse } from 'next/server';
import { calculateAllVenueCosts } from '@/lib/execution-costs/calculator';
import { Direction, ExecutionCostResponse } from '@/lib/execution-costs/types';

export const runtime = 'nodejs';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';

interface CachedResult {
  data: ExecutionCostResponse;
  timestamp: number;
}
const resultCache = new Map<string, CachedResult>();
const CACHE_TTL = 10_000;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const asset = (searchParams.get('asset') || 'BTC').toUpperCase();
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
      headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' },
    });
  } catch (error) {
    console.error('Execution cost API error:', error);
    if (cached) {
      return NextResponse.json(cached.data, { headers: { 'X-Cache': 'STALE' } });
    }
    return NextResponse.json({ error: 'Failed to calculate execution costs' }, { status: 502 });
  }
}
