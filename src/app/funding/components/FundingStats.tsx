import { FundingRateData } from '@/lib/api/types';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { formatRate, getRateColor } from '../utils';

interface FundingStatsProps {
  fundingRates: FundingRateData[];
  avgRate: number;
  highestRate: FundingRateData | null;
  lowestRate: FundingRateData | null;
}

export default function FundingStats({ fundingRates, avgRate, highestRate, lowestRate }: FundingStatsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
      <div className="bg-hub-darker border border-white/[0.06] rounded-lg px-4 py-3">
        <span className="text-neutral-500 text-[11px] uppercase tracking-wider">Pairs</span>
        <div className="text-lg font-bold text-white font-mono mt-0.5">{fundingRates.length.toLocaleString()}</div>
      </div>
      <div className="bg-hub-darker border border-white/[0.06] rounded-lg px-4 py-3">
        <span className="text-neutral-500 text-[11px] uppercase tracking-wider">Avg Rate</span>
        <div className={`text-lg font-bold font-mono mt-0.5 ${getRateColor(avgRate)}`}>
          {formatRate(avgRate)}
        </div>
      </div>
      <div className="bg-hub-darker border border-green-500/10 rounded-lg px-4 py-3">
        <span className="text-green-500/60 text-[11px] uppercase tracking-wider">Highest</span>
        {highestRate && (
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-lg font-bold text-green-400 font-mono">{formatRate(highestRate.fundingRate)}</span>
            <span className="text-green-400/50 text-xs">{highestRate.symbol}</span>
            <ExchangeLogo exchange={highestRate.exchange.toLowerCase()} size={14} />
          </div>
        )}
      </div>
      <div className="bg-hub-darker border border-red-500/10 rounded-lg px-4 py-3">
        <span className="text-red-500/60 text-[11px] uppercase tracking-wider">Lowest</span>
        {lowestRate && (
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-lg font-bold text-red-400 font-mono">{formatRate(lowestRate.fundingRate)}</span>
            <span className="text-red-400/50 text-xs">{lowestRate.symbol}</span>
            <ExchangeLogo exchange={lowestRate.exchange.toLowerCase()} size={14} />
          </div>
        )}
      </div>
    </div>
  );
}
