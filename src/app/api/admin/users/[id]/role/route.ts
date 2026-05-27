/**
 * /api/admin/users/[id]/role
 *
 * Two methods:
 *
 *   PUT  body: { role: 'admin' | 'advisor' | 'user' }
 *   POST body: { billingTier?: 'free'|'trader'|'pro'|'whale'; role?: ...; reason: string }
 *
 * The PUT handler is the legacy entry point used by the old /admin
 * users tab. The POST handler is what the new admin-panel UserDrawer
 * uses — it requires an audit reason and supports tier overrides in
 * addition to role changes.
 *
 * Both paths block last-admin removal and write to audit_log.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, verifySameOrigin, auth, isOwner } from '@/lib/auth';
import { isDBConfigured, getSQL, recordAuditEvent } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

// Roles ordered owner > admin > moderator/marketer > advisor > user.
//   · Owner-only grants/revokes: 'owner', 'admin'
//   · Admin or owner can grant/revoke: 'moderator', 'marketer', 'advisor', 'user'
const VALID_ROLES = ['owner', 'admin', 'moderator', 'marketer', 'advisor', 'user'] as const;
const OWNER_ONLY_ROLES = new Set<string>(['owner', 'admin']);
const VALID_TIERS = ['free', 'trader', 'pro', 'whale'] as const;

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const originErr = verifySameOrigin(request);
  if (originErr) return originErr;
  const denied = await requireAdmin();
  if (denied) return denied;

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const session = await auth();
  const { id } = await params;
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const role = body?.role;

  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 });
  }

  // Owner-only roles (owner/admin) require the caller to be owner.
  if (OWNER_ONLY_ROLES.has(role) && !(await isOwner(session?.user?.id ?? ''))) {
    return NextResponse.json({ error: 'Owner role required to grant owner/admin' }, { status: 403 });
  }
  // Block demoting an existing owner via the PUT path too.
  if (role !== 'owner' && !(await isOwner(session?.user?.id ?? ''))) {
    try {
      const db = getSQL();
      const existing = await db`SELECT role FROM users WHERE id = ${id}`;
      if (existing[0]?.role === 'owner') {
        return NextResponse.json({ error: 'Cannot demote the owner' }, { status: 403 });
      }
    } catch {}
  }

  if (id === session?.user?.id && role !== 'admin' && role !== 'owner') {
    return NextResponse.json({ error: 'Cannot change your own role' }, { status: 403 });
  }

  try {
    const db = getSQL();
    const rows = await db`
      UPDATE users SET role = ${role}
      WHERE id = ${id}
        AND (
          ${role} = 'admin'
          OR role != 'admin'
          OR (SELECT COUNT(*) FROM users WHERE role = 'admin' AND id != ${id}) >= 1
        )
      RETURNING id, email, role
    `;

    if (rows.length === 0) {
      const exists = await db`SELECT id, role FROM users WHERE id = ${id}`;
      if (exists.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Cannot remove the last admin' }, { status: 403 });
    }

    try {
      await recordAuditEvent('admin_change_user_role', {
        actorId: session?.user?.id ?? null,
        admin: session?.user?.email ?? null,        // legacy field name
        actorEmail: session?.user?.email ?? null,   // new canonical name
        targetUserId: id,
        targetEmail: rows[0].email,
        newRole: role,
      });
    } catch (auditErr) {
      console.warn('admin role change: audit log failed:', auditErr);
    }

    return NextResponse.json({ user: rows[0] });
  } catch (e) {
    console.error('Admin role change error:', e);
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
  }
}

/**
 * POST body: { billingTier?, role?, reason: string }
 *
 * Audit-friendly mutation entry. Reason is required (audit trail).
 * Exactly one of billingTier OR role must be provided.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const originErr = verifySameOrigin(request);
  if (originErr) return originErr;
  const denied = await requireAdmin();
  if (denied) return denied;

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const session = await auth();
  const { id } = await params;
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  if (!reason) {
    return NextResponse.json({ error: 'reason is required (audit trail)' }, { status: 400 });
  }

  const newTier = typeof body?.billingTier === 'string' ? body.billingTier : null;
  const newRole = typeof body?.role         === 'string' ? body.role        : null;

  if (!newTier && !newRole) {
    return NextResponse.json({ error: 'Provide billingTier or role' }, { status: 400 });
  }
  if (newTier && !VALID_TIERS.includes(newTier as (typeof VALID_TIERS)[number])) {
    return NextResponse.json({ error: `Invalid billingTier. Must be one of: ${VALID_TIERS.join(', ')}` }, { status: 400 });
  }
  if (newRole && !VALID_ROLES.includes(newRole as (typeof VALID_ROLES)[number])) {
    return NextResponse.json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 });
  }
  // Owner-only roles: grants/revokes of 'owner' and 'admin' require
  // the caller to be the owner. Admins can still grant moderator /
  // marketer / advisor / user.
  if (newRole && OWNER_ONLY_ROLES.has(newRole) && !(await isOwner(session?.user?.id ?? ''))) {
    return NextResponse.json({ error: 'Owner role required to grant owner/admin' }, { status: 403 });
  }
  // Also block demotion of an existing owner unless the caller is owner.
  if (newRole && newRole !== 'owner' && !(await isOwner(session?.user?.id ?? ''))) {
    try {
      const db = getSQL();
      const existing = await db`SELECT role FROM users WHERE id = ${id}`;
      if (existing[0]?.role === 'owner') {
        return NextResponse.json({ error: 'Cannot demote the owner — only owner can change owner role' }, { status: 403 });
      }
    } catch { /* fall through to UPDATE which will succeed if non-owner */ }
  }
  if (id === session?.user?.id && newRole && newRole !== 'admin' && newRole !== 'owner') {
    return NextResponse.json({ error: 'Cannot change your own role' }, { status: 403 });
  }

  try {
    const db = getSQL();

    if (newTier) {
      const rows = await db`
        UPDATE users SET billing_tier = ${newTier}
        WHERE id = ${id}
        RETURNING id, email, billing_tier
      `;
      if (rows.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      await recordAuditEvent('admin_change_billing_tier', {
        actorId: session?.user?.id ?? null,
        admin: session?.user?.email ?? null,
        actorEmail: session?.user?.email ?? null,
        targetUserId: id,
        targetEmail: rows[0].email,
        newTier,
        reason,
      }).catch(e => console.warn('audit log failed:', e));
      return NextResponse.json({ user: rows[0], reason });
    }

    // newRole branch — reuse the PUT path's last-admin guard
    if (newRole) {
      const rows = await db`
        UPDATE users SET role = ${newRole}
        WHERE id = ${id}
          AND (
            ${newRole} = 'admin'
            OR role != 'admin'
            OR (SELECT COUNT(*) FROM users WHERE role = 'admin' AND id != ${id}) >= 1
          )
        RETURNING id, email, role
      `;
      if (rows.length === 0) {
        const exists = await db`SELECT id, role FROM users WHERE id = ${id}`;
        if (exists.length === 0) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Cannot remove the last admin' }, { status: 403 });
      }
      await recordAuditEvent('admin_change_user_role', {
        actorId: session?.user?.id ?? null,
        admin: session?.user?.email ?? null,
        actorEmail: session?.user?.email ?? null,
        targetUserId: id,
        targetEmail: rows[0].email,
        newRole,
        reason,
      }).catch(e => console.warn('audit log failed:', e));
      return NextResponse.json({ user: rows[0], reason });
    }

    return NextResponse.json({ error: 'No update applied' }, { status: 400 });
  } catch (e) {
    console.error('Admin POST role/tier error:', e);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
