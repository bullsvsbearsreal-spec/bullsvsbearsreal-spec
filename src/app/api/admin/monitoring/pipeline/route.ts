/**
 * GET /api/admin/monitoring/pipeline
 *
 * Returns exchange health, stale data detection, collector status,
 * cross-exchange outliers, zero/null anomalies, and symbol coverage.
 * Admin only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrAdvisor } from '@/lib/auth';
import { isDBConfigured } from '@/lib/db';
import { getCollectorHealth } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';

const ADMIN_API_KEY = (process.env.ADMIN_API_KEY || '').trim();

interface ExchangeHealth {
  name: string;
  status: 'ok' | 'error' | 'empty';
  count: number;
  latencyMs: number;
  error?: string;
}

interface HealthRouteData {
  health: ExchangeHealth[];
  cache: string;
  meta: { totalExchanges: number; activeExchanges: number; totalEntries: number; timestamp: number };
}

interface FundingRow {
  symbol: string;
  exchange: string;
  fundingRate: number | null;
}

interface OIRow {
  symbol: string;
  exchange: string;
  openInterestValue: number;
}

export async function GET(request: NextRequest) {
  const denied = await requireAdminOrAdvisor();
  if (denied) return denied;

  const origin = request.nextUrl.origin;
  const timeout = AbortSignal.timeout(25000);

  // Fetch health + live data in parallel
  const healthHeaders: HeadersInit = {};
  if (ADMIN_API_KEY) healthHeaders['authorization'] = `Bearer ${ADMIN_API_KEY}`;

  const [healthRes, fundingRes, oiRes, collectorData] = await Promise.all([
    fetch(`${origin}/api/health`, { signal: timeout, headers: healthHeaders }).catch(() => null),
    fetch(`${origin}/api/funding`, { signal: timeout }).catch(() => null),
    fetch(`${origin}/api/openinterest`, { signal: timeout }).catch(() => null),
    isDBConfigured() ? getCollectorHealth() : null,
  ]);

  // Parse health data
  let exchangeHealth: {
    status: string;
    routes: Record<string, HealthRouteData>;
    errors: Array<{ exchange: string; route: string; error: string; latencyMs: number }>;
  } = { status: 'unknown', routes: {}, errors: [] };

  if (healthRes && healthRes.ok) {
    exchangeHealth = await healthRes.json();
  }

  // Detect stale exchanges (latency > 5 min = probably cached too long or error)
  const staleExchanges: Array<{ name: string; route: string; ageMinutes: number }> = [];
  for (const [routeName, routeData] of Object.entries(exchangeHealth.routes || {})) {
    for (const h of (routeData as HealthRouteData).health || []) {
      if (h.status === 'error' || h.status === 'empty') {
        staleExchanges.push({ name: h.name, route: routeName, ageMinutes: -1 });
      }
    }
  }

  // Parse funding data for outlier + anomaly detection
  let fundingData: FundingRow[] = [];
  let oiData: OIRow[] = [];

  if (fundingRes && fundingRes.ok) {
    const json = await fundingRes.json();
    fundingData = json.data || [];
  }
  if (oiRes && oiRes.ok) {
    const json = await oiRes.json();
    oiData = json.data || [];
  }

  // Cross-exchange outlier detection (funding rates)
  const outliers = detectFundingOutliers(fundingData);

  // Zero/null anomaly detection
  const anomalies = detectAnomalies(fundingData, oiData);

  // Symbol coverage per exchange
  const coverage = computeCoverage(fundingData, oiData, exchangeHealth.routes);

  // Collector health
  const collector = collectorData ? {
    ...collectorData,
    gapDetected: false,
  } : null;

  if (collector) {
    const now = Date.now();
    const lastTimes = [collector.lastFunding, collector.lastOI].filter(Boolean).map(t => new Date(t!).getTime());
    const mostRecent = lastTimes.length > 0 ? Math.max(...lastTimes) : 0;
    collector.gapDetected = mostRecent > 0 && (now - mostRecent) > 20 * 60 * 1000; // >20 min
  }

  return NextResponse.json({
    exchangeHealth,
    staleExchanges,
    collector,
    outliers,
    anomalies,
    coverage,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

function detectFundingOutliers(data: FundingRow[]) {
  const bySymbol = new Map<string, { exchange: string; rate: number }[]>();
  for (const row of data) {
    if (row.fundingRate == null) continue;
    if (!bySymbol.has(row.symbol)) bySymbol.set(row.symbol, []);
    bySymbol.get(row.symbol)!.push({ exchange: row.exchange, rate: row.fundingRate });
  }

  const outliers: Array<{ symbol: string; exchange: string; metric: string; value: number; median: number; deviationPct: number }> = [];

  for (const [symbol, entries] of Array.from(bySymbol)) {
    if (entries.length < 3) continue;
    const rates = entries.map((e: { exchange: string; rate: number }) => e.rate).sort((a: number, b: number) => a - b);
    const median = rates[Math.floor(rates.length / 2)];
    if (Math.abs(median) < 0.0001) continue;

    for (const entry of entries) {
      const deviation = Math.abs((entry.rate - median) / median) * 100;
      if (deviation > 200) {
        outliers.push({
          symbol, exchange: entry.exchange, metric: 'funding',
          value: entry.rate, median, deviationPct: Math.round(deviation),
        });
      }
    }
  }

  return outliers.sort((a, b) => b.deviationPct - a.deviationPct).slice(0, 20);
}

function detectAnomalies(fundingData: FundingRow[], oiData: OIRow[]) {
  const zeroOI: Record<string, number> = {};
  const nullFunding: Record<string, number> = {};

  for (const r of oiData) {
    if (r.openInterestValue === 0 || r.openInterestValue == null) {
      zeroOI[r.exchange] = (zeroOI[r.exchange] || 0) + 1;
    }
  }
  for (const r of fundingData) {
    if (r.fundingRate == null) {
      nullFunding[r.exchange] = (nullFunding[r.exchange] || 0) + 1;
    }
  }

  return {
    zeroOI: Object.entries(zeroOI).map(([exchange, count]) => ({ exchange, count })).sort((a, b) => b.count - a.count),
    nullFunding: Object.entries(nullFunding).map(([exchange, count]) => ({ exchange, count })).sort((a, b) => b.count - a.count),
    totalZeroOI: Object.values(zeroOI).reduce((a, b) => a + b, 0),
    totalNullFunding: Object.values(nullFunding).reduce((a, b) => a + b, 0),
  };
}

function computeCoverage(
  fundingData: FundingRow[],
  oiData: OIRow[],
  routes: Record<string, HealthRouteData>,
) {
  const exchangeSet = new Set<string>();
  const fundingCount: Record<string, number> = {};
  const oiCount: Record<string, number> = {};
  const tickerCount: Record<string, number> = {};

  for (const r of fundingData) {
    exchangeSet.add(r.exchange);
    fundingCount[r.exchange] = (fundingCount[r.exchange] || 0) + 1;
  }
  for (const r of oiData) {
    exchangeSet.add(r.exchange);
    oiCount[r.exchange] = (oiCount[r.exchange] || 0) + 1;
  }
  // Ticker count from health data
  for (const h of (routes?.tickers as HealthRouteData)?.health || []) {
    exchangeSet.add(h.name);
    tickerCount[h.name] = h.count;
  }

  return Array.from(exchangeSet).sort().map(exchange => ({
    exchange,
    funding: fundingCount[exchange] || 0,
    oi: oiCount[exchange] || 0,
    tickers: tickerCount[exchange] || 0,
  }));
}
