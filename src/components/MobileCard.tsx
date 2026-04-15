'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { TokenIconSimple } from './TokenIcon';

interface MobileCardProps {
  symbol: string;
  rows: { label: string; value: React.ReactNode }[];
  actions?: React.ReactNode;
  href?: string;
  /** Extra rows revealed on tap. When provided, card becomes expandable. */
  expandedRows?: { label: string; value: React.ReactNode }[];
}

/**
 * Card layout for table rows on mobile.
 * Renders as a vertical card instead of horizontal table row.
 * Only visible below `md` breakpoint.
 * When `expandedRows` is provided, tapping the card reveals additional data.
 */
export default function MobileCard({ symbol, rows, actions, href, expandedRows }: MobileCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isExpandable = expandedRows && expandedRows.length > 0;

  return (
    <div
      className={`bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 space-y-2 transition-all duration-200 hover:border-white/[0.1] active:scale-[0.98] ${isExpandable ? 'cursor-pointer' : ''}`}
      role={isExpandable ? 'button' : undefined}
      tabIndex={isExpandable ? 0 : undefined}
      aria-expanded={isExpandable ? expanded : undefined}
      aria-label={isExpandable ? `${symbol} details, ${expanded ? 'collapse' : 'expand'}` : undefined}
      onClick={isExpandable ? () => setExpanded(prev => !prev) : undefined}
      onKeyDown={isExpandable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(prev => !prev); } } : undefined}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TokenIconSimple symbol={symbol} size={28} />
          {href ? (
            <Link href={href} onClick={e => e.stopPropagation()} className="text-white font-semibold text-sm hover:text-hub-yellow transition-colors">{symbol}</Link>
          ) : (
            <span className="text-white font-semibold text-sm">{symbol}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {actions && <div onClick={e => e.stopPropagation()}>{actions}</div>}
          {isExpandable && (
            <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {rows.map((row) => (
          <div key={row.label}>
            <span className="text-neutral-600 text-[10px] uppercase tracking-wider">{row.label}</span>
            <div className="text-sm font-mono">{row.value}</div>
          </div>
        ))}
      </div>
      {/* Expanded section */}
      {isExpandable && expanded && (
        <div className="pt-2 mt-1 border-t border-white/[0.04] grid grid-cols-2 gap-x-4 gap-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
          {expandedRows.map((row) => (
            <div key={row.label}>
              <span className="text-neutral-600 text-[10px] uppercase tracking-wider">{row.label}</span>
              <div className="text-sm font-mono">{row.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
