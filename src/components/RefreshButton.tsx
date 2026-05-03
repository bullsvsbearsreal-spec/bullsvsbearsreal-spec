'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface RefreshButtonProps {
  /** Function that refreshes data — usually the `refresh` from useApi */
  onRefresh: () => Promise<void> | void;
  /** Whether an async fetch is currently in flight (e.g. isRefreshing from useApi) */
  isRefreshing?: boolean;
  /** Optional extra className */
  className?: string;
}

/**
 * Minimal icon-only refresh button with spin animation. Sits next to
 * DataFreshness indicators on pages that poll on an interval but also
 * want to give users manual control.
 */
export default function RefreshButton({ onRefresh, isRefreshing = false, className = '' }: RefreshButtonProps) {
  const [localRefreshing, setLocalRefreshing] = useState(false);
  const spinning = isRefreshing || localRefreshing;

  const handleClick = async () => {
    if (spinning) return;
    setLocalRefreshing(true);
    try {
      await onRefresh();
    } finally {
      // Give the animation a minimum duration so fast refreshes still "feel" like work
      setTimeout(() => setLocalRefreshing(false), 400);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={spinning}
      className={`inline-flex items-center justify-center w-6 h-6 rounded text-neutral-500 hover:text-white hover:bg-white/[0.06] transition-colors disabled:cursor-wait ${className}`}
      aria-label="Refresh data"
      title="Refresh data now"
    >
      <RefreshCw className={`w-3 h-3 ${spinning ? 'animate-spin' : ''}`} />
    </button>
  );
}
