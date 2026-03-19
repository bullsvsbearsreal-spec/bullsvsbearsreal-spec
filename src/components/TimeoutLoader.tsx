'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface TimeoutLoaderProps {
  loading: boolean;
  timeout?: number;
  onRetry?: () => void;
  children: ReactNode;
  /** Label shown during loading */
  label?: string;
  /** Number of skeleton rows to show */
  skeletonRows?: number;
}

/**
 * Wraps content with loading skeleton + timeout detection.
 * Shows skeleton during loading, then a retry prompt if loading exceeds timeout.
 */
export default function TimeoutLoader({
  loading,
  timeout = 20000,
  onRetry,
  children,
  label = 'Loading data...',
  skeletonRows = 5,
}: TimeoutLoaderProps) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!loading) {
      setTimedOut(false);
      return;
    }
    const t = setTimeout(() => setTimedOut(true), timeout);
    return () => clearTimeout(t);
  }, [loading, timeout]);

  if (!loading) return <>{children}</>;

  if (timedOut) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500" />
        <p className="text-neutral-400 text-sm">Data taking longer than expected</p>
        <p className="text-neutral-600 text-xs">Exchange APIs may be slow or rate-limited</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 px-4 py-2 rounded-lg bg-hub-yellow/10 border border-hub-yellow/20 text-hub-yellow text-xs font-medium hover:bg-hub-yellow/20 transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  // Skeleton loading state
  return (
    <div className="space-y-2 animate-pulse">
      {label && (
        <div className="flex items-center gap-2 mb-4">
          <RefreshCw className="w-4 h-4 text-hub-yellow animate-spin" />
          <span className="text-neutral-500 text-sm">{label}</span>
        </div>
      )}
      {Array.from({ length: skeletonRows }).map((_, i) => (
        <div
          key={i}
          className="h-12 bg-white/[0.03] rounded-lg"
          style={{ opacity: 1 - i * 0.12 }}
        />
      ))}
    </div>
  );
}
