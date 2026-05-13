'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApi } from '@/hooks/useSWRApi';
import DataFreshness from '@/components/DataFreshness';
import RefreshButton from '@/components/RefreshButton';
import UsdDisplay from '@/components/UsdDisplay';
import { Skull, Search, ExternalLink, Sparkles, Info, ArrowRight, Flame } from 'lucide-react';

interface RektRow {
  rank: number;
  address: string;
  totalNotional: number;
  count: number;
  score: number;
  avgLiquidation: number;
}

interface RektResponse {
  data: RektRow[];
  summary: {
    totalRekt: number;
    totalWallets: number;
    totalLiquidations: number;
    biggestLoser: string | null;
    biggestLoserNotional: number;
    biggestScore: number;
  };
  meta: { timestamp: number };
}

function short(a: string): string {
  if (!a) return '—';
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function isEvmAddress(s: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(s.trim());
}

export default function BounceHubPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const submit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const addr = query.trim();
    if (!addr) return;
    if (!isEvmAddress(addr)) {
      setErr('Enter a valid 0x… EVM address');
      return;
    }
    setErr(null);
    router.push(`/bounce/${addr.toLowerCase()}`);
  }, [query, router]);

  const { data, isLoading, isRefreshing, refresh } = useApi<RektResponse>({
    key: 'rekt:notional',
    fetcher: async () => {
      const res = await fetch('/api/rekt-leaderboard?limit=10&sort=notional', {
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refreshInterval: 300_000,
  });

  return (
    <>
      <main className="max-w-[1400px] mx-auto w-full px-4 py-6">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Overview</h2>
            <div className="ml-auto flex items-center gap-1">
              <DataFreshness exchangeCount={data?.summary?.totalWallets ?? 0} lastUpdated={data?.meta?.timestamp ?? null} sources={['bounce.tech']} />
              <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} />
            </div>
          </div>
          <p className="text-sm text-neutral-500">
            Leveraged-tokens protocol on HyperEVM backed by Hyperliquid perps. Up to 10x leverage with ERC-20 wrappers that can&apos;t be liquidated.
            They scored the entire HL liquidation history and let the biggest losers claim BOUNCE for their pain.
          </p>
        </div>

        {/* Address search — the centerpiece */}
        <div className="card-premium p-5 mb-4 bg-gradient-to-br from-red-500/[0.04] to-transparent border border-red-400/20">
          <div className="flex items-center gap-2 mb-3">
            <Search className="w-4 h-4 text-red-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Check any wallet&apos;s rekt profile</h2>
          </div>
          <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setErr(null); }}
              placeholder="0x… any EVM / Hyperliquid wallet"
              className="flex-1 bg-white/[0.04] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-white font-mono placeholder:text-neutral-600 focus:outline-none focus:border-red-400/60"
              aria-label="Wallet address"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="submit"
              className="px-5 py-2.5 bg-red-400 text-black font-bold rounded-lg text-sm hover:bg-red-300 transition-colors inline-flex items-center gap-1"
            >
              Show profile <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
          {err && <div className="mt-2 text-[11px] text-red-400">{err}</div>}
          {/* Was: hardcoded "#2 rekt · $72M" / "#4 · $32M" / "#8 · $15M"
              ranks + dollar amounts. Those ranks shift hourly on the real
              leaderboard, so the teaser lied within minutes of release.
              Strip the stale numbers, keep the wallets as examples. */}
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <span className="text-neutral-500">Try:</span>
            {[
              '0x69423c20cb04da697996534507f8541fdb3e9aa9',
              '0xaa1b01270a5bf5b981bf07a28c9def8d39625997',
              '0x2f79e7993359e37091f8298c9706c75243da65a5',
            ].map((addr) => (
              <Link
                key={addr}
                href={`/bounce/${addr}`}
                className="px-2 py-0.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded text-neutral-300 hover:text-white transition-colors font-mono"
              >
                {addr.slice(0, 6)}…{addr.slice(-4)}
              </Link>
            ))}
            <Link
              href="/bounce/leaderboard"
              className="px-2 py-0.5 text-hub-yellow hover:text-yellow-300 transition-colors"
            >
              See leaderboard →
            </Link>
          </div>
        </div>

        {/* Ecosystem stats */}
        {data?.summary && (
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4"
            aria-live="polite"
            aria-atomic="false"
          >
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Total tracked</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-red-400">
                <UsdDisplay amount={data.summary.totalRekt} />
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">top {data.data.length} wallets</div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Events</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-white">
                {data.summary.totalLiquidations.toLocaleString()}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">across leaderboard</div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Biggest loser</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-hub-yellow">
                {data.summary.biggestLoser ? short(data.summary.biggestLoser) : '—'}
              </div>
              {data.summary.biggestLoserNotional > 0 && (
                <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">
                  <UsdDisplay amount={data.summary.biggestLoserNotional} />
                </div>
              )}
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Max score</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-white">
                {data.summary.biggestScore}
                <span className="text-neutral-600 text-xs">/1000</span>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard preview */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Top 10 rekt</h2>
          <Link href="/bounce/leaderboard" className="text-xs text-hub-yellow hover:underline inline-flex items-center gap-1">
            Full leaderboard <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="card-premium p-3 min-h-[200px]">
          <div className="hidden md:grid md:grid-cols-[40px,200px,140px,100px,120px] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
            <div>#</div>
            <div>Wallet</div>
            <div className="text-right">Total Rekt</div>
            <div className="text-right">Events</div>
            <div className="text-right">Score</div>
          </div>

          {isLoading && (
            <div className="space-y-1.5 p-1">
              {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-12 bg-white/[0.03] rounded animate-pulse" />)}
            </div>
          )}

          {data?.data?.slice(0, 10).map((r, i) => {
            const rankColor = i === 0 ? 'text-red-400' : i === 1 ? 'text-orange-400' : i === 2 ? 'text-yellow-400' : 'text-neutral-500';
            return (
              <Link
                key={r.address}
                href={`/bounce/${r.address}`}
                className="md:grid md:grid-cols-[40px,200px,140px,100px,120px] gap-3 px-3 py-2 items-center rounded hover:bg-white/[0.02] transition-colors cursor-pointer"
              >
                <div className={`text-right font-mono text-sm tabular-nums font-semibold ${rankColor} inline-flex items-center justify-end gap-1`}>
                  {i < 3 && <Skull className="w-3 h-3" aria-hidden />}
                  {i + 1}
                </div>
                <div className="text-sm text-white font-mono font-semibold truncate">
                  {short(r.address)}
                </div>
                <div className="text-right font-mono text-sm tabular-nums text-red-400 font-semibold">
                  <UsdDisplay amount={r.totalNotional} />
                </div>
                <div className="text-right font-mono text-xs tabular-nums text-neutral-300">
                  {r.count.toLocaleString()}
                </div>
                <div className="text-right">
                  <div className="font-mono tabular-nums text-xs text-white">
                    {r.score}
                    <span className="text-neutral-600">/1000</span>
                  </div>
                  <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-red-400/60 rounded-full"
                      style={{ width: `${(r.score / 1000) * 100}%` }}
                      aria-hidden
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* About + CTA */}
        <div className="grid md:grid-cols-2 gap-3 mt-4">
          <div className="card-premium p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-hub-yellow" />
              <div className="text-xs font-bold text-white uppercase tracking-wider">What bounce.tech does</div>
            </div>
            <p className="text-[12px] text-neutral-400 leading-relaxed mb-2">
              Leveraged-token protocol on HyperEVM backed by Hyperliquid perps. You deposit stables, receive a leveraged ERC-20 (e.g. BTC3L for 3x long BTC). The protocol runs the perp under the hood.
              The wrapper token itself can&apos;t be liquidated because it auto-rebalances. Your downside is capped at your deposit, just like holding an ETF.
            </p>
            <div className="text-[11px] text-neutral-500 flex flex-wrap gap-x-3 gap-y-1">
              <span>• Up to 10x leverage</span>
              <span>• Zero user-level liquidation</span>
              <span>• Fully composable ERC-20</span>
              <span>• Private beta (invite-gated)</span>
            </div>
          </div>

          <div className="card-premium p-4">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="w-4 h-4 text-red-400" />
              <div className="text-xs font-bold text-white uppercase tracking-wider">Why the liquidation score matters</div>
            </div>
            <p className="text-[12px] text-neutral-400 leading-relaxed mb-3">
              bounce.tech ingested the full Hyperliquid liquidation history and ranked every wallet 0-1000 by notional, event count, and recency.
              The biggest losers can register, claim their score, and unlock BOUNCE rewards. You got rekt, now you&apos;re airdrop eligible.
            </p>
            <a
              href="https://bounce.tech/register"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-hub-yellow hover:underline"
            >
              Register on bounce.tech <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed flex items-start gap-2">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div>
            InfoHub mirrors bounce.tech&apos;s public liquidation data so you can look up any wallet without an invite. For the actual
            leveraged tokens + rebate claim you need to register with bounce.tech directly.
          </div>
        </div>
      </main>
    </>
  );
}
