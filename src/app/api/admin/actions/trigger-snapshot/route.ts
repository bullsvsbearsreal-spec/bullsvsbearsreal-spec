import { NextResponse } from 'next/server';
import { requireAdminOrAdvisor, auth } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'dxb1';
export const maxDuration = 30;

export async function POST() {
  const adminErr = await requireAdminOrAdvisor();
  if (adminErr) return adminErr;

  const session = await auth();

  try {
    const baseUrl = process.env.NEXTAUTH_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
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
    }).catch(() => {});

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
        error: isTimeout ? 'Snapshot timed out — try again in a minute' : err.message,
      },
      { status: isTimeout ? 504 : 500 },
    );
  }
}
