'use client';

import { Loader2 } from 'lucide-react';

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
