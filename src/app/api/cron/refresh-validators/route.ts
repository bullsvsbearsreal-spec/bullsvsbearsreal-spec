/**
 * Cron: pull latest LST / restaking yields from DefiLlama and write to
 * the Redis warm cache. Means /api/validators never waits on the slow
 * DefiLlama upstream during a normal request — it just reads warm.
 *
 * Schedule: every 30 minutes via systemd timer
 * (/etc/systemd/system/infohub-cron-refresh-validators.timer).
 *
 * Auth: Authorization: Bearer <CRON_SECRET>.
 */
import { NextRequest, NextResponse } from 'next/server';
import { fetchValidatorsFresh } from '@/lib/validators-data';
import { setWarmCache } from '@/lib/api/warm-cache';
import { verifyCronAuth } from '../_auth';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const WARM_KEY = 'validators';
const WARM_TTL = 90 * 60; // 90 min — generous so we don't drop the cache mid-fetch

export async function GET(req: NextRequest) {
  const authErr = verifyCronAuth(req);
  if (authErr) return authErr;

  try {
    const body = await fetchValidatorsFresh();
    if (body.totalTvl <= 0) {
      return NextResponse.json(
        { ok: false, reason: 'empty payload from DefiLlama', byAsset: {}, totalTvl: 0 },
        { status: 502, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    await setWarmCache(WARM_KEY, body, WARM_TTL);
    return NextResponse.json(
      {
        ok: true,
        totalTvl: body.totalTvl,
        assetCount: Object.keys(body.byAsset).length,
        ts: body.ts,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'failed' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
