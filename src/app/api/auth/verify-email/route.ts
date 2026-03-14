export const runtime = 'nodejs';
export const preferredRegion = 'bom1';

import { NextResponse } from 'next/server';
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

export async function POST(req: Request) {
  try {
    const { email, code } = await req.json();

    if (!email || !code) {
      return NextResponse.json({ error: 'Email and code are required' }, { status: 400 });
    }

    if (!isDBConfigured()) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Rate limit check
    if (!checkRateLimit(email)) {
      return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
    }

    const db = getSQL();

    // Atomically claim the code — prevents TOCTOU race with concurrent requests
    const claimed = await db`
      UPDATE email_verification_codes SET used = true
      WHERE id = (
        SELECT id FROM email_verification_codes
        WHERE email = ${email}
          AND code = ${code}
          AND used = false
          AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1
      )
      RETURNING user_id
    `;

    if (claimed.length === 0) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
    }

    // Mark user as verified
    await db`UPDATE users SET email_verified = NOW() WHERE id = ${claimed[0].user_id}`;

    return NextResponse.json({ verified: true });
  } catch (e: any) {
    console.error('Verify email error:', e?.message || e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
