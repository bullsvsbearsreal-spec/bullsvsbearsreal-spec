/**
 * Cron entry point — every 60s, scan every watched wallet across both
 * Hyperliquid and gTrade, diff against the last snapshot, fan out
 * Telegram alerts to subscribed users for matching trigger types.
 *
 * The actual work lives in `lib/hl-watch-runner.ts` so the same logic
 * can be invoked directly from `/api/cron/snapshot` without an HTTP
 * roundtrip (per CLAUDE.md "don't fetch your own routes" rule).
 */
import { NextRequest, NextResponse } from 'next/server';
import { runWatchTick } from '@/lib/hl-watch-runner';
import { upsertWorkerHeartbeat } from '@/lib/db';
import { verifyCronAuth } from '../_auth';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authErr = verifyCronAuth(req);
  if (authErr) return authErr;
  const startedAt = Date.now();
  let status: 'ok' | 'degraded' = 'ok';
  let stats: any;
  try {
    stats = await runWatchTick();
  } catch (e) {
    status = 'degraded';
    stats = { error: e instanceof Error ? e.message : String(e) };
  }
  await upsertWorkerHeartbeat('cron:watch-hl-wallets', status, {
    elapsedMs: Date.now() - startedAt,
    ...(stats && typeof stats === 'object' ? stats : {}),
  }).catch(() => {});
  if (status === 'degraded') {
    return NextResponse.json(stats, { status: 500 });
  }
  return NextResponse.json(stats);
}

export const POST = GET;
