export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || '';
let sql: ReturnType<typeof postgres> | null = null;
function getSQL() {
  if (!sql) sql = postgres(DATABASE_URL, { max: 5, idle_timeout: 20, ssl: 'require' });
  return sql;
}

export async function POST(req: Request) {
  try {
    const { email, code } = await req.json();

    if (!email || !code) {
      return NextResponse.json({ error: 'Email and code are required' }, { status: 400 });
    }

    if (!DATABASE_URL) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const db = getSQL();

    // Find valid, unused code
    const rows = await db`
      SELECT id, user_id FROM email_verification_codes
      WHERE email = ${email}
        AND code = ${code}
        AND used = false
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
    }

    const { id, user_id } = rows[0];

    // Mark code as used
    await db`UPDATE email_verification_codes SET used = true WHERE id = ${id}`;

    // Mark user as verified
    await db`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified TIMESTAMPTZ DEFAULT NULL`.catch(() => {});
    await db`UPDATE users SET email_verified = NOW() WHERE id = ${user_id}`;

    return NextResponse.json({ verified: true });
  } catch (e: any) {
    console.error('Verify email error:', e?.message || e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
