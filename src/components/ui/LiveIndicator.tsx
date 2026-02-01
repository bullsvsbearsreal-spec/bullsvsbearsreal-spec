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
      <span className="flex items-center gap-1.5 text-xs text-hub-gray-text bg-hub-gray/30 px-2 py-1 rounded-md">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
        </span>
        Live
        {showTime && lastUpdate && (
          <span className="text-hub-gray-text/70 ml-1">
            · {formatRelativeTime(lastUpdate.getTime())}
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
    live: { color: 'bg-success', text: 'Live', animate: true },
    loading: { color: 'bg-hub-yellow', text: 'Loading', animate: true },
    error: { color: 'bg-danger', text: 'Error', animate: false },
    stale: { color: 'bg-hub-gray', text: 'Stale', animate: false },
  };

  const config = configs[status];

  return (
    <span className="flex items-center gap-1.5 text-xs text-hub-gray-text bg-hub-gray/30 px-2 py-1 rounded-md">
      <span className="relative flex h-2 w-2">
        {config.animate && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.color} opacity-75`}></span>
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${config.color}`}></span>
      </span>
      {config.text}
    </span>
  );
}
