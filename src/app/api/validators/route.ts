/**
 * GET /api/validators
 *
 * Liquid-staking + native staking yields across ETH, SOL, and other major
 * PoS chains. Pulls DefiLlama Yields filtered to known LST/LSD projects.
 *
 * Cache hierarchy (fastest → slowest):
 *   1. In-process L1 (single slot, 30 min TTL) — sub-millisecond.
 *   2. Upstash Redis warm cache populated by cron/refresh-validators —
 *      ~10-30 ms per call. Survives Edge cold starts.
 *   3. Live DefiLlama fetch (12 s+) — only used when both caches are
 *      empty (very cold start) or stale.
 *
 * The cron refresh keeps the warm cache populated so /api/validators
 * never has to wait for DefiLlama on the request hot path.
 */
import { NextResponse } from 'next/server';
import { fetchValidatorsFresh, type ValidatorsResponse } from '@/lib/validators-data';
import { getWarmCache } from '@/lib/api/warm-cache';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

const WARM_KEY = 'validators';
let l1: { body: ValidatorsResponse; ts: number } | null = null;
const L1_TTL = 30 * 60 * 1000;
const WARM_FRESHNESS_MS = 60 * 60 * 1000; // accept Redis entries up to 1h old

export async function GET() {
  // L1
  if (l1 && Date.now() - l1.ts < L1_TTL) {
    return NextResponse.json(l1.body, {
      headers: { 'X-Cache': 'L1', 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' },
    });
  }

  // L2 (Redis warm cache, written by cron/refresh-validators)
  try {
    const warm = await getWarmCache<ValidatorsResponse>(WARM_KEY);
    if (warm && Date.now() - warm.ts < WARM_FRESHNESS_MS && warm.body?.totalTvl > 0) {
      l1 = { body: warm.body, ts: Date.now() };
      return NextResponse.json(warm.body, {
        headers: { 'X-Cache': 'WARM', 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' },
      });
    }
  } catch { /* fall through to live fetch */ }

  // Live fetch
  try {
    const body = await fetchValidatorsFresh();
    if (body.totalTvl > 0) l1 = { body, ts: Date.now() };
    return NextResponse.json(body, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': body.totalTvl > 0
          ? 'public, s-maxage=900, stale-while-revalidate=3600'
          : 'no-store',
      },
    });
  } catch (e) {
    if (l1) {
      return NextResponse.json(l1.body, {
        headers: { 'X-Cache': 'STALE', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=1800' },
      });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'failed', byAsset: {} },
      { status: 502 },
    );
  }
}
