export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || '';
let sql: ReturnType<typeof postgres> | null = null;
function getSQL() {
  if (!sql) sql = postgres(DATABASE_URL, { max: 5, idle_timeout: 20, ssl: 'require' });
  return sql;
}

/**
 * Validate email/password WITHOUT issuing a session.
 * Used by login page to check credentials before 2FA step.
 * Returns { valid, emailVerified, requires2FA, methods }.
 */
export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    if (!DATABASE_URL) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const db = getSQL();

    const rows = await db`
      SELECT id, password_hash, email_verified
      FROM users WHERE email = ${email}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Wrong email or password' }, { status: 401 });
    }

    const user = rows[0];
    if (!user.password_hash) {
      return NextResponse.json({ error: 'Wrong email or password' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Wrong email or password' }, { status: 401 });
    }

    // Check email verification
    if (!user.email_verified) {
      return NextResponse.json({ valid: true, emailVerified: false }, { status: 200 });
    }

    // Check 2FA status
    const twofa = await db`
      SELECT totp_enabled, email_2fa_enabled FROM user_2fa WHERE user_id = ${user.id}
    `;

    let requires2FA = false;
    const methods: string[] = [];

    if (twofa.length > 0) {
      if (twofa[0].totp_enabled) methods.push('totp');
      if (twofa[0].email_2fa_enabled) methods.push('email');
      requires2FA = methods.length > 0;
    }

    return NextResponse.json({ valid: true, emailVerified: true, requires2FA, methods });
  } catch (e: any) {
    console.error('Check credentials error:', e?.message || e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
