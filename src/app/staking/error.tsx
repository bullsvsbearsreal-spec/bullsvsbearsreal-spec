'use client';
import { useEffect } from 'react';
export default function StakingError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[Staking] render error:', error); }, [error]);
  return (
    <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-20 flex flex-col items-center text-center">
      <h1 className="text-lg font-semibold text-white mb-2">Staking feed hit an issue</h1>
      <p className="text-neutral-400 text-sm mb-6 max-w-sm">DefiLlama&apos;s pools endpoint may be rate-limiting. Retry usually clears it.</p>
      <div className="flex gap-3">
        <button onClick={reset} className="px-4 py-2 bg-hub-yellow text-black rounded-lg text-sm font-medium">Try again</button>
        <a href="/yields" className="px-4 py-2 border border-white/[0.1] text-neutral-300 rounded-lg text-sm">All yields</a>
      </div>
    </main>
  );
}
