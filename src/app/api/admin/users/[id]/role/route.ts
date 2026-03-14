/**
 * PUT /api/admin/users/[id]/role
 *
 * Change a user's role. Admin only.
 * Body: { role: 'admin' | 'advisor' | 'user' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, auth } from '@/lib/auth';
import { isDBConfigured, getSQL } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

const VALID_ROLES = ['admin', 'advisor', 'user'] as const;

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const session = await auth();
  const { id } = await params;
  const body = await request.json();
  const role = body.role;

  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 });
  }

  // Prevent self-demotion (admin locking themselves out)
  if (id === session?.user?.id && role !== 'admin') {
    return NextResponse.json({ error: 'Cannot change your own role' }, { status: 403 });
  }

  try {
    const db = getSQL();

    // Atomic role update with last-admin guard to prevent TOCTOU race
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
      // Distinguish: user not found vs last-admin guard
      const exists = await db`SELECT id, role FROM users WHERE id = ${id}`;
      if (exists.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Cannot remove the last admin' }, { status: 403 });
    }

    return NextResponse.json({ user: rows[0] });
  } catch (e) {
    console.error('Admin role change error:', e);
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
  }
}
