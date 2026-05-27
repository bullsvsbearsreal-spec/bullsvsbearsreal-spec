/**
 * POST /api/admin/users/bulk
 *
 * Bulk operations against a list of user ids. Admin-only, audit-trailed,
 * requires reason. Three supported actions:
 *
 *   action: 'tier'       — body: { userIds[], billingTier, reason }
 *   action: 'suspend'    — body: { userIds[], reason }
 *   action: 'unsuspend'  — body: { userIds[], reason }
 *
 * Returns:
 *   { processed: N, skipped: N, results: [{ userId, ok, reason? }] }
 *
 * Self-target guard: the current admin's own id is silently skipped to
 * prevent locking yourself out via a bulk-suspend mistake.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, verifySameOrigin, auth } from '@/lib/auth';
import { initDB, isDBConfigured, getSQL, recordAuditEvent } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const VALID_TIERS = ['free', 'trader', 'pro', 'whale'] as const;
const MAX_BATCH = 200;

export async function POST(request: NextRequest) {
  const originErr = verifySameOrigin(request);
  if (originErr) return originErr;
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const action = String(body?.action ?? '');
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  const userIds: string[] = Array.isArray(body?.userIds) ? body.userIds.filter((x: unknown) => typeof x === 'string') : [];

  if (!['tier', 'suspend', 'unsuspend'].includes(action)) {
    return NextResponse.json({ error: 'action must be tier | suspend | unsuspend' }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: 'reason is required (audit trail)' }, { status: 400 });
  }
  if (userIds.length < 1) {
    return NextResponse.json({ error: 'userIds must be a non-empty array' }, { status: 400 });
  }
  if (userIds.length > MAX_BATCH) {
    return NextResponse.json({ error: `Batch capped at ${MAX_BATCH} users` }, { status: 400 });
  }

  let newTier: (typeof VALID_TIERS)[number] | null = null;
  if (action === 'tier') {
    const t = String(body?.billingTier ?? '');
    if (!VALID_TIERS.includes(t as (typeof VALID_TIERS)[number])) {
      return NextResponse.json({ error: `billingTier must be one of: ${VALID_TIERS.join(', ')}` }, { status: 400 });
    }
    newTier = t as (typeof VALID_TIERS)[number];
  }

  const session = await auth();
  const selfId = session?.user?.id ?? null;

  await initDB();
  const db = getSQL();

  // Dedupe + drop self
  const targets = Array.from(new Set(userIds)).filter(id => id !== selfId);

  type Result = { userId: string; ok: boolean; reason?: string };
  const results: Result[] = [];

  if (action === 'tier' && newTier) {
    // One bulk UPDATE — cheaper than N round trips.
    try {
      const updated = await db`
        UPDATE users SET billing_tier = ${newTier}
        WHERE id = ANY(${targets}::text[])
        RETURNING id, email
      `;
      const updatedIds = new Set((updated as any[]).map(r => String(r.id)));
      for (const id of targets) {
        results.push({ userId: id, ok: updatedIds.has(id), reason: updatedIds.has(id) ? undefined : 'not found' });
      }
    } catch (e) {
      for (const id of targets) results.push({ userId: id, ok: false, reason: 'DB error' });
    }
  } else if (action === 'suspend') {
    // Single atomic UPDATE — same pattern as the tier branch above.
    // Avoids the partial-apply window the prior N-round-trip loop had.
    try {
      const updated = await db`
        UPDATE users SET suspended_at = NOW()
        WHERE id = ANY(${targets}::text[])
          AND suspended_at IS NULL
        RETURNING id
      `;
      const updatedIds = new Set((updated as any[]).map(r => String(r.id)));
      for (const id of targets) {
        results.push({ userId: id, ok: updatedIds.has(id), reason: updatedIds.has(id) ? undefined : 'not found or already suspended' });
      }
    } catch {
      for (const id of targets) results.push({ userId: id, ok: false, reason: 'DB error' });
    }
  } else if (action === 'unsuspend') {
    try {
      const updated = await db`
        UPDATE users SET suspended_at = NULL
        WHERE id = ANY(${targets}::text[])
          AND suspended_at IS NOT NULL
        RETURNING id
      `;
      const updatedIds = new Set((updated as any[]).map(r => String(r.id)));
      for (const id of targets) {
        results.push({ userId: id, ok: updatedIds.has(id), reason: updatedIds.has(id) ? undefined : 'not found or not suspended' });
      }
    } catch {
      for (const id of targets) results.push({ userId: id, ok: false, reason: 'DB error' });
    }
  }

  await recordAuditEvent('admin_bulk_user', {
    actorId: session?.user?.id ?? null,
    admin: session?.user?.email ?? null,
    actorEmail: session?.user?.email ?? null,
    action,
    billingTier: newTier,
    reason,
    requested: userIds.length,
    processed: results.filter(r => r.ok).length,
    skipped: userIds.length - targets.length, // self-target dropped
  }).catch(e => console.warn('audit log failed:', e));

  return NextResponse.json({
    processed: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
    skippedSelf: userIds.length - targets.length,
    results,
  });
}
