'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PageHero from '@/components/PageHero';
import { Coins, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';

interface StableRow {
  id: number;
  name: string;
  symbol: string;
  supply: number;
  change1d: number | null;
  change7d: number | null;
  change30d: number | null;
  pegMechanism: string;
  chains: string[];
  logoUrl: string | null;
}

interface ApiResponse {
  rows: StableRow[];
  totalSupply: number;
  totalChange30d: number | null;
  ts: number;
}

function fmtUsd(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtPct(n: number | null, digits = 2): string {
  if (n == null) return '—';
  const v = n * 100;
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(digits)}%`;
}

function pctTone(n: number | null): string {
  if (n == null) return 'text-neutral-500';
  if (n > 0.02) return 'text-emerald-400 font-semibold';
  if (n > 0) return 'text-emerald-300';
  if (n > -0.02) return 'text-rose-300';
  return 'text-rose-400 font-semibold';
}

const MECHANISM_TONE: Record<string, string> = {
  'fiat-backed': 'bg-emerald-500/10 text-emerald-400 border-emerald-400/20',
  'crypto-backed': 'bg-violet-500/10 text-violet-400 border-violet-400/20',
  'algorithmic': 'bg-amber-500/10 text-amber-400 border-amber-400/20',
  'unknown': 'bg-neutral-500/10 text-neutral-400 border-neutral-400/20',
};

export default function StablecoinSupplyPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch('/api/stablecoin-supply', { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ApiResponse;
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
    const id = setInterval(() => load(true), 30 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <>
      <Header />
      <main className="max-w-[1200px] mx-auto w-full px-4 py-6">
        <PageHero
          icon={Coins}
          eyebrow={`Liquidity · ${data?.rows.length ?? 0} USD pegs · 30d`}
          title="Stablecoin"
          accentNoun="supply"
          accent="emerald"
          description={
            <>Circulating supply per stablecoin with <span className="text-white">1d / 7d / 30d</span> change.
              Total stablecoin supply is the cleanest liquidity-onramp signal —
              growth = new dollars entering crypto, contraction = liquidity
              leaving the system.</>
          }
          actions={
            <button
              onClick={() => load(false)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-neutral-300 hover:text-white hover:bg-white/[0.08] text-xs font-semibold transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          }
        />

        {data && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Total stablecoin mcap</div>
              <div className="font-mono tabular-nums text-base font-bold text-white">{fmtUsd(data.totalSupply)}</div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">30d change</div>
              <div className={`font-mono tabular-nums text-base font-bold ${(data.totalChange30d ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {fmtPct(data.totalChange30d, 2)}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">
                {data.totalChange30d != null
                  ? `${(data.totalChange30d ?? 0) >= 0 ? 'minted' : 'burned'} ~${fmtUsd(Math.abs((data.totalChange30d ?? 0) * data.totalSupply))}`
                  : '—'}
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium inline-flex items-center gap-1">
                {(data.totalChange30d ?? 0) >= 0 ? <TrendingUp className="w-3 h-3 text-emerald-400" /> : <TrendingDown className="w-3 h-3 text-rose-400" />}
                Liquidity regime
              </div>
              <div className={`font-mono tabular-nums text-base font-bold ${(data.totalChange30d ?? 0) > 0.01 ? 'text-emerald-400' : (data.totalChange30d ?? 0) < -0.01 ? 'text-rose-400' : 'text-neutral-400'}`}>
                {(data.totalChange30d ?? 0) > 0.02 ? 'Strong inflows'
                  : (data.totalChange30d ?? 0) > 0.005 ? 'Inflows'
                  : (data.totalChange30d ?? 0) > -0.005 ? 'Neutral'
                  : (data.totalChange30d ?? 0) > -0.02 ? 'Outflows'
                  : 'Strong outflows'}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="card-premium p-4 text-center mb-4">
            <p className="text-red-400 text-sm">Failed to load · {error}</p>
            <button onClick={() => load(false)} className="mt-2 text-xs text-hub-yellow hover:underline">retry</button>
          </div>
        )}

        {!data && !error && (
          <div className="card-premium p-12 text-center text-neutral-500 text-sm">Loading stablecoin supplies…</div>
        )}

        {data && data.rows.length > 0 && (
          <div className="card-premium p-3 overflow-x-auto">
            <div className="grid grid-cols-[40px,1fr,140px,90px,90px,90px,140px] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
              <div>#</div>
              <div>Stablecoin</div>
              <div className="text-right">Supply</div>
              <div className="text-right">1d</div>
              <div className="text-right">7d</div>
              <div className="text-right">30d</div>
              <div>Mechanism</div>
            </div>
            {data.rows.map((r, i) => {
              const mech = (r.pegMechanism || 'unknown').toLowerCase();
              const tone = MECHANISM_TONE[mech] ?? MECHANISM_TONE.unknown;
              return (
                <div
                  key={r.id}
                  className="grid grid-cols-[40px,1fr,140px,90px,90px,90px,140px] gap-3 px-3 py-2 items-center rounded hover:bg-white/[0.02]"
                >
                  <div className="text-right text-neutral-500 font-mono text-xs tabular-nums">{i + 1}</div>
                  <div className="min-w-0">
                    <div className="text-sm text-white font-bold truncate">
                      {r.symbol}
                      <span className="text-neutral-500 font-normal ml-2 text-[11px]">{r.name}</span>
                    </div>
                    <div className="text-[10px] text-neutral-600 truncate font-mono mt-0.5">
                      {r.chains.slice(0, 4).join(' · ')}
                      {r.chains.length > 4 && ' · …'}
                    </div>
                  </div>
                  <div className="text-right font-mono text-sm tabular-nums text-white font-semibold">{fmtUsd(r.supply)}</div>
                  <div className={`text-right font-mono text-xs tabular-nums ${pctTone(r.change1d)}`}>{fmtPct(r.change1d, 2)}</div>
                  <div className={`text-right font-mono text-xs tabular-nums ${pctTone(r.change7d)}`}>{fmtPct(r.change7d, 2)}</div>
                  <div className={`text-right font-mono text-xs tabular-nums ${pctTone(r.change30d)}`}>{fmtPct(r.change30d, 2)}</div>
                  <div>
                    <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-px rounded border ${tone}`}>
                      {mech}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed">
          <strong className="text-neutral-300">How to read:</strong> a 7d change of +2%
          on the total = ~$5B of fresh dollars freshly minted, usually parking
          on exchanges before getting deployed into spot or perps. Sustained
          contraction (USDT redemptions, USDC outflows) historically precedes
          chop or down-moves. Source: <a href="https://defillama.com/stablecoins" target="_blank" rel="noopener" className="text-hub-yellow hover:underline">DefiLlama</a>.
        </div>
      </main>
      <Footer />
    </>
  );
}
