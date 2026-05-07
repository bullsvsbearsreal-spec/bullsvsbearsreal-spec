'use client';

/**
 * /positions/tax — FIFO cost-basis aggregator.
 *
 * Walks every fill on user_trades and computes:
 *   - Total realised PnL (all-time + YTD)
 *   - Per-year breakdown (for filing)
 *   - Open positions with weighted avg cost basis
 *   - Top winners and losers
 *
 * Pure compute on the data the trade-history sync stores; no new
 * ingestion. As CEX clients gain fetchTradeHistory the coverage expands
 * automatically.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ArrowLeft, Calculator, RefreshCw, Download, Info } from 'lucide-react';

interface OpenPosition {
  symbol: string;
  exchange: string;
  side: 'long' | 'short';
  totalSize: number;
  avgCostBasis: number;
  totalCostUsd: number;
  lotCount: number;
}

interface PerPair {
  symbol: string;
  exchange: string;
  pnl: number;
  trades: number;
}

interface YearBucket {
  year: number;
  realized: number;
  fees: number;
  trades: number;
}

interface ApiResponse {
  success: boolean;
  summary: {
    realizedPnlUsd: number;
    feesUsd: number;
    netUsd: number;
    realizedYtdUsd: number;
    openPositions: OpenPosition[];
    topWinners: PerPair[];
    topLosers: PerPair[];
    byYear: YearBucket[];
  };
  tradeCount: number;
  note: string | null;
}

const fmtUsd = (n: number) => {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
};
const fmtUsdSign = (n: number) => (n >= 0 ? '+' : '') + fmtUsd(n);
const fmtPrice = (n: number) => {
  if (n < 0.01) return `$${n.toFixed(6)}`;
  if (n < 1) return `$${n.toFixed(4)}`;
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
};
const fmtSize = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 4 });

export default function TaxPage() {
  const router = useRouter();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/account/tax', { signal: AbortSignal.timeout(20_000) });
      if (res.status === 401) {
        router.push('/auth/signin?callbackUrl=/positions/tax');
        return;
      }
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

  const summary = data?.summary;

  function downloadCsv() {
    if (!summary) return;
    const rows: string[] = [];
    rows.push('Year,Trades,Realised PnL (USD),Fees (USD),Net (USD)');
    for (const y of summary.byYear) {
      rows.push(`${y.year},${y.trades},${y.realized.toFixed(2)},${y.fees.toFixed(2)},${(y.realized - y.fees).toFixed(2)}`);
    }
    rows.push('');
    rows.push('Symbol,Exchange,Realised PnL (USD),Trade count');
    for (const w of summary.topWinners) rows.push(`${w.symbol},${w.exchange},${w.pnl.toFixed(2)},${w.trades}`);
    for (const l of summary.topLosers) rows.push(`${l.symbol},${l.exchange},${l.pnl.toFixed(2)},${l.trades}`);
    rows.push('');
    rows.push('Open positions,,,,,');
    rows.push('Symbol,Exchange,Side,Size,Avg cost,Total cost USD,Lots');
    for (const p of summary.openPositions) {
      rows.push(`${p.symbol},${p.exchange},${p.side},${p.totalSize},${p.avgCostBasis.toFixed(6)},${p.totalCostUsd.toFixed(2)},${p.lotCount}`);
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `infohub-tax-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 py-6">
        <Link href="/positions" className="text-[11px] text-neutral-500 hover:text-hub-yellow inline-flex items-center gap-1 mb-2">
          <ArrowLeft className="w-3 h-3" /> back to positions
        </Link>
        <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-hub-yellow" />
              <h1 className="text-2xl font-bold text-white">Tax / Cost-Basis</h1>
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-hub-yellow/15 text-hub-yellow font-bold">
                FIFO · beta
              </span>
            </div>
            <p className="text-sm text-neutral-500 mt-1 max-w-3xl">
              Aggregate cost-basis + realised PnL across every connected wallet & key. FIFO accounting
              over your entire trade history. Currently powered by Hyperliquid fills (CEX coming soon).
              Numbers are estimates — confirm with your accountant before filing.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {summary && (
              <button
                onClick={downloadCsv}
                className="inline-flex items-center gap-1 text-xs text-hub-yellow hover:text-hub-yellow/80 px-2 py-1 rounded border border-hub-yellow/30 bg-hub-yellow/5"
              >
                <Download className="w-3 h-3" /> Export CSV
              </button>
            )}
            <button
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-hub-yellow disabled:opacity-40"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> refresh
            </button>
          </div>
        </div>

        {data?.note && (
          <div className="card-premium p-3 mb-4 border border-amber-400/30 bg-amber-500/5 text-[11px] text-amber-300 inline-flex items-start gap-2">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{data.note}</span>
          </div>
        )}

        {error && (
          <div className="card-premium p-4 border border-red-400/30 bg-red-500/5 text-sm text-red-300 mb-4">
            {error}
          </div>
        )}

        {!data && !error && (
          <div className="card-premium p-8 text-center text-neutral-500 text-sm">Computing FIFO basis…</div>
        )}

        {summary && (
          <>
            {/* Top KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
              <Stat label="Realised (all-time)" value={fmtUsdSign(summary.realizedPnlUsd)} valueColor={summary.realizedPnlUsd >= 0 ? 'text-emerald-400' : 'text-red-400'} />
              <Stat label="Realised YTD" value={fmtUsdSign(summary.realizedYtdUsd)} valueColor={summary.realizedYtdUsd >= 0 ? 'text-emerald-400' : 'text-red-400'} />
              <Stat label="Fees paid" value={fmtUsd(summary.feesUsd)} valueColor="text-amber-400/80" />
              <Stat label="Net (realised − fees)" value={fmtUsdSign(summary.netUsd)} valueColor={summary.netUsd >= 0 ? 'text-emerald-400' : 'text-red-400'} />
            </div>

            {/* By year */}
            {summary.byYear.length > 0 && (
              <div className="card-premium p-4 mb-4">
                <h3 className="text-sm font-semibold text-white mb-2">Per-year realised PnL</h3>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-neutral-500 border-b border-white/[0.06]">
                      <th className="text-left py-2 font-medium">Year</th>
                      <th className="text-right py-2 font-medium">Trades</th>
                      <th className="text-right py-2 font-medium">Realised</th>
                      <th className="text-right py-2 font-medium">Fees</th>
                      <th className="text-right py-2 font-medium">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byYear.map(y => (
                      <tr key={y.year} className="border-b border-white/[0.03]">
                        <td className="py-2 text-white tabular-nums font-semibold">{y.year}</td>
                        <td className="py-2 text-right text-neutral-400 tabular-nums">{y.trades}</td>
                        <td className={`py-2 text-right tabular-nums font-medium ${y.realized >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {fmtUsdSign(y.realized)}
                        </td>
                        <td className="py-2 text-right text-amber-400/70 tabular-nums">{fmtUsd(y.fees)}</td>
                        <td className={`py-2 text-right tabular-nums font-medium ${(y.realized - y.fees) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {fmtUsdSign(y.realized - y.fees)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Top winners + losers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
              <PnlList title="Top winners" rows={summary.topWinners} tone="emerald" />
              <PnlList title="Top losers" rows={summary.topLosers} tone="red" />
            </div>

            {/* Open lots */}
            {summary.openPositions.length > 0 && (
              <div className="card-premium p-4 mb-4">
                <h3 className="text-sm font-semibold text-white mb-3">Open positions (cost basis)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-neutral-500 border-b border-white/[0.06]">
                        <th className="text-left py-2 font-medium">Symbol</th>
                        <th className="text-left py-2 font-medium">Exchange</th>
                        <th className="text-left py-2 font-medium">Side</th>
                        <th className="text-right py-2 font-medium">Size</th>
                        <th className="text-right py-2 font-medium">Avg cost</th>
                        <th className="text-right py-2 font-medium">Total cost</th>
                        <th className="text-right py-2 font-medium">Lots</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.openPositions.map((p, i) => (
                        <tr key={`${p.symbol}-${p.exchange}-${p.side}-${i}`} className="border-b border-white/[0.03]">
                          <td className="py-2 text-white font-semibold">{p.symbol}</td>
                          <td className="py-2 text-neutral-400 text-[11px]">{p.exchange}</td>
                          <td className="py-2">
                            <span className={`text-[10px] uppercase tracking-wider font-semibold ${p.side === 'long' ? 'text-emerald-400' : 'text-red-400'}`}>
                              {p.side}
                            </span>
                          </td>
                          <td className="py-2 text-right text-neutral-300 tabular-nums">{fmtSize(p.totalSize)}</td>
                          <td className="py-2 text-right text-neutral-300 tabular-nums">{fmtPrice(p.avgCostBasis)}</td>
                          <td className="py-2 text-right text-white tabular-nums">{fmtUsd(p.totalCostUsd)}</td>
                          <td className="py-2 text-right text-neutral-500 tabular-nums">{p.lotCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="text-[10px] text-neutral-600 mt-2 max-w-3xl">
              ⚠️ This is FIFO cost-basis only. Tax law varies by jurisdiction — some allow LIFO/HIFO/specific-id which can produce different numbers. Wash-sale rules, like-kind treatment, and short-vs-long-term capital gains classification are NOT applied here. <strong>Confirm with a qualified tax professional before filing.</strong>
            </div>
          </>
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

function PnlList({ title, rows, tone }: { title: string; rows: PerPair[]; tone: 'emerald' | 'red' }) {
  if (rows.length === 0) {
    return (
      <div className="card-premium p-3">
        <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-2">{title}</div>
        <div className="text-[11px] text-neutral-600">None yet.</div>
      </div>
    );
  }
  return (
    <div className="card-premium p-3">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-2">{title}</div>
      <div className="space-y-0.5 text-[11px]">
        {rows.map((r, i) => (
          <div key={`${r.symbol}-${r.exchange}-${i}`} className="flex items-center justify-between">
            <span className="text-white">
              {r.symbol} <span className="text-neutral-600">· {r.exchange} · {r.trades} trades</span>
            </span>
            <span className={`tabular-nums font-mono ${tone === 'emerald' ? 'text-emerald-400' : 'text-red-400'}`}>
              {fmtUsdSign(r.pnl)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
