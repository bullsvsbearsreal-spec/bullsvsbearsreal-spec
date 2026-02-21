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
        <div className="text-center px-6">
          <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
          <p className="text-neutral-400 mb-6 text-sm">An unexpected error occurred. The team has been notified.</p>
          <button
            onClick={reset}
            className="px-4 py-2 bg-hub-yellow text-black rounded-lg font-medium hover:bg-hub-yellow/90 transition-colors"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
