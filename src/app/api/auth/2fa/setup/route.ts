export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import postgres from 'postgres';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import crypto from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL || '';
let sql: ReturnType<typeof postgres> | null = null;
function getSQL() {
  if (!sql) sql = postgres(DATABASE_URL, { max: 5, idle_timeout: 20, ssl: 'require' });
  return sql;
}

function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 8; i++) {
    codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return codes;
}

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!DATABASE_URL) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const db = getSQL();
    const userId = session.user.id;

    // Block setup if TOTP is already enabled (must disable first)
    const existing = await db`SELECT totp_enabled FROM user_2fa WHERE user_id = ${userId}`;
    if (existing.length > 0 && existing[0].totp_enabled) {
      return NextResponse.json({ error: 'TOTP is already enabled. Disable it first to reconfigure.' }, { status: 400 });
    }

    // Generate TOTP secret
    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({
      issuer: 'InfoHub',
      label: session.user.email || 'user',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    });

    const uri = totp.toString();
    const qrCode = await QRCode.toDataURL(uri);
    const backupCodes = generateBackupCodes();

    // Store secret (not yet enabled)
    await db`
      INSERT INTO user_2fa (user_id, totp_secret, totp_enabled, backup_codes, updated_at)
      VALUES (${userId}, ${secret.base32}, false, ${backupCodes}, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET totp_secret = ${secret.base32}, totp_enabled = false, backup_codes = ${backupCodes}, updated_at = NOW()
    `;

    return NextResponse.json({
      qrCode,
      secret: secret.base32,
      backupCodes,
    });
  } catch (e: any) {
    console.error('2FA setup error:', e?.message || e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
