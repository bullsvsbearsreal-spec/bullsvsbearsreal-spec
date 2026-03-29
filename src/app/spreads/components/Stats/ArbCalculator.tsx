'use client';

import { memo, useMemo } from 'react';
import { Calculator, X } from 'lucide-react';
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
  /** 'inline' = collapsible top bar, 'sidebar' = compact vertical layout */
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
    const totalFees = notional * (feePct / 100) * 2; // buy + sell
    const net = gross - totalFees;
    const roi = notional > 0 ? (net / notional) * 100 : 0;
    return { gross, totalFees, net, roi, qty, notional };
  }, [stats, calcAmt, calcFee, calcMode]);

  if (!stats) return null;

  const isSidebar = variant === 'sidebar';

  const resultBlock = calc && (
    <div className={`space-y-1 ${isSidebar ? 'p-4 rounded-xl ' + (calc.net >= 0 ? 'bg-green-500/[0.05] border border-green-500/10' : 'bg-red-500/[0.05] border border-red-500/10') : ''}`}>
      {isSidebar && <p className="text-[11px] text-neutral-500 mb-1">Estimated net profit</p>}
      {isSidebar && (
        <p className={`text-2xl font-bold font-mono ${calc.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {calc.net >= 0 ? '+' : '-'}${fp(Math.abs(calc.net))}
        </p>
      )}
      <div className="flex justify-between text-[10px]">
        <span className="text-neutral-500">Gross</span>
        <span className="font-mono text-green-400">${fp(calc.gross)}</span>
      </div>
      <div className="flex justify-between text-[10px]">
        <span className="text-neutral-500">Fees</span>
        <span className="font-mono text-red-400">-${fp(calc.totalFees)}</span>
      </div>
      {!isSidebar && (
        <div className="flex justify-between text-[10px] border-t border-white/[0.06] pt-1">
          <span className="text-neutral-400 font-medium">Net P&L</span>
          <span className={`font-mono font-bold ${calc.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {calc.net >= 0 ? '+' : ''}${fp(calc.net)} ({calc.roi.toFixed(2)}%)
          </span>
        </div>
      )}
      {isSidebar && stats && (
        <p className="text-[11px] text-neutral-500 mt-1">
          Gross {stats.pct.toFixed(3)}% − fees {((Number(calcFee) || 0) * 2).toFixed(2)}% = net {calc.roi.toFixed(3)}%
        </p>
      )}
    </div>
  );

  if (isSidebar) {
    return (
      <>
        <h3 className="text-sm font-semibold mb-1">Arb Calculator</h3>
        <p className="text-[11px] text-neutral-500 mb-4">Estimate net profit from cross-exchange arbitrage</p>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] text-neutral-500">Trade size</label>
              <div className="flex items-center gap-[2px] p-[2px] rounded-md bg-white/[0.03] border border-white/[0.06]">
                <button onClick={() => onModeChange('usd')}
                  className={`px-2 py-0.5 rounded text-[9px] font-semibold transition ${calcMode === 'usd' ? 'bg-hub-yellow/15 text-hub-yellow' : 'text-neutral-600'}`}>USD</button>
                <button onClick={() => onModeChange('coin')}
                  className={`px-2 py-0.5 rounded text-[9px] font-semibold transition ${calcMode === 'coin' ? 'bg-hub-yellow/15 text-hub-yellow' : 'text-neutral-600'}`}>Coins</button>
              </div>
            </div>
            <div className="relative">
              <input value={calcAmt} onChange={e => onAmtChange(e.target.value)} type="number" aria-label="Position size"
                className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm font-mono outline-none focus:border-hub-yellow/30" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-neutral-600">{calcMode === 'usd' ? 'USD' : 'Coins'}</span>
            </div>
          </div>
          <div>
            <label className="text-[11px] text-neutral-500 block mb-1">Fee per side (%)</label>
            <input value={calcFee} onChange={e => onFeeChange(e.target.value)} type="number" step="0.01"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm font-mono outline-none focus:border-hub-yellow/30" />
          </div>
          {resultBlock}
        </div>
      </>
    );
  }

  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4 mb-5" data-testid="arb-calculator">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-hub-yellow" />
          <span className="text-sm font-semibold">Arb Calculator</span>
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
        {resultBlock}
      </div>
    </div>
  );
}

export const ArbCalculator = memo(ArbCalculatorInner);
