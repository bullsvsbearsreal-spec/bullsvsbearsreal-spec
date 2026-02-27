export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import postgres from 'postgres';
import * as OTPAuth from 'otpauth';

const DATABASE_URL = process.env.DATABASE_URL || '';
let sql: ReturnType<typeof postgres> | null = null;
function getSQL() {
  if (!sql) sql = postgres(DATABASE_URL, { max: 5, idle_timeout: 20, ssl: 'require' });
  return sql;
}

// Validate a 2FA code during login (supports TOTP, email code, or backup code)
export async function POST(req: Request) {
  try {
    const { email, code, method } = await req.json();
    if (!email || !code) {
      return NextResponse.json({ error: 'Email and code are required' }, { status: 400 });
    }

    if (!DATABASE_URL) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const db = getSQL();

    // Get user + 2FA settings
    const users = await db`SELECT id FROM users WHERE email = ${email}`;
    if (users.length === 0) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 400 });
    }
    const userId = users[0].id;

    const twofa = await db`SELECT totp_secret, totp_enabled, email_2fa_enabled, backup_codes FROM user_2fa WHERE user_id = ${userId}`;
    if (twofa.length === 0) {
      return NextResponse.json({ error: 'Two-factor auth not configured' }, { status: 400 });
    }

    const settings = twofa[0];

    // Method: totp
    if (method === 'totp' && settings.totp_enabled && settings.totp_secret) {
      const totp = new OTPAuth.TOTP({
        issuer: 'InfoHub',
        label: email,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(settings.totp_secret),
      });

      const delta = totp.validate({ token: code, window: 1 });
      if (delta !== null) {
        return NextResponse.json({ valid: true });
      }
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }

    // Method: email
    if (method === 'email' && settings.email_2fa_enabled) {
      const rows = await db`
        SELECT id FROM twofa_login_codes
        WHERE email = ${email}
          AND code = ${code}
          AND used = false
          AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1
      `;
      if (rows.length > 0) {
        await db`UPDATE twofa_login_codes SET used = true WHERE id = ${rows[0].id}`;
        return NextResponse.json({ valid: true });
      }
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
    }

    // Method: backup
    if (method === 'backup') {
      const backupCodes: string[] = settings.backup_codes || [];
      const idx = backupCodes.indexOf(code.toUpperCase());
      if (idx !== -1) {
        // Remove used backup code
        backupCodes.splice(idx, 1);
        await db`UPDATE user_2fa SET backup_codes = ${backupCodes}, updated_at = NOW() WHERE user_id = ${userId}`;
        return NextResponse.json({ valid: true });
      }
      return NextResponse.json({ error: 'Invalid backup code' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Invalid 2FA method' }, { status: 400 });
  } catch (e: any) {
    console.error('2FA validate error:', e?.message || e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
