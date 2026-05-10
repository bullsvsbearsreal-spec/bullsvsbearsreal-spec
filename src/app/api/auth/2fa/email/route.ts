export const runtime = 'nodejs';
export const preferredRegion = 'bom1';

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isDBConfigured, getSQL } from '@/lib/db';

// POST: Enable email-based 2FA
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDBConfigured()) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const db = getSQL();
    const userId = session.user.id;

    await db`
      INSERT INTO user_2fa (user_id, email_2fa_enabled, updated_at)
      VALUES (${userId}, true, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET email_2fa_enabled = true, updated_at = NOW()
    `;

    return NextResponse.json({ enabled: true });
  } catch (e: any) {
    console.error('Email 2FA enable error:', e?.message || e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Disable email-based 2FA (requires password re-auth).
//
// Without re-auth, an attacker who hijacks a session (XSS, stolen
// cookie) could disable email 2FA and proceed without the second
// factor — full account takeover. Mirrors the pattern in
// /api/auth/2fa/verify DELETE which already requires a TOTP code or
// password to disable TOTP.
export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDBConfigured()) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const db = getSQL();
    const userId = session.user.id;

    // Require re-authentication via current account password.
    let body: { password?: string } = {};
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    if (!body.password || typeof body.password !== 'string') {
      return NextResponse.json(
        { error: 'Re-authentication required: provide current password to disable email 2FA' },
        { status: 400 },
      );
    }

    const bcrypt = (await import('bcryptjs')).default;
    const rows = await db`SELECT password_hash FROM users WHERE id = ${userId}`;
    if (!rows[0]?.password_hash) {
      return NextResponse.json(
        { error: 'Cannot verify password for OAuth account' },
        { status: 400 },
      );
    }
    const valid = await bcrypt.compare(body.password, rows[0].password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 400 });
    }

    await db`
      UPDATE user_2fa SET email_2fa_enabled = false, updated_at = NOW()
      WHERE user_id = ${userId}
    `;

    return NextResponse.json({ disabled: true });
  } catch (e: any) {
    console.error('Email 2FA disable error:', e?.message || e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
