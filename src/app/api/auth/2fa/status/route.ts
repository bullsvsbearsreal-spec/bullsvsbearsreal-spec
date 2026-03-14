export const runtime = 'nodejs';
export const preferredRegion = 'bom1';

import { NextResponse } from 'next/server';
import { isDBConfigured, getSQL } from '@/lib/db';

// In-memory rate limit: max 20 lookups per email per 5 minutes
const statusAttempts = new Map<string, { count: number; resetAt: number }>();

function checkStatusRate(email: string): boolean {
  const now = Date.now();
  const key = email.toLowerCase();
  const entry = statusAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    statusAttempts.set(key, { count: 1, resetAt: now + 5 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 20) return false;
  entry.count++;
  return true;
}

// Check 2FA status for a user (pre-login) or for current session
export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!checkStatusRate(email)) {
      return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
    }

    if (!isDBConfigured()) {
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
