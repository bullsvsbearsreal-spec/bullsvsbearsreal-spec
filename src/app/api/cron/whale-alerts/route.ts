/**
 * Cron endpoint: Whale-tier priority alert checking.
 *
 * Delegates to `/api/cron/alerts?priority=1` — same handler, same logic,
 * but the priority flag filters the user list to Whale-tier accounts
 * only. Run at a faster cadence than the standard `/api/cron/alerts` to
 * deliver on the /pricing "priority alert queue" promise.
 *
 * Operator setup (May 2026):
 *   - This endpoint should be hit every 30s (or faster) by a systemd
 *     timer on the droplet. The standard /api/cron/alerts runs every
 *     5min and skips Whale users so they don't double-fire.
 *   - Together: Whale users see < 30s alert latency vs ~5min for the
 *     standard tier.
 *
 * Security: Verifies CRON_SECRET Bearer token (inherited from the
 * delegated handler, which calls verifyCronAuth itself).
 */

import { NextRequest } from 'next/server';
import { GET as standardAlertsHandler } from '../alerts/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export const preferredRegion = 'bom1';

export async function GET(request: NextRequest) {
  // Append `?priority=1` to the URL and delegate to the standard cron
  // handler. The handler reads the flag from searchParams and filters
  // to Whale-tier users. We construct a fresh NextRequest so the auth
  // header + body pass through unchanged.
  const url = new URL(request.url);
  url.searchParams.set('priority', '1');
  const delegated = new NextRequest(url, {
    headers: request.headers,
    method: 'GET',
  });
  return standardAlertsHandler(delegated);
}
