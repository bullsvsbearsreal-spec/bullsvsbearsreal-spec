'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function Error({
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
    <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-20 flex flex-col items-center justify-center text-center">
      <div className="text-4xl font-bold text-red-400 mb-4">Error</div>
      <h1 className="text-xl font-semibold text-white mb-2">Something went wrong</h1>
      <p className="text-neutral-400 text-sm mb-8 max-w-md">
        An unexpected error occurred. Our team has been notified.
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-hub-yellow text-black rounded-lg font-medium text-sm hover:bg-hub-yellow/90 transition-colors"
      >
        Try again
      </button>
    </main>
  );
}
