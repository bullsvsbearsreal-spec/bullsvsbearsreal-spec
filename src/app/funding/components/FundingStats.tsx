import { FundingRateData } from '@/lib/api/types';
import { formatRate, getRateColor } from '../utils';

interface FundingStatsProps {
  fundingRates: FundingRateData[];
  avgRate: number;
  highestRate: FundingRateData | null;
  lowestRate: FundingRateData | null;
}

export default function FundingStats({ fundingRates, avgRate, highestRate, lowestRate }: FundingStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl p-5">
        <span className="text-hub-gray-text text-sm">Total Pairs</span>
        <div className="text-2xl font-bold text-white mt-1">{fundingRates.length}</div>
      </div>
      <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl p-5">
        <span className="text-hub-gray-text text-sm">Average Rate</span>
        <div className={`text-2xl font-bold mt-1 ${getRateColor(avgRate)}`}>
          {formatRate(avgRate)}
        </div>
      </div>
      <div className="bg-success/10 border border-success/30 rounded-2xl p-5">
        <span className="text-success text-sm">Highest Rate</span>
        {highestRate && (
          <div className="mt-1">
            <span className="text-2xl font-bold text-success">{formatRate(highestRate.fundingRate)}</span>
            <span className="text-success/70 text-sm ml-2">{highestRate.symbol}</span>
          </div>
        )}
      </div>
      <div className="bg-danger/10 border border-danger/30 rounded-2xl p-5">
        <span className="text-danger text-sm">Lowest Rate</span>
        {lowestRate && (
          <div className="mt-1">
            <span className="text-2xl font-bold text-danger">{formatRate(lowestRate.fundingRate)}</span>
            <span className="text-danger/70 text-sm ml-2">{lowestRate.symbol}</span>
          </div>
        )}
      </div>
    </div>
  );
}
