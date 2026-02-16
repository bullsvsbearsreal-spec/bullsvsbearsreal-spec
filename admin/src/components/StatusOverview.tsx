'use client';

import { HealthResponse, RouteHealth } from '@/lib/types';
import StatusBadge from './StatusBadge';

function CacheCard({ name, route }: { name: string; route: RouteHealth }) {
  const cacheColor =
    route.cache === 'HIT' ? 'text-emerald-400' :
    route.cache === 'MISS' ? 'text-blue-400' :
    route.cache === 'STALE' ? 'text-amber-400' : 'text-red-400';

  const ageMs = Date.now() - route.meta.timestamp;
  const ageSec = Math.round(ageMs / 1000);

  return (
    <div className="admin-card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-neutral-500 uppercase tracking-wider">{name}</span>
        <span className={`text-xs font-medium ${cacheColor}`}>{route.cache}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-white">
          {route.meta.activeExchanges}
          <span className="text-neutral-600 text-sm">/{route.meta.totalExchanges}</span>
        </span>
        <span className="text-xs text-neutral-600">active</span>
      </div>
      <div className="flex items-center justify-between mt-2 text-[11px] text-neutral-600">
        <span>{route.meta.totalEntries.toLocaleString()} entries</span>
        <span>{ageSec}s ago</span>
      </div>
    </div>
  );
}

export default function StatusOverview({ data }: { data: HealthResponse }) {
  return (
    <div className="space-y-4">
      {/* System status header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-terminal-green font-bold text-base tracking-wider">INFOHUB ADMIN</h1>
          <StatusBadge status={data.status} />
        </div>
        <span className="text-[11px] text-neutral-600">
          {new Date(data.timestamp).toLocaleTimeString()}
        </span>
      </div>

      {/* Cache status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <CacheCard name="Funding" route={data.routes.funding} />
        <CacheCard name="Open Interest" route={data.routes.openinterest} />
        <CacheCard name="Tickers" route={data.routes.tickers} />
      </div>
    </div>
  );
}
