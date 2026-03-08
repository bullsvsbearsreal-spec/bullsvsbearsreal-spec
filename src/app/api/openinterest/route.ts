import { NextRequest, NextResponse } from 'next/server';
import { getOIData, getOIChanges } from '../_shared/oi-core';

export const runtime = 'nodejs';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(request: NextRequest) {
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

  // Optionally include OI change % when ?changes=1
  const includeChanges = request.nextUrl.searchParams.get('changes') === '1';
  const response: any = { ...result.result };
  if (includeChanges) {
    const { changes, snapshotCount } = getOIChanges();
    // Serialize Map to object for JSON
    const changesObj: Record<string, { pct1h?: number; pct4h?: number; pct24h?: number }> = {};
    changes.forEach((ch, sym) => { changesObj[sym] = ch; });
    response.oiChanges = changesObj;
    response.meta = { ...response.meta, snapshotCount };
  }

  return NextResponse.json(response, {
    headers: { 'X-Cache': result.cacheStatus, 'Cache-Control': cacheControl },
  });
}
