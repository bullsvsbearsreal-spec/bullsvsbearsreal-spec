'use client';

import { TokenIconSimple } from './TokenIcon';

interface MobileCardProps {
  symbol: string;
  rows: { label: string; value: React.ReactNode }[];
  actions?: React.ReactNode;
}

/**
 * Card layout for table rows on mobile.
 * Renders as a vertical card instead of horizontal table row.
 * Only visible below `md` breakpoint.
 */
export default function MobileCard({ symbol, rows, actions }: MobileCardProps) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TokenIconSimple symbol={symbol} size={28} />
          <span className="text-white font-semibold text-sm">{symbol}</span>
        </div>
        {actions}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {rows.map((row) => (
          <div key={row.label}>
            <span className="text-neutral-600 text-[10px] uppercase tracking-wider">{row.label}</span>
            <div className="text-sm font-mono">{row.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
