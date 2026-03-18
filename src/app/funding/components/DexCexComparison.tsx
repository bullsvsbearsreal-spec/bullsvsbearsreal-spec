'use client';

import { useMemo } from 'react';

interface DexCexComparisonProps {
  fundingRates: Array<{
    symbol: string;
    exchange: string;
    rate: number; // already period-normalized
  }>;
  dexExchanges: ReadonlySet<string>;
}

interface SymbolDivergence {
  symbol: string;
  cexAvg: number;
  dexAvg: number;
  spread: number;
}

export default function DexCexComparison({ fundingRates, dexExchanges }: DexCexComparisonProps) {
  const { cexAvg, dexAvg, divergence, topDivergences, dexCount } = useMemo(() => {
    if (fundingRates.length === 0) {
      return { cexAvg: 0, dexAvg: 0, divergence: 0, topDivergences: [], dexCount: 0 };
    }

    // Separate rates by venue type
    let cexSum = 0, cexCount = 0;
    let dexSum = 0, dxCount = 0;

    // Per-symbol accumulation for divergence calculation
    const symbolCex = new Map<string, { sum: number; count: number }>();
    const symbolDex = new Map<string, { sum: number; count: number }>();

    const activeDexes = new Set<string>();

    for (const fr of fundingRates) {
      const isDex = dexExchanges.has(fr.exchange);
      if (isDex) {
        dexSum += fr.rate;
        dxCount++;
        activeDexes.add(fr.exchange);
        const entry = symbolDex.get(fr.symbol);
        if (entry) { entry.sum += fr.rate; entry.count++; }
        else symbolDex.set(fr.symbol, { sum: fr.rate, count: 1 });
      } else {
        cexSum += fr.rate;
        cexCount++;
        const entry = symbolCex.get(fr.symbol);
        if (entry) { entry.sum += fr.rate; entry.count++; }
        else symbolCex.set(fr.symbol, { sum: fr.rate, count: 1 });
      }
    }

    const cAvg = cexCount > 0 ? cexSum / cexCount : 0;
    const dAvg = dxCount > 0 ? dexSum / dxCount : 0;
    const div = dAvg - cAvg;

    // Find symbols present on BOTH DEX and CEX, compute per-symbol divergence
    const divergences: SymbolDivergence[] = [];
    symbolDex.forEach((dexEntry, symbol) => {
      const cexEntry = symbolCex.get(symbol);
      if (!cexEntry) return;
      const cAvgSym = cexEntry.sum / cexEntry.count;
      const dAvgSym = dexEntry.sum / dexEntry.count;
      divergences.push({
        symbol,
        cexAvg: cAvgSym,
        dexAvg: dAvgSym,
        spread: Math.abs(dAvgSym - cAvgSym),
      });
    });

    divergences.sort((a, b) => b.spread - a.spread);

    return {
      cexAvg: cAvg,
      dexAvg: dAvg,
      divergence: div,
      topDivergences: divergences.slice(0, 3),
      dexCount: activeDexes.size,
    };
  }, [fundingRates, dexExchanges]);

  if (fundingRates.length === 0) return null;

  const formatRate = (rate: number) => {
    const abs = Math.abs(rate);
    const decimals = abs >= 10 ? 2 : abs >= 1 ? 3 : 4;
    return rate >= 0 ? `+${rate.toFixed(decimals)}%` : `${rate.toFixed(decimals)}%`;
  };

  const rateColorClass = (rate: number) =>
    rate > 0 ? 'text-emerald-400' : rate < 0 ? 'text-rose-400' : 'text-neutral-400';

  // Divergence bar: clamp to [-0.1, 0.1] for display
  const barMax = 0.1;
  const clampedDiv = Math.max(-barMax, Math.min(barMax, divergence));
  const barPct = Math.abs(clampedDiv) / barMax * 50; // 50% = full one side

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
          DEX vs CEX Funding
        </span>
        <span className="text-[9px] font-bold text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded-full ring-1 ring-purple-500/20">
          {dexCount > 0 ? dexCount : dexExchanges.size} DEX
        </span>
      </div>

      {/* CEX / DEX averages side by side */}
      <div className="flex items-start gap-6 mb-3">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider mb-0.5">CEX Avg</div>
          <div className={`text-xl font-bold font-mono tracking-tight ${rateColorClass(cexAvg)}`}>
            {formatRate(cexAvg)}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-medium text-purple-400/70 uppercase tracking-wider mb-0.5">DEX Avg</div>
          <div className={`text-xl font-bold font-mono tracking-tight ${rateColorClass(dexAvg)}`}>
            {formatRate(dexAvg)}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider mb-0.5">Divergence</div>
          <div className={`text-xl font-bold font-mono tracking-tight ${rateColorClass(divergence)}`}>
            {formatRate(divergence)}
          </div>
        </div>
      </div>

      {/* Divergence bar */}
      <div className="relative h-1.5 rounded-full bg-white/[0.04] overflow-hidden mb-3">
        {/* Center line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/[0.1]" />
        {/* Bar */}
        {divergence !== 0 && (
          <div
            className={`absolute top-0 bottom-0 rounded-full ${divergence > 0 ? 'bg-emerald-500/70' : 'bg-rose-500/70'}`}
            style={
              divergence > 0
                ? { left: '50%', width: `${barPct}%` }
                : { right: '50%', width: `${barPct}%` }
            }
          />
        )}
      </div>

      {/* Top divergences */}
      {topDivergences.length > 0 && (
        <div className="space-y-1">
          {topDivergences.map((d) => (
            <div key={d.symbol} className="flex items-center gap-2 text-[11px]">
              <span className="text-white font-semibold w-14 truncate">{d.symbol}</span>
              <span className="text-neutral-500 w-16 text-right font-mono">
                <span className="text-neutral-600 text-[9px] mr-1">CEX</span>
                <span className={rateColorClass(d.cexAvg)}>{formatRate(d.cexAvg)}</span>
              </span>
              <span className="text-neutral-500 w-16 text-right font-mono">
                <span className="text-purple-400/50 text-[9px] mr-1">DEX</span>
                <span className={rateColorClass(d.dexAvg)}>{formatRate(d.dexAvg)}</span>
              </span>
              <span className="text-hub-yellow font-mono font-bold ml-auto">
                {d.spread.toFixed(4)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
