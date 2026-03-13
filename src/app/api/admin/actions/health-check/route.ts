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
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

    if (!baseUrl) {
      return NextResponse.json({ success: false, error: 'Server URL not configured' }, { status: 500 });
    }
    const apiKey = process.env.ADMIN_API_KEY || '';

    const res = await fetch(`${baseUrl}/api/health`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal: AbortSignal.timeout(28000),
    });

    let healthResult;
    try {
      healthResult = await res.json();
    } catch {
      healthResult = { status: 'error', error: `Health API returned ${res.status}`, timestamp: Date.now() };
    }

    await recordAuditEvent('health_check', {
      admin: session?.user?.email ?? 'unknown',
      status: healthResult?.status ?? 'unknown',
      errorCount: healthResult?.errors?.length ?? 0,
    }).catch(() => {}); // Don't fail the whole request if audit fails

    return NextResponse.json({
      success: true,
      healthResult,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    // Even on timeout/error, return success:false with useful info
    const isTimeout = err.name === 'TimeoutError' || err.message?.includes('timeout');
    return NextResponse.json(
      {
        success: false,
        error: isTimeout ? 'Health check timed out — cache may be cold, try again in 1 minute' : err.message,
      },
      { status: isTimeout ? 504 : 500 },
    );
  }
}
