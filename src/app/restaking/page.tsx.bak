'use client';

/**
 * /restaking — Restaking Yield Aggregator
 *
 * Cross-protocol restaking pools (EigenLayer, Symbiotic, Karak, Babylon,
 * Renzo, EtherFi, Kelp, Puffer, ...) sorted by TVL or APY. Filter by
 * protocol or chain, set minimum TVL.
 */
import { useEffect, useState, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Layers, RefreshCw, Filter, ArrowUpDown } from 'lucide-react';

interface RestakingPool {
  poolId: string;
  protocol: string;
  protocolDisplay: string;
  chain: string;
  symbol: string;
  tvlUsd: number;
  apyBase: number | null;
  apyReward: number | null;
  apy: number;
  rewardTokens: string[] | null;
  apyDelta7d: number | null;
  apyDelta30d: number | null;
  ilRisk: string | null;
  exposure: string | null;
  stablecoin: boolean;
  outlier: boolean;
}

interface ApiResponse {
  ts: number;
  pools: RestakingPool[];
  summary: {
    totalTvlUsd: number;
    poolCount: number;
    medianApy: number;
    topByTvl: RestakingPool | null;
    topByApy: RestakingPool | null;
  };
}

const fmtUsd = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(abs / 1e3).toFixed(1)}K`;
  return `$${abs.toFixed(0)}`;
};
const fmtPct = (n: number, digits = 2) => `${n.toFixed(digits)}%`;

export default function RestakingPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [protoFilter, setProtoFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<'tvl' | 'apy'>('tvl');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/restaking', { signal: AbortSignal.timeout(20_000) });
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

  useEffect(() => { load(); }, []);

  const protocols = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const p of data.pools) counts.set(p.protocolDisplay, (counts.get(p.protocolDisplay) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let p = data.pools;
    if (protoFilter) p = p.filter(x => x.protocolDisplay === protoFilter);
    return [...p].sort((a, b) => sort === 'apy' ? b.apy - a.apy : b.tvlUsd - a.tvlUsd);
  }, [data, protoFilter, sort]);

  return (
    <>
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 py-6">
        <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-400" />
              <h1 className="text-2xl font-bold text-white">Restaking Yield Aggregator</h1>
            </div>
            <p className="text-sm text-neutral-500 mt-1">
              EigenLayer, Symbiotic, Karak, Babylon, and the LRT ecosystem (Renzo, EtherFi, Kelp, Puffer, …) — sorted by TVL or APY.
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

        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <SummaryCell label="Pools" value={data.summary.poolCount.toLocaleString()} />
            <SummaryCell label="Total TVL" value={fmtUsd(data.summary.totalTvlUsd)} valueColor="text-emerald-400" />
            <SummaryCell label="Median APY" value={fmtPct(data.summary.medianApy)} />
            <SummaryCell
              label="Top APY pool"
              value={data.summary.topByApy ? `${data.summary.topByApy.symbol} (${fmtPct(data.summary.topByApy.apy)})` : '—'}
            />
          </div>
        )}

        {/* Filter chips */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-neutral-500" />
          <button
            onClick={() => setProtoFilter(null)}
            className={`text-[11px] px-2 py-1 rounded-md font-medium transition-colors ${
              protoFilter == null ? 'bg-hub-yellow text-black' : 'bg-white/[0.04] text-neutral-400 hover:text-white hover:bg-white/[0.08]'
            }`}
          >
            All ({data?.summary.poolCount ?? 0})
          </button>
          {protocols.map(([proto, count]) => (
            <button
              key={proto}
              onClick={() => setProtoFilter(proto)}
              className={`text-[11px] px-2 py-1 rounded-md font-medium transition-colors ${
                protoFilter === proto ? 'bg-hub-yellow text-black' : 'bg-white/[0.04] text-neutral-400 hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              {proto} ({count})
            </button>
          ))}
          <div className="ml-auto inline-flex items-center gap-1">
            <ArrowUpDown className="w-3 h-3 text-neutral-500" />
            <select
              value={sort}
              onChange={e => setSort(e.target.value as 'tvl' | 'apy')}
              className="bg-white/[0.04] border border-white/10 rounded text-[11px] px-2 py-1 text-neutral-300 focus:outline-none"
            >
              <option value="tvl">TVL desc</option>
              <option value="apy">APY desc</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="card-premium p-4 border border-red-400/30 bg-red-500/5 text-sm text-red-300 mb-4">
            {error}
          </div>
        )}

        {!data && !error && (
          <div className="card-premium p-8 text-center text-neutral-500 text-sm">Loading restaking pools…</div>
        )}

        {data && filtered.length === 0 && (
          <div className="card-premium p-8 text-center text-neutral-500 text-sm">
            No pools match this filter.
          </div>
        )}

        {data && filtered.length > 0 && (
          <div className="card-premium overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-white/[0.03] border-b border-white/[0.06]">
                <tr className="text-[10px] uppercase tracking-wider text-neutral-500">
                  <th className="text-left px-3 py-2 font-medium">#</th>
                  <th className="text-left px-2 py-2 font-medium">Protocol</th>
                  <th className="text-left px-2 py-2 font-medium">Symbol</th>
                  <th className="text-left px-2 py-2 font-medium">Chain</th>
                  <th className="text-right px-2 py-2 font-medium">TVL</th>
                  <th className="text-right px-2 py-2 font-medium">APY</th>
                  <th className="text-right px-2 py-2 font-medium">Base</th>
                  <th className="text-right px-2 py-2 font-medium">Reward</th>
                  <th className="text-right px-2 py-2 font-medium">7d Δ</th>
                  <th className="text-right px-3 py-2 font-medium">30d Δ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={p.poolId} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="px-3 py-2 text-neutral-500 tabular-nums">{i + 1}</td>
                    <td className="px-2 py-2 text-white">
                      {p.protocolDisplay}
                      {p.outlier && <span className="ml-1 text-[9px] text-amber-400" title="DeFi Llama flagged this pool as a high-variance outlier">⚠</span>}
                    </td>
                    <td className="px-2 py-2 font-semibold text-white">{p.symbol}</td>
                    <td className="px-2 py-2 text-[11px] text-neutral-400">{p.chain}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-white">{fmtUsd(p.tvlUsd)}</td>
                    <td className="px-2 py-2 text-right tabular-nums font-bold text-emerald-400">{fmtPct(p.apy)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-neutral-400">{p.apyBase != null ? fmtPct(p.apyBase) : '—'}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-amber-400/70">{p.apyReward != null ? fmtPct(p.apyReward) : '—'}</td>
                    <td className={`px-2 py-2 text-right tabular-nums ${p.apyDelta7d == null ? 'text-neutral-600' : p.apyDelta7d >= 0 ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
                      {p.apyDelta7d == null ? '—' : (p.apyDelta7d >= 0 ? '+' : '') + fmtPct(p.apyDelta7d, 2)}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${p.apyDelta30d == null ? 'text-neutral-600' : p.apyDelta30d >= 0 ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
                      {p.apyDelta30d == null ? '—' : (p.apyDelta30d >= 0 ? '+' : '') + fmtPct(p.apyDelta30d, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && (
          <div className="text-center mt-4 text-[10px] text-neutral-600">
            Last refresh: {new Date(data.ts).toLocaleTimeString()} · cached 10 min · source: DeFi Llama yields
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}

function SummaryCell({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="card-premium p-3">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">{label}</div>
      <div className={`text-lg font-bold tabular-nums mt-0.5 ${valueColor ?? 'text-white'}`}>{value}</div>
    </div>
  );
}
