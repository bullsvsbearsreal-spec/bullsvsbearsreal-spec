'use client';

import { RefreshCw } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils/format';

interface LiveIndicatorProps {
  lastUpdate: Date | null;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  showTime?: boolean;
}

export function LiveIndicator({ lastUpdate, isRefreshing, onRefresh, showTime = true }: LiveIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1.5 text-xs text-hub-gray-text bg-hub-gray/30 px-2.5 py-1 rounded-full">
        <span className="relative flex h-2 w-2">
          <span className="animate-breathe absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.4)]" />
        </span>
        Streaming
        {showTime && lastUpdate && (
          <span className="text-hub-gray-text/50 ml-0.5">
            {formatRelativeTime(lastUpdate.getTime())}
          </span>
        )}
      </span>
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-2 rounded-lg text-hub-gray-text hover:text-hub-yellow hover:bg-hub-gray/30 transition-all disabled:opacity-50"
          aria-label="Refresh data"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      )}
    </div>
  );
}

export function StatusBadge({ status }: { status: 'live' | 'loading' | 'error' | 'stale' }) {
  const configs = {
    live: { color: 'bg-emerald-400', glow: 'shadow-[0_0_6px_rgba(52,211,153,0.4)]', text: 'Connected', animate: true },
    loading: { color: 'bg-amber-400', glow: 'shadow-[0_0_6px_rgba(251,191,36,0.3)]', text: 'Connecting', animate: true },
    error: { color: 'bg-red-400', glow: '', text: 'Interrupted', animate: false },
    stale: { color: 'bg-neutral-500', glow: '', text: 'Waiting', animate: false },
  };

  const config = configs[status];

  return (
    <span className="flex items-center gap-1.5 text-xs text-hub-gray-text bg-hub-gray/30 px-2.5 py-1 rounded-full">
      <span className="relative flex h-2 w-2">
        {config.animate && (
          <span className={`animate-breathe absolute inline-flex h-full w-full rounded-full ${config.color}`} />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${config.color} ${config.glow}`} />
      </span>
      {config.text}
    </span>
  );
}
