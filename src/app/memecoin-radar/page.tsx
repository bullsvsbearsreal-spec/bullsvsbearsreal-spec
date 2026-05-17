'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PageHero from '@/components/PageHero';
import { Flame, RefreshCw, ExternalLink, TrendingUp, TrendingDown, Clock } from 'lucide-react';

interface MemeToken {
  address: string;
  name: string;
  symbol: string;
  pairUrl: string;
  priceUsd: number;
  marketCap: number;
  liquidityUsd: number;
  volume1h: number;
  volume24h: number;
  change5m: number;
  change1h: number;
  change24h: number;
  ageHours: number;
  velocity: number;
}

interface ApiResponse {
  tokens: MemeToken[];
  ts: number;
}

function fmtUsd(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '$0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  if (abs >= 1) return `${sign}$${abs.toFixed(2)}`;
  if (abs >= 0.0001) return `${sign}$${abs.toFixed(6)}`;
  return `${sign}$${abs.toFixed(8)}`;
}

function fmtPct(n: number, digits = 1): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(digits)}%`;
}

function fmtAge(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(0)}h`;
  return `${Math.round(hours / 24)}d`;
}

function changeTone(n: number): string {
  if (n > 50) return 'text-emerald-400 font-bold';
  if (n > 10) return 'text-emerald-300';
  if (n > 0) return 'text-emerald-200';
  if (n < -50) return 'text-rose-400 font-bold';
  if (n < -10) return 'text-rose-300';
  if (n < 0) return 'text-rose-200';
  return 'text-neutral-400';
}

export default function MemecoinRadarPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch('/api/memecoin-radar', { signal: AbortSignal.timeout(15_000) });
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
    const id = setInterval(() => load(true), 60_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <>
      <Header />
      <main className="max-w-[1200px] mx-auto w-full px-4 py-6">
        <PageHero
          icon={Flame}
          eyebrow={`Solana · ${data?.tokens.length ?? 0} hot · live`}
          title="Memecoin"
          accentNoun="radar"
          accent="orange"
          description={
            <>Hot Solana memecoins ranked by 1-hour velocity (volume × |1h price move|).
              Filtered to pairs with at least <span className="text-white">$25k liquidity</span> and
              <span className="text-white"> $5k of 1h volume</span>. Click any row to open the pair
              on DexScreener. PvP gambling at your own risk.</>
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

        {error && (
          <div className="card-premium p-4 text-center mb-4">
            <p className="text-red-400 text-sm">Failed to load · {error}</p>
            <button onClick={() => load(false)} className="mt-2 text-xs text-hub-yellow hover:underline">retry</button>
          </div>
        )}

        {!data && !error && (
          <div className="card-premium p-12 text-center text-neutral-500 text-sm">Scanning Solana DEX pairs…</div>
        )}

        {data && data.tokens.length === 0 && !error && (
          <div className="card-premium p-12 text-center text-neutral-500 text-sm">
            Nothing meeting filters right now. Refresh in a few minutes.
          </div>
        )}

        {data && data.tokens.length > 0 && (
          <div className="card-premium p-3 overflow-x-auto">
            <div className="grid grid-cols-[40px,1fr,90px,90px,90px,90px,90px,90px,90px,40px] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
              <div>#</div>
              <div>Token</div>
              <div className="text-right">Price</div>
              <div className="text-right">5m</div>
              <div className="text-right">1h</div>
              <div className="text-right">24h</div>
              <div className="text-right">Vol 1h</div>
              <div className="text-right">Mcap</div>
              <div className="text-right">Liq</div>
              <div></div>
            </div>
            {data.tokens.map((t, i) => (
              <a
                key={t.address}
                href={t.pairUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="grid grid-cols-[40px,1fr,90px,90px,90px,90px,90px,90px,90px,40px] gap-3 px-3 py-2 items-center rounded hover:bg-white/[0.025] transition-colors group"
              >
                <div className="text-right text-neutral-500 font-mono text-xs tabular-nums">{i + 1}</div>
                <div className="min-w-0">
                  <div className="text-sm text-white font-bold truncate group-hover:text-hub-yellow transition-colors">
                    {t.symbol}
                  </div>
                  <div className="text-[10px] text-neutral-600 truncate flex items-center gap-1.5">
                    {t.name}
                    {t.ageHours < 9999 && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] px-1 py-px rounded bg-white/[0.03] border border-white/[0.06] text-neutral-500">
                        <Clock className="w-2.5 h-2.5" /> {fmtAge(t.ageHours)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right font-mono text-xs tabular-nums text-neutral-300">{fmtUsd(t.priceUsd)}</div>
                <div className={`text-right font-mono text-xs tabular-nums ${changeTone(t.change5m)}`}>{fmtPct(t.change5m)}</div>
                <div className={`text-right font-mono text-xs tabular-nums font-semibold inline-flex items-center justify-end gap-1 ${changeTone(t.change1h)}`}>
                  {t.change1h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {fmtPct(t.change1h)}
                </div>
                <div className={`text-right font-mono text-xs tabular-nums ${changeTone(t.change24h)}`}>{fmtPct(t.change24h)}</div>
                <div className="text-right font-mono text-[11px] tabular-nums text-neutral-300">{fmtUsd(t.volume1h)}</div>
                <div className="text-right font-mono text-[11px] tabular-nums text-neutral-400">{fmtUsd(t.marketCap)}</div>
                <div className="text-right font-mono text-[11px] tabular-nums text-neutral-500">{fmtUsd(t.liquidityUsd)}</div>
                <ExternalLink className="w-3 h-3 text-neutral-700 group-hover:text-neutral-400" />
              </a>
            ))}
          </div>
        )}

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed">
          <strong className="text-neutral-300">How to read:</strong> Velocity ranks tokens
          combining 1h volume and 1h price move so genuine momentum (high vol +
          big % move) ranks above tokens with one but not the other. Liquidity
          floor of $25k filters the worst rugs. Mcap = circulating × price (or FDV
          if circ unknown). Source: <a href="https://dexscreener.com" target="_blank" rel="noopener noreferrer" className="text-hub-yellow hover:underline">DexScreener</a>.
          Cached 60s. <em>Memecoins are extremely high-risk. Do your own research.</em>
        </div>
      </main>
      <Footer />
    </>
  );
}
