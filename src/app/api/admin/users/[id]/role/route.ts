/**
 * PUT /api/admin/users/[id]/role
 *
 * Change a user's role. Admin only.
 * Body: { role: 'admin' | 'advisor' | 'user' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, auth } from '@/lib/auth';
import { isDBConfigured } from '@/lib/db';
import postgres from 'postgres';

export const runtime = 'nodejs';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';

const DATABASE_URL = process.env.DATABASE_URL || '';
let sql: ReturnType<typeof postgres> | null = null;
function getSQL() {
  if (!sql) sql = postgres(DATABASE_URL, { max: 5, idle_timeout: 20, ssl: 'require' });
  return sql;
}

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

    // If demoting an admin, ensure at least one other admin remains
    if (role !== 'admin') {
      const target = await db`SELECT role FROM users WHERE id = ${id}`;
      if (target.length > 0 && target[0].role === 'admin') {
        const adminCount = await db`SELECT COUNT(*) as count FROM users WHERE role = 'admin'`;
        if (Number(adminCount[0].count) <= 1) {
          return NextResponse.json({ error: 'Cannot remove the last admin' }, { status: 403 });
        }
      }
    }

    const rows = await db`
      UPDATE users SET role = ${role} WHERE id = ${id}
      RETURNING id, email, role
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user: rows[0] });
  } catch (e) {
    console.error('Admin role change error:', e);
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
  }
}
