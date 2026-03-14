export const runtime = 'nodejs';
export const preferredRegion = 'bom1';

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import * as OTPAuth from 'otpauth';
import { isDBConfigured, getSQL } from '@/lib/db';

// POST: Verify TOTP code and enable 2FA
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { code } = await req.json();
    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    if (!isDBConfigured()) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const db = getSQL();
    const userId = session.user.id;

    // Get stored secret
    const rows = await db`SELECT totp_secret FROM user_2fa WHERE user_id = ${userId}`;
    if (rows.length === 0 || !rows[0].totp_secret) {
      return NextResponse.json({ error: 'Setup not started. Call /api/auth/2fa/setup first.' }, { status: 400 });
    }

    const totp = new OTPAuth.TOTP({
      issuer: 'InfoHub',
      label: session.user.email || 'user',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(rows[0].totp_secret),
    });

    const delta = totp.validate({ token: code, window: 1 });
    if (delta === null) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }

    // Enable TOTP
    await db`UPDATE user_2fa SET totp_enabled = true, updated_at = NOW() WHERE user_id = ${userId}`;

    return NextResponse.json({ enabled: true });
  } catch (e: any) {
    console.error('2FA verify error:', e?.message || e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Disable TOTP 2FA
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDBConfigured()) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const db = getSQL();
    await db`
      UPDATE user_2fa SET totp_enabled = false, totp_secret = NULL, updated_at = NOW()
      WHERE user_id = ${session.user.id}
    `;

    return NextResponse.json({ disabled: true });
  } catch (e: any) {
    console.error('2FA disable error:', e?.message || e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
