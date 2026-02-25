import { FundingRateData } from '@/lib/api/types';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { formatRateAdaptive, getRateColor, type FundingPeriod, periodMultiplier, PERIOD_LABELS } from '../utils';
import { Activity, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';

interface FundingStatsProps {
  fundingRates: FundingRateData[];
  avgRate: number;
  highestRate: FundingRateData | null;
  lowestRate: FundingRateData | null;
  fundingPeriod: FundingPeriod;
}

export default function FundingStats({ fundingRates, avgRate, highestRate, lowestRate, fundingPeriod }: FundingStatsProps) {
  const normDisplay = (fr: FundingRateData) => fr.fundingRate * periodMultiplier(fr.fundingInterval, fundingPeriod);
  const periodLabel = PERIOD_LABELS[fundingPeriod];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-5">
      {/* Pairs */}
      <div className="relative group rounded-xl overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(255,165,0,0.06) 0%, var(--hub-darker) 60%)', border: '1px solid rgba(255,165,0,0.1)' }}>
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'radial-gradient(circle at 30% 30%, rgba(255,165,0,0.08), transparent 70%)' }} />
        <div className="relative px-4 py-3.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-neutral-500 text-[10px] font-semibold uppercase tracking-[0.1em]">Pairs</span>
            <BarChart3 className="w-3.5 h-3.5 text-hub-yellow/40" />
          </div>
          <div className="text-xl font-bold text-white font-mono tracking-tight">{fundingRates.length.toLocaleString()}</div>
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
          <div className={`text-xl font-bold font-mono tracking-tight ${getRateColor(avgRate)}`}>
            {formatRateAdaptive(avgRate)}
          </div>
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
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-emerald-400 font-mono tracking-tight">{formatRateAdaptive(normDisplay(highestRate))}</span>
              <span className="text-emerald-400/50 text-[11px] font-medium">{highestRate.symbol}</span>
              <ExchangeLogo exchange={highestRate.exchange.toLowerCase()} size={14} />
            </div>
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
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-rose-400 font-mono tracking-tight">{formatRateAdaptive(normDisplay(lowestRate))}</span>
              <span className="text-rose-400/50 text-[11px] font-medium">{lowestRate.symbol}</span>
              <ExchangeLogo exchange={lowestRate.exchange.toLowerCase()} size={14} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
