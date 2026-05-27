/**
 * GET /api/status
 *
 * Public, unauthenticated. Used by the /status page (and any third-
 * party uptime checker like UptimeRobot). Returns the three signals
 * an operator wants visible during an incident:
 *
 *   · aggregator   — WS venue connection state (from prices.info-hub.io)
 *   · alertEngine  — when each notification channel last fired
 *   · api          — simple "responsive" health based on DB ping
 *
 * Cached at the edge for 15 seconds so a spike in /status traffic
 * doesn't hammer the aggregator droplet or DB.
 */
import { NextResponse } from 'next/server';
import { isDBConfigured, getSQL } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

interface VenueHealth { connected: boolean; lastUpdate?: number; errors?: number }

export async function GET() {
  const startedAt = Date.now();

  // ─── Aggregator ────────────────────────────────────────────────────
  let aggregator: { connected: number; total: number; degraded: number; reachable: boolean } = {
    connected: 0, total: 0, degraded: 0, reachable: false,
  };
  try {
    const res = await fetch('https://prices.info-hub.io/health', {
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const d = await res.json();
      const venues = Object.values(d.health || {}) as VenueHealth[];
      const now = Date.now();
      const connected = venues.filter(v => v.connected).length;
      const degraded = venues.filter(v => v.connected && (!v.lastUpdate || now - v.lastUpdate > 60_000)).length;
      aggregator = { connected, total: venues.length, degraded, reachable: true };
    }
  } catch { /* aggregator unreachable — leave defaults */ }

  // ─── DB + alert engine ─────────────────────────────────────────────
  let api = { responsive: false, latencyMs: 0 };
  let alertEngine: { channel: string; lastFire: string | null; sent24h: number }[] = [];

  if (isDBConfigured()) {
    try {
      const db = getSQL();
      const dbStart = Date.now();
      const lastFire = await db`
        SELECT channel,
               MAX(sent_at) AS last_at,
               COUNT(*) FILTER (WHERE sent_at > NOW() - INTERVAL '24 hours')::int AS sent_24h
          FROM alert_notifications
         WHERE sent_at > NOW() - INTERVAL '7 days'
         GROUP BY channel
      `;
      api = { responsive: true, latencyMs: Date.now() - dbStart };
      alertEngine = (lastFire as any[]).map(r => ({
        channel: String(r.channel),
        lastFire: r.last_at instanceof Date ? r.last_at.toISOString() : (r.last_at ? String(r.last_at) : null),
        sent24h: Number(r.sent_24h ?? 0),
      }));
    } catch { /* DB hiccup — leave api responsive=false */ }
  }

  // ─── Composite top-line status ─────────────────────────────────────
  // up    = aggregator fully connected + API responsive
  // degraded = some venues down OR > 60s without an alert channel firing
  // down  = aggregator unreachable OR DB not responsive
  let topLine: 'up' | 'degraded' | 'down';
  if (!aggregator.reachable || !api.responsive) {
    topLine = 'down';
  } else if (aggregator.connected < aggregator.total || aggregator.degraded > 0) {
    topLine = 'degraded';
  } else {
    topLine = 'up';
  }

  return NextResponse.json(
    {
      status: topLine,
      aggregator,
      api,
      alertEngine,
      checkedAt: new Date().toISOString(),
      checkDurationMs: Date.now() - startedAt,
    },
    {
      headers: {
        // Edge cache for 15 sec; SWR for another 15s. Public so it
        // can be polled by external uptime monitors.
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=15',
      },
    },
  );
}
