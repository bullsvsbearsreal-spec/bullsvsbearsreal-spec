'use client';

import { useMemo } from 'react';
import { formatUSD } from '@/lib/utils/format';

interface SlippageVenue {
  exchange: string;
  available: boolean;
  midPrice: number;
  bidDepthUsd: number;
  askDepthUsd: number;
  slippage: Record<number, { bid: number; ask: number }>;
}

interface Props {
  data: {
    symbol: string;
    depthSizes: number[];
    venues: SlippageVenue[];
  } | null;
  loading?: boolean;
}

function slippageColor(slip: number): string {
  // Low slippage = green, high = red
  if (slip <= 0.01) return 'rgba(16, 185, 129, 0.6)';    // <0.01% - deep green
  if (slip <= 0.03) return 'rgba(16, 185, 129, 0.35)';   // <0.03%
  if (slip <= 0.05) return 'rgba(250, 204, 21, 0.3)';    // <0.05% - yellow
  if (slip <= 0.1)  return 'rgba(251, 146, 60, 0.35)';   // <0.1% - orange
  if (slip <= 0.3)  return 'rgba(244, 63, 94, 0.35)';    // <0.3% - red
  return 'rgba(244, 63, 94, 0.55)';                       // >0.3% - deep red
}

function slippageTextColor(slip: number): string {
  if (slip <= 0.03) return 'rgb(52, 211, 153)';
  if (slip <= 0.05) return 'rgb(250, 204, 21)';
  if (slip <= 0.1)  return 'rgb(251, 146, 60)';
  return 'rgb(251, 113, 133)';
}

function formatSlippage(v: number): string {
  if (v === 0) return '0.00%';
  if (v < 0.01) return `${(v * 100).toFixed(1)}bp`;
  return `${v.toFixed(2)}%`;
}

export default function SlippageHeatmap({ data, loading }: Props) {
  const sorted = useMemo(() => {
    if (!data?.venues) return [];
    return [...data.venues]
      .filter(v => v.available)
      .sort((a, b) => (b.bidDepthUsd + b.askDepthUsd) - (a.bidDepthUsd + a.askDepthUsd));
  }, [data]);

  if (loading) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="h-4 w-40 bg-white/[0.06] rounded animate-pulse mb-4" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-10 bg-white/[0.03] rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || sorted.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center text-neutral-600 text-sm">
        No orderbook data available
      </div>
    );
  }

  const sizes = data.depthSizes;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Slippage Heatmap — {data.symbol}</h3>
        <span className="text-[10px] text-neutral-600">Bid / Ask slippage at order size</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="text-left text-neutral-600 font-medium pb-2 pr-3 text-[10px] uppercase tracking-wider w-24">Exchange</th>
              <th className="text-right text-neutral-600 font-medium pb-2 px-2 text-[10px] uppercase tracking-wider">Depth</th>
              {sizes.map(s => (
                <th key={s} className="text-center text-neutral-600 font-medium pb-2 px-1 text-[10px] uppercase tracking-wider">
                  {formatUSD(s, 0)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(venue => (
              <tr key={venue.exchange} className="group hover:bg-white/[0.02]">
                <td className="py-1.5 pr-3 font-medium text-white text-[11px]">{venue.exchange}</td>
                <td className="py-1.5 px-2 text-right">
                  <div className="flex flex-col items-end gap-[1px]">
                    <span className="text-green-400/70 text-[10px] font-mono tabular-nums">{formatUSD(venue.bidDepthUsd, 0)}</span>
                    <span className="text-red-400/70 text-[10px] font-mono tabular-nums">{formatUSD(venue.askDepthUsd, 0)}</span>
                  </div>
                </td>
                {sizes.map(size => {
                  const slip = venue.slippage[size];
                  if (!slip) return <td key={size} className="py-1.5 px-1 text-center text-neutral-700">—</td>;
                  const avgSlip = (slip.bid + slip.ask) / 2;
                  return (
                    <td
                      key={size}
                      className="py-1.5 px-1"
                      title={`Bid: ${formatSlippage(slip.bid)} | Ask: ${formatSlippage(slip.ask)}`}
                    >
                      <div
                        className="rounded-md px-2 py-1.5 text-center transition-colors"
                        style={{ background: slippageColor(avgSlip) }}
                      >
                        <div className="flex flex-col gap-[1px]">
                          <span className="font-mono tabular-nums text-[10px] font-semibold" style={{ color: slippageTextColor(slip.bid) }}>
                            {formatSlippage(slip.bid)}
                          </span>
                          <span className="font-mono tabular-nums text-[10px] font-semibold" style={{ color: slippageTextColor(slip.ask) }}>
                            {formatSlippage(slip.ask)}
                          </span>
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/[0.04]">
        <span className="text-[10px] text-neutral-600">Slippage scale:</span>
        <div className="flex items-center gap-1.5">
          {[
            ['<0.01%', 'rgba(16, 185, 129, 0.6)'],
            ['<0.05%', 'rgba(250, 204, 21, 0.3)'],
            ['<0.1%', 'rgba(251, 146, 60, 0.35)'],
            ['>0.3%', 'rgba(244, 63, 94, 0.55)'],
          ].map(([label, color]) => (
            <div key={label} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded" style={{ background: color }} />
              <span className="text-[9px] text-neutral-500">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
