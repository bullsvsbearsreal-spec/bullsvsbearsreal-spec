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
    <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-hub-gray/30">
        <h3 className="text-white font-semibold">Funding Rate Heatmap</h3>
        <p className="text-hub-gray-text text-sm">Compare rates across exchanges (green = positive, red = negative)</p>
      </div>
      <div className="overflow-x-auto p-4">
        <table className="w-full">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left text-sm font-semibold text-hub-gray-text">Symbol</th>
              {visibleExchanges.map(ex => (
                <th key={ex} className="px-3 py-2 text-center text-sm font-semibold text-hub-gray-text">
                  <div className="flex items-center justify-center gap-2">
                    <ExchangeLogo exchange={ex.toLowerCase()} size={16} />
                    <span>{ex}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {symbols.map(symbol => {
              const rates = heatmapData.get(symbol);
              return (
                <tr key={symbol} className="border-t border-hub-gray/20">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <TokenIconSimple symbol={symbol} size={24} />
                      <span className="text-white font-medium text-sm">{symbol}</span>
                    </div>
                  </td>
                  {visibleExchanges.map(ex => {
                    const rate = rates?.get(ex);
                    return (
                      <td key={ex} className="px-1 py-1">
                        <div
                          className={`${getHeatmapColor(rate)} rounded-lg px-2 py-2 text-center text-xs font-mono text-white/90`}
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

      {/* Legend */}
      <div className="p-4 border-t border-hub-gray/30 flex items-center justify-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-500" />
          <span className="text-hub-gray-text">&lt; -0.1%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-700" />
          <span className="text-hub-gray-text">-0.1% to 0%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-hub-gray/30" />
          <span className="text-hub-gray-text">0%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-700" />
          <span className="text-hub-gray-text">0% to +0.1%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-500" />
          <span className="text-hub-gray-text">&gt; +0.1%</span>
        </div>
      </div>
    </div>
  );
}
