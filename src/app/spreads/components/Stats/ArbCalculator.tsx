'use client';

import { memo, useMemo } from 'react';
import { Calculator, X, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { fp } from '../../lib/spread-math';
import type { SpreadStats } from '../../lib/types';

interface ArbCalculatorProps {
  stats: SpreadStats | null;
  calcAmt: string;
  calcFee: string;
  calcMode: 'usd' | 'coin';
  onAmtChange: (v: string) => void;
  onFeeChange: (v: string) => void;
  onModeChange: (m: 'usd' | 'coin') => void;
  onClose: () => void;
  variant?: 'inline' | 'sidebar';
}

function ArbCalculatorInner({ stats, calcAmt, calcFee, calcMode, onAmtChange, onFeeChange, onModeChange, onClose, variant = 'inline' }: ArbCalculatorProps) {
  const calc = useMemo(() => {
    if (!stats || !stats.hi || !stats.lo) return null;
    const amt = Number(calcAmt) || 0;
    const feePct = Number(calcFee) || 0;
    const spread = stats.cur;
    const midPrice = (stats.hi.p + stats.lo.p) / 2;
    const qty = calcMode === 'usd' ? amt / midPrice : amt;
    const notional = qty * midPrice;
    const gross = qty * spread;
    const totalFees = notional * (feePct / 100) * 2;
    const net = gross - totalFees;
    const roi = notional > 0 ? (net / notional) * 100 : 0;
    // Break-even: minimum spread % needed to cover fees
    const breakEvenPct = (feePct * 2);
    return { gross, totalFees, net, roi, qty, notional, breakEvenPct };
  }, [stats, calcAmt, calcFee, calcMode]);

  if (!stats) return null;

  const isProfit = calc ? calc.net >= 0 : false;
  const isSidebar = variant === 'sidebar';

  // Shared input field style
  const inputCls = 'w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white text-sm font-mono outline-none focus:border-hub-yellow/30 transition-colors';

  if (isSidebar) {
    return (
      <>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-hub-yellow/10 flex items-center justify-center">
            <Calculator className="w-3.5 h-3.5 text-hub-yellow" />
          </div>
          <div>
            <h3 className="text-sm font-semibold leading-tight">Arb Calculator</h3>
            <p className="text-[10px] text-neutral-600 leading-tight">Cross-exchange arbitrage estimator</p>
          </div>
        </div>

        {/* Route display */}
        {stats.hi && stats.lo && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
            <span className="text-[11px] text-green-400 font-medium truncate">{stats.lo.e}</span>
            <ArrowRight className="w-3 h-3 text-neutral-600 flex-shrink-0" />
            <span className="text-[11px] text-red-400 font-medium truncate">{stats.hi.e}</span>
            <span className="ml-auto text-[10px] text-neutral-500 tabular-nums">{stats.pct.toFixed(3)}%</span>
          </div>
        )}

        <div className="space-y-3">
          {/* Trade size */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] text-neutral-500">Trade size</label>
              <div className="flex items-center gap-[2px] p-[2px] rounded-md bg-white/[0.03] border border-white/[0.06]">
                <button onClick={() => onModeChange('usd')}
                  className={`px-2 py-0.5 rounded text-[9px] font-semibold transition ${calcMode === 'usd' ? 'bg-hub-yellow/15 text-hub-yellow' : 'text-neutral-600 hover:text-neutral-400'}`}>USD</button>
                <button onClick={() => onModeChange('coin')}
                  className={`px-2 py-0.5 rounded text-[9px] font-semibold transition ${calcMode === 'coin' ? 'bg-hub-yellow/15 text-hub-yellow' : 'text-neutral-600 hover:text-neutral-400'}`}>Coins</button>
              </div>
            </div>
            <div className="relative">
              <input value={calcAmt} onChange={e => onAmtChange(e.target.value)} type="number" aria-label="Position size"
                className={inputCls} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-neutral-600">{calcMode === 'usd' ? 'USD' : 'coins'}</span>
            </div>
            {/* Quick amounts */}
            <div className="flex gap-1 mt-1.5">
              {(calcMode === 'usd' ? ['1000', '5000', '10000', '50000'] : ['0.1', '1', '10', '100']).map(v => (
                <button key={v} onClick={() => onAmtChange(v)}
                  className={`flex-1 py-1 rounded text-[9px] font-medium transition ${
                    calcAmt === v ? 'bg-hub-yellow/10 text-hub-yellow' : 'bg-white/[0.03] text-neutral-600 hover:text-neutral-400'
                  }`}>
                  {calcMode === 'usd' ? `$${Number(v).toLocaleString()}` : v}
                </button>
              ))}
            </div>
          </div>

          {/* Fee */}
          <div>
            <label className="text-[11px] text-neutral-500 block mb-1.5">Fee per side (%)</label>
            <div className="relative">
              <input value={calcFee} onChange={e => onFeeChange(e.target.value)} type="number" step="0.01"
                className={inputCls} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-neutral-600">%</span>
            </div>
            {/* Common fee presets */}
            <div className="flex gap-1 mt-1.5">
              {['0.02', '0.05', '0.1', '0.15'].map(v => (
                <button key={v} onClick={() => onFeeChange(v)}
                  className={`flex-1 py-1 rounded text-[9px] font-medium transition ${
                    calcFee === v ? 'bg-hub-yellow/10 text-hub-yellow' : 'bg-white/[0.03] text-neutral-600 hover:text-neutral-400'
                  }`}>
                  {v}%
                </button>
              ))}
            </div>
          </div>

          {/* Result */}
          {!calc && stats && (
            <div className="p-3 rounded-xl border border-white/[0.04] bg-white/[0.01] text-center">
              <p className="text-[10px] text-neutral-600">Need 2+ exchanges with price data to calculate arbitrage</p>
            </div>
          )}
          {calc && (
            <div className={`p-3.5 rounded-xl border ${isProfit
              ? 'bg-green-500/[0.04] border-green-500/10'
              : 'bg-red-500/[0.04] border-red-500/10'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {isProfit
                  ? <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                  : <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                }
                <span className="text-[10px] text-neutral-500">{isProfit ? 'Estimated profit' : 'Estimated loss'}</span>
              </div>
              <p className={`text-2xl font-bold font-mono leading-tight ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                {calc.net >= 0 ? '+' : '-'}${fp(Math.abs(calc.net))}
              </p>
              <p className={`text-xs font-mono mt-0.5 ${isProfit ? 'text-green-400/60' : 'text-red-400/60'}`}>
                {calc.roi >= 0 ? '+' : ''}{calc.roi.toFixed(3)}% ROI
              </p>

              <div className="mt-3 pt-2.5 border-t border-white/[0.04] space-y-1.5">
                <div className="flex justify-between text-[10px]">
                  <span className="text-neutral-500">Gross profit</span>
                  <span className="font-mono text-green-400/80">${fp(calc.gross)}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-neutral-500">Total fees (2x)</span>
                  <span className="font-mono text-red-400/80">-${fp(calc.totalFees)}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-neutral-500">Break-even spread</span>
                  <span className="font-mono text-neutral-400">{calc.breakEvenPct.toFixed(3)}%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  // Inline variant (collapsible top bar)
  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4 mb-5" data-testid="arb-calculator">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-hub-yellow" />
          <span className="text-sm font-semibold">Arb Calculator</span>
          {stats.hi && stats.lo && (
            <span className="text-[10px] text-neutral-500 ml-2">
              {stats.lo.e} <ArrowRight className="w-2.5 h-2.5 inline" /> {stats.hi.e}
            </span>
          )}
        </div>
        <button onClick={onClose} aria-label="Close calculator" className="text-neutral-500 hover:text-white"><X className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="text-[10px] text-neutral-500 block mb-1">Amount ({calcMode === 'usd' ? 'USD' : 'Coins'})</label>
          <input value={calcAmt} onChange={e => onAmtChange(e.target.value)} type="number"
            className="w-full px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-white outline-none focus:border-hub-yellow/30" />
        </div>
        <div>
          <label className="text-[10px] text-neutral-500 block mb-1">Fee per side (%)</label>
          <input value={calcFee} onChange={e => onFeeChange(e.target.value)} type="number" step="0.01"
            className="w-full px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-white outline-none focus:border-hub-yellow/30" />
        </div>
        <div>
          <label className="text-[10px] text-neutral-500 block mb-1">Mode</label>
          <div className="flex rounded-lg overflow-hidden border border-white/[0.08]">
            <button onClick={() => onModeChange('usd')}
              className={`flex-1 px-2 py-1.5 text-[10px] font-bold ${calcMode === 'usd' ? 'bg-hub-yellow/20 text-hub-yellow' : 'text-neutral-500'}`}>USD</button>
            <button onClick={() => onModeChange('coin')}
              className={`flex-1 px-2 py-1.5 text-[10px] font-bold border-l border-white/[0.06] ${calcMode === 'coin' ? 'bg-hub-yellow/20 text-hub-yellow' : 'text-neutral-500'}`}>Coins</button>
          </div>
        </div>
        {calc && (
          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-neutral-500">Gross</span>
              <span className="font-mono text-green-400">${fp(calc.gross)}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-neutral-500">Fees</span>
              <span className="font-mono text-red-400">-${fp(calc.totalFees)}</span>
            </div>
            <div className="flex justify-between text-[10px] border-t border-white/[0.06] pt-1">
              <span className="text-neutral-400 font-medium">Net P&L</span>
              <span className={`font-mono font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                {calc.net >= 0 ? '+' : ''}${fp(calc.net)} ({calc.roi.toFixed(2)}%)
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const ArbCalculator = memo(ArbCalculatorInner);
