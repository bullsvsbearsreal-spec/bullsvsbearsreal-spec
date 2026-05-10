export const runtime = 'nodejs';
export const preferredRegion = 'bom1';

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { validatePassword } from '@/lib/auth/password';
import { getSQL, isDBConfigured } from '@/lib/db';

export async function POST(req: Request) {
  try {
    if (!isDBConfigured()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password are required' }, { status: 400 });
    }

    const pw = validatePassword(password);
    if (!pw.ok) {
      return NextResponse.json({ error: pw.error }, { status: 400 });
    }

    const db = getSQL();

    // Atomically claim the token — prevents TOCTOU race with concurrent requests
    const claimed = await db`
      UPDATE password_reset_tokens
      SET used = true
      WHERE token = ${token}
        AND used = false
        AND expires_at > NOW()
      RETURNING email
    `;

    if (claimed.length === 0) {
      return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 });
    }

    const { email: resetEmail } = claimed[0];

    // Hash the new password
    const hash = await bcrypt.hash(password, 12);

    // Update the user's password
    const updated = await db`
      UPDATE users SET password_hash = ${hash}
      WHERE email = ${resetEmail}
      RETURNING id
    `;

    if (updated.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Invalidate ALL existing NextAuth sessions for this user. Without
    // this, an attacker who triggered the reset (or any other live
    // session on a different device) keeps full access — the legitimate
    // user can't even log them out by changing the password. After this
    // delete, every existing session must re-authenticate.
    try {
      await db`DELETE FROM sessions WHERE "userId" = ${updated[0].id}`;
    } catch (e) {
      // Non-fatal: log but don't surface to the user. The password change
      // succeeded; session table missing or schema-different shouldn't
      // block the recovery flow.
      console.warn('reset-password: session invalidation failed (non-fatal):', e);
    }

    return NextResponse.json({ message: 'Password reset successfully' });
  } catch (e: any) {
    console.error('Reset password error:', e);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
