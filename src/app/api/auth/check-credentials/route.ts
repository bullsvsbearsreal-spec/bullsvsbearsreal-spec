export const runtime = 'nodejs';
export const preferredRegion = 'dxb1';

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { isDBConfigured, getSQL } from '@/lib/db';

// In-memory rate limit: max 10 attempts per email per 15 minutes
const MAX_TRACKED_KEYS = 10_000;
const attempts = new Map<string, { count: number; resetAt: number }>();
let lastCleanup = 0;

function checkBruteForce(email: string): boolean {
  const now = Date.now();
  const key = email.toLowerCase();

  // Periodic cleanup of expired entries (at most once per minute)
  if (now - lastCleanup > 60_000) {
    lastCleanup = now;
    attempts.forEach((v, k) => {
      if (now > v.resetAt) attempts.delete(k);
    });
  }

  // Hard cap to prevent memory exhaustion under attack
  if (attempts.size >= MAX_TRACKED_KEYS && !attempts.has(key)) {
    return false; // reject new entries when map is full
  }

  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
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

    // Rate limit check — prevent brute-force password guessing
    if (!checkBruteForce(email)) {
      return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
    }

    if (!isDBConfigured()) {
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
