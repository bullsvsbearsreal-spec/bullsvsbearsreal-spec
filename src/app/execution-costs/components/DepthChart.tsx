'use client';
import { VenueCost } from '@/lib/execution-costs/types';
import { formatUSD } from '@/lib/utils/format';

interface Props { venues: VenueCost[]; orderSizeUsd: number; }

const MAX_DEPTH_DISPLAY = 1_000_000_000;

export default function DepthChart({ venues, orderSizeUsd }: Props) {
  const available = venues.filter(v => v.available && v.maxFillableSize > 0 && v.maxFillableSize !== Infinity);
  if (available.length === 0) {
    return <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center text-neutral-600 text-sm">No depth data available</div>;
  }

  const sorted = available
    .sort((a, b) => b.maxFillableSize - a.maxFillableSize)
    .map(v => ({
      exchange: v.exchange,
      depth: Math.min(v.maxFillableSize, MAX_DEPTH_DISPLAY),
      raw: v.maxFillableSize,
      capped: v.maxFillableSize > MAX_DEPTH_DISPLAY,
      method: v.method,
      canFill: v.maxFillableSize >= orderSizeUsd,
      fillPct: Math.min((v.maxFillableSize / orderSizeUsd) * 100, 100),
    }));

  const maxDepth = Math.max(...sorted.map(v => v.depth), orderSizeUsd * 1.2);
  const fmtUsd = (v: number) => formatUSD(v, 1);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Available Depth by Venue</h3>
        <span className="text-[10px] text-neutral-500">
          Order: <span className="text-hub-yellow font-mono font-semibold">{fmtUsd(orderSizeUsd)}</span>
        </span>
      </div>

      <div className="space-y-2.5">
        {sorted.map((v, i) => {
          const barPct = (v.depth / maxDepth) * 100;
          const orderPct = (orderSizeUsd / maxDepth) * 100;
          const isTop = i === 0;
          return (
            <div key={v.exchange} className="group">
              {/* Exchange label row */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-white font-medium">{v.exchange}</span>
                  <span className="text-[8px] px-1.5 py-[1px] rounded bg-white/[0.06] text-neutral-500 uppercase font-semibold">
                    {v.method === 'clob' ? 'CLOB' : v.method === 'amm_formula' ? 'AMM' : v.method?.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-neutral-400">{fmtUsd(v.raw)}</span>
                  {v.canFill ? (
                    <span className="text-[8px] px-1.5 py-[1px] rounded bg-green-500/10 text-green-400 font-semibold">FILLABLE</span>
                  ) : (
                    <span className="text-[8px] px-1.5 py-[1px] rounded bg-orange-500/10 text-orange-400 font-semibold">{v.fillPct.toFixed(0)}%</span>
                  )}
                </div>
              </div>
              {/* Bar */}
              <div className="relative h-6 bg-white/[0.03] rounded-md overflow-hidden">
                {/* Depth bar */}
                <div
                  className="absolute inset-y-0 left-0 rounded-md transition-all duration-500"
                  style={{
                    width: `${Math.max(barPct, 1)}%`,
                    background: v.canFill
                      ? `linear-gradient(90deg, #22c55e ${Math.min(orderPct / barPct * 100, 100)}%, #15803d 100%)`
                      : `linear-gradient(90deg, #f59e0b, #d97706)`,
                    opacity: isTop ? 0.85 : 0.7,
                  }}
                />
                {/* Order size marker */}
                <div
                  className="absolute top-0 bottom-0 w-[2px] bg-hub-yellow z-10"
                  style={{ left: `${Math.min(orderPct, 99)}%` }}
                >
                  <div className="absolute -top-[2px] -left-[3px] w-2 h-2 rounded-full bg-hub-yellow" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/[0.04]">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-green-500/70" />
          <span className="text-[9px] text-neutral-500">Can fill order</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-amber-500/70" />
          <span className="text-[9px] text-neutral-500">Partial fill only</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-hub-yellow" />
          <span className="text-[9px] text-neutral-500">Your order size</span>
        </div>
      </div>
    </div>
  );
}
