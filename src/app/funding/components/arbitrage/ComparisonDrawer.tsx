import { TokenIconSimple } from '@/components/TokenIcon';
import { formatUSD, formatPnl } from './utils';
import type { EnrichedArb } from './types';

export function ComparisonDrawer({ items, periodScale, onClear }: {
  items: EnrichedArb[]; periodScale: number; onClear: () => void;
}) {
  if (items.length === 0) return null;

  const metrics: { label: string; key: string; format: (i: EnrichedArb) => string; best: 'max' | 'min' | null }[] = [
    { label: 'Grade', key: 'gradeScore', format: (i) => `${i.grade} (${i.gradeScore}/8)`, best: 'max' },
    { label: 'Spread/8h', key: 'grossSpread8h', format: (i) => `${i.grossSpread8h.toFixed(4)}%`, best: 'max' },
    { label: 'Net Ann.', key: 'netAnnualized', format: (i) => `${i.netAnnualized > 0 ? '+' : ''}${i.netAnnualized.toFixed(1)}%`, best: 'max' },
    { label: 'Short', key: 'high', format: (i) => i.high.exchange, best: null },
    { label: 'Long', key: 'low', format: (i) => i.low.exchange, best: null },
    { label: 'Fees', key: 'roundTripFee', format: (i) => `${i.roundTripFee.toFixed(3)}%`, best: 'min' },
    { label: 'Daily PnL', key: 'dailyPnl', format: (i) => formatPnl(i.dailyPnl), best: 'max' },
    { label: 'OI', key: 'totalOI', format: (i) => i.totalOI > 0 ? formatUSD(i.totalOI) : '-', best: 'max' },
    { label: 'Stability', key: 'stability', format: (i) => i.stability || '-', best: null },
    { label: 'Trend', key: 'trend', format: (i) => i.trend || '-', best: null },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-hub-darker border-t border-white/[0.1] shadow-2xl z-50 max-h-[300px] overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-white text-sm font-semibold">Comparing {items.length} Opportunities</h4>
          <button onClick={onClear} className="text-neutral-500 hover:text-white text-xs px-2 py-1 rounded bg-white/[0.04] transition-colors">Clear</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="py-1.5 pr-3 text-left text-neutral-500 text-[10px] font-semibold uppercase w-24">Metric</th>
                {items.map(item => (
                  <th key={item.symbol} className="py-1.5 px-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <TokenIconSimple symbol={item.symbol} size={14} />
                      <span className="text-white font-semibold">{item.symbol}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map(metric => {
                const values = items.map(i => typeof (i as any)[metric.key] === 'number' ? (i as any)[metric.key] as number : null);
                const validValues = values.filter((v): v is number => v !== null);
                const bestVal = metric.best === 'max' && validValues.length > 0 ? Math.max(...validValues)
                  : metric.best === 'min' && validValues.length > 0 ? Math.min(...validValues)
                  : null;
                return (
                  <tr key={metric.label} className="border-b border-white/[0.03]">
                    <td className="py-1.5 pr-3 text-neutral-500 text-[10px]">{metric.label}</td>
                    {items.map(item => {
                      const val = typeof (item as any)[metric.key] === 'number' ? (item as any)[metric.key] as number : null;
                      const isBest = bestVal !== null && val === bestVal && items.length > 1;
                      return (
                        <td key={item.symbol} className={`py-1.5 px-3 text-center font-mono ${isBest ? 'text-green-400' : 'text-neutral-300'}`}>
                          {metric.format(item)}
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
    </div>
  );
}
