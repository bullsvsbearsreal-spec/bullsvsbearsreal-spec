import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrAdvisor, verifySameOrigin, auth } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const originErr = verifySameOrigin(request);
  if (originErr) return originErr;
  const adminErr = await requireAdminOrAdvisor();
  if (adminErr) return adminErr;

  const session = await auth();

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
      || process.env.NEXTAUTH_URL
      || 'http://localhost:3000';
    const cronSecret = process.env.CRON_SECRET || '';

    const res = await fetch(`${baseUrl}/api/cron/snapshot`, {
      headers: cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {},
      signal: AbortSignal.timeout(28000),
    });

    let result;
    try {
      result = await res.json();
    } catch {
      result = { ok: false, error: `Snapshot API returned ${res.status}` };
    }

    await recordAuditEvent('trigger_snapshot', {
      admin: session?.user?.email ?? 'unknown',
      ok: result?.ok ?? false,
      fundingInserted: result?.fundingInserted ?? 0,
      oiInserted: result?.oiInserted ?? 0,
      liqInserted: result?.liqInserted ?? 0,
    }).catch(e => console.error('[admin] audit snapshot error:', e));

    return NextResponse.json({
      success: result?.ok ?? false,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    const isTimeout = err.name === 'TimeoutError' || err.message?.includes('timeout');
    return NextResponse.json(
      {
        success: false,
        error: isTimeout ? 'Snapshot timed out — try again in a minute' : 'Snapshot failed',
      },
      { status: isTimeout ? 504 : 500 },
    );
  }
}
