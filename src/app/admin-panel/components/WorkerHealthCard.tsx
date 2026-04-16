'use client';

import { useEffect, useState } from 'react';
import { Cpu, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

interface WorkerHeartbeat {
  workerName: string;
  status: string;
  lastHeartbeat: string;
  meta?: Record<string, unknown>;
  stale: boolean;
}

interface WorkerData {
  ok: boolean;
  summary: { total: number; healthy: number; stale: number };
  workers: WorkerHeartbeat[];
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function friendlyName(name: string): string {
  return name
    .replace(/^cron:/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export default function WorkerHealthCard() {
  const [data, setData] = useState<WorkerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetch('/api/admin/monitoring/workers', { signal: AbortSignal.timeout(10000) })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData)
      .catch(e => setError(e?.message || 'Failed'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Cpu className="w-4 h-4 text-neutral-500" />
          <span className="text-sm font-medium text-neutral-400">Worker Health</span>
        </div>
        <div className="flex items-center justify-center py-6">
          <div className="w-5 h-5 border-2 border-hub-yellow/30 border-t-hub-yellow rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/[0.03] p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-red-400" />
            <span className="text-sm font-medium text-red-400">Worker Health</span>
          </div>
          <button onClick={load} className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
        <p className="text-xs text-red-400/70">{error}</p>
      </div>
    );
  }

  if (!data || data.workers.length === 0) {
    return (
      <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-neutral-500" />
          <span className="text-sm font-medium text-neutral-400">Worker Health</span>
        </div>
        <p className="text-xs text-neutral-600 mt-2">No worker heartbeats recorded yet.</p>
      </div>
    );
  }

  const { summary, workers } = data;
  const allHealthy = summary.stale === 0;

  return (
    <div className={`rounded-lg border p-4 ${allHealthy ? 'border-white/[0.08] bg-white/[0.02]' : 'border-yellow-500/20 bg-yellow-500/[0.03]'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Cpu className={`w-4 h-4 ${allHealthy ? 'text-emerald-400' : 'text-yellow-400'}`} />
          <span className="text-sm font-medium text-white">Worker Health</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
            allHealthy
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-yellow-500/15 text-yellow-400'
          }`}>
            {allHealthy ? 'All OK' : `${summary.stale} stale`}
          </span>
        </div>
        <button onClick={load} className="text-[11px] text-neutral-500 hover:text-white flex items-center gap-1 transition-colors">
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      <div className="space-y-1.5">
        {workers.map(w => (
          <div
            key={w.workerName}
            className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${
              w.stale
                ? 'bg-yellow-500/[0.06] border border-yellow-500/15'
                : 'bg-white/[0.02] border border-white/[0.05]'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {w.stale ? (
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              )}
              <span className={`font-medium truncate ${w.stale ? 'text-yellow-300' : 'text-white'}`}>
                {friendlyName(w.workerName)}
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0 ml-3">
              {w.meta && Object.keys(w.meta).length > 0 && (
                <span className="text-neutral-500 hidden sm:inline">
                  {Object.entries(w.meta)
                    .filter(([, v]) => typeof v === 'number')
                    .slice(0, 3)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(' · ')}
                </span>
              )}
              <span className={`${w.stale ? 'text-yellow-400/70' : 'text-neutral-500'}`}>
                {timeAgo(w.lastHeartbeat)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4 mt-3 text-[11px] text-neutral-500">
        <span>Total: <span className="text-white font-medium">{summary.total}</span></span>
        <span>Healthy: <span className="text-emerald-400 font-medium">{summary.healthy}</span></span>
        {summary.stale > 0 && (
          <span>Stale: <span className="text-yellow-400 font-medium">{summary.stale}</span></span>
        )}
      </div>
    </div>
  );
}
