/**
 * POST /api/admin/actions/trigger-cron
 *
 * Generic admin-trigger for any allowlisted cron job. Lets the admin panel
 * "Actions" tab fire any of the routine cron tasks on demand without
 * having to wait for the systemd timer on the droplet.
 *
 * Body: { name: 'refresh-etf-flows' | 'refresh-validators' | ... }
 *
 * Authn: requires admin (or advisor) session.
 * Server-side, this re-issues the request to /api/cron/<name> with the
 * Bearer CRON_SECRET, so the cron route itself stays locked down to
 * Bearer-only callers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrAdvisor, auth } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * Allowlist of cron jobs that admins may trigger from the panel.
 * Jobs that mutate user state, send notifications, or have side
 * effects beyond data refresh should require an explicit confirmation
 * upstream; the panel UI marks those `requireConfirm: true`.
 *
 * NEVER add `telegram-daily` or any other mass-broadcast cron without
 * a separate confirmation flow — the broadcast action already has its
 * own modal at /api/admin/actions/broadcast.
 */
const ALLOWED_CRONS: Record<string, { description: string; estTimeoutMs: number }> = {
  'snapshot':            { description: 'Funding + OI + spread snapshot', estTimeoutMs: 30_000 },
  'ingest-liquidations': { description: 'Pull recent liquidations',       estTimeoutMs: 30_000 },
  'refresh-etf-flows':   { description: 'BTC + ETH ETF flows from Farside', estTimeoutMs: 30_000 },
  'refresh-validators':  { description: 'LST + restaking yields',         estTimeoutMs: 30_000 },
  'warm-smart-money':    { description: 'Top wallets PnL leaderboard',    estTimeoutMs: 60_000 },
  'whale-trades':        { description: 'Detect new whale DEX swaps',     estTimeoutMs: 30_000 },
  'social-fetch':        { description: 'KOL Twitter/X cache refresh',    estTimeoutMs: 30_000 },
  'sync-positions':      { description: 'User connected-exchange sync',   estTimeoutMs: 30_000 },
  'alerts':              { description: 'Alert evaluation pass',          estTimeoutMs: 30_000 },
  'watch-hl-wallets':    { description: 'HL wallet watch — diff + Telegram', estTimeoutMs: 60_000 },
};

export async function POST(req: NextRequest) {
  const adminErr = await requireAdminOrAdvisor();
  if (adminErr) return adminErr;

  const session = await auth();
  let body: { name?: string };
  try { body = await req.json(); } catch { body = {}; }

  const name = (body.name ?? '').trim();
  const meta = ALLOWED_CRONS[name];
  if (!meta) {
    return NextResponse.json(
      { success: false, error: `Unknown or disallowed cron: ${name || '<empty>'}`, allowed: Object.keys(ALLOWED_CRONS) },
      { status: 400 },
    );
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
      || process.env.NEXTAUTH_URL
      || 'http://localhost:3000';
    const cronSecret = process.env.CRON_SECRET || '';

    const start = Date.now();
    const res = await fetch(`${baseUrl}/api/cron/${name}`, {
      headers: cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {},
      signal: AbortSignal.timeout(meta.estTimeoutMs),
    });
    const durationMs = Date.now() - start;

    let result: any;
    try {
      result = await res.json();
    } catch {
      result = { ok: false, error: `Cron endpoint returned ${res.status} (non-JSON)` };
    }

    await recordAuditEvent(`trigger_cron:${name}`, {
      admin: session?.user?.email ?? 'unknown',
      ok: result?.ok ?? res.ok,
      durationMs,
      result,
    }).catch(e => console.error('[admin] audit trigger-cron error:', e));

    return NextResponse.json({
      success: result?.ok ?? res.ok,
      cronName: name,
      durationMs,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    const isTimeout = err.name === 'TimeoutError' || err.message?.includes('timeout');
    await recordAuditEvent(`trigger_cron:${name}`, {
      admin: session?.user?.email ?? 'unknown',
      ok: false,
      error: err.message ?? 'unknown',
    }).catch(() => {});
    return NextResponse.json(
      {
        success: false,
        cronName: name,
        error: isTimeout ? `${name} timed out` : (err.message || `${name} failed`),
      },
      { status: isTimeout ? 504 : 500 },
    );
  }
}

/**
 * GET /api/admin/actions/trigger-cron
 * Returns the allowlist (used by the UI to render dynamic cron buttons).
 */
export async function GET() {
  const adminErr = await requireAdminOrAdvisor();
  if (adminErr) return adminErr;

  return NextResponse.json({
    crons: Object.entries(ALLOWED_CRONS).map(([name, meta]) => ({
      name,
      description: meta.description,
      estTimeoutMs: meta.estTimeoutMs,
    })),
  });
}
