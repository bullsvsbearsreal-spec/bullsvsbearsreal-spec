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
import { upsertWorkerHeartbeat } from '@/lib/db';
import { verifyCronAuth } from '../_auth';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const WARM_TTL = 48 * 60 * 60; // 48h — long enough to ride out an extended bot block

export async function GET(req: NextRequest) {
  const authErr = verifyCronAuth(req);
  if (authErr) return authErr;

  const out: Record<string, { ok: boolean; days?: number; note?: string; stale?: boolean }> = {};
  for (const asset of ['btc', 'eth'] as const) {
    try {
      const r = await fetchFarsideFlows(asset);
      // Only write to the warm cache when we got LIVE data (direct or
      // proxy). Wayback Machine fallbacks are intentionally NOT cached
      // here — the warm cache is a "hours-fresh" tier; archive data is
      // weeks stale and should re-fetch on every page load to give the
      // live source a chance whenever it's reachable.
      if (r.dataAvailable && r.days.length > 0 && !r.stale) {
        await setWarmCache(`etf_flows_${asset}`, { days: r.days, issuers: r.issuers }, WARM_TTL);
        out[asset] = { ok: true, days: r.days.length };
      } else if (r.dataAvailable && r.stale) {
        // Wayback succeeded — the page will still render archive data
        // via the /api/etf-flows fetch path, we just intentionally don't
        // pin the stale data in the warm cache for the next 48h.
        out[asset] = { ok: false, days: r.days.length, stale: true, note: 'archive only — not cached' };
      } else {
        out[asset] = { ok: false, note: r.note ?? 'no data' };
      }
    } catch (e) {
      out[asset] = { ok: false, note: e instanceof Error ? e.message : 'fetch error' };
    }
  }

  const anyOk = Object.values(out).some(v => v.ok);
  // Heartbeat — was missing. Farside-only feeds break for days under
  // Cloudflare bot challenges and the only ops signal was journal
  // grepping. Now admin pipeline panel surfaces it via heartbeat
  // staleness + degraded status.
  await upsertWorkerHeartbeat(
    'cron:refresh-etf-flows',
    anyOk ? 'ok' : 'degraded',
    { btc: out.btc, eth: out.eth },
  ).catch(e => console.error('[refresh-etf-flows] heartbeat error:', e));
  // Always return 200 — DO App Platform rewrites non-2xx route responses
  // to its own generic "via_upstream (502 -)" HTML page, which would mask
  // our structured error payload from systemd journal grepping. Signal
  // failure in the JSON body instead so the cron output stays useful.
  return NextResponse.json(
    { ok: anyOk, results: out, ts: Date.now() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
