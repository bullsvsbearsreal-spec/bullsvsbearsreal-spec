'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, RotateCcw } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Dashboard] render error:', error);
  }, [error]);

  return (
    <main className="max-w-[640px] mx-auto px-4 py-20 flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-400/30 flex items-center justify-center mb-4">
        <AlertCircle className="w-6 h-6 text-rose-400" />
      </div>
      <h1 className="text-lg font-semibold text-white mb-2">Dashboard ran into a problem</h1>
      <p className="text-neutral-400 text-sm mb-6 max-w-sm">
        Something went wrong rendering your command center. Try again — if it keeps failing,
        the underlying API may be temporarily down.
      </p>
      {error.digest && (
        <p className="text-[10px] font-mono text-neutral-600 mb-6">
          ref: {error.digest}
        </p>
      )}
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 bg-hub-yellow text-black rounded-lg font-medium text-sm hover:bg-hub-yellow/90 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Try again
        </button>
        <Link
          href="/"
          className="px-4 py-2 border border-white/[0.1] text-neutral-300 rounded-lg text-sm hover:bg-white/[0.04] transition-colors"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
