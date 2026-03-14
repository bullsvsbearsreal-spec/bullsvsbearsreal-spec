import { NextResponse } from 'next/server';
import { requireAdminOrAdvisor, auth } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/db';
import { getFundingData } from '@/app/api/_shared/funding-core';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const maxDuration = 30;

export async function POST() {
  const adminErr = await requireAdminOrAdvisor();
  if (adminErr) return adminErr;

  const session = await auth();

  try {
    // Call getFundingData directly — no self-referential HTTP calls
    const fundingResult = await getFundingData('crypto');

    let healthResult;

    if (fundingResult) {
      const health = fundingResult.result.health || [];
      const activeExchanges = health.filter((h: any) => h.status === 'ok').length;
      const totalExchanges = health.length;
      const ratio = totalExchanges > 0 ? activeExchanges / totalExchanges : 0;
      const staleExchanges: string[] = [];
      const now = Date.now();

      // Detect stale exchanges (>10 min since last update)
      const entries: any[] = fundingResult.result.data || [];
      const latestByExchange = new Map<string, number>();
      for (const e of entries) {
        const ts = e.updatedAt ? new Date(e.updatedAt).getTime() : 0;
        const existing = latestByExchange.get(e.exchange) || 0;
        if (ts > existing) latestByExchange.set(e.exchange, ts);
      }
      latestByExchange.forEach((ts, name) => {
        if (ts > 0 && now - ts > 10 * 60 * 1000) staleExchanges.push(name);
      });

      healthResult = {
        status: ratio >= 0.8 ? 'healthy' : ratio >= 0.5 ? 'degraded' : 'down',
        errors: health
          .filter((h: any) => h.status === 'error')
          .map((h: any) => ({ exchange: h.name, error: h.error || 'Error', latencyMs: h.latencyMs })),
        staleExchanges,
        activeExchanges,
        totalExchanges,
        totalEntries: entries.length,
        cache: fundingResult.cacheStatus,
        lastUpdate: new Date().toISOString(),
      };
    } else {
      healthResult = {
        status: 'degraded',
        errors: [{ exchange: 'system', error: 'Funding data unavailable' }],
        lastUpdate: new Date().toISOString(),
      };
    }

    await recordAuditEvent('health_check', {
      admin: session?.user?.email ?? 'unknown',
      status: healthResult.status,
      errorCount: healthResult.errors?.length ?? 0,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      healthResult,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
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
