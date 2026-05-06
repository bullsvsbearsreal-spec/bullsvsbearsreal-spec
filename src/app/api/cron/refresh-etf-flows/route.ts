/**
 * Cron: pull latest BTC + ETH spot-ETF flows from Farside and write to
 * the Redis warm cache. /api/etf-flows reads from there when its own
 * direct Farside fetch returns a Cloudflare bot challenge — which
 * happens often from Edge isolates.
 *
 * Schedule: every 30 minutes (Farside posts once per US trading day so
 * we don't need to be more aggressive than that).
 *
 * Auth: Authorization: Bearer <CRON_SECRET>.
 */
import { NextRequest, NextResponse } from 'next/server';
import { fetchFarsideFlows } from '@/lib/etf-flows-fetch';
import { setWarmCache } from '@/lib/api/warm-cache';
import { verifyCronAuth } from '../_auth';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const WARM_TTL = 48 * 60 * 60; // 48h — long enough to ride out an extended bot block

export async function GET(req: NextRequest) {
  const authErr = verifyCronAuth(req);
  if (authErr) return authErr;

  const out: Record<string, { ok: boolean; days?: number; note?: string }> = {};
  for (const asset of ['btc', 'eth'] as const) {
    try {
      const r = await fetchFarsideFlows(asset);
      if (r.dataAvailable && r.days.length > 0) {
        await setWarmCache(`etf_flows_${asset}`, { days: r.days, issuers: r.issuers }, WARM_TTL);
        out[asset] = { ok: true, days: r.days.length };
      } else {
        out[asset] = { ok: false, note: r.note ?? 'no data' };
      }
    } catch (e) {
      out[asset] = { ok: false, note: e instanceof Error ? e.message : 'fetch error' };
    }
  }

  const anyOk = Object.values(out).some(v => v.ok);
  // Always return 200 — DO App Platform rewrites non-2xx route responses
  // to its own generic "via_upstream (502 -)" HTML page, which would mask
  // our structured error payload from systemd journal grepping. Signal
  // failure in the JSON body instead so the cron output stays useful.
  return NextResponse.json(
    { ok: anyOk, results: out, ts: Date.now() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
