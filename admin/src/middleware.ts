import { NextRequest, NextResponse } from 'next/server';

const AUTH_SECRET = (process.env.AUTH_SECRET || '').trim();

async function hashToken(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time hex string comparison (Edge-compatible, no Node crypto needed) */
function safeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = new TextEncoder().encode(a);
  const bufB = new TextEncoder().encode(b);
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) {
    diff |= bufA[i] ^ bufB[i];
  }
  return diff === 0;
}

export async function middleware(request: NextRequest) {
  // Only protect /dashboard routes
  if (!request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.next();
  }

  // Block access entirely if AUTH_SECRET is not configured
  if (!AUTH_SECRET || AUTH_SECRET.length < 16) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const session = request.cookies.get('admin_session')?.value;
  const verify = request.cookies.get('admin_verify')?.value;

  // If no session cookies, redirect to login
  if (!session || !verify) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Verify HMAC: admin_verify must equal hash(AUTH_SECRET + session_token)
  // Without this, an attacker could set both cookies to arbitrary values
  const expectedVerify = await hashToken(`${AUTH_SECRET}-${session}`);
  if (!safeHexEqual(verify, expectedVerify)) {
    // Invalid session — clear cookies and redirect to login
    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.delete('admin_session');
    response.cookies.delete('admin_verify');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
