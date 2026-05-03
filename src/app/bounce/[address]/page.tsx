'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useApi } from '@/hooks/useSWRApi';
import UsdDisplay from '@/components/UsdDisplay';
import RefreshButton from '@/components/RefreshButton';
import { Flame, Skull, ArrowLeft, ExternalLink, CheckCircle2, Sparkles, Info, Trophy } from 'lucide-react';

interface AssetRow {
  asset: string;
  totalLiquidationNotional: number;
  totalLiquidationCount: number;
  topPercent: number;
}
interface FirstLiq {
  timestamp: number;
  asset: string;
  notional: number;
  isLong: boolean;
  price: number;
}
interface MonthRow {
  month: string;
  totalLiquidationNotional: number;
  totalLiquidationCount: number;
}
interface ProfileResponse {
  address: string;
  totalNotional: number;
  count: number;
  topPercent: number;   // 0.006 means top 0.006% (smaller = more rekt)
  rank: number | null;
  score: number;
  hasClaimed: boolean;
  liquidatedOnOct10: boolean;
  rarestAsset: string | null;
  firstLiquidation: FirstLiq | null;
  assets: AssetRow[];
  monthly: MonthRow[];
  meta: { source: string; timestamp: number; bounceProfileUrl: string; bounceRegisterUrl: string };
}

function short(a: string): string {
  if (!a) return '—';
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function fmtDate(ts: number): string {
  try {
    return new Date(ts).toISOString().slice(0, 10);
  } catch { return '—'; }
}

/** 0.006 -> "Top 0.006%". Handles edge cases where upstream returns 0 or >100. */
function fmtTopPercent(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—';
  // bounce uses 0-1 or 0-100 depending on the field; the address-level one is 0-1 fraction.
  const pct = n <= 1 ? n * 100 : n;
  if (pct < 0.01) return `Top ${pct.toFixed(4)}%`;
  if (pct < 1) return `Top ${pct.toFixed(2)}%`;
  return `Top ${pct.toFixed(1)}%`;
}

/** Score tier label */
function tier(score: number): { label: string; color: string } {
  if (score >= 900) return { label: 'Apex Gambler',  color: 'text-red-400' };
  if (score >= 800) return { label: 'Serial Liquidatee', color: 'text-red-400' };
  if (score >= 600) return { label: 'Frequent Flyer', color: 'text-orange-400' };
  if (score >= 400) return { label: 'Taking Damage', color: 'text-yellow-400' };
  if (score >= 200) return { label: 'Slightly Singed', color: 'text-neutral-300' };
  if (score > 0)    return { label: 'Barely Rekt', color: 'text-green-400' };
  return { label: 'Clean Record', color: 'text-green-400' };
}

export default function BounceProfilePage() {
  const params = useParams<{ address: string }>();
  const address = (params?.address || '').toLowerCase();

  const { data, isLoading, isRefreshing, error, refresh } = useApi<ProfileResponse>({
    key: `bounce-profile:${address}`,
    fetcher: async () => {
      const res = await fetch(`/api/bounce/profile/${address}`, {
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(j?.error || `HTTP ${res.status}`);
      }
      return res.json();
    },
    refreshInterval: 0,
  });

  const tierInfo = useMemo(() => tier(data?.score ?? 0), [data?.score]);

  // Derived: max monthly notional for the sparkline bar scale
  const monthlyMax = useMemo(() => {
    if (!data?.monthly?.length) return 0;
    return Math.max(...data.monthly.map(m => m.totalLiquidationNotional));
  }, [data?.monthly]);

  return (
    <>
      <main className="max-w-[1400px] mx-auto w-full px-4 py-6">
        {/* Breadcrumb + back */}
        <div className="mb-3 flex items-center gap-2 text-xs">
          <Link href="/bounce" className="text-neutral-500 hover:text-hub-yellow transition-colors inline-flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> overview
          </Link>
          <span className="text-neutral-700">/</span>
          <span className="text-neutral-400 font-mono">{short(address)}</span>
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="w-7 h-7 rounded-md bg-red-500/10 flex items-center justify-center">
              <Flame className="w-4 h-4 text-red-400" />
            </div>
            <h1 className="text-xl font-bold text-white truncate">
              Rekt Profile <span className="text-neutral-500 font-mono text-base">· {short(address)}</span>
            </h1>
            <div className="ml-auto flex items-center gap-1">
              <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} />
            </div>
          </div>
          <p className="text-sm text-neutral-500">
            Hyperliquid liquidation history scored by{' '}
            <a href="https://bounce.tech" target="_blank" rel="noopener noreferrer" className="text-hub-yellow hover:underline">bounce.tech</a>.
          </p>
        </div>

        {isLoading && (
          <div className="space-y-2">
            <div className="h-32 bg-white/[0.03] rounded-xl animate-pulse" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-[66px] bg-white/[0.03] rounded-xl animate-pulse" />)}
            </div>
            <div className="h-[400px] bg-white/[0.03] rounded-xl animate-pulse" />
          </div>
        )}

        {error && (
          <div className="card-premium p-6 text-center">
            <div className="text-red-400 text-sm mb-3">Failed to load · {String(error)}</div>
            <div className="text-xs text-neutral-500 mb-4">
              bounce.tech may not have this address indexed, or the API is temporarily unavailable.
            </div>
            <Link href="/bounce" className="inline-flex items-center gap-1 text-xs text-hub-yellow hover:underline">
              <ArrowLeft className="w-3 h-3" /> Back to bounce.tech hub
            </Link>
          </div>
        )}

        {data && !error && (
          <>
            {/* Hero: score + tier */}
            <div className="card-premium p-6 mb-4 bg-gradient-to-br from-red-500/[0.05] via-transparent to-transparent" aria-live="polite">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                <div className="flex-shrink-0">
                  <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Liquidation Score</div>
                  <div className="font-mono tabular-nums text-5xl font-bold text-red-400 inline-flex items-baseline gap-1">
                    {data.score}
                    <span className="text-neutral-600 text-xl">/1000</span>
                  </div>
                  <div className={`text-xs font-bold uppercase tracking-wider mt-1 ${tierInfo.color}`}>
                    {tierInfo.label}
                  </div>
                </div>

                <div className="flex-1 w-full">
                  <div className="relative h-3 rounded-full bg-white/[0.04] overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-yellow-400 via-orange-400 to-red-500 rounded-full"
                      style={{ width: `${(data.score / 1000) * 100}%` }}
                      aria-hidden
                    />
                  </div>
                  <div className="flex justify-between text-[10px] mt-2 font-mono tabular-nums text-neutral-600">
                    <span>0</span>
                    <span>250</span>
                    <span>500</span>
                    <span>750</span>
                    <span>1000</span>
                  </div>
                </div>

                <div className="flex-shrink-0 flex flex-col items-end gap-2">
                  {data.hasClaimed ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-2 py-1 rounded bg-green-400/15 text-green-400">
                      <CheckCircle2 className="w-3 h-3" /> Claimed
                    </span>
                  ) : (
                    <a
                      href={data.meta.bounceRegisterUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-black bg-hub-yellow hover:bg-hub-yellow/90 px-3 py-1.5 rounded transition-colors"
                    >
                      <Sparkles className="w-3 h-3" /> Claim on bounce.tech
                    </a>
                  )}
                  <a
                    href={data.meta.bounceProfileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-neutral-500 hover:text-hub-yellow inline-flex items-center gap-1"
                  >
                    View on bounce.tech <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
              <div className="card-premium p-3">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Total rekt</div>
                <div className="font-mono tabular-nums text-sm font-semibold text-red-400">
                  <UsdDisplay amount={data.totalNotional} />
                </div>
              </div>
              <div className="card-premium p-3">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Events</div>
                <div className="font-mono tabular-nums text-sm font-semibold text-white">
                  {data.count.toLocaleString()}
                </div>
              </div>
              <div className="card-premium p-3">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Ranking</div>
                <div className="font-mono tabular-nums text-sm font-semibold text-hub-yellow">
                  {data.rank ? `#${data.rank.toLocaleString()}` : '—'}
                </div>
                <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">
                  {fmtTopPercent(data.topPercent)}
                </div>
              </div>
              <div className="card-premium p-3">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Rarest asset</div>
                <div className="font-mono tabular-nums text-sm font-semibold text-white truncate">
                  {data.rarestAsset || '—'}
                </div>
                <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">
                  weirdest thing you got rekt on
                </div>
              </div>
            </div>

            {/* Badges row */}
            <div className="flex flex-wrap gap-2 mb-4">
              {data.liquidatedOnOct10 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-red-400/15 text-red-400">
                  <Skull className="w-3 h-3" /> Oct 10 &apos;25 survivor
                </span>
              )}
              {data.rank && data.rank <= 100 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-hub-yellow/15 text-hub-yellow">
                  <Trophy className="w-3 h-3" /> Top 100
                </span>
              )}
              {data.count >= 100 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-orange-400/15 text-orange-400">
                  <Flame className="w-3 h-3" /> 100+ events
                </span>
              )}
            </div>

            {/* Assets breakdown + Monthly time series */}
            <div className="grid md:grid-cols-2 gap-3 mb-4">
              {/* Assets */}
              <div className="card-premium p-4">
                <div className="text-xs font-bold text-white uppercase tracking-wider mb-3">Assets rekt on</div>
                {data.assets.length === 0 ? (
                  <div className="text-xs text-neutral-500 py-4 text-center">No asset breakdown available.</div>
                ) : (
                  <div className="space-y-2">
                    {data.assets.slice(0, 10).map(a => {
                      const pctOfTotal = data.totalNotional > 0 ? (a.totalLiquidationNotional / data.totalNotional) * 100 : 0;
                      return (
                        <div key={a.asset} className="grid grid-cols-[1fr,120px,60px] gap-2 items-center">
                          <div className="min-w-0">
                            <div className="text-sm text-white font-semibold truncate">{a.asset}</div>
                            <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden mt-1">
                              <div
                                className="h-full bg-red-400/60 rounded-full"
                                style={{ width: `${pctOfTotal}%` }}
                                aria-hidden
                              />
                            </div>
                          </div>
                          <div className="text-right font-mono text-xs tabular-nums text-red-400">
                            <UsdDisplay amount={a.totalLiquidationNotional} />
                          </div>
                          <div className="text-right font-mono text-[10px] tabular-nums text-neutral-500">
                            {a.totalLiquidationCount}×
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Monthly */}
              <div className="card-premium p-4">
                <div className="text-xs font-bold text-white uppercase tracking-wider mb-3">Liquidations per month</div>
                {data.monthly.length === 0 ? (
                  <div className="text-xs text-neutral-500 py-4 text-center">No monthly history available.</div>
                ) : (
                  <div className="space-y-1">
                    {data.monthly.slice(-12).map(m => {
                      const pct = monthlyMax > 0 ? (m.totalLiquidationNotional / monthlyMax) * 100 : 0;
                      return (
                        <div key={m.month} className="grid grid-cols-[70px,1fr,80px] gap-2 items-center">
                          <div className="text-[10px] text-neutral-500 font-mono">{m.month}</div>
                          <div className="h-3 bg-white/[0.04] rounded overflow-hidden">
                            <div
                              className="h-full bg-red-400/40 rounded"
                              style={{ width: `${pct}%` }}
                              aria-hidden
                            />
                          </div>
                          <div className="text-right font-mono text-[10px] tabular-nums text-neutral-400">
                            <UsdDisplay amount={m.totalLiquidationNotional} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* First liquidation card */}
            {data.firstLiquidation && (
              <div className="card-premium p-4 mb-4">
                <div className="text-xs font-bold text-white uppercase tracking-wider mb-3">First liquidation</div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-0.5">Date</div>
                    <div className="font-mono tabular-nums text-white">{fmtDate(data.firstLiquidation.timestamp)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-0.5">Asset</div>
                    <div className="font-mono text-white">{data.firstLiquidation.asset}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-0.5">Side</div>
                    <div className={`font-mono font-semibold ${data.firstLiquidation.isLong ? 'text-green-400' : 'text-red-400'}`}>
                      {data.firstLiquidation.isLong ? 'LONG' : 'SHORT'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-0.5">Notional</div>
                    <div className="font-mono tabular-nums text-white"><UsdDisplay amount={data.firstLiquidation.notional} /></div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-0.5">Price</div>
                    <div className="font-mono tabular-nums text-white"><UsdDisplay amount={data.firstLiquidation.price} /></div>
                  </div>
                </div>
              </div>
            )}

            {/* Share + Cross-platform links */}
            <div className="card-premium p-4 mb-4">
              <div className="text-xs font-bold text-white uppercase tracking-wider mb-3">Share &amp; explore</div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`check out this rekt profile on @info_hub69 🔥\n\nscore ${data.score}/1000 · ${data.rank ? '#' + data.rank : 'ranked'} · ${((data.totalNotional || 0) / 1e6).toFixed(1)}M rekt`)}&url=${encodeURIComponent(`https://info-hub.io/bounce/${address}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-black text-white border border-white/[0.1] hover:bg-white/[0.08] transition-colors font-semibold"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  Tweet this
                </a>
                <Link
                  href={`/bounce/share/${address}`}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-red-400/10 hover:bg-red-400/20 border border-red-400/30 text-red-400 transition-colors font-semibold"
                >
                  <Flame className="w-3 h-3" /> Shareable card
                </Link>
                <Link
                  href={`/trader/${address}`}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-white/[0.04] hover:bg-white/[0.08] text-white transition-colors"
                >
                  <Trophy className="w-3 h-3 text-hub-yellow" /> Cross-platform profile
                </Link>
                <a
                  href={`https://app.hyperliquid.xyz/explorer/address/${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-white/[0.04] hover:bg-white/[0.08] text-white transition-colors"
                >
                  <ExternalLink className="w-3 h-3 text-purple-400" /> HL explorer
                </a>
                <a
                  href={`https://app.hyperliquid.xyz/trade/${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-white/[0.04] hover:bg-white/[0.08] text-white transition-colors"
                >
                  <ExternalLink className="w-3 h-3 text-purple-400" /> Live positions
                </a>
              </div>
            </div>
          </>
        )}

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed flex items-start gap-2">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div>
            Historical liquidation data from bounce.tech. The score combines total notional, event count, and recency (0-1000 scale).
            Tiers are InfoHub&apos;s interpretation. Claim rewards are issued by bounce.tech directly — use the button above to register.
          </div>
        </div>
      </main>
    </>
  );
}
