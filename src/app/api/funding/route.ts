import { NextRequest, NextResponse } from 'next/server';
import { getFundingData } from '../_shared/funding-core';
import { FundingQuerySchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = FundingQuerySchema.safeParse({
    assetClass: searchParams.get('assetClass') || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid parameters', details: parsed.error.issues },
      { status: 400 },
    );
  }
  const { assetClass } = parsed.data;

  const result = await getFundingData(assetClass);

  if (!result) {
    return NextResponse.json(
      { error: 'Failed to fetch funding data', data: [], health: [], meta: { timestamp: Date.now() } },
      { status: 502, headers: { 'Cache-Control': 'no-cache' } },
    );
  }

  const cacheControl = result.cacheStatus.startsWith('STALE')
    ? 'public, s-maxage=30, stale-while-revalidate=60'
    : 'public, s-maxage=60, stale-while-revalidate=120';

  return NextResponse.json(result.result, {
    headers: { 'X-Cache': result.cacheStatus, 'Cache-Control': cacheControl },
  });
}
