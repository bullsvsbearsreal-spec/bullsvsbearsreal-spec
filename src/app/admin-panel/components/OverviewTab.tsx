'use client';

import { useEffect, useState, useCallback } from 'react';
import AuditTimeline from './AuditTimeline';
import { CardGridSkeleton } from './AdminSkeletons';

interface HealthError {
  exchange: string;
  error: string;
  latencyMs?: number;
}

interface HealthResult {
  status: string;
  errors?: HealthError[];
  staleExchanges?: string[];
  activeExchanges?: number;
  totalExchanges?: number;
  totalEntries?: number;
  cache?: string;
  lastUpdate?: string;
}

type AdminTab = 'overview' | 'pipeline' | 'alerts' | 'database' | 'users' | 'actions';

interface Props {
  onNavigate: (tab: AdminTab) => void;
}

export default function OverviewTab({ onNavigate }: Props) {
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHealth = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const r = await fetch('/api/admin/actions/health-check', { method: 'POST' });
      const d = await r.json();
      if (d.success && d.healthResult) {
        setHealth(d.healthResult);
      } else {
        setHealth({ status: 'unknown', errors: d.error ? [{ exchange: 'system', error: d.error }] : [] });
      }
    } catch {
      setHealth({ status: 'unknown' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    // Auto-refresh every 2 min
    const iv = setInterval(() => fetchHealth(), 120_000);
    return () => clearInterval(iv);
  }, [fetchHealth]);

  // Normalize status
  const rawStatus = health?.status;
  const normalizedStatus = !rawStatus ? null
    : rawStatus === 'healthy' ? 'healthy'
    : rawStatus === 'degraded' ? 'degraded'
    : rawStatus === 'down' ? 'down'
    : 'degraded';

  const statusColor = !normalizedStatus
    ? 'border-neutral-700 bg-neutral-800/50'
    : normalizedStatus === 'healthy'
    ? 'border-emerald-500/30 bg-emerald-500/10'
    : normalizedStatus === 'degraded'
    ? 'border-amber-500/30 bg-amber-500/10'
    : 'border-red-500/30 bg-red-500/10';

  const statusText = !normalizedStatus
    ? 'Checking...'
    : normalizedStatus === 'healthy'
    ? 'All Systems Operational'
    : normalizedStatus === 'degraded'
    ? (rawStatus === 'error' || rawStatus === 'unknown' ? 'Health Check Unavailable' : 'Degraded Performance')
    : 'System Down';

  const statusDot = !normalizedStatus
    ? 'bg-neutral-500'
    : normalizedStatus === 'healthy'
    ? 'bg-emerald-400'
    : normalizedStatus === 'degraded'
    ? 'bg-amber-400'
    : 'bg-red-400';

  const errorCount = health?.errors?.length ?? 0;
  const staleCount = health?.staleExchanges?.length ?? 0;
  const activeExchanges = health?.activeExchanges ?? 0;
  const totalExchanges = health?.totalExchanges ?? 0;
  const totalEntries = health?.totalEntries ?? 0;

  return (
    <div className="space-y-4">
      {/* System status banner */}
      <div className={`rounded-lg border p-3 flex items-center gap-3 ${statusColor}`}>
        <div className={`w-2.5 h-2.5 rounded-full ${statusDot} ${normalizedStatus !== 'healthy' ? 'animate-pulse' : ''}`} />
        <span className="text-sm font-medium text-white">{statusText}</span>
        <div className="ml-auto flex items-center gap-2">
          {health?.lastUpdate && (
            <span className="text-[10px] text-neutral-500">
              {new Date(health.lastUpdate).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => fetchHealth(true)}
            disabled={refreshing}
            className="text-[10px] text-neutral-500 hover:text-white transition-colors disabled:opacity-50"
          >
            {refreshing ? '...' : 'Recheck'}
          </button>
        </div>
      </div>

      {/* Quick stats */}
      {loading ? (
        <CardGridSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            onClick={() => onNavigate('pipeline')}
            className="text-left rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5 hover:bg-white/[0.04] transition-colors"
          >
            <p className="text-[10px] text-neutral-500 mb-0.5">Exchanges</p>
            <p className="text-lg font-bold tabular-nums text-white">
              <span className={activeExchanges === totalExchanges ? 'text-emerald-400' : 'text-amber-400'}>
                {activeExchanges}
              </span>
              <span className="text-neutral-600 text-sm">/{totalExchanges}</span>
            </p>
            <p className="text-[10px] text-neutral-600 mt-0.5">Active feeds →</p>
          </button>
          <button
            onClick={() => onNavigate('pipeline')}
            className="text-left rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5 hover:bg-white/[0.04] transition-colors"
          >
            <p className="text-[10px] text-neutral-500 mb-0.5">Errors</p>
            <p className={`text-lg font-bold tabular-nums ${errorCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {errorCount}
            </p>
            {errorCount > 0 && (
              <p className="text-[10px] text-neutral-600 mt-0.5">View details →</p>
            )}
          </button>
          <button
            onClick={() => onNavigate('pipeline')}
            className="text-left rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5 hover:bg-white/[0.04] transition-colors"
          >
            <p className="text-[10px] text-neutral-500 mb-0.5">Stale Feeds</p>
            <p className={`text-lg font-bold tabular-nums ${staleCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {staleCount}
            </p>
            {staleCount > 0 && (
              <p className="text-[10px] text-neutral-600 mt-0.5">{health?.staleExchanges?.slice(0, 2).join(', ')}{staleCount > 2 ? ` +${staleCount - 2}` : ''}</p>
            )}
          </button>
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5">
            <p className="text-[10px] text-neutral-500 mb-0.5">Trading Pairs</p>
            <p className="text-lg font-bold tabular-nums text-white">
              {totalEntries > 0 ? totalEntries.toLocaleString() : '—'}
            </p>
            {health?.cache && (
              <p className="text-[10px] text-neutral-600 mt-0.5">Cache: {health.cache}</p>
            )}
          </div>
        </div>
      )}

      {/* Error list (if any) */}
      {errorCount > 0 && health?.errors && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
          <p className="text-xs font-medium text-red-400 mb-2">Active Errors</p>
          <div className="space-y-1">
            {health.errors.slice(0, 8).map((e, i) => (
              <div key={i} className="text-[11px] flex items-center gap-2">
                <span className="text-red-300 font-medium min-w-[80px]">{e.exchange}</span>
                <span className="text-neutral-500 truncate flex-1">{e.error}</span>
                {e.latencyMs != null && (
                  <span className="text-neutral-600 tabular-nums">{e.latencyMs}ms</span>
                )}
              </div>
            ))}
            {errorCount > 8 && (
              <p className="text-[10px] text-neutral-600">and {errorCount - 8} more...</p>
            )}
          </div>
        </div>
      )}

      {/* Stale exchanges warning */}
      {staleCount > 0 && health?.staleExchanges && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <p className="text-xs font-medium text-amber-400 mb-2">Stale Data ({'>'}10 min old)</p>
          <div className="flex flex-wrap gap-1.5">
            {health.staleExchanges.map((name) => (
              <span key={name} className="text-[11px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                {name}
              </span>
            ))}
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
