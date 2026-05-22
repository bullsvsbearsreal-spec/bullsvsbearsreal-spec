'use client';

import { FundingRateData } from '@/lib/api/types';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { getExchangeReferralUrl } from '@/lib/referralLinks';
import { formatRateAdaptive, getRateColor, type FundingPeriod, periodMultiplier, PERIOD_LABELS } from '../utils';
import { Activity, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { useFlash } from '@/hooks/useFlash';

interface FundingStatsProps {
  fundingRates: FundingRateData[];
  avgRate: number;
  highestRate: FundingRateData | null;
  lowestRate: FundingRateData | null;
  fundingPeriod: FundingPeriod;
}

/** Trader slang for extreme funding */
function getFundingSlang(rate: number, type: 'highest' | 'lowest'): string | null {
  const abs = Math.abs(rate);
  if (abs < 0.05) return null;
  if (type === 'highest') {
    if (abs >= 0.5) return 'Funding printing money';
    if (abs >= 0.1) return 'Longs paying heavy premium';
    return 'Bullish pressure building';
  } else {
    if (abs >= 0.5) return 'Funding apocalypse';
    if (abs >= 0.1) return 'Shorts paying through the nose';
    return 'Bears squeezing hard';
  }
}

export default function FundingStats({ fundingRates, avgRate, highestRate, lowestRate, fundingPeriod }: FundingStatsProps) {
  const normDisplay = (fr: FundingRateData) => fr.fundingRate * periodMultiplier(fr.fundingInterval, fundingPeriod, fr.fundingIntervalHours);
  const periodLabel = PERIOD_LABELS[fundingPeriod];

  // Compute top 4 highest and top 5 lowest
  const sorted = [...fundingRates].sort((a, b) => normDisplay(b) - normDisplay(a));
  const top4Highest = sorted.slice(0, 4);
  const top5Lowest = sorted.slice(-5).reverse(); // lowest first

  const highestNorm = highestRate ? normDisplay(highestRate) : 0;
  const lowestNorm = lowestRate ? normDisplay(lowestRate) : 0;
  const highSlang = getFundingSlang(highestNorm, 'highest');
  const lowSlang = getFundingSlang(lowestNorm, 'lowest');
  const highFlash = useFlash(highestNorm);
  const lowFlash = useFlash(lowestNorm);
  const avgFlash = useFlash(avgRate);

  return (
    <div className="space-y-2.5 mb-5">
      {/* Top row: Pairs, Avg Rate, Highest, Lowest */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* Pairs */}
        <div className="relative group rounded-xl overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(255,165,0,0.06) 0%, var(--hub-darker) 60%)', border: '1px solid rgba(255,165,0,0.1)' }}>
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'radial-gradient(circle at 30% 30%, rgba(255,165,0,0.08), transparent 70%)' }} />
          <div className="relative px-4 py-3.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-neutral-500 text-[10px] font-semibold uppercase tracking-[0.1em]">Pairs</span>
              <BarChart3 className="w-3.5 h-3.5 text-hub-yellow/40" />
            </div>
            <div className="text-2xl font-black text-white font-mono tracking-tight">{fundingRates.length.toLocaleString()}</div>
            <span className="text-neutral-600 text-[9px] mt-1 block" title="Count of exchange × symbol combinations, not unique symbols">Exchange-pair combos</span>
          </div>
        </div>

        {/* Avg Rate */}
        <div className="relative group rounded-xl overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, var(--hub-darker) 60%)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.04), transparent 70%)' }} />
          <div className="relative px-4 py-3.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-neutral-500 text-[10px] font-semibold uppercase tracking-[0.1em]">Avg Rate /{periodLabel}</span>
              <Activity className="w-3.5 h-3.5 text-neutral-600" />
            </div>
            <div className={`text-2xl font-black font-mono tracking-tight ${getRateColor(avgRate)} ${avgFlash}`}>
              {formatRateAdaptive(avgRate)}
            </div>
            <span className="text-neutral-600 text-[9px] mt-1 block" title="Simple average across all exchange-pair combos — not weighted by open interest">Unweighted avg · all pairs</span>
          </div>
        </div>

        {/* Highest */}
        <div className="relative group rounded-xl overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, var(--hub-darker) 60%)', border: '1px solid rgba(16,185,129,0.12)' }}>
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'radial-gradient(circle at 30% 30%, rgba(16,185,129,0.1), transparent 70%)' }} />
          <div className="relative px-4 py-3.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-emerald-500/60 text-[10px] font-semibold uppercase tracking-[0.1em]">Highest /{periodLabel}</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500/40" />
            </div>
            {highestRate && (
              <>
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-black font-mono tracking-tight ${
                    Math.abs(highestNorm) >= 0.1 ? 'text-pump-hot' : 'text-emerald-400'
                  } ${highFlash}`} style={Math.abs(highestNorm) >= 0.1 ? { textShadow: '0 0 6px rgba(0, 230, 118, 0.3)' } : undefined}>
                    {formatRateAdaptive(highestNorm)}
                  </span>
                  <span className="text-emerald-400/50 text-[11px] font-medium">{highestRate.symbol}</span>
                  <ExchangeLogo exchange={highestRate.exchange.toLowerCase()} size={14} />
                </div>
                {highSlang && (
                  <p className="text-[9px] mt-1 italic" style={{ color: 'var(--highlight-hot)', opacity: 0.6 }}>{highSlang}</p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Lowest */}
        <div className="relative group rounded-xl overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(244,63,94,0.08) 0%, var(--hub-darker) 60%)', border: '1px solid rgba(244,63,94,0.12)' }}>
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'radial-gradient(circle at 30% 30%, rgba(244,63,94,0.1), transparent 70%)' }} />
          <div className="relative px-4 py-3.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-rose-500/60 text-[10px] font-semibold uppercase tracking-[0.1em]">Lowest /{periodLabel}</span>
              <TrendingDown className="w-3.5 h-3.5 text-rose-500/40" />
            </div>
            {lowestRate && (
              <>
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-black font-mono tracking-tight ${
                    Math.abs(lowestNorm) >= 0.1 ? 'text-rekt-hot' : 'text-rose-400'
                  } ${lowFlash}`} style={Math.abs(lowestNorm) >= 0.1 ? { textShadow: '0 0 6px rgba(255, 23, 68, 0.3)' } : undefined}>
                    {formatRateAdaptive(lowestNorm)}
                  </span>
                  <span className="text-rose-400/50 text-[11px] font-medium">{lowestRate.symbol}</span>
                  <ExchangeLogo exchange={lowestRate.exchange.toLowerCase()} size={14} />
                </div>
                {lowSlang && (
                  <p className="text-[9px] mt-1 italic" style={{ color: 'var(--highlight-hot)', opacity: 0.6 }}>{lowSlang}</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom row: Top 4 Highest + Top 5 Lowest leaderboards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {/* Top 4 Highest */}
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--hub-darker)', border: '1px solid rgba(16,185,129,0.08)' }}>
          <div className="px-3.5 py-2.5 border-b border-white/[0.04] flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500/60" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-500/60">Top 4 Highest Funding /{periodLabel}</span>
          </div>
          <div className="divide-y divide-white/[0.03]">
            {top4Highest.map((fr, idx) => {
              const rate = normDisplay(fr);
              return (
                <div key={`h-${fr.symbol}-${fr.exchange}-${idx}`} className="flex items-center gap-2.5 px-3.5 py-2 hover:bg-white/[0.02] transition-colors">
                  <span className="text-emerald-500/40 text-[11px] font-mono font-bold w-4">{idx + 1}</span>
                  <ExchangeLogo exchange={fr.exchange.toLowerCase()} size={14} />
                  <span className="text-white text-xs font-semibold flex-1">{fr.symbol}</span>
                  {(() => { const ref = getExchangeReferralUrl(fr.exchange); return ref ? (
                    <a href={ref} target="_blank" rel="noopener noreferrer" className="text-neutral-600 text-[10px] hover:text-hub-yellow transition">{fr.exchange}</a>
                  ) : (
                    <span className="text-neutral-600 text-[10px]">{fr.exchange}</span>
                  ); })()}
                  <span className={`font-mono text-xs font-bold ${
                    Math.abs(rate) >= 0.1 ? 'text-pump-hot' : 'text-emerald-400'
                  }`} style={Math.abs(rate) >= 0.1 ? { textShadow: '0 0 4px rgba(0, 230, 118, 0.2)' } : undefined}>
                    {formatRateAdaptive(rate)}
                  </span>
                </div>
              );
            })}
            {top4Highest.length === 0 && (
              <div className="px-3.5 py-3 text-neutral-600 text-xs">No data</div>
            )}
          </div>
        </div>

        {/* Top 5 Lowest */}
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--hub-darker)', border: '1px solid rgba(244,63,94,0.08)' }}>
          <div className="px-3.5 py-2.5 border-b border-white/[0.04] flex items-center gap-2">
            <TrendingDown className="w-3.5 h-3.5 text-rose-500/60" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-rose-500/60">Top 5 Lowest Funding /{periodLabel}</span>
          </div>
          <div className="divide-y divide-white/[0.03]">
            {top5Lowest.map((fr, idx) => {
              const rate = normDisplay(fr);
              return (
                <div key={`l-${fr.symbol}-${fr.exchange}-${idx}`} className="flex items-center gap-2.5 px-3.5 py-2 hover:bg-white/[0.02] transition-colors">
                  <span className="text-rose-500/40 text-[11px] font-mono font-bold w-4">{idx + 1}</span>
                  <ExchangeLogo exchange={fr.exchange.toLowerCase()} size={14} />
                  <span className="text-white text-xs font-semibold flex-1">{fr.symbol}</span>
                  {(() => { const ref = getExchangeReferralUrl(fr.exchange); return ref ? (
                    <a href={ref} target="_blank" rel="noopener noreferrer" className="text-neutral-600 text-[10px] hover:text-hub-yellow transition">{fr.exchange}</a>
                  ) : (
                    <span className="text-neutral-600 text-[10px]">{fr.exchange}</span>
                  ); })()}
                  <span className={`font-mono text-xs font-bold ${
                    Math.abs(rate) >= 0.1 ? 'text-rekt-hot' : 'text-rose-400'
                  }`} style={Math.abs(rate) >= 0.1 ? { textShadow: '0 0 4px rgba(255, 23, 68, 0.2)' } : undefined}>
                    {formatRateAdaptive(rate)}
                  </span>
                </div>
              );
            })}
            {top5Lowest.length === 0 && (
              <div className="px-3.5 py-3 text-neutral-600 text-xs">No data</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
