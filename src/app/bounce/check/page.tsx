'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight, Info, Sparkles, Flame } from 'lucide-react';

function isEvmAddress(s: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(s.trim());
}

// Famous rekt wallets — useful as examples + discovery.
const EXAMPLES: Array<{ address: string; label: string; note: string }> = [
  { address: '0x69423c20cb04da697996534507f8541fdb3e9aa9', label: 'Rank #2', note: '$72.2M liquidated · score 848' },
  { address: '0xaa1b01270a5bf5b981bf07a28c9def8d39625997', label: 'Rank #4', note: '$32.7M · 263 events' },
  { address: '0x7af6023089aac9c4a8adee1e0f82ada3b528df9d', label: 'Rank #6', note: '$18.2M · 241 events' },
  { address: '0x2f79e7993359e37091f8298c9706c75243da65a5', label: 'Rank #8', note: '$15.5M · 347 events' },
  { address: '0x06e0602c9158ee8478365c74606346d90d06df67', label: 'Rank #9', note: '$14.4M · 131 events' },
];

export default function BounceCheckPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const addr = query.trim();
    if (!addr) return;
    if (!isEvmAddress(addr)) {
      setErr('Enter a valid 0x… EVM address (40 hex characters).');
      return;
    }
    setErr(null);
    setLoading(true);
    router.push(`/bounce/${addr.toLowerCase()}`);
  }, [query, router]);

  return (
    <main className="max-w-[1400px] mx-auto w-full px-4 py-6">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Check Wallet Rekt Profile</h2>
        <p className="text-sm text-neutral-500">
          Look up any Hyperliquid-active EVM wallet to see its bounce.tech rekt profile — score, per-asset breakdown, monthly history, and claim status.
        </p>
      </div>

      {/* The search form — full-width, bold, CTA-style */}
      <div className="card-premium p-6 mb-4 bg-gradient-to-br from-red-500/[0.04] to-transparent border border-red-400/20">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-4 h-4 text-red-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Enter wallet address</h3>
        </div>
        <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setErr(null); }}
            placeholder="0x…"
            className="flex-1 bg-white/[0.04] border border-white/[0.1] rounded-lg px-4 py-3 text-base text-white font-mono placeholder:text-neutral-600 focus:outline-none focus:border-red-400/60"
            aria-label="Wallet address"
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-red-400 text-black font-bold rounded-lg text-sm hover:bg-red-300 disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-1.5"
          >
            {loading ? 'Loading…' : 'Check rekt profile'} <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>
        {err && <div className="mt-2 text-[12px] text-red-400">{err}</div>}
        <div className="mt-4 text-[11px] text-neutral-500">
          Works for any EVM address that has traded on Hyperliquid. Non-HL wallets will return zeros.
        </div>
      </div>

      {/* Examples */}
      <div className="card-premium p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-hub-yellow" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Example profiles</h3>
        </div>
        <div className="grid md:grid-cols-2 gap-2">
          {EXAMPLES.map(ex => (
            <Link
              key={ex.address}
              href={`/bounce/${ex.address}`}
              className="group flex items-center gap-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.04] rounded-lg px-3 py-2.5 transition-colors"
            >
              <div className="w-8 h-8 rounded bg-red-400/10 flex items-center justify-center flex-shrink-0">
                <Flame className="w-4 h-4 text-red-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-red-400 uppercase tracking-wider">{ex.label}</span>
                  <span className="text-[11px] text-white font-mono truncate">
                    {ex.address.slice(0, 6)}…{ex.address.slice(-4)}
                  </span>
                </div>
                <div className="text-[10px] text-neutral-500 truncate">{ex.note}</div>
              </div>
              <ArrowRight className="w-3 h-3 text-neutral-600 group-hover:text-hub-yellow flex-shrink-0" />
            </Link>
          ))}
        </div>
      </div>

      {/* Info panel */}
      <div className="p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed flex items-start gap-2">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <div>
          The rekt profile page shows total notional liquidated, event count, global rank + percentile, monthly history,
          per-asset breakdown, and whether the wallet has already claimed BOUNCE rewards on bounce.tech.
          Not your wallet? You can still browse any public rekt profile as research — see who got caught on which cycle.
        </div>
      </div>
    </main>
  );
}
