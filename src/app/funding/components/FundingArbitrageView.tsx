import { TokenIconSimple } from '@/components/TokenIcon';
import { ExchangeLogo } from '@/components/ExchangeLogos';
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
    <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <h3 className="text-white font-semibold text-sm">Arbitrage Opportunities</h3>
        <p className="text-neutral-600 text-xs">Largest funding rate spreads between exchanges</p>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {arbitrageData.slice(0, 20).map((item, index) => {
          const sorted = [...item.exchanges].sort((a, b) => b.rate - a.rate);
          const high = sorted[0];
          const low = sorted[sorted.length - 1];

          return (
            <div key={item.symbol} className="px-4 py-3 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-neutral-600 text-xs font-mono w-5">{index + 1}</span>
                  <TokenIconSimple symbol={item.symbol} size={24} />
                  <span className="text-white font-bold text-sm">{item.symbol}</span>
                </div>
                <div className="text-right">
                  <span className="text-hub-yellow font-bold font-mono text-sm">
                    {item.spread.toFixed(4)}%
                  </span>
                  <span className="text-neutral-600 text-[10px] ml-2">
                    {(item.spread * 3 * 365).toFixed(1)}% ann.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2">
                  <div className="text-red-400/60 text-[10px] uppercase tracking-wider mb-1">Short</div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <ExchangeLogo exchange={high.exchange.toLowerCase()} size={14} />
                      <span className="text-xs text-neutral-300">{high.exchange}</span>
                    </div>
                    <span className="text-red-400 font-mono text-xs font-semibold">{formatRate(high.rate)}</span>
                  </div>
                </div>
                <div className="bg-green-500/5 border border-green-500/10 rounded-lg px-3 py-2">
                  <div className="text-green-400/60 text-[10px] uppercase tracking-wider mb-1">Long</div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <ExchangeLogo exchange={low.exchange.toLowerCase()} size={14} />
                      <span className="text-xs text-neutral-300">{low.exchange}</span>
                    </div>
                    <span className="text-green-400 font-mono text-xs font-semibold">{formatRate(low.rate)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-1">
                {sorted.map((ex) => (
                  <div key={ex.exchange} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.03] text-[10px]">
                    <ExchangeLogo exchange={ex.exchange.toLowerCase()} size={12} />
                    <span className="text-neutral-500">{ex.exchange}</span>
                    <span className={ex.rate >= 0 ? 'text-green-400' : 'text-red-400'}>{formatRate(ex.rate)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {arbitrageData.length === 0 && (
        <div className="p-8 text-center text-neutral-600 text-sm">
          No arbitrage opportunities found.
        </div>
      )}
    </div>
  );
}
