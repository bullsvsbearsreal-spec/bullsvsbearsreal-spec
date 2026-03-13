'use client';

import { useEffect, useState } from 'react';
import AuditTimeline from './AuditTimeline';
import { CardGridSkeleton } from './AdminSkeletons';

interface HealthResult {
  status: string;
  errors?: { exchange: string; error: string }[];
  staleExchanges?: string[];
  lastUpdate?: string;
}

type AdminTab = 'overview' | 'pipeline' | 'alerts' | 'database' | 'users' | 'actions';

interface Props {
  onNavigate: (tab: AdminTab) => void;
}

export default function OverviewTab({ onNavigate }: Props) {
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/actions/health-check', { method: 'POST' })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.healthResult) {
          setHealth(d.healthResult);
        } else {
          setHealth({ status: 'unknown', errors: d.error ? [{ exchange: 'system', error: d.error }] : [] });
        }
      })
      .catch(() => setHealth({ status: 'unknown' }))
      .finally(() => setLoading(false));
  }, []);

  const statusColor = !health
    ? 'border-neutral-700 bg-neutral-800/50'
    : health.status === 'healthy'
    ? 'border-emerald-500/30 bg-emerald-500/10'
    : health.status === 'degraded'
    ? 'border-amber-500/30 bg-amber-500/10'
    : 'border-red-500/30 bg-red-500/10';

  const statusText = !health
    ? 'Checking...'
    : health.status === 'healthy'
    ? 'All Systems Operational'
    : health.status === 'degraded'
    ? 'Degraded Performance'
    : 'System Down';

  const statusDot = !health
    ? 'bg-neutral-500'
    : health.status === 'healthy'
    ? 'bg-emerald-400'
    : health.status === 'degraded'
    ? 'bg-amber-400'
    : 'bg-red-400';

  const errorCount = health?.errors?.length ?? 0;
  const staleCount = health?.staleExchanges?.length ?? 0;

  return (
    <div className="space-y-4">
      {/* System status banner */}
      <div className={`rounded-lg border p-3 flex items-center gap-3 ${statusColor}`}>
        <div className={`w-2.5 h-2.5 rounded-full ${statusDot} ${health?.status !== 'healthy' ? 'animate-pulse' : ''}`} />
        <span className="text-sm font-medium text-white">{statusText}</span>
        {health?.lastUpdate && (
          <span className="ml-auto text-[10px] text-neutral-500">
            Last: {new Date(health.lastUpdate).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Quick stats */}
      {loading ? (
        <CardGridSkeleton count={3} />
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onNavigate('pipeline')}
            className="text-left rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5 hover:bg-white/[0.04] transition-colors"
          >
            <p className="text-[10px] text-neutral-500 mb-0.5">Exchange Errors</p>
            <p className={`text-lg font-bold tabular-nums ${errorCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {errorCount}
            </p>
            {errorCount > 0 && (
              <p className="text-[10px] text-neutral-600 mt-0.5">View in Pipeline →</p>
            )}
          </button>
          <button
            onClick={() => onNavigate('pipeline')}
            className="text-left rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5 hover:bg-white/[0.04] transition-colors"
          >
            <p className="text-[10px] text-neutral-500 mb-0.5">Stale Exchanges</p>
            <p className={`text-lg font-bold tabular-nums ${staleCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {staleCount}
            </p>
            {staleCount > 0 && (
              <p className="text-[10px] text-neutral-600 mt-0.5">View in Pipeline →</p>
            )}
          </button>
          <button
            onClick={() => onNavigate('alerts')}
            className="text-left rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5 hover:bg-white/[0.04] transition-colors"
          >
            <p className="text-[10px] text-neutral-500 mb-0.5">System Health</p>
            <p className={`text-lg font-bold ${health?.status === 'healthy' ? 'text-emerald-400' : 'text-amber-400'}`}>
              {health?.status ?? '...'}
            </p>
          </button>
        </div>
      )}

      {/* Error list (if any) */}
      {errorCount > 0 && health?.errors && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
          <p className="text-xs font-medium text-red-400 mb-2">Active Errors</p>
          <div className="space-y-1">
            {health.errors.slice(0, 5).map((e, i) => (
              <div key={i} className="text-[11px] flex items-center gap-2">
                <span className="text-red-300 font-medium">{e.exchange}</span>
                <span className="text-neutral-500 truncate">{e.error}</span>
              </div>
            ))}
            {errorCount > 5 && (
              <p className="text-[10px] text-neutral-600">and {errorCount - 5} more...</p>
            )}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button
          onClick={() => onNavigate('pipeline')}
          className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5 hover:bg-white/[0.06] transition-colors text-left"
        >
          <p className="text-xs font-medium text-white">Pipeline</p>
          <p className="text-[10px] text-neutral-500 mt-0.5">Monitor exchange feeds</p>
        </button>
        <button
          onClick={() => onNavigate('database')}
          className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5 hover:bg-white/[0.06] transition-colors text-left"
        >
          <p className="text-xs font-medium text-white">Database</p>
          <p className="text-[10px] text-neutral-500 mt-0.5">Storage & cache health</p>
        </button>
        <button
          onClick={() => onNavigate('users')}
          className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5 hover:bg-white/[0.06] transition-colors text-left"
        >
          <p className="text-xs font-medium text-white">Users</p>
          <p className="text-[10px] text-neutral-500 mt-0.5">Manage accounts</p>
        </button>
        <button
          onClick={() => onNavigate('actions')}
          className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5 hover:bg-white/[0.06] transition-colors text-left"
        >
          <p className="text-xs font-medium text-white">Actions</p>
          <p className="text-[10px] text-neutral-500 mt-0.5">Admin operations</p>
        </button>
      </div>

      {/* Audit timeline */}
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-3">
        <p className="text-xs font-medium text-neutral-400 mb-2">Recent Activity</p>
        <AuditTimeline limit={10} />
      </div>
    </div>
  );
}
