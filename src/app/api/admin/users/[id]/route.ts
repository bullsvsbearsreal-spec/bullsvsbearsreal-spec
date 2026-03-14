import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrAdvisor, requireAdmin, auth } from '@/lib/auth';
import { getUserDetailForAdmin, getSQL } from '@/lib/db';
import { recordAuditEvent } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminErr = await requireAdminOrAdvisor();
  if (adminErr) return adminErr;

  const { id } = await params;
  const user = await getUserDetailForAdmin(id);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ user });
}

/**
 * DELETE /api/admin/users/[id] — admin deletes a user account
 * Removes all user data atomically. Cannot delete yourself or other admins.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const session = await auth();
  const { id } = await params;

  // Prevent self-deletion via admin panel
  if (id === session?.user?.id) {
    return NextResponse.json({ error: 'Cannot delete your own account from admin panel' }, { status: 403 });
  }

  try {
    const db = getSQL();

    // Check user exists and isn't an admin
    const rows = await db`SELECT id, email, role FROM users WHERE id = ${id}`;
    if (rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (rows[0].role === 'admin') {
      return NextResponse.json({ error: 'Cannot delete an admin account. Demote first.' }, { status: 403 });
    }

    const userEmail = rows[0].email;

    // Delete all user data atomically
    await db.begin(async (tx: any) => {
      await tx`DELETE FROM alert_notifications WHERE user_id = ${id}`;
      await tx`DELETE FROM portfolio_snapshots WHERE user_id = ${id}`;
      await tx`DELETE FROM user_prefs WHERE user_id = ${id}`;
      await tx`DELETE FROM watchlists WHERE user_id = ${id}`;
      await tx`DELETE FROM api_keys WHERE user_id = ${id}`;
      await tx`DELETE FROM push_subscriptions WHERE user_id = ${id}`;
      await tx`DELETE FROM email_verification_codes WHERE user_id = ${id}`;
      await tx`DELETE FROM user_2fa WHERE user_id = ${id}`;
      if (userEmail) {
        await tx`DELETE FROM password_reset_tokens WHERE email = ${userEmail}`;
      }
      await tx`DELETE FROM accounts WHERE user_id = ${id}`;
      await tx`DELETE FROM sessions WHERE user_id = ${id}`;
      await tx`DELETE FROM users WHERE id = ${id}`;
    });

    await recordAuditEvent('admin_delete_user', {
      admin: session?.user?.email ?? 'unknown',
      deletedUser: userEmail ?? id,
    }).catch(() => {});

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (e: any) {
    console.error('Admin delete user error:', e);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
