export const runtime = 'nodejs';
export const preferredRegion = 'bom1';

import { NextResponse } from 'next/server';
import * as OTPAuth from 'otpauth';
import crypto from 'crypto';
import { isDBConfigured, getSQL } from '@/lib/db';

// In-memory rate limit: max 5 attempts per email per 15 minutes
const attempts = new Map<string, { count: number; resetAt: number }>();
let lastCleanup = 0;

function checkRateLimit(email: string): boolean {
  const now = Date.now();
  const key = email.toLowerCase();

  // Periodic cleanup of expired entries (at most once per minute)
  if (now - lastCleanup > 60_000) {
    lastCleanup = now;
    attempts.forEach((v, k) => {
      if (now > v.resetAt) attempts.delete(k);
    });
  }

  const entry = attempts.get(key);

  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }

  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

// Validate a 2FA code during login (supports TOTP, email code, or backup code)
export async function POST(req: Request) {
  try {
    const { email, code, method } = await req.json();
    if (!email || !code) {
      return NextResponse.json({ error: 'Email and code are required' }, { status: 400 });
    }

    // Rate limit check
    if (!checkRateLimit(email)) {
      return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
    }

    if (!isDBConfigured()) {
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

    // Method: email — atomic claim to prevent TOCTOU race
    if (method === 'email' && settings.email_2fa_enabled) {
      const claimed = await db`
        UPDATE twofa_login_codes SET used = true
        WHERE id = (
          SELECT id FROM twofa_login_codes
          WHERE email = ${email}
            AND code = ${code}
            AND used = false
            AND expires_at > NOW()
          ORDER BY created_at DESC
          LIMIT 1
        )
        RETURNING id
      `;
      if (claimed.length > 0) {
        return NextResponse.json({ valid: true });
      }
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
    }

    // Method: backup (timing-safe compare, atomic removal to prevent race conditions)
    if (method === 'backup') {
      const backupCodes: string[] = settings.backup_codes || [];
      const upperCode = code.toUpperCase();
      // Timing-safe: compare all codes so timing doesn't leak which index matched
      let matchIdx = -1;
      for (let i = 0; i < backupCodes.length; i++) {
        const stored = Buffer.from(backupCodes[i]);
        const input = Buffer.from(upperCode);
        if (stored.length === input.length && crypto.timingSafeEqual(stored, input)) {
          matchIdx = i;
        }
      }
      if (matchIdx !== -1) {
        // Atomic removal: use array_remove to prevent race condition with concurrent requests
        const removed = await db`
          UPDATE user_2fa
          SET backup_codes = array_remove(backup_codes, ${backupCodes[matchIdx]}), updated_at = NOW()
          WHERE user_id = ${userId} AND ${backupCodes[matchIdx]} = ANY(backup_codes)
          RETURNING user_id
        `;
        if (removed.length === 0) {
          return NextResponse.json({ error: 'Backup code already used' }, { status: 400 });
        }
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
