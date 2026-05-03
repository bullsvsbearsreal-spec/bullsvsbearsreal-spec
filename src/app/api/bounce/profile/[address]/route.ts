/**
 * GET /api/bounce/profile/[address]
 *
 * Per-wallet rekt profile from bounce.tech. Returns:
 *   • total notional + count
 *   • top-% ranking (e.g. 0.006 = top 0.006%)
 *   • global rank
 *   • the 0-1000 score
 *   • per-asset breakdown (top coins rekt on)
 *   • first liquidation details
 *   • liquidationsPerMonth time series
 *   • rarestAsset (weirdest thing they got rekt on)
 *   • whether claimed
 *
 * Upstream:
 *   GET https://api.bounce.tech/liquidation-data/{lowerCaseAddress}
 *
 * Cache: 10 min per address (data is historical + slow-moving).
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

interface BounceAssetBreakdown {
  asset: string;
  totalLiquidationNotional: number;
  totalLiquidationCount: number;
  topPercent: number;
}

interface BounceFirstLiq {
  timestamp: number;
  asset: string;
  notional: number;
  isLong: boolean;
  price: number;
}

interface BounceMonthly {
  month: string;         // e.g. '2025-04' or an ISO-like key
  totalLiquidationNotional: number;
  totalLiquidationCount: number;
}

interface BounceProfile {
  user: string;
  totalLiquidationNotional: number;
  totalLiquidationCount: number;
  topPercent: number;
  rank: number | null;
  liquidatedOnTenthOfOctober2025: boolean;
  rarestAsset: string | null;
  firstLiquidation: BounceFirstLiq | null;
  assets: BounceAssetBreakdown[];
  liquidationsPerMonth: BounceMonthly[];
  score: number;
  hasClaimed: boolean;
}

const cache = new Map<string, { body: any; ts: number }>();
const CACHE_TTL = 600_000; // 10 min

function isEvmAddress(s: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(s);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { address: string } },
) {
  const raw = (params.address || '').trim();
  if (!isEvmAddress(raw)) {
    return NextResponse.json({ error: 'invalid address', data: null }, { status: 400 });
  }
  const address = raw.toLowerCase();

  const cacheKey = `bounce-profile:${address}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.body, { headers: { 'X-Cache': 'HIT' } });
  }

  try {
    const url = `https://api.bounce.tech/liquidation-data/${address}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'Accept': 'application/json', 'User-Agent': 'InfoHub/2.0 (info-hub.io)' },
    });
    if (!res.ok) {
      return NextResponse.json({ error: `bounce.tech ${res.status}`, data: null }, { status: 502 });
    }
    const json = await res.json();
    if (json?.status !== 'success' || !json?.data) {
      return NextResponse.json({ error: json?.error || 'bounce.tech error', data: null }, { status: 502 });
    }

    const d: BounceProfile = json.data;
    // Defensive normalization so the client never has to null-check.
    const body = {
      address,
      totalNotional: d.totalLiquidationNotional ?? 0,
      count: d.totalLiquidationCount ?? 0,
      topPercent: d.topPercent ?? 0,
      rank: d.rank ?? null,
      score: d.score ?? 0,
      hasClaimed: !!d.hasClaimed,
      liquidatedOnOct10: !!d.liquidatedOnTenthOfOctober2025,
      rarestAsset: d.rarestAsset ?? null,
      firstLiquidation: d.firstLiquidation ?? null,
      assets: Array.isArray(d.assets) ? d.assets : [],
      monthly: Array.isArray(d.liquidationsPerMonth) ? d.liquidationsPerMonth : [],
      meta: {
        source: 'bounce.tech',
        timestamp: Date.now(),
        bounceProfileUrl: `https://bounce.tech/profile/${address}`,
        bounceRegisterUrl: 'https://bounce.tech/register',
      },
    };

    cache.set(cacheKey, { body, ts: Date.now() });
    return NextResponse.json(body, {
      headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    console.error('[bounce-profile] error:', msg);
    return NextResponse.json({ error: msg, data: null }, { status: 502 });
  }
}
