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

    let healthResult;

    // Try the full health endpoint first (requires ADMIN_API_KEY)
    if (apiKey) {
      try {
        const res = await fetch(`${baseUrl}/api/health`, {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(25000),
        });
        healthResult = await res.json().catch(() => null);
      } catch {
        healthResult = null;
      }
    }

    // Fallback: quick health check by pinging the funding API directly
    if (!healthResult || !healthResult.status) {
      try {
        const fundingRes = await fetch(`${baseUrl}/api/funding`, { signal: AbortSignal.timeout(15000) });
        if (fundingRes.ok) {
          const fj = await fundingRes.json();
          const activeExchanges = fj.health?.filter((h: any) => h.status === 'ok').length ?? 0;
          const totalExchanges = fj.health?.length ?? 0;
          const ratio = totalExchanges > 0 ? activeExchanges / totalExchanges : 0;
          healthResult = {
            status: ratio >= 0.8 ? 'healthy' : ratio >= 0.5 ? 'degraded' : 'down',
            errors: fj.health?.filter((h: any) => h.status === 'error').map((h: any) => ({ exchange: h.name, error: h.error || 'Error' })) || [],
            lastUpdate: new Date().toISOString(),
          };
        } else {
          healthResult = { status: 'degraded', errors: [{ exchange: 'system', error: `Funding API returned ${fundingRes.status}` }], lastUpdate: new Date().toISOString() };
        }
      } catch {
        healthResult = { status: 'degraded', errors: [{ exchange: 'system', error: 'Could not reach APIs' }], lastUpdate: new Date().toISOString() };
      }
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
