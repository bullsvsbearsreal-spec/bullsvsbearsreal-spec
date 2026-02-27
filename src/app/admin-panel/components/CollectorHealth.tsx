'use client';

import { Clock, AlertTriangle, Activity } from 'lucide-react';

interface Props {
  collector: {
    lastFunding: string | null;
    lastOI: string | null;
    lastLiq: string | null;
    avgIntervalMin: number | null;
    gapDetected: boolean;
    last24h: { funding: number; oi: number; liq: number };
  } | null;
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function CollectorHealth({ collector }: Props) {
  if (!collector) {
    return <p className="text-neutral-500 text-sm">Database not configured — collector data unavailable.</p>;
  }

  const isStale = (iso: string | null) => {
    if (!iso) return true;
    return Date.now() - new Date(iso).getTime() > 20 * 60 * 1000;
  };

  return (
    <div className="space-y-3">
      {collector.gapDetected && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-500/5 border border-red-500/20 text-[12px] text-red-400">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Gap detected — no new snapshots in 20+ minutes. Collector may be down.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <SnapCard label="Last Funding" time={collector.lastFunding} stale={isStale(collector.lastFunding)} />
        <SnapCard label="Last OI" time={collector.lastOI} stale={isStale(collector.lastOI)} />
        <SnapCard label="Last Liq" time={collector.lastLiq} stale={isStale(collector.lastLiq)} />
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5">
          <div className="flex items-center gap-1 text-neutral-500 text-[11px] mb-1">
            <Activity className="w-3 h-3" />
            Avg Interval
          </div>
          <p className="text-sm font-bold text-white">
            {collector.avgIntervalMin ? `${collector.avgIntervalMin}m` : '--'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 text-[11px] text-neutral-500">
        <span>24h snapshots:</span>
        <span>Funding: <span className="text-white font-medium">{formatNum(collector.last24h.funding)}</span></span>
        <span>OI: <span className="text-white font-medium">{formatNum(collector.last24h.oi)}</span></span>
        <span>Liq: <span className="text-white font-medium">{formatNum(collector.last24h.liq)}</span></span>
      </div>
    </div>
  );
}

function SnapCard({ label, time, stale }: { label: string; time: string | null; stale: boolean }) {
  return (
    <div className={`rounded-lg border p-2.5 ${stale ? 'border-yellow-500/20 bg-yellow-500/[0.03]' : 'border-white/[0.08] bg-white/[0.02]'}`}>
      <div className="flex items-center gap-1 text-neutral-500 text-[11px] mb-1">
        <Clock className="w-3 h-3" />
        {label}
      </div>
      <p className={`text-sm font-bold ${stale ? 'text-yellow-400' : 'text-white'}`}>
        {timeAgo(time)}
      </p>
    </div>
  );
}
