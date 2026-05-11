'use client';

import { useState } from 'react';
import { useApi } from '@/hooks/useSWRApi';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import DataFreshness from '@/components/DataFreshness';
import RefreshButton from '@/components/RefreshButton';
import UsdDisplay from '@/components/UsdDisplay';
import { Rocket, Info, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

interface BreakoutRow {
  rank: number;
  id: string;
  symbol: string;
  name: string;
  image: string | null;
  price: number;
  marketCap: number;
  volume24h: number;
  change24h: number;
  change7d: number;
  change30d: number;
  change1y: number;
  ath: number;
  athPct: number;
  athDate: string | null;
  atlPct: number;
  high24h: number;
  low24h: number;
  signals: string[];
  score: number;
}

interface BreakoutsResponse {
  data: BreakoutRow[];
  summary: {
    kind: string;
    universeSize: number;
    matchingSignals: number;
  };
  meta: { timestamp: number };
}

type Kind = 'ath' | 'breakout' | 'breakdown' | 'strong-trend' | 'recovery';

const KIND_META: Record<Kind, { label: string; emoji: string; color: string; desc: string }> = {
  ath:            { label: 'Near ATH',       emoji: '👑', color: 'text-hub-yellow', desc: 'Coins within 15% of their all-time high' },
  breakout:       { label: 'Breaking 24h',   emoji: '🚀', color: 'text-green-400', desc: 'Price at or near the 24h high with strong +24h move' },
  'strong-trend': { label: 'Strong uptrend', emoji: '📈', color: 'text-green-400', desc: 'Positive across 24h, 7d, and 30d. +30d > 10%' },
  breakdown:      { label: 'Breakdown',      emoji: '🩸', color: 'text-red-400',   desc: 'Big -24h move and close to all-time lows' },
  recovery:       { label: 'Recovery play',  emoji: '🌱', color: 'text-blue-400',  desc: 'Down big over 1y but positive in last 30d' },
};

function fmtPct(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '—';
  if (Math.abs(n) >= 10_000) return `${n >= 0 ? '+' : ''}${(n / 1000).toFixed(1)}Kx`;
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toISOString().slice(0, 10); } catch { return '—'; }
}

export default function BreakoutsPage() {
  const [kind, setKind] = useState<Kind>('ath');

  const { data, isLoading, isRefreshing, error, refresh } = useApi<BreakoutsResponse>({
    key: `breakouts:${kind}`,
    fetcher: async () => {
      const res = await fetch(`/api/breakouts?kind=${kind}&limit=50`, {
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refreshInterval: 300_000,
  });

  const rows = data?.data ?? [];
  const meta = KIND_META[kind];

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto w-full px-4 py-6">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="w-7 h-7 rounded-md bg-hub-yellow/10 flex items-center justify-center">
              <Rocket className="w-4 h-4 text-hub-yellow" />
            </div>
            <h1 className="text-xl font-bold text-white">Breakout Scanner</h1>
            <div className="ml-auto flex items-center gap-1">
              <DataFreshness exchangeCount={data?.summary?.universeSize ?? 0} lastUpdated={data?.meta?.timestamp ?? null} sources={['CoinGecko']} />
              <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} />
            </div>
          </div>
          <p className="text-sm text-neutral-500">
            Coins near ATH, breaking out of 24h highs, in strong multi-window uptrends, or bleeding toward all-time lows. {data?.summary && `${data.summary.matchingSignals} matches in the current ${kind} view.`}
          </p>
        </div>

        <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5 w-fit mb-3 flex-wrap">
          {(['ath', 'breakout', 'strong-trend', 'breakdown', 'recovery'] as const).map(k => {
            const m = KIND_META[k];
            return (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`px-3 py-1.5 rounded text-[11px] font-semibold uppercase tracking-wider transition-colors inline-flex items-center gap-1 ${
                  kind === k ? 'bg-hub-yellow text-black' : 'text-neutral-400 hover:text-white'
                }`}
              >
                <span aria-hidden>{m.emoji}</span> {m.label}
              </button>
            );
          })}
        </div>

        <div className="card-premium p-3 mb-4 text-[11px] text-neutral-500 bg-gradient-to-r from-hub-yellow/[0.03] to-transparent border-l-2 border-hub-yellow/30">
          <span className={meta.color + ' font-bold'}>{meta.label}:</span> <span>{meta.desc}</span>
        </div>

        <div className="card-premium p-3 min-h-[500px]">
          <div className="hidden md:grid md:grid-cols-[40px,1fr,100px,110px,110px,110px,120px,110px] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
            <div>#</div>
            <div>Asset</div>
            <div className="text-right">Price</div>
            <div className="text-right">24h</div>
            <div className="text-right">7d / 30d</div>
            <div className="text-right">vs ATH</div>
            <div className="text-right">ATH date</div>
            <div>Signals</div>
          </div>

          {isLoading && (
            <div className="space-y-1.5 p-1">
              {Array.from({ length: 10 }, (_, i) => <div key={i} className="h-12 bg-white/[0.03] rounded animate-pulse" />)}
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-red-400 text-sm">Failed to load · {String(error)}</div>
          )}

          {!isLoading && !error && rows.length === 0 && (
            <div className="text-center py-12 text-neutral-500 text-sm">No coins match this signal right now.</div>
          )}

          {rows.map((r, i) => {
            const athColor = r.athPct > -5 ? 'text-hub-yellow font-semibold' : r.athPct > -20 ? 'text-green-400' : r.athPct > -50 ? 'text-neutral-300' : 'text-red-400';
            return (
              <div
                key={r.id}
                className="md:grid md:grid-cols-[40px,1fr,100px,110px,110px,110px,120px,110px] gap-3 px-3 py-2 items-center rounded hover:bg-white/[0.02] transition-colors"
              >
                <div className="text-right text-neutral-500 font-mono text-xs tabular-nums">{i + 1}</div>
                <div className="flex items-center gap-2 min-w-0">
                  {r.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.image} alt="" className="w-4 h-4 rounded-full flex-shrink-0" loading="lazy" />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm text-white font-semibold truncate">{r.symbol}</div>
                    <div className="text-[10px] text-neutral-600 truncate">{r.name}</div>
                  </div>
                </div>
                <div className="text-right font-mono text-xs tabular-nums text-neutral-300">
                  <UsdDisplay amount={r.price} />
                </div>
                <div className={`text-right font-mono text-xs tabular-nums font-semibold inline-flex items-center justify-end gap-1 ${r.change24h > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {r.change24h > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {fmtPct(r.change24h)}
                </div>
                <div className="text-right">
                  <div className={`font-mono text-[11px] tabular-nums ${r.change7d >= 0 ? 'text-green-400/80' : 'text-red-400/80'}`}>
                    {fmtPct(r.change7d)}
                  </div>
                  <div className={`font-mono text-[10px] tabular-nums ${r.change30d >= 0 ? 'text-green-400/60' : 'text-red-400/60'}`}>
                    {fmtPct(r.change30d)}
                  </div>
                </div>
                <div className={`text-right font-mono text-xs tabular-nums ${athColor}`}>
                  {fmtPct(r.athPct)}
                </div>
                <div className="text-right font-mono text-[10px] tabular-nums text-neutral-500">
                  {fmtDate(r.athDate)}
                </div>
                <div className="flex flex-wrap gap-1">
                  {r.signals.slice(0, 2).map(s => (
                    <span key={s} className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-hub-yellow/15 text-hub-yellow">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed flex items-start gap-2">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div>
            Five-way screener across ~220 liquid coins (stablecoins and BTC/ETH proxies excluded).
            <strong className="text-neutral-300"> At / near ATH</strong> = within 2%/5%/15% of all-time high.
            <strong className="text-neutral-300"> 24h high breakout</strong> = current price within 0.5% of the 24h high plus positive 24h move.
            <strong className="text-neutral-300"> Strong uptrend</strong> = positive 24h, 7d, and 30d with 30d {'>'} 10%.
            <strong className="text-neutral-300"> Breakdown</strong> = big negative 24h and near all-time lows.
            <strong className="text-neutral-300"> Recovery</strong> = 1-year drawdown below -50% but 30d positive. Source: CoinGecko.
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
