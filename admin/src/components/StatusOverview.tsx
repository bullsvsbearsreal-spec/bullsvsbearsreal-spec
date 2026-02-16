'use client';

import { HealthResponse, RouteHealth } from '@/lib/types';

function CacheBadge({ status }: { status: string }) {
  const color =
    status === 'HIT' ? 'var(--admin-accent)' :
    status === 'MISS' ? '#60a5fa' :
    status === 'STALE' ? '#f59e0b' : '#ef4444';

  return (
    <span
      className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
      style={{ color, background: `${color}15`, border: `1px solid ${color}30` }}
    >
      {status}
    </span>
  );
}

function CacheCard({ name, route, ttl }: { name: string; route: RouteHealth; ttl: number }) {
  const ageMs = Date.now() - route.meta.timestamp;
  const ageSec = Math.round(ageMs / 1000);
  const freshPercent = Math.max(0, Math.min(100, ((ttl - ageSec) / ttl) * 100));

  const freshColor = ageSec < ttl * 0.5 ? 'var(--admin-accent)' :
                     ageSec < ttl * 0.8 ? '#f59e0b' : '#ef4444';

  return (
    <div className="admin-card admin-card-accent overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] uppercase tracking-wider font-medium" style={{ color: 'var(--admin-accent)' }}>
          {name}
        </span>
        <CacheBadge status={route.cache} />
      </div>

      {/* Main stat */}
      <div className="flex items-baseline gap-1.5 mb-3">
        <span className="text-3xl font-bold text-white tabular-nums">
          {route.meta.activeExchanges}
        </span>
        <span className="text-lg tabular-nums" style={{ color: 'var(--admin-text-muted)' }}>
          / {route.meta.totalExchanges}
        </span>
        <span className="text-[11px] ml-1" style={{ color: 'var(--admin-text-muted)' }}>active</span>
      </div>

      {/* Entries */}
      <div className="text-[11px] mb-3" style={{ color: 'var(--admin-text-muted)' }}>
        {route.meta.totalEntries.toLocaleString()} entries
      </div>

      {/* Cache freshness progress bar */}
      <div className="admin-progress">
        <div className="admin-progress-fill" style={{ width: `${freshPercent}%`, background: freshColor }} />
      </div>
      <div className="flex justify-between mt-1.5 text-[10px]" style={{ color: 'var(--admin-text-muted)' }}>
        <span>{ageSec}s ago</span>
        <span>TTL {ttl}s</span>
      </div>
    </div>
  );
}

export default function StatusOverview({ data }: { data: HealthResponse }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <CacheCard name="Funding" route={data.routes.funding} ttl={120} />
      <CacheCard name="Open Interest" route={data.routes.openinterest} ttl={120} />
      <CacheCard name="Tickers" route={data.routes.tickers} ttl={30} />
    </div>
  );
}
