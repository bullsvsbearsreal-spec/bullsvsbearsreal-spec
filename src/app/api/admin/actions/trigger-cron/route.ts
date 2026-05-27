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
import { requireAdmin, verifySameOrigin, auth } from '@/lib/auth';
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
  'snapshot':              { description: 'Funding + OI + spread snapshot',  estTimeoutMs: 30_000 },
  'ingest-liquidations':   { description: 'Pull recent liquidations',        estTimeoutMs: 30_000 },
  'refresh-etf-flows':     { description: 'BTC + ETH ETF flows from Farside', estTimeoutMs: 30_000 },
  'refresh-validators':    { description: 'LST + restaking yields',          estTimeoutMs: 30_000 },
  'warm-smart-money':      { description: 'Top wallets PnL leaderboard',     estTimeoutMs: 60_000 },
  'whale-trades':          { description: 'Detect new whale DEX swaps',      estTimeoutMs: 30_000 },
  'whale-alerts':          { description: 'Whale priority alert sweep',      estTimeoutMs: 30_000 },
  'social-fetch':          { description: 'KOL Twitter/X cache refresh',     estTimeoutMs: 30_000 },
  'sync-positions':        { description: 'User connected-exchange sync',    estTimeoutMs: 30_000 },
  'alerts':                { description: 'Alert evaluation pass',           estTimeoutMs: 30_000 },
  'check-position-alerts': { description: 'Position-alert checker',          estTimeoutMs: 30_000 },
  'auto-tweet':            { description: 'Auto-tweet queue flush',          estTimeoutMs: 30_000 },
  'portfolio-snapshot':    { description: 'Per-user portfolio snapshot',     estTimeoutMs: 60_000 },
  'aggregate-page-views':  { description: 'Page views rollup + prune (90d)', estTimeoutMs: 30_000 },
  'watch-hl-wallets':      { description: 'HL wallet watch — diff + Telegram', estTimeoutMs: 60_000 },
  // INTENTIONALLY OMITTED: 'telegram-daily' — mass broadcast, requires
  // the explicit confirmation flow at /api/admin/actions/broadcast.
};

export async function POST(req: NextRequest) {
  const originErr = verifySameOrigin(req);
  if (originErr) return originErr;
  const adminErr = await requireAdmin();
  if (adminErr) return adminErr;

  const session = await auth();
  let body: { name?: string; cron?: string; reason?: string };
  try { body = await req.json(); } catch { body = {}; }

  // Accept either { name } (legacy) or { cron } (new admin dashboard).
  const name = (body.name ?? body.cron ?? '').trim();
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 200) : '';
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
      actorEmail: session?.user?.email ?? null,
      reason,
      ok: result?.ok ?? res.ok,
      durationMs,
      result,
    }).catch(e => console.error('[admin] audit trigger-cron error:', e));

    // Filter the cron's response to a known-safe shape before forwarding
    // to the admin browser. Some crons include stack-trace fragments or DB
    // error strings in their JSON body; the full audit log captures it
    // server-side, but the admin browser shouldn't see internals.
    const safeResult = result && typeof result === 'object' ? {
      ok: result.ok,
      ...(typeof result.fetched === 'number' ? { fetched: result.fetched } : {}),
      ...(typeof result.inserted === 'number' ? { inserted: result.inserted } : {}),
      ...(typeof result.processed === 'number' ? { processed: result.processed } : {}),
      ...(typeof result.errors === 'number' ? { errors: result.errors } : {}),
      ...(typeof result.error === 'string' ? { error: result.error.slice(0, 200) } : {}),
    } : { ok: res.ok };

    return NextResponse.json({
      success: result?.ok ?? res.ok,
      cronName: name,
      durationMs,
      result: safeResult,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    const isTimeout = err.name === 'TimeoutError' || err.message?.includes('timeout');
    await recordAuditEvent(`trigger_cron:${name}`, {
      admin: session?.user?.email ?? 'unknown',
      actorEmail: session?.user?.email ?? null,
      reason,
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
  const adminErr = await requireAdmin();
  if (adminErr) return adminErr;

  return NextResponse.json({
    crons: Object.entries(ALLOWED_CRONS).map(([name, meta]) => ({
      name,
      description: meta.description,
      estTimeoutMs: meta.estTimeoutMs,
    })),
  });
}
