'use client';

import { useEffect } from 'react';

export default function PerpDexVolumeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Perp DEX Volume] render error:', error);
  }, [error]);

  return (
    <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-20 flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h1 className="text-lg font-semibold text-white mb-2">Volume race hit an issue</h1>
      <p className="text-neutral-400 text-sm mb-6 max-w-sm">
        DeFiLlama&apos;s derivatives feed was unreachable. This usually resolves within a minute — give it a retry.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 bg-hub-yellow text-black rounded-lg font-medium text-sm hover:bg-hub-yellow/90 transition-colors"
        >
          Try again
        </button>
        <a
          href="/funding-arb"
          className="px-4 py-2 border border-white/[0.1] text-neutral-300 rounded-lg text-sm hover:bg-white/[0.04] transition-colors"
        >
          Funding arb
        </a>
      </div>
    </main>
  );
}
