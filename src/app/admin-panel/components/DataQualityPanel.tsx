'use client';

import { AlertTriangle, CheckCircle, Grid3X3 } from 'lucide-react';

interface Props {
  outliers: Array<{ symbol: string; exchange: string; metric: string; value: number; median: number; deviationPct: number }>;
  anomalies: {
    zeroOI: Array<{ exchange: string; count: number }>;
    nullFunding: Array<{ exchange: string; count: number }>;
    totalZeroOI: number;
    totalNullFunding: number;
  };
  coverage: Array<{ exchange: string; funding: number; oi: number; tickers: number }>;
}

export default function DataQualityPanel({ outliers, anomalies, coverage }: Props) {
  return (
    <div className="space-y-4">
      {/* Outliers */}
      <div className="rounded-lg border border-white/[0.06] overflow-hidden">
        <div className="px-3 py-2 border-b border-white/[0.06] flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
          <span className="text-[11px] text-neutral-500 uppercase tracking-wider">
            Cross-Exchange Outliers
          </span>
          <span className="text-[10px] text-neutral-600 ml-auto">
            Funding rates deviating {'>'}200% from median
          </span>
        </div>
        {outliers.length === 0 ? (
          <div className="p-4 text-center">
            <CheckCircle className="w-5 h-5 text-green-400 mx-auto mb-1" />
            <p className="text-[11px] text-neutral-500">No outliers detected</p>
          </div>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-neutral-500 text-left border-b border-white/[0.06]">
                <th className="px-3 py-2 font-medium">Symbol</th>
                <th className="px-3 py-2 font-medium">Exchange</th>
                <th className="px-3 py-2 font-medium text-right">Rate</th>
                <th className="px-3 py-2 font-medium text-right">Median</th>
                <th className="px-3 py-2 font-medium text-right">Deviation</th>
              </tr>
            </thead>
            <tbody>
              {outliers.slice(0, 15).map((o, i) => (
                <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-3 py-1.5 text-white font-medium">{o.symbol}</td>
                  <td className="px-3 py-1.5 text-neutral-400">{o.exchange}</td>
                  <td className="px-3 py-1.5 text-right text-white tabular-nums">{(o.value * 100).toFixed(4)}%</td>
                  <td className="px-3 py-1.5 text-right text-neutral-400 tabular-nums">{(o.median * 100).toFixed(4)}%</td>
                  <td className="px-3 py-1.5 text-right">
                    <span className="text-red-400 font-medium tabular-nums">{o.deviationPct}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Anomalies */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <AnomalyCard
          title="Zero OI"
          total={anomalies.totalZeroOI}
          items={anomalies.zeroOI}
        />
        <AnomalyCard
          title="Null Funding"
          total={anomalies.totalNullFunding}
          items={anomalies.nullFunding}
        />
      </div>

      {/* Symbol Coverage Matrix */}
      <div className="rounded-lg border border-white/[0.06] overflow-hidden">
        <div className="px-3 py-2 border-b border-white/[0.06] flex items-center gap-2">
          <Grid3X3 className="w-3.5 h-3.5 text-hub-yellow" />
          <span className="text-[11px] text-neutral-500 uppercase tracking-wider">Symbol Coverage</span>
        </div>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-neutral-500 text-left border-b border-white/[0.06]">
              <th className="px-3 py-2 font-medium">Exchange</th>
              <th className="px-3 py-2 font-medium text-right">Funding</th>
              <th className="px-3 py-2 font-medium text-right">OI</th>
              <th className="px-3 py-2 font-medium text-right">Tickers</th>
              <th className="px-3 py-2 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {coverage.map(c => (
              <tr key={c.exchange} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                <td className="px-3 py-1.5 text-white font-medium">{c.exchange}</td>
                <td className="px-3 py-1.5 text-right text-neutral-400 tabular-nums">{c.funding || '--'}</td>
                <td className="px-3 py-1.5 text-right text-neutral-400 tabular-nums">{c.oi || '--'}</td>
                <td className="px-3 py-1.5 text-right text-neutral-400 tabular-nums">{c.tickers || '--'}</td>
                <td className="px-3 py-1.5 text-right text-white font-medium tabular-nums">{c.funding + c.oi + c.tickers}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AnomalyCard({ title, total, items }: { title: string; total: number; items: Array<{ exchange: string; count: number }> }) {
  return (
    <div className="rounded-lg border border-white/[0.06] p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] text-neutral-500 uppercase tracking-wider">{title}</p>
        <span className={`text-sm font-bold ${total > 0 ? 'text-yellow-400' : 'text-green-400'}`}>{total}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-[11px] text-neutral-600">None detected</p>
      ) : (
        <div className="space-y-0.5">
          {items.slice(0, 5).map(item => (
            <div key={item.exchange} className="flex justify-between text-[11px]">
              <span className="text-neutral-400">{item.exchange}</span>
              <span className="text-yellow-400 tabular-nums">{item.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
