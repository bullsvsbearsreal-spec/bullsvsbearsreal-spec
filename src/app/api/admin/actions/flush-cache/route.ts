import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, verifySameOrigin, auth } from '@/lib/auth';
import { flushApiCache, recordAuditEvent } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Origin check first — cheaper than the DB-backed admin check and
  // rejects forged cross-origin POSTs that an admin's browser might
  // be tricked into firing from a malicious page.
  const originErr = verifySameOrigin(request);
  if (originErr) return originErr;
  const adminErr = await requireAdmin();
  if (adminErr) return adminErr;

  const session = await auth();
  const cleared = await flushApiCache();

  await recordAuditEvent('cache_flush', {
    admin: session?.user?.email ?? 'unknown',
    clearedEntries: cleared,
  });

  return NextResponse.json({
    success: true,
    clearedEntries: cleared,
    timestamp: new Date().toISOString(),
  });
}
