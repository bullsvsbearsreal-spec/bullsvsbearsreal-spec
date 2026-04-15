import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getCircuitBreakerStatus } from '../_shared/exchange-fetchers';
import { getFundingData } from '../_shared/funding-core';
import { getOIData } from '../_shared/oi-core';
import { fetchWithTimeout, normalizeSymbol } from '../_shared/fetch';
import { fetchAllExchangesWithHealth } from '../_shared/exchange-fetchers';
import { dedupedFetch } from '../_shared/inflight';
import { tickerFetchers } from '../tickers/exchanges';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

const ADMIN_API_KEY = (process.env.ADMIN_API_KEY || '').trim();

interface ExchangeHealth {
  name: string;
  status: 'ok' | 'error' | 'empty' | 'circuit-open';
  count: number;
  latencyMs: number;
  error?: string;
}

interface RouteHealth {
  health: ExchangeHealth[];
  cache: string;
  meta: {
    totalExchanges: number;
    activeExchanges: number;
    totalEntries: number;
    timestamp: number;
  };
}

export async function GET(request: NextRequest) {
  // Auth check — always require Bearer token (timing-safe comparison)
  const authHeader = request.headers.get('authorization') || '';
  const expected = `Bearer ${ADMIN_API_KEY}`;
  if (!ADMIN_API_KEY || authHeader.length !== expected.length
    || !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const routes: Record<string, RouteHealth> = {};
  const errors: Array<{ exchange: string; route: string; error: string; latencyMs: number }> = [];

  // Fetch all 3 data sources directly (no self-referential HTTP)
  const [fundingResult, oiResult, tickersResult] = await Promise.all([
    getFundingData('crypto').catch(() => null),
    getOIData().catch(() => null),
    dedupedFetch('tickers', () =>
      fetchAllExchangesWithHealth(tickerFetchers, fetchWithTimeout),
    ).catch(() => null),
  ]);

  // Process funding
  if (fundingResult) {
    const health: ExchangeHealth[] = fundingResult.result.health || [];
    const meta = fundingResult.result.meta || { totalExchanges: 0, activeExchanges: 0, totalEntries: 0, timestamp: Date.now() };
    routes.funding = { health, cache: fundingResult.cacheStatus || 'DIRECT', meta };
    for (const h of health) {
      if (h.status === 'error') errors.push({ exchange: h.name, route: 'funding', error: h.error || 'Unknown', latencyMs: h.latencyMs });
    }
  } else {
    routes.funding = { health: [], cache: 'ERROR', meta: { totalExchanges: 0, activeExchanges: 0, totalEntries: 0, timestamp: Date.now() } };
  }

  // Process OI
  if (oiResult) {
    const health: ExchangeHealth[] = oiResult.result.health || [];
    const meta = oiResult.result.meta || { totalExchanges: 0, activeExchanges: 0, totalEntries: 0, timestamp: Date.now() };
    routes.openinterest = { health, cache: oiResult.cacheStatus || 'DIRECT', meta };
    for (const h of health) {
      if (h.status === 'error') errors.push({ exchange: h.name, route: 'openinterest', error: h.error || 'Unknown', latencyMs: h.latencyMs });
    }
  } else {
    routes.openinterest = { health: [], cache: 'ERROR', meta: { totalExchanges: 0, activeExchanges: 0, totalEntries: 0, timestamp: Date.now() } };
  }

  // Process tickers
  if (tickersResult) {
    const health: ExchangeHealth[] = tickersResult.health || [];
    const activeExchanges = health.filter((h: ExchangeHealth) => h.status === 'ok').length;
    routes.tickers = {
      health,
      cache: 'DIRECT',
      meta: { totalExchanges: health.length, activeExchanges, totalEntries: tickersResult.data?.length || 0, timestamp: Date.now() },
    };
    for (const h of health) {
      if (h.status === 'error') errors.push({ exchange: h.name, route: 'tickers', error: h.error || 'Unknown', latencyMs: h.latencyMs });
    }
  } else {
    routes.tickers = { health: [], cache: 'ERROR', meta: { totalExchanges: 0, activeExchanges: 0, totalEntries: 0, timestamp: Date.now() } };
  }

  // Determine overall status
  const totalActive = Object.values(routes).reduce((sum, r) => sum + r.meta.activeExchanges, 0);
  const totalExchanges = Object.values(routes).reduce((sum, r) => sum + r.meta.totalExchanges, 0);
  const activeRatio = totalExchanges > 0 ? totalActive / totalExchanges : 0;

  let status: 'healthy' | 'degraded' | 'down' = 'healthy';
  if (activeRatio < 0.5) status = 'down';
  else if (activeRatio < 0.8 || errors.length > 5) status = 'degraded';

  // Circuit breaker status
  const circuitBreakers = getCircuitBreakerStatus();
  const openBreakers = Object.entries(circuitBreakers)
    .filter(([, s]) => s.isOpen)
    .map(([name]) => name);

  return NextResponse.json({
    status,
    timestamp: Date.now(),
    routes,
    errors,
    circuitBreakers: {
      openCount: openBreakers.length,
      open: openBreakers,
      all: circuitBreakers,
    },
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
