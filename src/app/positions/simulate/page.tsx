'use client';

/**
 * /positions/simulate — pre-trade decision engine.
 *
 * "I'm about to open BTC long $50k at 10x on Hyperliquid. Should I?"
 *
 * Form on the left, before/after comparison on the right. Pure
 * what-if — never persists or executes. Runs the same Position Health
 * Score + funding cost-of-carry math the live /positions page uses, so
 * the user gets a like-for-like preview of how the trade would land.
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PageHero from '@/components/PageHero';
import {
  ArrowLeft, Calculator, TrendingUp, TrendingDown, ChevronDown,
  AlertTriangle, AlertOctagon, AlertCircle, Activity, ShieldCheck,
} from 'lucide-react';

interface SimulateResponse {
  success: boolean;
  hypothetical: {
    symbol: string;
    side: 'long' | 'short';
    positionValueUsd: number;
    leverage: number;
    exchange: string;
    markPrice: number | null;
    liquidationPrice: number | null;
    currentFundingPct: number | null;
    tpPrice: number | null;
    slPrice: number | null;
    health: {
      score: number;
      label: 'critical' | 'risky' | 'caution' | 'ok' | 'healthy';
      factors: { liqBuffer: number; leverage: number; stopLoss: number; funding: number; profitability: number };
      reasons: string[];
    };
    dailyFundingCarryUsd: number | null;
    intervalHours: number;
  };
  aggregate: {
    before: { nominal: number; totalLong: number; totalShort: number; equity: number; leverageLong: number; leverageShort: number };
    after: { nominal: number; totalLong: number; totalShort: number; equity: number; leverageLong: number; leverageShort: number };
    delta: { nominal: number; totalLong: number; totalShort: number; equity: number; leverageLong: number; leverageShort: number };
    dailyFundingCarryUsdBefore: number | null;
    dailyFundingCarryUsdAfter: number | null;
  };
  existingPositionCount: number;
  ts: number;
  error?: string;
}

// Lucide icon per health tier — replaces the older emoji set so the
// badge fits the rest of the data-terminal UI. Each icon still telegraphs
// severity (octagon = stop, triangle = warn, circle = info, activity =
// pulse, shield = protected).
const VIBE_ICON: Record<'critical'|'risky'|'caution'|'ok'|'healthy', React.ComponentType<{ className?: string }>> = {
  critical: AlertOctagon,
  risky:    AlertTriangle,
  caution:  AlertCircle,
  ok:       Activity,
  healthy:  ShieldCheck,
};
const TONE: Record<'critical'|'risky'|'caution'|'ok'|'healthy', string> = {
  critical: 'border-red-400/40 text-red-300 bg-red-500/10',
  risky:    'border-orange-400/40 text-orange-300 bg-orange-500/10',
  caution:  'border-amber-400/40 text-amber-300 bg-amber-500/10',
  ok:       'border-sky-400/40 text-sky-300 bg-sky-500/10',
  healthy:  'border-emerald-400/40 text-emerald-300 bg-emerald-500/10',
};

const EXCHANGES = ['Hyperliquid', 'GMX', 'gTrade', 'Lighter', 'Binance', 'Bybit', 'OKX', 'Bitget'];

const fmtUsd = (n: number | null | undefined): string => {
  if (n == null || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
};
const fmtUsdSign = (n: number | null | undefined): string => {
  if (n == null || !Number.isFinite(n)) return '—';
  return (n >= 0 ? '+' : '') + fmtUsd(n);
};
const fmtPrice = (n: number | null): string => {
  if (n == null) return '—';
  if (n < 0.01) return `$${n.toFixed(6)}`;
  if (n < 1) return `$${n.toFixed(4)}`;
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
};
const fmtLev = (n: number): string => `${n.toFixed(2)}×`;

export default function SimulatePage() {
  const router = useRouter();
  const [symbol, setSymbol] = useState('BTC');
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [positionValueUsd, setPositionValueUsd] = useState(50_000);
  const [leverage, setLeverage] = useState(10);
  const [exchange, setExchange] = useState('Hyperliquid');
  const [tpPrice, setTpPrice] = useState<string>('');
  const [slPrice, setSlPrice] = useState<string>('');

  const [result, setResult] = useState<SimulateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSimulation() {
    setLoading(true);
    setError(null);
    try {
      const body = {
        symbol,
        side,
        positionValueUsd,
        leverage,
        exchange,
        tpPrice: tpPrice ? Number(tpPrice) : null,
        slPrice: slPrice ? Number(slPrice) : null,
      };
      const res = await fetch('/api/account/positions/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        router.push('/login?callbackUrl=/positions/simulate');
        return;
      }
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || `HTTP ${res.status}`);
        setResult(null);
        return;
      }
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  // Auto-run on mount with default values so users see something immediately.
  useEffect(() => {
    runSimulation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const h = result?.hypothetical;
  const agg = result?.aggregate;

  return (
    <>
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 py-6">
        <Link href="/positions" className="text-[11px] text-neutral-500 hover:text-hub-yellow inline-flex items-center gap-1 mb-2">
          <ArrowLeft className="w-3 h-3" /> back to positions
        </Link>
        <PageHero
          icon={Calculator}
          eyebrow="What-if engine"
          title="Pre-trade"
          accentNoun="simulator"
          accent="hub-yellow"
          description="Plug in a hypothetical trade and see its impact on your book BEFORE you execute. No state mutation — your real positions are not touched."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* ─── Form (left, 1 col) ───────────────────────────────── */}
          <div className="card-premium p-4 space-y-3 h-fit">
            <h2 className="text-sm font-semibold text-white mb-2">Hypothetical Trade</h2>

            <Field label="Symbol">
              <input
                type="text"
                value={symbol}
                onChange={e => setSymbol(e.target.value.toUpperCase())}
                className="w-full bg-white/[0.04] border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-hub-yellow/50"
                placeholder="BTC"
              />
            </Field>

            <Field label="Side">
              <div className="flex gap-2">
                <button
                  onClick={() => setSide('long')}
                  className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded inline-flex items-center justify-center gap-1 ${
                    side === 'long' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40' : 'bg-white/[0.03] text-neutral-400 border border-white/10'
                  }`}
                >
                  <TrendingUp className="w-3 h-3" /> Long
                </button>
                <button
                  onClick={() => setSide('short')}
                  className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded inline-flex items-center justify-center gap-1 ${
                    side === 'short' ? 'bg-red-500/20 text-red-300 border border-red-400/40' : 'bg-white/[0.03] text-neutral-400 border border-white/10'
                  }`}
                >
                  <TrendingDown className="w-3 h-3" /> Short
                </button>
              </div>
            </Field>

            <Field label="Position size (USD)">
              <input
                type="number"
                value={positionValueUsd}
                onChange={e => setPositionValueUsd(Number(e.target.value) || 0)}
                className="w-full bg-white/[0.04] border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-hub-yellow/50 tabular-nums"
                min={1}
                step={1000}
              />
            </Field>

            <Field label={`Leverage (${leverage}×)`}>
              <input
                type="range"
                min={1}
                max={50}
                step={1}
                value={leverage}
                onChange={e => setLeverage(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-[9px] text-neutral-600 mt-1">
                <span>1×</span><span>10×</span><span>25×</span><span>50×</span>
              </div>
            </Field>

            <Field label="Exchange">
              <div className="relative">
                <select
                  value={exchange}
                  onChange={e => setExchange(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-hub-yellow/50 appearance-none pr-8"
                >
                  {EXCHANGES.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label="TP (optional)">
                <input
                  type="number"
                  value={tpPrice}
                  onChange={e => setTpPrice(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-hub-yellow/50 tabular-nums"
                  step="any"
                  placeholder="—"
                />
              </Field>
              <Field label="SL (optional)">
                <input
                  type="number"
                  value={slPrice}
                  onChange={e => setSlPrice(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-hub-yellow/50 tabular-nums"
                  step="any"
                  placeholder="—"
                />
              </Field>
            </div>

            <button
              onClick={runSimulation}
              disabled={loading}
              className="w-full py-2 px-3 mt-3 bg-hub-yellow text-black text-sm font-semibold rounded hover:bg-hub-yellow/90 transition disabled:opacity-50 disabled:cursor-wait"
            >
              {loading ? 'Simulating…' : 'Simulate this trade'}
            </button>

            {error && (
              <div className="text-[11px] text-red-400 mt-2 inline-flex items-start gap-1">
                <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* ─── Result (right, 2 cols) ───────────────────────────── */}
          <div className="md:col-span-2 space-y-4">
            {h && (
              <>
                {/* Hypothetical position card */}
                <div className={`card-premium p-4 border ${TONE[h.health.label]}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">If you opened</div>
                      <div className="text-lg font-bold text-white">
                        {h.symbol} {h.side === 'long' ? 'long' : 'short'} {fmtUsd(h.positionValueUsd)} @ {h.leverage.toFixed(1)}× on {h.exchange}
                      </div>
                    </div>
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md border tabular-nums font-mono font-bold text-base ${TONE[h.health.label]}`}>
                      {(() => { const Icon = VIBE_ICON[h.health.label]; return <Icon className="w-4 h-4" />; })()}
                      {h.health.score}
                      <span className="text-[10px] uppercase tracking-wider opacity-60 font-normal">{h.health.label}</span>
                    </div>
                  </div>

                  {h.health.reasons.length > 0 && (
                    <div className="text-[11px] text-neutral-400 mb-3">
                      <span className="font-semibold text-neutral-300">Concerns:</span>{' '}
                      {h.health.reasons.join(' · ')}
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <Stat label="Mark" value={fmtPrice(h.markPrice)} />
                    <Stat label="Liq" value={fmtPrice(h.liquidationPrice)} sub="(approx)" />
                    <Stat label="TP" value={fmtPrice(h.tpPrice)} />
                    <Stat label="SL" value={fmtPrice(h.slPrice)} />
                    <Stat
                      label="Funding rate"
                      value={h.currentFundingPct == null ? '—' : `${h.currentFundingPct >= 0 ? '+' : ''}${h.currentFundingPct.toFixed(4)}%/${h.intervalHours}h`}
                    />
                    <Stat
                      label="Daily carry"
                      value={fmtUsdSign(h.dailyFundingCarryUsd)}
                      valueClass={h.dailyFundingCarryUsd == null ? '' : h.dailyFundingCarryUsd >= 0 ? 'text-emerald-400' : 'text-red-400'}
                    />
                    <Stat label="Margin posted" value={fmtUsd(h.positionValueUsd / h.leverage)} />
                    <Stat
                      label="Monthly carry"
                      value={fmtUsdSign(h.dailyFundingCarryUsd != null ? h.dailyFundingCarryUsd * 30 : null)}
                      valueClass={h.dailyFundingCarryUsd == null ? '' : h.dailyFundingCarryUsd >= 0 ? 'text-emerald-400/80' : 'text-red-400/80'}
                    />
                  </div>

                  {/* Sub-score bars */}
                  <div className="mt-3 grid grid-cols-5 gap-2 text-[10px]">
                    {Object.entries(h.health.factors).map(([k, v]) => (
                      <div key={k}>
                        <div className="text-[9px] uppercase tracking-wider text-neutral-600">{k}</div>
                        <div className="h-1.5 bg-white/5 rounded overflow-hidden mt-0.5">
                          <div
                            className={`h-full ${v >= 70 ? 'bg-emerald-400' : v >= 45 ? 'bg-amber-400' : 'bg-red-400'}`}
                            style={{ width: `${v}%` }}
                          />
                        </div>
                        <div className="tabular-nums text-neutral-500 mt-0.5">{v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Aggregate before/after */}
                {agg && (
                  <div className="card-premium p-4">
                    <h3 className="text-sm font-semibold text-white mb-3">
                      Impact on your book ({result?.existingPositionCount ?? 0} existing position{(result?.existingPositionCount ?? 0) !== 1 ? 's' : ''})
                    </h3>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <Comparison label="Equity" before={agg.before.equity} after={agg.after.equity} fmt={fmtUsd} />
                      <Comparison label="Nominal" before={agg.before.nominal} after={agg.after.nominal} fmt={fmtUsd} />
                      <Comparison label="Total long" before={agg.before.totalLong} after={agg.after.totalLong} fmt={fmtUsd} colorOnIncrease="emerald" />
                      <Comparison label="Total short" before={agg.before.totalShort} after={agg.after.totalShort} fmt={fmtUsd} colorOnIncrease="red" />
                      <Comparison label="Leverage long" before={agg.before.leverageLong} after={agg.after.leverageLong} fmt={fmtLev} />
                      <Comparison label="Leverage short" before={agg.before.leverageShort} after={agg.after.leverageShort} fmt={fmtLev} />
                    </div>
                  </div>
                )}

                {/* Verdict line */}
                <div className={`card-premium p-3 border ${TONE[h.health.label]}`}>
                  <div className="text-[11px] text-neutral-400">
                    <span className="font-semibold text-white">Verdict:</span>{' '}
                    {h.health.label === 'healthy' && 'This setup looks comfortable. You can size up if you have conviction.'}
                    {h.health.label === 'ok' && 'Reasonable setup. Consider adding a stop-loss if you don\'t have one.'}
                    {h.health.label === 'caution' && 'Tight liq buffer or high leverage — set a stop-loss and watch funding.'}
                    {h.health.label === 'risky' && 'High leverage + thin buffer. Small adverse move would be painful.'}
                    {h.health.label === 'critical' && 'Don\'t do this. Reduce leverage or position size first.'}
                  </div>
                </div>
              </>
            )}
            {!h && !loading && (
              <div className="card-premium p-8 text-center text-neutral-500 text-sm">
                Fill in the form and hit Simulate to preview.
              </div>
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

function Stat({ label, value, sub, valueClass }: { label: string; value: string; sub?: string; valueClass?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className={`text-sm font-mono tabular-nums ${valueClass ?? 'text-white'}`}>{value}</div>
      {sub && <div className="text-[9px] text-neutral-600">{sub}</div>}
    </div>
  );
}

function Comparison({
  label, before, after, fmt, colorOnIncrease,
}: {
  label: string;
  before: number;
  after: number;
  fmt: (n: number) => string;
  colorOnIncrease?: 'emerald' | 'red';
}) {
  const diff = after - before;
  const tone = diff === 0
    ? 'text-neutral-500'
    : colorOnIncrease === 'emerald'
      ? (diff > 0 ? 'text-emerald-400' : 'text-red-400')
      : colorOnIncrease === 'red'
        ? (diff > 0 ? 'text-red-400' : 'text-emerald-400')
        : 'text-neutral-300';
  return (
    <div className="bg-white/[0.02] rounded p-2">
      <div className="text-[9px] uppercase tracking-wider text-neutral-600 font-medium">{label}</div>
      <div className="flex items-baseline gap-2 mt-1 tabular-nums font-mono">
        <span className="text-neutral-500 text-[10px]">{fmt(before)}</span>
        <span className="text-neutral-600">→</span>
        <span className="text-white text-sm font-semibold">{fmt(after)}</span>
      </div>
      {diff !== 0 && (
        <div className={`text-[10px] tabular-nums ${tone}`}>
          {diff >= 0 ? '+' : ''}{fmt(diff)}
        </div>
      )}
    </div>
  );
}
