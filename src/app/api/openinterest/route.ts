import { NextResponse } from 'next/server';
import { getOIData } from '../_shared/oi-core';

export const runtime = 'nodejs';
export const preferredRegion = 'sin1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET() {
  const result = await getOIData();

  if (!result) {
    return NextResponse.json(
      { error: 'Failed to fetch OI data', data: [], health: [], meta: { timestamp: Date.now() } },
      { status: 500, headers: { 'Cache-Control': 'no-cache' } },
    );
  }

  const cacheControl = result.cacheStatus === 'STALE'
    ? 'public, s-maxage=30'
    : 'public, s-maxage=60, stale-while-revalidate=120';

  return NextResponse.json(result.result, {
    headers: { 'X-Cache': result.cacheStatus, 'Cache-Control': cacheControl },
  });
}
