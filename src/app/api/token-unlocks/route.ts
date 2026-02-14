import { NextResponse } from 'next/server';
import { fetchAllUnlocks } from '@/lib/api/tokenunlocks';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';

export async function GET() {
  const unlocks = await fetchAllUnlocks();
  return NextResponse.json({ unlocks, meta: { total: unlocks.length, timestamp: Date.now() } });
}
