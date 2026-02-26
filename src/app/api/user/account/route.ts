export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import postgres from 'postgres';
import { auth } from '@/lib/auth';

const DATABASE_URL = process.env.DATABASE_URL || '';
let sql: ReturnType<typeof postgres> | null = null;
function getSQL() {
  if (!sql) sql = postgres(DATABASE_URL, { max: 5, idle_timeout: 20, ssl: 'require' });
  return sql;
}

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

    // Delete in order: dependent rows first, then user
    await db`DELETE FROM alert_notifications WHERE user_id = ${userId}`;
    await db`DELETE FROM portfolio_snapshots WHERE user_id = ${userId}`;
    await db`DELETE FROM user_prefs WHERE user_id = ${userId}`;
    await db`DELETE FROM watchlists WHERE user_id = ${userId}`;
    await db`DELETE FROM accounts WHERE user_id = ${userId}`;
    await db`DELETE FROM sessions WHERE user_id = ${userId}`;
    await db`DELETE FROM users WHERE id = ${userId}`;

    return NextResponse.json({ message: 'Account deleted successfully' });
  } catch (e: any) {
    console.error('Delete account error:', e);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
