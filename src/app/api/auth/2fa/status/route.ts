export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || '';
let sql: ReturnType<typeof postgres> | null = null;
function getSQL() {
  if (!sql) sql = postgres(DATABASE_URL, { max: 5, idle_timeout: 20, ssl: 'require' });
  return sql;
}

// Check 2FA status for a user (pre-login) or for current session
export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!DATABASE_URL) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const db = getSQL();

    const users = await db`SELECT id FROM users WHERE email = ${email}`;
    if (users.length === 0) {
      // Don't reveal whether email exists — return no 2FA
      return NextResponse.json({ requires2FA: false });
    }

    const userId = users[0].id;
    const rows = await db`
      SELECT totp_enabled, email_2fa_enabled FROM user_2fa WHERE user_id = ${userId}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ requires2FA: false });
    }

    const { totp_enabled, email_2fa_enabled } = rows[0];
    const methods: string[] = [];
    if (totp_enabled) methods.push('totp');
    if (email_2fa_enabled) methods.push('email');

    return NextResponse.json({
      requires2FA: methods.length > 0,
      methods,
    });
  } catch (e: any) {
    console.error('2FA status error:', e?.message || e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
