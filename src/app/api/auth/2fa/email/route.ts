export const runtime = 'nodejs';
export const preferredRegion = 'dxb1';

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

// DELETE: Disable email-based 2FA
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
      UPDATE user_2fa SET email_2fa_enabled = false, updated_at = NOW()
      WHERE user_id = ${session.user.id}
    `;

    return NextResponse.json({ disabled: true });
  } catch (e: any) {
    console.error('Email 2FA disable error:', e?.message || e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
