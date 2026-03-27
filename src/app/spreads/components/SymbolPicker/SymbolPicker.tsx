'use client';

import { memo, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { getCoinIcon } from '@/lib/coinIcons';
import { SYMBOLS } from '../../lib/symbols';
import type { AssetClass } from '../../lib/symbols';

// Category icons for non-crypto categories
const CATEGORY_ICONS: Record<string, string> = {
  'Precious Metals': '🥇',
  Energy: '⛽',
  Industrial: '🏭',
  'Forex Majors': '💱',
  'Forex Crosses': '💱',
  'Mega Cap Stocks': '📈',
  'Crypto Stocks': '📊',
  Indices: '📉',
};

interface SymbolPickerProps {
  current: string;
  query: string;
  dynamicSymbols: string[];
  onSelect: (sym: string) => void;
  onQueryChange: (q: string) => void;
  onClose: () => void;
}

function SymbolPickerInner({ current, query, dynamicSymbols, onSelect, onQueryChange, onClose }: SymbolPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="absolute top-full mt-1 left-0 z-50 w-64 max-h-[28rem] overflow-y-auto rounded-xl bg-[#141418] border border-white/[0.08] shadow-2xl"
      data-sym-picker
      onKeyDown={handleKeyDown}
    >
      {/* Search */}
      <div className="p-2 border-b border-white/[0.06] sticky top-0 bg-[#141418] z-10">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.04]">
          <Search className="w-3.5 h-3.5 text-neutral-500 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            placeholder="Search symbols..."
            className="bg-transparent text-sm text-white placeholder:text-neutral-600 outline-none w-full"
          />
          {query && (
            <button onClick={() => onQueryChange('')} className="text-neutral-500 hover:text-white">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <p className="text-[9px] text-neutral-600 px-2 mt-1">
          Press <kbd className="px-1 py-0.5 bg-white/[0.06] rounded text-[8px]">/</kbd> to search · <kbd className="px-1 py-0.5 bg-white/[0.06] rounded text-[8px]">Esc</kbd> to close
        </p>
      </div>

      {/* Categories */}
      {Object.entries(SYMBOLS).map(([group, syms]) => {
        const filtered = syms.filter(s => !query || s.toUpperCase().includes(query.toUpperCase()));
        if (!filtered.length) return null;
        const icon = CATEGORY_ICONS[group];
        return (
          <div key={group}>
            <p className="px-3 py-1 text-[9px] text-neutral-600 uppercase tracking-wider font-semibold flex items-center gap-1">
              {icon && <span className="text-[10px]">{icon}</span>}
              {group}
              <span className="text-neutral-700 ml-auto">{filtered.length}</span>
            </p>
            {filtered.map(s => (
              <button
                key={s}
                onClick={() => onSelect(s)}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-white/[0.04] flex items-center gap-2 transition ${
                  s === current ? 'text-hub-yellow' : 'text-neutral-300'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getCoinIcon(s)}
                  alt=""
                  className="w-4 h-4 rounded-full"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                {s}
                {s === current && <span className="ml-auto text-hub-yellow text-xs">✓</span>}
              </button>
            ))}
          </div>
        );
      })}

      {/* Dynamic symbols from live tickers */}
      {dynamicSymbols.length > 0 && (() => {
        const filtered = dynamicSymbols.filter(s => !query || s.toUpperCase().includes(query.toUpperCase()));
        if (!filtered.length) return null;
        return (
          <div>
            <p className="px-3 py-1 text-[9px] text-neutral-600 uppercase tracking-wider font-semibold">
              Discovered ({filtered.length})
            </p>
            {filtered.slice(0, query ? 50 : 20).map(s => (
              <button
                key={s}
                onClick={() => onSelect(s)}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-white/[0.04] flex items-center gap-2 ${
                  s === current ? 'text-hub-yellow' : 'text-neutral-300'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getCoinIcon(s)}
                  alt=""
                  className="w-4 h-4 rounded-full"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                {s}
                {s === current && <span className="ml-auto text-hub-yellow text-xs">✓</span>}
              </button>
            ))}
            {!query && filtered.length > 20 && (
              <p className="px-3 py-1 text-[9px] text-neutral-500">
                Type to search {filtered.length - 20} more...
              </p>
            )}
          </div>
        );
      })()}
    </div>
  );
}

export const SymbolPicker = memo(SymbolPickerInner);
