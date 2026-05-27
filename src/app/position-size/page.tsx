'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import UsdDisplay from '@/components/UsdDisplay';
import PageHero from '@/components/PageHero';
import { Ruler, Info, AlertTriangle, CheckCircle2, Target, Copy } from 'lucide-react';

type Side = 'long' | 'short';

const STORAGE_KEY = 'infohub_position_size_prefs_v1';

/** Subset of inputs we persist across visits. Entry/stop/target stay
 *  per-session since they're trade-specific; account + risk + Kelly
 *  defaults are user preferences. */
interface PersistedPrefs {
  account?: string;
  riskPct?: string;
  winRate?: string;
  avgWin?: string;
  avgLoss?: string;
}

function loadPrefs(): PersistedPrefs {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch { return {}; }
}

function savePrefs(prefs: PersistedPrefs): void {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
}

function toNum(v: string): number {
  const n = parseFloat(v.replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

export default function PositionSizePage() {
  const [side, setSide] = useState<Side>('long');
  const [accountStr, setAccountStr] = useState('10000');
  const [riskPctStr, setRiskPctStr] = useState('1');
  const [entryStr, setEntryStr] = useState('75000');
  const [stopStr, setStopStr] = useState('73000');
  const [targetStr, setTargetStr] = useState('80000');
  const [leverageStr, setLeverageStr] = useState('');  // optional override for liq calc

  // Hydrate persisted prefs on mount. Done in an effect (not the initial
  // useState default) so SSR markup matches first client render — without
  // this, the server-rendered "10000" defaults would mismatch a returning
  // user whose localStorage has "50000". Also read ?symbol= and prefill
  // entry from current price if a known symbol arrives.
  useEffect(() => {
    const prefs = loadPrefs();
    if (prefs.account) setAccountStr(prefs.account);
    if (prefs.riskPct) setRiskPctStr(prefs.riskPct);
    if (prefs.winRate) setWinRateStr(prefs.winRate);
    if (prefs.avgWin) setAvgWinStr(prefs.avgWin);
    if (prefs.avgLoss) setAvgLossStr(prefs.avgLoss);
  }, []);

  // Kelly inputs
  const [winRateStr, setWinRateStr] = useState('55');
  const [avgWinStr, setAvgWinStr] = useState('2');
  const [avgLossStr, setAvgLossStr] = useState('1');

  // Auto-save persisted prefs whenever any of them change. Debounced
  // implicitly by React's batching — small enough writes that no
  // explicit debounce is needed.
  useEffect(() => {
    savePrefs({ account: accountStr, riskPct: riskPctStr, winRate: winRateStr, avgWin: avgWinStr, avgLoss: avgLossStr });
  }, [accountStr, riskPctStr, winRateStr, avgWinStr, avgLossStr]);

  const account = toNum(accountStr);
  const riskPct = toNum(riskPctStr);
  const entry = toNum(entryStr);
  const stop = toNum(stopStr);
  const target = toNum(targetStr);
  const winRate = toNum(winRateStr);
  const avgWin = toNum(avgWinStr);
  const avgLoss = toNum(avgLossStr);
  const userLeverage = toNum(leverageStr);

  // Liquidation price preview — uses a simplified isolated-margin
  // formula common across major CEXs. The "real" liq price depends
  // on the venue's maintenance margin schedule (BTC/USDT tiers etc.)
  // which we don't model here — these are within ~10% for sub-50x
  // leverage and become unreliable approaching the maintenance band.
  //
  // Formula (long):  liq = entry × (1 - 1/leverage + maintenanceMarginRate)
  //   where maintenanceMarginRate ≈ 0.005 (0.5%) for major perps
  // Short flips the sign.
  const MAINT_MARGIN = 0.005;
  const liqPreview = useMemo(() => {
    // Prefer the user's explicit leverage input; fall back to the
    // result.leverageNeeded computed below if they leave it blank.
    // (We can't reference `result` here yet — circular — so duplicate
    // the cheap calc inline.)
    const stopDistPct = entry > 0 ? Math.abs(entry - stop) / entry : 0;
    const computedLev = stopDistPct > 0 && account > 0
      ? ((account * riskPct) / 100 / stopDistPct) / account
      : 0;
    const lev = Number.isFinite(userLeverage) && userLeverage > 0 ? userLeverage : computedLev;
    if (!lev || lev <= 0 || entry <= 0) return null;
    // Sub-1x leverage means the user's collateral fully covers the
    // position — there is mathematically no liquidation price (or it's
    // negative/above the realistic price). Return a sentinel so the UI
    // can render "No liq risk" instead of a nonsense -$124k value.
    if (lev < 1) {
      return { leverageUsed: lev, liq: null, distPct: null, stopToLiqPct: null, noLiqRisk: true as const };
    }
    const liq = side === 'long'
      ? entry * (1 - 1 / lev + MAINT_MARGIN)
      : entry * (1 + 1 / lev - MAINT_MARGIN);
    // Distance from entry to liq, %
    const distPct = Math.abs(liq - entry) / entry;
    // Distance from stop to liq, % — negative means liq comes FIRST
    // (i.e. you'd liquidate before your stop fills, which is bad).
    const stopToLiqPct = side === 'long' ? (stop - liq) / entry : (liq - stop) / entry;
    return { leverageUsed: lev, liq, distPct: distPct * 100, stopToLiqPct: stopToLiqPct * 100, noLiqRisk: false as const };
  }, [side, entry, stop, account, riskPct, userLeverage]);

  const valid = account > 0 && riskPct > 0 && entry > 0 && stop > 0;

  const result = useMemo(() => {
    if (!valid) return null;
    // Risk amount in $
    const riskUsd = (account * riskPct) / 100;
    // Distance from entry to stop, in % of entry
    const stopDistPct = Math.abs(entry - stop) / entry;
    const stopDistAbs = Math.abs(entry - stop);

    // Validate side direction
    const directionValid = side === 'long' ? stop < entry : stop > entry;

    // Position size (USD notional): riskUsd / stopDistPct
    // i.e. if my stop is 2% away, I can put 50x the risk amount into the position
    const notional = stopDistPct > 0 ? riskUsd / stopDistPct : 0;
    const positionUnits = entry > 0 ? notional / entry : 0;
    const leverageNeeded = account > 0 ? notional / account : 0;

    // Risk/reward
    let rrRatio = 0;
    let targetMove = 0;
    let targetPnl = 0;
    if (target > 0) {
      targetMove = Math.abs(target - entry) / entry;
      targetPnl = notional * targetMove;
      rrRatio = stopDistPct > 0 ? targetMove / stopDistPct : 0;
    }

    // Breakeven fee move (0.05% taker both sides assumption)
    const feeBreakEvenPct = 0.1;  // 0.05% x 2

    return {
      riskUsd,
      stopDistPct: stopDistPct * 100,
      stopDistAbs,
      directionValid,
      notional,
      positionUnits,
      leverageNeeded,
      rrRatio,
      targetMove: targetMove * 100,
      targetPnl,
      feeBreakEvenPct,
    };
  }, [valid, side, account, riskPct, entry, stop, target]);

  // Kelly Criterion
  const kelly = useMemo(() => {
    if (!Number.isFinite(winRate) || !Number.isFinite(avgWin) || !Number.isFinite(avgLoss)) return null;
    if (winRate <= 0 || winRate >= 100 || avgWin <= 0 || avgLoss <= 0) return null;
    const w = winRate / 100;
    const b = avgWin / avgLoss;
    // Kelly % = W - ((1-W) / b)
    const kellyPct = w - (1 - w) / b;
    // Half Kelly is usually safer
    const halfKelly = kellyPct / 2;
    // Expected value per trade (as fraction of bankroll)
    const ev = w * avgWin - (1 - w) * avgLoss;
    return { kellyPct: kellyPct * 100, halfKelly: halfKelly * 100, ev };
  }, [winRate, avgWin, avgLoss]);

  const riskTier = result
    ? result.leverageNeeded > 20 ? 'extreme' : result.leverageNeeded > 10 ? 'high' : result.leverageNeeded > 3 ? 'moderate' : 'low'
    : 'low';
  const riskColor = riskTier === 'extreme' ? 'text-red-400' : riskTier === 'high' ? 'text-orange-400' : riskTier === 'moderate' ? 'text-yellow-400' : 'text-green-400';

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto w-full px-4 py-6">
        <PageHero
          icon={Ruler}
          eyebrow="Tools · pre-trade sizing"
          title="Position"
          accentNoun="sizer"
          accent="cyan"
          description={
            <>Given account size + risk tolerance + entry + stop, compute the
              exact position you should take. Plus R:R ratio, expected value,
              and Kelly sizing — the four numbers that decide whether a setup
              is actually worth taking.</>
          }
          actions={
            <Link
              href="/hl-whales"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-emerald-400/30 bg-emerald-500/[0.08] text-emerald-300 hover:bg-emerald-500/[0.14] transition-colors"
              title="Pick a whale position to mirror — sizing pre-fills here"
            >
              <Copy className="w-3.5 h-3.5" />
              Copying a whale? Start there
            </Link>
          }
          className="mb-4"
        />

        <div className="grid md:grid-cols-2 gap-4">
          {/* Core Inputs */}
          <div className="card-premium p-5 space-y-4">
            <div className="text-xs font-bold text-white uppercase tracking-wider">Trade setup</div>

            <div className="flex gap-2">
              <button
                onClick={() => setSide('long')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-colors ${
                  side === 'long' ? 'bg-green-400 text-black' : 'bg-white/[0.04] text-neutral-400 hover:text-white'
                }`}
              >
                Long
              </button>
              <button
                onClick={() => setSide('short')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-colors ${
                  side === 'short' ? 'bg-red-400 text-black' : 'bg-white/[0.04] text-neutral-400 hover:text-white'
                }`}
              >
                Short
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium block">Account size (USD)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={accountStr}
                  onChange={e => setAccountStr(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-teal-400/60"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium block">Risk % per trade</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={riskPctStr}
                  onChange={e => setRiskPctStr(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-teal-400/60"
                />
                <div className="flex gap-1 mt-1">
                  {['0.5', '1', '2', '3', '5'].map(r => (
                    <button
                      key={r}
                      onClick={() => setRiskPctStr(r)}
                      className="text-[10px] px-2 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] text-neutral-400 hover:text-white transition-colors"
                    >
                      {r}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium block">Entry price</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={entryStr}
                  onChange={e => setEntryStr(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-teal-400/60"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium block">Stop loss</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={stopStr}
                  onChange={e => setStopStr(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-teal-400/60"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium block">Take profit (optional, for R:R)</label>
              <input
                type="text"
                inputMode="decimal"
                value={targetStr}
                onChange={e => setTargetStr(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-teal-400/60"
              />
            </div>
          </div>

          {/* Results */}
          <div className="card-premium p-5">
            {!valid ? (
              <div className="flex items-center justify-center h-full text-neutral-500 text-sm">
                Enter account size, risk %, entry, and stop to compute.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-white uppercase tracking-wider">Sizing</div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/[0.04] ${riskColor}`}>
                    {riskTier} leverage
                  </span>
                </div>

                {!result!.directionValid && (
                  <div className="flex items-start gap-2 border border-yellow-400/30 bg-yellow-500/[0.04] rounded p-2.5">
                    <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div className="text-[11px] text-yellow-200">
                      Stop is on the wrong side of entry for a {side}. For a long, stop should be below entry; for a short, above.
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-0.5">Position size (USD notional)</div>
                  <div className="font-mono tabular-nums text-2xl font-bold text-teal-400">
                    <UsdDisplay amount={result!.notional} />
                  </div>
                  <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                    {result!.positionUnits.toFixed(6)} units · {result!.leverageNeeded.toFixed(1)}x leverage on ${account.toLocaleString()} account
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/[0.04] rounded p-3">
                    <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-0.5">Risk amount</div>
                    <div className="font-mono tabular-nums text-sm font-semibold text-red-400">
                      <UsdDisplay amount={result!.riskUsd} />
                    </div>
                    <div className="text-[10px] text-neutral-600 font-mono">worst case, at stop</div>
                  </div>
                  <div className="bg-white/[0.04] rounded p-3">
                    <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-0.5">Stop distance</div>
                    <div className="font-mono tabular-nums text-sm font-semibold text-white">
                      {result!.stopDistPct.toFixed(2)}%
                    </div>
                    <div className="text-[10px] text-neutral-600 font-mono">
                      <UsdDisplay amount={result!.stopDistAbs} /> per unit
                    </div>
                  </div>
                  {target > 0 && (
                    <>
                      <div className="bg-white/[0.04] rounded p-3">
                        <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-0.5">Take-profit target</div>
                        <div className={`font-mono tabular-nums text-sm font-semibold ${result!.rrRatio >= 2 ? 'text-green-400' : result!.rrRatio >= 1 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {result!.rrRatio.toFixed(2)}R
                        </div>
                        <div className="text-[10px] text-neutral-600 font-mono">reward / risk ratio</div>
                      </div>
                      <div className="bg-white/[0.04] rounded p-3">
                        <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-0.5">Target PnL</div>
                        <div className="font-mono tabular-nums text-sm font-semibold text-green-400">
                          +<UsdDisplay amount={result!.targetPnl} />
                        </div>
                        <div className="text-[10px] text-neutral-600 font-mono">if target hit</div>
                      </div>
                    </>
                  )}
                  {/* ─── Liquidation price preview ───
                      Estimates where you'd get liquidated given the
                      leverage you'd use for this trade (or the explicit
                      leverage override). Highlights amber if the stop
                      is dangerously close to liq, red if stop is BEYOND
                      liq (you'd get liquidated before your stop fills). */}
                  {liqPreview && liqPreview.noLiqRisk && (
                    <>
                      <div className="rounded p-3 col-span-2 border bg-green-500/[0.06] border-green-400/30">
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-[10px] uppercase tracking-wider text-neutral-500">Liquidation preview</div>
                          <div className="text-[10px] text-neutral-600 font-mono">
                            @ {liqPreview.leverageUsed.toFixed(2)}x · sub-1x
                          </div>
                        </div>
                        <div className="font-mono tabular-nums text-sm font-semibold text-green-400">
                          No liquidation risk
                        </div>
                        <div className="text-[10px] text-neutral-500 mt-1 leading-relaxed">
                          Your collateral fully covers this position at &lt; 1x leverage. You can lose money — but you can&apos;t be force-liquidated by the exchange. Stop loss is the only thing that closes you.
                        </div>
                      </div>
                      <div className="col-span-2 flex items-center gap-2">
                        <label className="text-[10px] uppercase tracking-wider text-neutral-500">Override leverage:</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="auto"
                          value={leverageStr}
                          onChange={e => setLeverageStr(e.target.value)}
                          className="w-20 bg-white/[0.04] border border-white/[0.1] rounded px-2 py-1 text-[11px] text-white font-mono focus:outline-none focus:border-teal-400/60"
                        />
                        <span className="text-[10px] text-neutral-600">x · try a number to preview with real leverage</span>
                      </div>
                    </>
                  )}
                  {liqPreview && !liqPreview.noLiqRisk && liqPreview.liq !== null && liqPreview.stopToLiqPct !== null && liqPreview.distPct !== null && (
                    <>
                      <div className={`rounded p-3 col-span-2 border ${
                        liqPreview.stopToLiqPct < 0 ? 'bg-red-500/[0.06] border-red-400/30'
                        : liqPreview.stopToLiqPct < 1 ? 'bg-amber-500/[0.06] border-amber-400/30'
                        : 'bg-white/[0.04] border-white/[0.06]'
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-[10px] uppercase tracking-wider text-neutral-500">Liquidation preview</div>
                          <div className="text-[10px] text-neutral-600 font-mono">
                            @ {liqPreview.leverageUsed.toFixed(1)}x · 0.5% maint
                          </div>
                        </div>
                        <div className="flex items-baseline gap-3">
                          <div className={`font-mono tabular-nums text-base font-bold ${
                            liqPreview.stopToLiqPct < 0 ? 'text-red-400'
                            : liqPreview.stopToLiqPct < 1 ? 'text-amber-300'
                            : 'text-white'
                          }`}>
                            <UsdDisplay amount={liqPreview.liq} />
                          </div>
                          <div className="text-[10px] text-neutral-500 font-mono">
                            {liqPreview.distPct.toFixed(2)}% from entry · stop is {liqPreview.stopToLiqPct >= 0 ? '+' : ''}{liqPreview.stopToLiqPct.toFixed(2)}% safer than liq
                          </div>
                        </div>
                        {liqPreview.stopToLiqPct < 0 && (
                          <div className="text-[10px] text-red-400 font-medium mt-1">
                            ⚠ Stop is BELOW liq — you'd liquidate before your stop fills. Either widen the stop or lower the leverage.
                          </div>
                        )}
                        {liqPreview.stopToLiqPct >= 0 && liqPreview.stopToLiqPct < 1 && (
                          <div className="text-[10px] text-amber-300 mt-1">
                            ⚠ Stop is &lt; 1% from liq. Slippage or wick could blow through both.
                          </div>
                        )}
                      </div>
                      {/* Optional leverage override */}
                      <div className="col-span-2 flex items-center gap-2">
                        <label className="text-[10px] uppercase tracking-wider text-neutral-500">Override leverage:</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="auto"
                          value={leverageStr}
                          onChange={e => setLeverageStr(e.target.value)}
                          className="w-20 bg-white/[0.04] border border-white/[0.1] rounded px-2 py-1 text-[11px] text-white font-mono focus:outline-none focus:border-teal-400/60"
                        />
                        <span className="text-[10px] text-neutral-600">x · blank = use computed leverage</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Coaching */}
                {result!.rrRatio > 0 && result!.rrRatio < 1.5 ? (
                  <div className="flex items-start gap-2 border border-red-400/30 bg-red-500/[0.04] rounded p-2.5">
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="text-[11px] text-red-200">
                      R:R under 1.5 is rough long-term. You need a &gt;60% win rate to profit. Either tighten stop, widen target, or skip.
                    </div>
                  </div>
                ) : result!.rrRatio >= 2 ? (
                  <div className="flex items-start gap-2 border border-green-400/30 bg-green-500/[0.04] rounded p-2.5">
                    <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                    <div className="text-[11px] text-green-200">
                      Favorable R:R. Even at 40% hit rate, setup is +EV long-term.
                    </div>
                  </div>
                ) : null}

                {result!.leverageNeeded > 20 && (
                  <div className="flex items-start gap-2 border border-red-400/30 bg-red-500/[0.04] rounded p-2.5">
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="text-[11px] text-red-200">
                      Leverage &gt; 20x. Either lower your risk %, tighten your account utilization, or trade a wider stop. Fees + funding will eat you alive.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Kelly Section */}
        <div className="mt-4 grid md:grid-cols-2 gap-4">
          <div className="card-premium p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-purple-400" />
              <div className="text-xs font-bold text-white uppercase tracking-wider">Kelly sizing (optional)</div>
            </div>
            <div className="text-[11px] text-neutral-500">
              For when you know your system&apos;s historical win rate + average win/loss. Kelly gives the mathematically-optimal bet size.
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium block">Win rate %</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={winRateStr}
                  onChange={e => setWinRateStr(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-purple-400/60"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium block">Avg win (R)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={avgWinStr}
                  onChange={e => setAvgWinStr(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-purple-400/60"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium block">Avg loss (R)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={avgLossStr}
                  onChange={e => setAvgLossStr(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-purple-400/60"
                />
              </div>
            </div>
          </div>

          <div className="card-premium p-5">
            {!kelly ? (
              <div className="flex items-center justify-center h-full text-neutral-500 text-sm">
                Fill win rate + avg win + avg loss.
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-0.5">Full Kelly</div>
                  <div className={`font-mono tabular-nums text-2xl font-bold ${kelly.kellyPct > 0 ? 'text-purple-400' : 'text-red-400'}`}>
                    {kelly.kellyPct.toFixed(2)}%
                  </div>
                  <div className="text-[10px] text-neutral-500 font-mono">
                    of bankroll per trade (full Kelly)
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/[0.04] rounded p-3">
                    <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-0.5">Half Kelly</div>
                    <div className="font-mono tabular-nums text-sm font-semibold text-white">
                      {kelly.halfKelly.toFixed(2)}%
                    </div>
                    <div className="text-[10px] text-neutral-600 font-mono">safer, most quants use this</div>
                  </div>
                  <div className="bg-white/[0.04] rounded p-3">
                    <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-0.5">Expected value</div>
                    <div className={`font-mono tabular-nums text-sm font-semibold ${kelly.ev > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {kelly.ev > 0 ? '+' : ''}{kelly.ev.toFixed(3)}R
                    </div>
                    <div className="text-[10px] text-neutral-600 font-mono">per trade</div>
                  </div>
                </div>
                {kelly.kellyPct <= 0 && (
                  <div className="flex items-start gap-2 border border-red-400/30 bg-red-500/[0.04] rounded p-2.5">
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="text-[11px] text-red-200">
                      Negative Kelly. Your edge is zero or losing. Don&apos;t size this up, fix the system first.
                    </div>
                  </div>
                )}
                {kelly.kellyPct > 25 && (
                  <div className="flex items-start gap-2 border border-yellow-400/30 bg-yellow-500/[0.04] rounded p-2.5">
                    <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div className="text-[11px] text-yellow-200">
                      Kelly over 25% usually means overfit stats. Backtest on more data before sizing this aggressively. Half Kelly is the conservative floor.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed flex items-start gap-2">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-neutral-300">Formula:</strong> Position notional = (account × risk%) / stop-distance%. So a $10k account risking 1% with a 2% stop puts $5k notional on the table.
            <strong className="text-neutral-300"> Kelly:</strong> f = p − (1 − p)/b, where p is win rate and b is win/loss ratio. Most practitioners use half Kelly because real-world distributions have fatter losing tails than assumed.
            Fees + funding not included.
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
