import { NextResponse } from 'next/server';
import { requireAdmin, auth } from '@/lib/auth';
import { flushApiCache, recordAuditEvent } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'dxb1';

export async function POST() {
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
