export const runtime = 'nodejs';
export const preferredRegion = 'dxb1';

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSQL } from '@/lib/db';

/**
 * DELETE /api/user/account — permanently delete the authenticated user's account
 * Removes all user data: prefs, alerts, portfolio snapshots, OAuth accounts, and the user row.
 */
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getSQL();
    const userId = session.user.id;

    // Delete all user data atomically — prevents partial deletion on error
    await db.begin(async (tx: any) => {
      const emailRows = await tx`SELECT email FROM users WHERE id = ${userId}`;
      await tx`DELETE FROM alert_notifications WHERE user_id = ${userId}`;
      await tx`DELETE FROM portfolio_snapshots WHERE user_id = ${userId}`;
      await tx`DELETE FROM user_prefs WHERE user_id = ${userId}`;
      await tx`DELETE FROM watchlists WHERE user_id = ${userId}`;
      await tx`DELETE FROM api_keys WHERE user_id = ${userId}`;
      await tx`DELETE FROM push_subscriptions WHERE user_id = ${userId}`;
      await tx`DELETE FROM email_verification_codes WHERE user_id = ${userId}`;
      await tx`DELETE FROM user_2fa WHERE user_id = ${userId}`;
      if (emailRows.length > 0) {
        await tx`DELETE FROM password_reset_tokens WHERE email = ${emailRows[0].email}`;
      }
      await tx`DELETE FROM accounts WHERE user_id = ${userId}`;
      await tx`DELETE FROM sessions WHERE user_id = ${userId}`;
      await tx`DELETE FROM users WHERE id = ${userId}`;
    });

    return NextResponse.json({ message: 'Account deleted successfully' });
  } catch (e: any) {
    console.error('Delete account error:', e);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
