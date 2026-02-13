import { TokenIconSimple } from '@/components/TokenIcon';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { formatRate, getHeatmapColor } from '../utils';

interface FundingHeatmapViewProps {
  symbols: string[];
  visibleExchanges: string[];
  heatmapData: Map<string, Map<string, number>>;
}

export default function FundingHeatmapView({ symbols, visibleExchanges, heatmapData }: FundingHeatmapViewProps) {
  return (
    <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold text-sm">Funding Rate Heatmap</h3>
          <p className="text-neutral-600 text-xs">Compare rates across exchanges</p>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-red-500" /><span className="text-neutral-500">&lt;-0.1%</span></div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-neutral-700" /><span className="text-neutral-500">~0%</span></div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-green-500" /><span className="text-neutral-500">&gt;+0.1%</span></div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.04]">
              <th scope="col" className="px-3 py-2 text-left text-[11px] font-semibold text-neutral-500 uppercase tracking-wider sticky left-0 bg-[#0d0d0d] z-10">Symbol</th>
              {visibleExchanges.map(ex => (
                <th key={ex} scope="col" className="px-1 py-2 text-center text-[10px] font-medium text-neutral-600">
                  <div className="flex items-center justify-center gap-1">
                    <ExchangeLogo exchange={ex.toLowerCase()} size={14} />
                    <span className="hidden lg:inline">{ex}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {symbols.map(symbol => {
              const rates = heatmapData.get(symbol);
              return (
                <tr key={symbol} className="border-b border-white/[0.02]">
                  <td className="px-3 py-1.5 sticky left-0 bg-[#0d0d0d] z-10">
                    <div className="flex items-center gap-1.5">
                      <TokenIconSimple symbol={symbol} size={18} />
                      <span className="text-white font-medium text-xs">{symbol}</span>
                    </div>
                  </td>
                  {visibleExchanges.map(ex => {
                    const rate = rates?.get(ex);
                    return (
                      <td key={ex} className="px-0.5 py-0.5">
                        <div
                          className={`${getHeatmapColor(rate)} rounded px-1.5 py-1.5 text-center text-[11px] font-mono text-white/80`}
                          title={`${symbol} on ${ex}: ${rate !== undefined ? formatRate(rate) : 'N/A'}`}
                        >
                          {rate !== undefined ? formatRate(rate) : '-'}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
