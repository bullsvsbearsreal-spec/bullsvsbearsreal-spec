import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
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

  // Basic check: both cookies must exist and be non-empty
  // Full hash verification happens in the API route
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
