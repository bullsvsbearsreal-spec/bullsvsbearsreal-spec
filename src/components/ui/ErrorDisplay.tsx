'use client';

import { AlertCircle, RefreshCw, WifiOff } from 'lucide-react';

interface ErrorDisplayProps {
  message: string;
  onRetry?: () => void;
  type?: 'error' | 'warning' | 'network';
  className?: string;
}

export function ErrorDisplay({ message, onRetry, type = 'error', className = '' }: ErrorDisplayProps) {
  const icons = {
    error: AlertCircle,
    warning: AlertCircle,
    network: WifiOff,
  };

  const colors = {
    error: 'text-danger',
    warning: 'text-hub-yellow',
    network: 'text-hub-gray-text',
  };

  const Icon = icons[type];

  return (
    <div className={`flex flex-col items-center justify-center gap-3 p-6 ${className}`}>
      <Icon className={`w-8 h-8 ${colors[type]}`} />
      <p className={`text-sm ${colors[type]}`}>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 bg-hub-gray/30 text-white rounded-lg text-sm hover:bg-hub-gray/50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      )}
    </div>
  );
}

export function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="glass-card rounded-2xl min-h-[200px] flex items-center justify-center">
      <ErrorDisplay message={message} onRetry={onRetry} />
    </div>
  );
}

export function NetworkError({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorDisplay
      type="network"
      message="Unable to connect. Check your internet connection."
      onRetry={onRetry}
    />
  );
}
