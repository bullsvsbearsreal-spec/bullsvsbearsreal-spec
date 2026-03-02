export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import postgres from 'postgres';
import { validatePassword } from '@/lib/auth/password';

const DATABASE_URL = process.env.DATABASE_URL || '';
let sql: ReturnType<typeof postgres> | null = null;
function getSQL() {
  if (!sql) sql = postgres(DATABASE_URL, { max: 5, idle_timeout: 20, ssl: 'require' });
  return sql;
}

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password are required' }, { status: 400 });
    }

    const pw = validatePassword(password);
    if (!pw.ok) {
      return NextResponse.json({ error: pw.error }, { status: 400 });
    }

    const db = getSQL();

    // Find valid token
    const tokens = await db`
      SELECT token, email, expires_at
      FROM password_reset_tokens
      WHERE token = ${token}
        AND used = false
        AND expires_at > NOW()
    `;

    if (tokens.length === 0) {
      return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 });
    }

    const resetToken = tokens[0];

    // Hash the new password
    const hash = await bcrypt.hash(password, 12);

    // Update the user's password
    const updated = await db`
      UPDATE users SET password_hash = ${hash}
      WHERE email = ${resetToken.email}
      RETURNING id
    `;

    if (updated.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Mark token as used
    await db`UPDATE password_reset_tokens SET used = true WHERE token = ${token}`;

    return NextResponse.json({ message: 'Password reset successfully' });
  } catch (e: any) {
    console.error('Reset password error:', e);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
