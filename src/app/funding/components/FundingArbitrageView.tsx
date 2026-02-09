import { TokenIconSimple } from '@/components/TokenIcon';
import { Shuffle } from 'lucide-react';
import { formatRate, getExchangeColor } from '../utils';

interface ArbitrageItem {
  symbol: string;
  spread: number;
  exchanges: { exchange: string; rate: number }[];
}

interface FundingArbitrageViewProps {
  arbitrageData: ArbitrageItem[];
}

export default function FundingArbitrageView({ arbitrageData }: FundingArbitrageViewProps) {
  return (
    <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-hub-gray/30">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Shuffle className="w-5 h-5 text-hub-yellow" />
          Funding Rate Arbitrage Opportunities
        </h3>
        <p className="text-hub-gray-text text-sm">Largest spread between exchanges (long on low rate, short on high rate)</p>
      </div>
      <div className="divide-y divide-hub-gray/20">
        {arbitrageData.slice(0, 20).map((item, index) => {
          const sortedExchanges = [...item.exchanges].sort((a, b) => b.rate - a.rate);
          const highestEx = sortedExchanges[0];
          const lowestEx = sortedExchanges[sortedExchanges.length - 1];

          return (
            <div key={item.symbol} className="p-4 hover:bg-hub-gray/30 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-hub-gray-text text-sm w-6">{index + 1}</span>
                  <TokenIconSimple symbol={item.symbol} size={32} />
                  <span className="text-white font-bold text-lg">{item.symbol}</span>
                </div>
                <div className="text-right">
                  <div className="text-hub-yellow font-bold">
                    Spread: {item.spread.toFixed(4)}%
                  </div>
                  <div className="text-hub-gray-text text-xs">
                    Annualized: {(item.spread * 3 * 365).toFixed(2)}%
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-danger/10 border border-danger/20 rounded-xl p-3">
                  <div className="text-danger text-xs mb-1">SHORT here (highest rate)</div>
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getExchangeColor(highestEx.exchange)}`}>
                      {highestEx.exchange}
                    </span>
                    <span className="text-danger font-mono font-bold">
                      {formatRate(highestEx.rate)}
                    </span>
                  </div>
                </div>
                <div className="bg-success/10 border border-success/20 rounded-xl p-3">
                  <div className="text-success text-xs mb-1">LONG here (lowest rate)</div>
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getExchangeColor(lowestEx.exchange)}`}>
                      {lowestEx.exchange}
                    </span>
                    <span className="text-success font-mono font-bold">
                      {formatRate(lowestEx.rate)}
                    </span>
                  </div>
                </div>
              </div>

              {/* All exchanges for this symbol */}
              <div className="mt-3 flex flex-wrap gap-2">
                {sortedExchanges.map((ex) => (
                  <div
                    key={ex.exchange}
                    className="flex items-center gap-2 px-2 py-1 rounded-lg bg-hub-gray/30 text-xs"
                  >
                    <span className="text-hub-gray-text">{ex.exchange}:</span>
                    <span className={ex.rate >= 0 ? 'text-success' : 'text-danger'}>
                      {formatRate(ex.rate)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {arbitrageData.length === 0 && (
        <div className="p-8 text-center text-hub-gray-text">
          No arbitrage opportunities found.
        </div>
      )}
    </div>
  );
}
