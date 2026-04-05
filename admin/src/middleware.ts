import { NextRequest, NextResponse } from 'next/server';

const AUTH_SECRET = process.env.AUTH_SECRET || 'infohub-admin-secret-change-me';

async function hashToken(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function middleware(request: NextRequest) {
  // Only protect /dashboard routes
  if (!request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.next();
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
  if (verify !== expectedVerify) {
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
