import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_PASSWORD, AUTH_SECRET } from '@/lib/config';

/* ─── IP-based rate limiter: max 5 attempts per 15 minutes ──────── */
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  // Periodic cleanup
  if (loginAttempts.size > 1000) {
    loginAttempts.forEach((v, k) => { if (now > v.resetAt) loginAttempts.delete(k); });
  }
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

async function hashToken(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Timing-safe string comparison — prevents password leaking via timing analysis */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = new TextEncoder().encode(a);
  const bufB = new TextEncoder().encode(b);
  // Constant-time comparison: XOR all bytes, accumulate differences
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) {
    diff |= bufA[i] ^ bufB[i];
  }
  return diff === 0;
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: 'Too many login attempts. Try again later.' }, { status: 429 });
    }

    const { password } = await request.json();

    // Block login entirely if ADMIN_PASSWORD or AUTH_SECRET is not configured
    if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 8) {
      return NextResponse.json({ error: 'Admin password not configured' }, { status: 503 });
    }
    if (!AUTH_SECRET || AUTH_SECRET.length < 16) {
      return NextResponse.json({ error: 'Auth secret not configured' }, { status: 503 });
    }

    if (!password || typeof password !== 'string' || !safeEqual(password, ADMIN_PASSWORD)) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    // Create a session token
    const token = await hashToken(`${AUTH_SECRET}-${Date.now()}`);

    const response = NextResponse.json({ ok: true });
    response.cookies.set('admin_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    // Also store the valid token server-side (in-memory for Edge runtime)
    // Since Edge workers are ephemeral, we use a simple cookie-based approach:
    // Store a signed hash that the middleware can verify
    const verifier = await hashToken(`${AUTH_SECRET}-${token}`);
    response.cookies.set('admin_verify', verifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24,
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

// Logout
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete('admin_session');
  response.cookies.delete('admin_verify');
  return response;
}
