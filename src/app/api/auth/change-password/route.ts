export const runtime = 'nodejs';
export const preferredRegion = 'bom1';

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { auth } from '@/lib/auth';
import { validatePassword } from '@/lib/auth/password';
import { isDBConfigured, getSQL } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Both current and new password are required' }, { status: 400 });
    }

    const pw = validatePassword(newPassword);
    if (!pw.ok) {
      return NextResponse.json({ error: pw.error }, { status: 400 });
    }

    const db = getSQL();

    // Get user's current password hash
    const rows = await db`
      SELECT password_hash FROM users WHERE id = ${session.user.id}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = rows[0];

    // OAuth-only accounts have no password_hash
    if (!user.password_hash) {
      return NextResponse.json(
        { error: 'This account uses social login. Password cannot be changed here.' },
        { status: 400 },
      );
    }

    // Verify current password
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }

    // Hash and save new password
    const hash = await bcrypt.hash(newPassword, 12);
    await db`UPDATE users SET password_hash = ${hash} WHERE id = ${session.user.id}`;

    return NextResponse.json({ message: 'Password changed successfully' });
  } catch (e: any) {
    console.error('Change password error:', e);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
