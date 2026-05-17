'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="bg-hub-black text-white min-h-screen flex items-center justify-center">
        <div className="text-center px-6 max-w-md">
          <div className="text-4xl font-bold text-red-400 mb-4 font-mono tracking-widest">REKT</div>
          <h1 className="text-xl font-semibold text-white mb-2">Everything hit a wick</h1>
          <p className="text-neutral-400 text-sm mb-2">
            Something on our end blew up at the root. Sentry has the stack
            trace; we&apos;ll dig in.
          </p>
          {error.digest && (
            <p className="text-neutral-600 text-[11px] font-mono mb-6">ref: {error.digest}</p>
          )}
          {!error.digest && <div className="mb-6" />}
          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="px-4 py-2 bg-hub-yellow text-black rounded-lg font-medium text-sm hover:bg-hub-yellow/90 transition-colors"
            >
              Retry
            </button>
            <a
              href="/home"
              className="px-4 py-2 bg-white/5 border border-white/10 text-white rounded-lg font-medium text-sm hover:bg-white/10 transition-colors"
            >
              Back to dashboard
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
