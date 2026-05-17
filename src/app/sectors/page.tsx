'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PageHero from '@/components/PageHero';
import { Layers, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';

interface Sector {
  id: string;
  name: string;
  marketCap: number;
  change24h: number | null;
  volume24h: number;
  topCoins: string[];
}

interface ApiResponse {
  sectors: Sector[];
  totalMarketCap: number;
  ts: number;
}

function fmtMcap(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${(n / 1e3).toFixed(0)}K`;
}

function fmtPct(n: number | null): string {
  if (n == null) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

/** Heat color for 24h % change. Used as background, not text. */
function heatBg(p: number | null): string {
  if (p == null) return 'rgba(255,255,255,0.02)';
  const clamp = Math.max(-15, Math.min(15, p));
  if (clamp >= 0) {
    const a = Math.min(0.4, clamp / 15 * 0.4);
    return `rgba(34,197,94,${a.toFixed(3)})`;
  } else {
    const a = Math.min(0.4, Math.abs(clamp) / 15 * 0.4);
    return `rgba(244,63,94,${a.toFixed(3)})`;
  }
}

type Sort = 'mcap' | 'change' | 'volume' | 'name';

export default function SectorsPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<Sort>('change');

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch('/api/sectors', { signal: AbortSignal.timeout(15_000) });
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
    const id = setInterval(() => load(true), 5 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  const sorted = useMemo(() => {
    if (!data) return [];
    const arr = [...data.sectors];
    if (sort === 'mcap') arr.sort((a, b) => b.marketCap - a.marketCap);
    else if (sort === 'change') arr.sort((a, b) => (b.change24h ?? -999) - (a.change24h ?? -999));
    else if (sort === 'volume') arr.sort((a, b) => b.volume24h - a.volume24h);
    else arr.sort((a, b) => a.name.localeCompare(b.name));
    return arr;
  }, [data, sort]);

  const winners = useMemo(() => {
    if (!data) return { up: 0, down: 0 };
    let up = 0, down = 0;
    for (const s of data.sectors) {
      if (s.change24h == null) continue;
      if (s.change24h > 0) up++; else if (s.change24h < 0) down++;
    }
    return { up, down };
  }, [data]);

  const best = sorted[0];
  const worst = sorted.length > 0 ? [...sorted].sort((a, b) => (a.change24h ?? 999) - (b.change24h ?? 999))[0] : null;

  return (
    <>
      <Header />
      <main className="max-w-[1400px] mx-auto w-full px-4 py-6">
        <PageHero
          icon={Layers}
          eyebrow={`${data?.sectors.length ?? 0} sectors · 24h`}
          title="Sector"
          accentNoun="rotation"
          accent="cyan"
          description="Which crypto sectors money is flowing into right now. Heatmap by 24-hour market-cap change — green = inflow, red = outflow. Watch for fast rotations between AI, DeFi, L2s, RWA, memes — they signal where the next leg is forming."
          actions={
            <button
              onClick={() => load(false)}
              disabled={refreshing}
              className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-hub-yellow disabled:opacity-40"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              refresh
            </button>
          }
        />

        {/* Top stat strip */}
        {data && data.sectors.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-1">Total mcap</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-white">{fmtMcap(data.totalMarketCap)}</div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-1 inline-flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-emerald-400" /> Up / Down
              </div>
              <div className="font-mono tabular-nums text-sm font-semibold">
                <span className="text-emerald-400">{winners.up}</span>
                <span className="text-neutral-600 mx-1">/</span>
                <span className="text-rose-400">{winners.down}</span>
              </div>
            </div>
            {best && best.change24h != null && (
              <div className="card-premium p-3">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-1">Best 24h</div>
                <div className="font-mono tabular-nums text-sm font-semibold text-white truncate">{best.name}</div>
                <div className="text-[10px] text-emerald-400 mt-0.5 font-mono">{fmtPct(best.change24h)}</div>
              </div>
            )}
            {worst && worst.change24h != null && (
              <div className="card-premium p-3">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-1">Worst 24h</div>
                <div className="font-mono tabular-nums text-sm font-semibold text-white truncate">{worst.name}</div>
                <div className="text-[10px] text-rose-400 mt-0.5 font-mono">{fmtPct(worst.change24h)}</div>
              </div>
            )}
          </div>
        )}

        {/* Sort toggle */}
        <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5 mb-3 w-fit">
          {([
            ['change', '24h ↓'],
            ['mcap', 'Market cap ↓'],
            ['volume', 'Volume ↓'],
            ['name', 'A-Z'],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setSort(k)}
              className={`px-3 py-1 rounded text-[11px] font-semibold uppercase whitespace-nowrap transition-colors ${
                sort === k ? 'bg-cyan-400 text-black' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="card-premium p-4 text-center mb-4">
            <p className="text-red-400 text-sm">Failed to load · {error}</p>
            <button onClick={() => load(false)} className="mt-2 text-xs text-hub-yellow hover:underline">retry</button>
          </div>
        )}

        {!data && !error && (
          <div className="card-premium p-12 text-center text-neutral-500 text-sm">Loading sectors…</div>
        )}

        {/* Heatmap grid */}
        {sorted.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {sorted.map(s => {
              const up = s.change24h != null && s.change24h >= 0;
              return (
                <div
                  key={s.id}
                  className="rounded-xl border border-white/[0.06] p-3 transition-all hover:border-white/[0.15] hover:-translate-y-px"
                  style={{ background: heatBg(s.change24h) }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="text-sm font-bold text-white truncate flex-1">{s.name}</div>
                    {s.change24h != null && (
                      <div className={`text-xs font-mono font-bold flex items-center gap-0.5 flex-shrink-0 ${up ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {fmtPct(s.change24h)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mb-2">
                    {s.topCoins.slice(0, 3).map(c => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={c} src={c} alt="" className="w-4 h-4 rounded-full" loading="lazy" />
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-neutral-500 font-mono">
                    <span>mcap {fmtMcap(s.marketCap)}</span>
                    <span>vol {fmtMcap(s.volume24h)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed">
          Curated set of {sorted.length || 0} sectors with &gt;$50M market cap.
          Source: <a href="https://www.coingecko.com" target="_blank" rel="noopener" className="text-hub-yellow hover:underline">CoinGecko</a> categories.
          24h % is the aggregate market-cap change. Refreshes every 5 minutes.
        </div>
      </main>
      <Footer />
    </>
  );
}
