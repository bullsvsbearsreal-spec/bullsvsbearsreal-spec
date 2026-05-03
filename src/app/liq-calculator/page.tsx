'use client';

import { useState, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import UsdDisplay from '@/components/UsdDisplay';
import { Calculator, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';

type Side = 'long' | 'short';
type MarginMode = 'isolated' | 'cross';

function toNum(v: string): number {
  const n = parseFloat(v.replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Liquidation price for a linear perp (USDT/USDC margined):
 *   long  liq  = entry * (1 - 1/leverage + maintMargin)
 *   short liq  = entry * (1 + 1/leverage - maintMargin)
 * This matches Binance/Bybit style maint-margin math to first order.
 * maintMargin is fractional (e.g. 0.005 = 0.5%).
 */
function liqPrice(side: Side, entry: number, leverage: number, maintMargin: number): number {
  if (!entry || !leverage) return 0;
  const im = 1 / leverage;
  if (side === 'long')  return entry * (1 - im + maintMargin);
  return entry * (1 + im - maintMargin);
}

/** Position size in base asset given margin + leverage + entry. */
function positionSize(margin: number, leverage: number, entry: number): number {
  if (!entry) return 0;
  return (margin * leverage) / entry;
}

export default function LiqCalculatorPage() {
  const [side, setSide] = useState<Side>('long');
  const [mode, setMode] = useState<MarginMode>('isolated');
  const [entryStr, setEntryStr] = useState('75000');
  const [leverageStr, setLeverageStr] = useState('10');
  const [marginStr, setMarginStr] = useState('1000');
  const [maintMarginStr, setMaintMarginStr] = useState('0.5'); // percent

  const entry = toNum(entryStr);
  const leverage = toNum(leverageStr);
  const margin = toNum(marginStr);
  const maintPct = toNum(maintMarginStr);
  const maintMargin = Number.isFinite(maintPct) ? maintPct / 100 : 0;

  const valid = entry > 0 && leverage > 0 && margin > 0;

  const result = useMemo(() => {
    if (!valid) return null;
    const size = positionSize(margin, leverage, entry);
    const notional = margin * leverage;
    const liq = liqPrice(side, entry, leverage, maintMargin);
    const distPct = entry > 0 ? ((liq - entry) / entry) * 100 : 0;

    // Fractional price move to liquidation (as absolute percent, unsigned).
    const distToLiqPct = Math.abs(distPct);

    // Breakeven assuming 0.05% taker both sides on entry + exit.
    const feeRate = 0.0005;
    const roundTripFeeUsd = notional * feeRate * 2;
    const feeBeMove = (roundTripFeeUsd / notional) * 100; // percent of notional
    const breakevenPrice = side === 'long' ? entry * (1 + feeRate * 2) : entry * (1 - feeRate * 2);

    // ROE at a few scenarios
    const scenarios = [1, 2, 5, 10].map(pct => {
      const move = side === 'long' ? pct : -pct;
      const pnl = notional * (move / 100);
      const roe = (pnl / margin) * 100;
      return { movePct: pct, pnl, roe };
    });

    return {
      size,
      notional,
      liq,
      distToLiqPct,
      breakevenPrice,
      feeBeMove,
      scenarios,
    };
  }, [side, entry, leverage, margin, maintMargin, valid]);

  // Risk tier color
  const riskLabel = leverage >= 50 ? 'extreme' : leverage >= 20 ? 'high' : leverage >= 10 ? 'moderate' : 'low';
  const riskColor = leverage >= 50 ? 'text-red-400' : leverage >= 20 ? 'text-orange-400' : leverage >= 10 ? 'text-yellow-400' : 'text-green-400';

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto w-full px-4 py-6">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="w-7 h-7 rounded-md bg-cyan-500/10 flex items-center justify-center">
              <Calculator className="w-4 h-4 text-cyan-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Liquidation Calculator</h1>
          </div>
          <p className="text-sm text-neutral-500">
            Linear perp liquidation price, breakeven, and PnL scenarios. Sized on your initial margin + leverage. Works for USDT/USDC-margined BTC, ETH, alts.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Inputs */}
          <div className="card-premium p-5 space-y-4">
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

            <div>
              <label className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium block">Entry price (USD)</label>
              <input
                type="text"
                inputMode="decimal"
                value={entryStr}
                onChange={e => setEntryStr(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-hub-yellow/60"
                placeholder="75000"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium block">Leverage</label>
              <input
                type="text"
                inputMode="decimal"
                value={leverageStr}
                onChange={e => setLeverageStr(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-hub-yellow/60"
                placeholder="10"
              />
              <div className="flex gap-1 mt-2">
                {[1, 3, 5, 10, 20, 50, 100].map(x => (
                  <button
                    key={x}
                    onClick={() => setLeverageStr(String(x))}
                    className="text-[10px] px-2 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] text-neutral-400 hover:text-white transition-colors"
                  >
                    {x}x
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium block">Initial margin (USD)</label>
              <input
                type="text"
                inputMode="decimal"
                value={marginStr}
                onChange={e => setMarginStr(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-hub-yellow/60"
                placeholder="1000"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium block">Maintenance margin %</label>
              <input
                type="text"
                inputMode="decimal"
                value={maintMarginStr}
                onChange={e => setMaintMarginStr(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-hub-yellow/60"
                placeholder="0.5"
              />
              <div className="text-[10px] text-neutral-600 mt-1 font-mono">
                BTC ~ 0.4%, ETH ~ 0.5%, alts 1-5%. Check your exchange&apos;s tier.
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium block">Margin mode</label>
              <div className="flex gap-1 bg-white/[0.03] rounded-lg p-0.5">
                {(['isolated', 'cross'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`flex-1 px-3 py-1.5 rounded text-xs font-semibold uppercase transition-colors ${
                      mode === m ? 'bg-hub-yellow text-black' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-neutral-600 mt-1 font-mono">
                Cross mode shares balance with other positions, liquidation can use your full wallet. This calc assumes isolated behaviour.
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="card-premium p-5">
            {!valid ? (
              <div className="flex items-center justify-center h-full text-neutral-500 text-sm">
                Enter entry price, leverage, and margin to compute.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-white uppercase tracking-wider">Result</div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/[0.04] ${riskColor}`}>
                    {riskLabel} risk
                  </span>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-0.5">Liquidation price</div>
                  <div className={`font-mono tabular-nums text-2xl font-bold ${side === 'long' ? 'text-red-400' : 'text-green-400'}`}>
                    <UsdDisplay amount={result!.liq} />
                  </div>
                  <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                    {result!.distToLiqPct.toFixed(2)}% {side === 'long' ? 'below' : 'above'} entry
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/[0.04] rounded p-3">
                    <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-0.5">Position size</div>
                    <div className="font-mono tabular-nums text-sm font-semibold text-white">
                      {result!.size.toFixed(6)}
                    </div>
                    <div className="text-[10px] text-neutral-600 font-mono">base asset</div>
                  </div>
                  <div className="bg-white/[0.04] rounded p-3">
                    <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-0.5">Notional</div>
                    <div className="font-mono tabular-nums text-sm font-semibold text-white">
                      <UsdDisplay amount={result!.notional} />
                    </div>
                  </div>
                  <div className="bg-white/[0.04] rounded p-3">
                    <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-0.5">Breakeven price</div>
                    <div className="font-mono tabular-nums text-sm font-semibold text-white">
                      <UsdDisplay amount={result!.breakevenPrice} />
                    </div>
                    <div className="text-[10px] text-neutral-600 font-mono">assumes 0.05% taker both sides</div>
                  </div>
                  <div className="bg-white/[0.04] rounded p-3">
                    <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-0.5">Fee breakeven move</div>
                    <div className="font-mono tabular-nums text-sm font-semibold text-white">
                      {result!.feeBeMove.toFixed(3)}%
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">ROE scenarios</div>
                  <div className="space-y-1">
                    {result!.scenarios.map(s => (
                      <div key={s.movePct} className="grid grid-cols-[80px,1fr,1fr] gap-2 text-xs items-center">
                        <div className="text-neutral-400 font-mono">
                          {side === 'long' ? '+' : '-'}{s.movePct}%
                        </div>
                        <div className={`font-mono tabular-nums ${s.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {s.pnl >= 0 ? '+' : ''}<UsdDisplay amount={s.pnl} />
                        </div>
                        <div className={`font-mono tabular-nums text-right ${s.roe >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {s.roe >= 0 ? '+' : ''}{s.roe.toFixed(1)}% ROE
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {leverage >= 50 ? (
                  <div className="flex items-start gap-2 border border-red-400/30 bg-red-500/[0.04] rounded p-2.5">
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="text-[11px] text-red-200">
                      <span className="font-semibold">Extreme leverage.</span> A {result!.distToLiqPct.toFixed(1)}% move {side === 'long' ? 'down' : 'up'} wipes you out. Funding + fees alone can bleed the position before price moves.
                    </div>
                  </div>
                ) : result!.distToLiqPct < 3 ? (
                  <div className="flex items-start gap-2 border border-yellow-400/30 bg-yellow-500/[0.04] rounded p-2.5">
                    <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div className="text-[11px] text-yellow-200">
                      Thin buffer. Normal intraday volatility is often larger than {result!.distToLiqPct.toFixed(1)}%.
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 border border-green-400/30 bg-green-500/[0.04] rounded p-2.5">
                    <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                    <div className="text-[11px] text-green-200">
                      Healthy buffer to liquidation. Still size to your risk tolerance, not the calculator.
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
            <strong className="text-neutral-300">Notes:</strong> Math is first-order for linear USDT/USDC perps. Real exchanges use tiered maintenance margin (MM grows with position size).
            Cross-margin behaviour is more generous than this calc assumes because it shares balance with other open positions.
            Funding cost is not included.
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
