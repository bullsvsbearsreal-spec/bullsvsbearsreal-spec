'use client';

/**
 * /backtest — Strategy Backtest Lab
 *
 * Two strategies in v1:
 *   - DCA: invest $X every N days into a CoinGecko asset for the past M
 *   - Funding-rate carry: harvest the spread between most-negative and
 *     most-positive funding rate every day, using our funding_snapshots
 *
 * Form on the left, result + cumulative-value SVG sparkline on the right.
 * Read-only — never executes anything.
 */
import { useEffect, useMemo, useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { TestTube, RefreshCw, AlertTriangle, ChevronDown, Calculator, TrendingUp } from 'lucide-react';

type Strategy = 'dca' | 'funding-carry';

interface BacktestPoint {
  date: string;
  valueUsd: number;
  depositedUsd: number;
  roiPct: number;
}
interface BacktestResult {
  strategy: Strategy;
  config: any;
  series: BacktestPoint[];
  finalValueUsd: number;
  totalDepositedUsd: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  annualisedVolPct: number;
  sharpe: number;
  trades: number;
  ts: number;
}

const fmtUsd = (n: number): string => {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
};
const fmtUsdSign = (n: number) => (n >= 0 ? '+' : '') + fmtUsd(n);
const fmtPct = (n: number, d = 2) => `${n >= 0 ? '+' : ''}${n.toFixed(d)}%`;

const COIN_OPTIONS = [
  { id: 'bitcoin', label: 'BTC' },
  { id: 'ethereum', label: 'ETH' },
  { id: 'solana', label: 'SOL' },
  { id: 'hyperliquid', label: 'HYPE' },
  { id: 'sui', label: 'SUI' },
  { id: 'dogecoin', label: 'DOGE' },
  { id: 'chainlink', label: 'LINK' },
  { id: 'avalanche-2', label: 'AVAX' },
];

export default function BacktestPage() {
  const [strategy, setStrategy] = useState<Strategy>('dca');
  // DCA fields
  const [asset, setAsset] = useState('bitcoin');
  const [amountUsd, setAmountUsd] = useState(100);
  const [intervalDays, setIntervalDays] = useState(7);
  const [lookbackDays, setLookbackDays] = useState(180);
  // Funding-carry fields
  const [notionalUsd, setNotionalUsd] = useState(10_000);
  const [carrySymbol, setCarrySymbol] = useState('');
  const [carryLookback, setCarryLookback] = useState(30);

  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const body = strategy === 'dca'
        ? { strategy, config: { asset, amountUsd, intervalDays, lookbackDays } }
        : { strategy, config: { notionalUsd, lookbackDays: carryLookback, symbol: carrySymbol || undefined } };
      const res = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || `HTTP ${res.status}`);
        setResult(null);
        return;
      }
      setResult(json.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }

  // Run once on mount with default DCA config.
  useEffect(() => { run(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // Build cumulative-PnL chart from series.
  const chart = useMemo(() => {
    if (!result || result.series.length < 2) return null;
    const w = 600, h = 140;
    const ys = result.series.map(p => p.valueUsd - p.depositedUsd); // PnL
    const yMin = Math.min(0, ...ys);
    const yMax = Math.max(0, ...ys);
    const yRange = yMax - yMin || 1;
    const path = result.series.map((p, i) => {
      const x = (i / Math.max(1, result.series.length - 1)) * w;
      const yVal = p.valueUsd - p.depositedUsd;
      const y = h - ((yVal - yMin) / yRange) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const zeroY = h - ((0 - yMin) / yRange) * h;
    const last = ys[ys.length - 1];
    const tone = last >= 0 ? 'stroke-emerald-400' : 'stroke-red-400';
    return { path, w, h, zeroY, tone, last, yMin, yMax };
  }, [result]);

  return (
    <>
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 py-6">
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <TestTube className="w-5 h-5 text-purple-400" />
            <h1 className="text-2xl font-bold text-white">Strategy Backtest Lab</h1>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-400/15 text-purple-400 font-bold">
              beta
            </span>
          </div>
          <p className="text-sm text-neutral-500 mt-1 max-w-3xl">
            What if you&rsquo;d run this strategy? Pure historical-data simulation — no fees, no slippage,
            no live execution. Treat the numbers as &ldquo;ballpark&rdquo;, not investment advice.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Form */}
          <div className="card-premium p-4 space-y-3 h-fit">
            <h2 className="text-sm font-semibold text-white mb-2">Strategy</h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setStrategy('dca')}
                className={`text-xs font-semibold py-1.5 px-2 rounded inline-flex items-center justify-center gap-1 ${
                  strategy === 'dca' ? 'bg-purple-500/20 text-purple-300 border border-purple-400/40' : 'bg-white/[0.03] text-neutral-400 border border-white/10'
                }`}
              >
                <Calculator className="w-3 h-3" /> DCA
              </button>
              <button
                onClick={() => setStrategy('funding-carry')}
                className={`text-xs font-semibold py-1.5 px-2 rounded inline-flex items-center justify-center gap-1 ${
                  strategy === 'funding-carry' ? 'bg-purple-500/20 text-purple-300 border border-purple-400/40' : 'bg-white/[0.03] text-neutral-400 border border-white/10'
                }`}
              >
                <TrendingUp className="w-3 h-3" /> Funding carry
              </button>
            </div>

            {strategy === 'dca' && (
              <>
                <Field label="Asset">
                  <div className="relative">
                    <select
                      value={asset}
                      onChange={e => setAsset(e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:outline-none appearance-none pr-8"
                    >
                      {COIN_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
                  </div>
                </Field>
                <Field label={`Amount per buy: $${amountUsd.toLocaleString()}`}>
                  <input type="range" min={10} max={5000} step={10} value={amountUsd} onChange={e => setAmountUsd(Number(e.target.value))} className="w-full" />
                </Field>
                <Field label={`Interval: every ${intervalDays} day${intervalDays > 1 ? 's' : ''}`}>
                  <input type="range" min={1} max={30} step={1} value={intervalDays} onChange={e => setIntervalDays(Number(e.target.value))} className="w-full" />
                </Field>
                <Field label={`Lookback: ${lookbackDays} days`}>
                  <input type="range" min={30} max={365} step={5} value={lookbackDays} onChange={e => setLookbackDays(Number(e.target.value))} className="w-full" />
                </Field>
              </>
            )}

            {strategy === 'funding-carry' && (
              <>
                <Field label={`Notional per leg: ${fmtUsd(notionalUsd)}`}>
                  <input type="range" min={1000} max={1_000_000} step={1000} value={notionalUsd} onChange={e => setNotionalUsd(Number(e.target.value))} className="w-full" />
                </Field>
                <Field label="Filter to symbol (optional)">
                  <input
                    type="text"
                    value={carrySymbol}
                    onChange={e => setCarrySymbol(e.target.value.toUpperCase())}
                    className="w-full bg-white/[0.04] border border-white/10 rounded px-2 py-1.5 text-white text-sm"
                    placeholder="e.g. BTC, ETH"
                  />
                </Field>
                <Field label={`Lookback: ${carryLookback} days`}>
                  <input type="range" min={3} max={50} step={1} value={carryLookback} onChange={e => setCarryLookback(Number(e.target.value))} className="w-full" />
                </Field>
                <p className="text-[10px] text-neutral-600 leading-relaxed">
                  Strategy: every day, go LONG the perp with the most-negative funding (longs collect)
                  and SHORT the perp with the most-positive funding (shorts collect). Earn the spread.
                  Fees / slippage / basis risk NOT modelled.
                </p>
              </>
            )}

            <button
              onClick={run}
              disabled={loading}
              className="w-full py-2 px-3 mt-2 bg-purple-500 text-white text-sm font-semibold rounded hover:bg-purple-500/90 transition disabled:opacity-50 disabled:cursor-wait inline-flex items-center justify-center gap-1"
            >
              {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
              {loading ? 'Running…' : 'Run backtest'}
            </button>

            {error && (
              <div className="text-[11px] text-red-400 inline-flex items-start gap-1 mt-2">
                <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Result */}
          <div className="md:col-span-2 space-y-4">
            {result && (
              <>
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Stat
                    label={strategy === 'dca' ? 'Final value' : 'Cumulative PnL'}
                    value={fmtUsd(result.finalValueUsd)}
                    valueColor="text-white"
                  />
                  <Stat
                    label={strategy === 'dca' ? 'Total deposited' : 'Notional per leg'}
                    value={fmtUsd(result.totalDepositedUsd)}
                  />
                  <Stat
                    label="Return"
                    value={fmtPct(result.totalReturnPct)}
                    valueColor={result.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-red-400'}
                  />
                  <Stat
                    label="Max drawdown"
                    value={fmtPct(-result.maxDrawdownPct)}
                    valueColor="text-red-400/80"
                  />
                  <Stat label="Ann. vol" value={fmtPct(result.annualisedVolPct, 1)} sub="of returns" />
                  <Stat label="Sharpe-ish" value={result.sharpe.toFixed(2)} sub="rf=0" />
                  <Stat label="Trades" value={result.trades.toLocaleString()} />
                  <Stat label="Days" value={result.series.length.toLocaleString()} />
                </div>

                {/* Chart */}
                {chart && (
                  <div className="card-premium p-4">
                    <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-2">
                      Cumulative {strategy === 'dca' ? 'PnL vs deposited' : 'PnL'} — {result.series.length} days
                    </div>
                    <svg viewBox={`0 0 ${chart.w} ${chart.h}`} className="w-full h-32">
                      <line x1={0} x2={chart.w} y1={chart.zeroY} y2={chart.zeroY} className="stroke-neutral-700" strokeDasharray="2 4" strokeWidth={0.5} />
                      <path d={chart.path} className={`fill-none ${chart.tone}`} strokeWidth={1.5} strokeLinejoin="round" />
                    </svg>
                    <div className="flex justify-between text-[10px] text-neutral-500 mt-1 tabular-nums">
                      <span>min: {fmtUsd(chart.yMin)}</span>
                      <span className={chart.last >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                        Now: {fmtUsdSign(chart.last)}
                      </span>
                      <span>max: {fmtUsd(chart.yMax)}</span>
                    </div>
                  </div>
                )}

                {/* Series tail */}
                <div className="card-premium p-4">
                  <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-2">
                    Last 10 days
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-wider text-neutral-500 border-b border-white/[0.06]">
                          <th className="text-left py-2 font-medium">Date</th>
                          <th className="text-right py-2 font-medium">Value</th>
                          <th className="text-right py-2 font-medium">Deposited</th>
                          <th className="text-right py-2 font-medium">PnL</th>
                          <th className="text-right py-2 font-medium">ROI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.series.slice(-10).reverse().map(p => {
                          const pnl = p.valueUsd - p.depositedUsd;
                          return (
                            <tr key={p.date} className="border-b border-white/[0.03]">
                              <td className="py-1 text-neutral-400">{p.date}</td>
                              <td className="py-1 text-right text-white tabular-nums">{fmtUsd(p.valueUsd)}</td>
                              <td className="py-1 text-right text-neutral-500 tabular-nums">{fmtUsd(p.depositedUsd)}</td>
                              <td className={`py-1 text-right tabular-nums ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtUsdSign(pnl)}</td>
                              <td className={`py-1 text-right tabular-nums ${p.roiPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtPct(p.roiPct)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="text-[10px] text-neutral-600 max-w-3xl">
                  ⚠️ This simulation ignores trading fees, slippage, and venue-specific risks (basis, cross-margin
                  effects, liquidation). Real execution will produce different numbers. <strong>Not investment advice.</strong>
                </div>
              </>
            )}
            {!result && !error && !loading && (
              <div className="card-premium p-8 text-center text-neutral-500 text-sm">Configure a strategy and run.</div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-1">{label}</div>
      {children}
    </label>
  );
}

function Stat({ label, value, sub, valueColor }: { label: string; value: string; sub?: string; valueColor?: string }) {
  return (
    <div className="card-premium p-3">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">{label}</div>
      <div className={`text-base font-bold tabular-nums mt-0.5 ${valueColor ?? 'text-white'}`}>{value}</div>
      {sub && <div className="text-[9px] text-neutral-600 mt-0.5">{sub}</div>}
    </div>
  );
}
