import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

const CRON_SECRET = (process.env.CRON_SECRET || '').trim();

/**
 * Verify the cron request's Authorization header against CRON_SECRET
 * using a timing-safe comparison.
 * Returns null if authorized, or a 401 NextResponse if not.
 */
export function verifyCronAuth(request: NextRequest): NextResponse | null {
  const auth = request.headers.get('authorization') || '';
  const expected = `Bearer ${CRON_SECRET}`;

  if (!CRON_SECRET || auth.length !== expected.length) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isValid = timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
