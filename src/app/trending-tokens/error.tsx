'use client';
import { useEffect } from 'react';
export default function TrendingTokensError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[Trending] render error:', error); }, [error]);
  return (
    <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-20 flex flex-col items-center text-center">
      <h1 className="text-lg font-semibold text-white mb-2">Trending tokens feed hit an issue</h1>
      <p className="text-neutral-400 text-sm mb-6 max-w-sm">DexScreener may be rate-limiting. Retry usually works.</p>
      <button onClick={reset} className="px-4 py-2 bg-hub-yellow text-black rounded-lg text-sm font-medium">Try again</button>
    </main>
  );
}
