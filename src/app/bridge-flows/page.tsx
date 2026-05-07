'use client';

/**
 * /bridge-flows — cross-chain bridge flow tracker.
 *
 * Surfaces three views of Wormhole bridge data:
 *   1. Scorecard (24h/7d/30d volume + messages)
 *   2. Source → Destination matrix (chain pairs by transfer count)
 *   3. Top assets being bridged + top corridors
 *
 * Refreshes on mount + whenever the timespan changes. Cached server-side
 * for 5 min so a click-burst across timespans is cheap.
 */
import { useEffect, useMemo, useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Globe2, RefreshCw, AlertTriangle, ArrowRight } from 'lucide-react';

interface ChainPairFlow {
  source: number;
  sourceName: string;
  destination: number;
  destinationName: string;
  transfers: number;
  volumeUsd?: number;
}
interface TopAsset {
  symbol: string;
  emitterChain: number;
  emitterChainName: string;
  tokenChain: number;
  tokenChainName: string;
  volumeUsd: number;
}
interface TopCorridor {
  source: number;
  sourceName: string;
  destination: number;
  destinationName: string;
  tokenChain: number;
  tokenChainName: string;
  symbol?: string;
  txs: number;
}
interface ApiResponse {
  ts: number;
  scorecard: {
    msgs24h: number;
    msgs7d: number;
    msgs30d: number;
    vol24hUsd: number;
    vol7dUsd: number;
    vol30dUsd: number;
    totalVolUsd: number;
    totalMessages: number;
  } | null;
  chainPairs: ChainPairFlow[];
  topAssets: TopAsset[];
  topCorridors: TopCorridor[];
}

const fmtUsd = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(abs / 1e3).toFixed(1)}K`;
  return `$${abs.toFixed(0)}`;
};
const fmtNum = (n: number): string => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

export default function BridgeFlowsPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [span, setSpan] = useState<'1d' | '7d' | '30d'>('7d');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bridge-flows?timeSpan=${span}`, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [span]);

  // Build a per-source aggregate that's easy to scan.
  const bySource = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { source: string; total: number; pairs: ChainPairFlow[] }>();
    for (const p of data.chainPairs) {
      const arr = map.get(p.sourceName) ?? { source: p.sourceName, total: 0, pairs: [] };
      arr.total += p.transfers;
      arr.pairs.push(p);
      map.set(p.sourceName, arr);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [data]);

  return (
    <>
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 py-6">
        <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Globe2 className="w-5 h-5 text-cyan-400" />
              <h1 className="text-2xl font-bold text-white">Bridge Flow Map</h1>
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-400/15 text-cyan-400 font-bold">
                wormhole
              </span>
            </div>
            <p className="text-sm text-neutral-500 mt-1 max-w-3xl">
              Cross-chain capital flow in real time. Source: Wormhole — the most-used cross-chain
              messaging protocol. Strong leading indicator: capital flows INTO a chain ahead of
              price moves and narrative rotation.
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-hub-yellow disabled:opacity-40"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> refresh
          </button>
        </div>

        {/* Time-span chip */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">window:</span>
          {(['1d', '7d', '30d'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSpan(s)}
              className={`text-[11px] px-2 py-1 rounded font-medium ${
                span === s ? 'bg-hub-yellow text-black' : 'bg-white/[0.04] text-neutral-400 hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {error && (
          <div className="card-premium p-4 border border-red-400/30 bg-red-500/5 text-sm text-red-300 mb-4 inline-flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!data && !error && (
          <div className="card-premium p-8 text-center text-neutral-500 text-sm">Loading bridge flows…</div>
        )}

        {data?.scorecard && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <Stat label="24h volume" value={fmtUsd(data.scorecard.vol24hUsd)} />
            <Stat label="7d volume" value={fmtUsd(data.scorecard.vol7dUsd)} valueColor="text-cyan-400" />
            <Stat label="30d volume" value={fmtUsd(data.scorecard.vol30dUsd)} />
            <Stat label="24h messages" value={fmtNum(data.scorecard.msgs24h)} />
          </div>
        )}

        {/* Chain pairs */}
        {bySource.length > 0 && (
          <div className="card-premium p-4 mb-4">
            <h3 className="text-sm font-semibold text-white mb-3">
              Top chain pairs ({span} transfers)
            </h3>
            <div className="space-y-3">
              {bySource.slice(0, 12).map(s => (
                <div key={s.source}>
                  <div className="text-[11px] text-neutral-400 mb-1">
                    <span className="font-semibold text-white">{s.source}</span>
                    <span className="text-neutral-600"> → outflows · {fmtNum(s.total)} transfers total</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {s.pairs.sort((a, b) => b.transfers - a.transfers).slice(0, 6).map(p => {
                      const pct = s.total > 0 ? (p.transfers / s.total) * 100 : 0;
                      return (
                        <div
                          key={`${p.source}-${p.destination}`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-cyan-400/20 bg-cyan-500/[0.06] text-[11px]"
                        >
                          <ArrowRight className="w-2.5 h-2.5 text-cyan-400/60" />
                          <span className="text-white">{p.destinationName}</span>
                          <span className="text-cyan-300/80 tabular-nums">{fmtNum(p.transfers)}</span>
                          <span className="text-neutral-500 tabular-nums">({pct.toFixed(0)}%)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
          {/* Top assets */}
          {data && data.topAssets.length > 0 && (
            <div className="card-premium p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Top assets ({span})</h3>
              <div className="space-y-1 text-[11px]">
                {data.topAssets.slice(0, 12).map((a, i) => (
                  <div key={`${a.symbol}-${a.tokenChain}-${i}`} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-500 tabular-nums">{i + 1}.</span>
                      <span className="text-white font-semibold">{a.symbol}</span>
                      <span className="text-neutral-500">on {a.tokenChainName}</span>
                    </div>
                    <span className="text-cyan-400 tabular-nums font-mono">{fmtUsd(a.volumeUsd)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top corridors */}
          {data && data.topCorridors.length > 0 && (
            <div className="card-premium p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Top corridors ({span})</h3>
              <div className="space-y-1 text-[11px]">
                {data.topCorridors.slice(0, 12).map((c, i) => (
                  <div key={`${c.source}-${c.destination}-${c.tokenChain}-${i}`} className="flex items-center justify-between">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-neutral-500 tabular-nums">{i + 1}.</span>
                      <span className="text-white">{c.symbol ?? '—'}</span>
                      <span className="text-neutral-600">·</span>
                      <span className="text-neutral-400">{c.sourceName}</span>
                      <ArrowRight className="w-2.5 h-2.5 text-neutral-600 flex-shrink-0" />
                      <span className="text-neutral-400">{c.destinationName}</span>
                    </div>
                    <span className="text-cyan-400/80 tabular-nums font-mono">{fmtNum(c.txs)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {data && (
          <div className="text-center mt-4 text-[10px] text-neutral-600">
            Last refresh: {new Date(data.ts).toLocaleTimeString()} · cached 5 min · source: Wormholescan
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}

function Stat({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="card-premium p-3">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">{label}</div>
      <div className={`text-lg font-bold tabular-nums mt-0.5 ${valueColor ?? 'text-white'}`}>{value}</div>
    </div>
  );
}
