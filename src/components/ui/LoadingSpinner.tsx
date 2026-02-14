'use client';

import { Loader2, RefreshCw } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  className?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

export function LoadingSpinner({ size = 'md', message, className = '' }: LoadingSpinnerProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 ${className}`}>
      <Loader2 className={`${sizeClasses[size]} text-hub-yellow animate-spin`} />
      {message && <p className="text-hub-gray-text text-sm">{message}</p>}
    </div>
  );
}

export function LoadingCard({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="glass-card rounded-2xl p-10 flex flex-col items-center justify-center min-h-[200px]">
      <LoadingSpinner size="lg" message={message} />
    </div>
  );
}

export function LoadingOverlay({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="absolute inset-0 bg-hub-dark/80 backdrop-blur-sm flex items-center justify-center z-50 rounded-2xl">
      <LoadingSpinner size="lg" message={message} />
    </div>
  );
}

/**
 * Dark-themed loading card matching InfoHub page style.
 * Replaces inline loading states across OI, Liquidations, Funding, etc.
 */
export function PageLoadingCard({ message = 'Loading data...' }: { message?: string }) {
  return (
    <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-8">
      <div className="flex items-center justify-center gap-3">
        <RefreshCw className="w-6 h-6 text-hub-yellow animate-spin" />
        <span className="text-white text-sm">{message}</span>
      </div>
    </div>
  );
}

/**
 * Skeleton rows for tables (animated pulse placeholders).
 * @param rows Number of skeleton rows to render
 */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse h-9 bg-white/[0.03] rounded-lg" />
      ))}
    </div>
  );
}
