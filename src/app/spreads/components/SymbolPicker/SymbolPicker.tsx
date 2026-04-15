'use client';

import { memo, useRef, useEffect, useState } from 'react';
import { Search, X, ChevronRight, TrendingUp } from 'lucide-react';
import { getCoinIcon, hasKnownIcon } from '@/lib/coinIcons';
import WatchlistStar from '@/components/WatchlistStar';
import { SYMBOLS } from '../../lib/symbols';

// Category config: label, icon, color accent
const CATEGORIES: Record<string, { icon: string; color: string }> = {
  Majors: { icon: '₿', color: '#F7931A' },
  'Layer 2': { icon: '⬡', color: '#8B5CF6' },
  AI: { icon: '🤖', color: '#06B6D4' },
  Alts: { icon: '◆', color: '#3B82F6' },
  DeFi: { icon: '🏦', color: '#10B981' },
  Memes: { icon: '🐸', color: '#EAB308' },
  Gaming: { icon: '🎮', color: '#EC4899' },
  'Precious Metals': { icon: '🥇', color: '#FFD700' },
  Energy: { icon: '⛽', color: '#F97316' },
  Industrial: { icon: '🏭', color: '#78716C' },
  'Forex Majors': { icon: '💱', color: '#14B8A6' },
  'Forex Crosses': { icon: '💱', color: '#0D9488' },
  'Mega Cap Stocks': { icon: '📈', color: '#6366F1' },
  'Crypto Stocks': { icon: '📊', color: '#8B5CF6' },
  Indices: { icon: '📉', color: '#F43F5E' },
};

// Popular/trending symbols shown at top when no search
const POPULAR_SYMS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'PEPE'];

interface SymbolPickerProps {
  current: string;
  query: string;
  dynamicSymbols: string[];
  onSelect: (sym: string) => void;
  onQueryChange: (q: string) => void;
  onClose: () => void;
}

/** Fallback icon: circle with initials */
function InitialsIcon({ symbol, size = 20 }: { symbol: string; size?: number }) {
  return (
    <div className="rounded-full bg-white/[0.08] flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}>
      <span className="font-bold text-neutral-400 leading-none" style={{ fontSize: size * 0.4 }}>
        {symbol.slice(0, 2)}
      </span>
    </div>
  );
}

/** Coin icon with error fallback */
function CoinLogo({ symbol, size = 20 }: { symbol: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const src = getCoinIcon(symbol);
  const isDataUri = src.startsWith('data:');

  if (failed && !isDataUri) return <InitialsIcon symbol={symbol} size={size} />;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`${symbol} icon`}
      className="rounded-full flex-shrink-0 object-cover"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}

function SymbolPickerInner({ current, query, dynamicSymbols, onSelect, onQueryChange, onClose }: SymbolPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Scroll active item into view
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [current]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // Flatten all filtered symbols for count
  const allFiltered = Object.values(SYMBOLS).flat().filter(s => !query || s.toUpperCase().includes(query.toUpperCase()));
  const dynFiltered = dynamicSymbols.filter(s => !query || s.toUpperCase().includes(query.toUpperCase()));
  const totalResults = allFiltered.length + dynFiltered.length;
  const isSearching = query.length > 0;

  return (
    <div
      className="absolute top-full mt-1 left-0 z-50 w-80 max-w-[calc(100vw-2rem)] max-h-[34rem] overflow-y-auto rounded-2xl bg-[#111114] border border-white/[0.08] shadow-2xl backdrop-blur-xl"
      data-sym-picker
      data-testid="symbol-picker"
      onKeyDown={handleKeyDown}
    >
      {/* Search header */}
      <div className="p-3 border-b border-white/[0.06] sticky top-0 bg-[#111114]/95 backdrop-blur-md z-10">
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] focus-within:border-hub-yellow/30 focus-within:bg-white/[0.06] transition-all">
          <Search className="w-4 h-4 text-neutral-500 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            placeholder="Search symbols..."
            className="bg-transparent text-sm text-white placeholder:text-neutral-500 outline-none w-full"
          />
          {query && (
            <button onClick={() => onQueryChange('')} aria-label="Clear search" className="text-neutral-500 hover:text-white transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between px-1 mt-2">
          <p className="text-[9px] text-neutral-600">
            <kbd className="px-1.5 py-0.5 bg-white/[0.06] rounded text-[8px] font-mono">/</kbd>
            <span className="mx-1">search</span>
            <kbd className="px-1.5 py-0.5 bg-white/[0.06] rounded text-[8px] font-mono">Esc</kbd>
            <span className="ml-1">close</span>
          </p>
          {isSearching && (
            <p className="text-[9px] text-neutral-500 tabular-nums">{totalResults} result{totalResults !== 1 ? 's' : ''}</p>
          )}
        </div>
      </div>

      {/* Quick picks (when not searching) */}
      {!isSearching && (
        <div className="px-3 pt-3 pb-1">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="w-3 h-3 text-hub-yellow" />
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Popular</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {POPULAR_SYMS.map(s => (
              <button
                key={s}
                onClick={() => onSelect(s)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                  s === current
                    ? 'bg-hub-yellow/15 text-hub-yellow border border-hub-yellow/20'
                    : 'bg-white/[0.04] text-neutral-300 border border-white/[0.06] hover:bg-white/[0.08] hover:text-white hover:border-white/[0.12]'
                }`}
              >
                <CoinLogo symbol={s} size={16} />
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Categories */}
      <div className="py-1">
        {Object.entries(SYMBOLS).map(([group, syms]) => {
          const filtered = syms.filter(s => !query || s.toUpperCase().includes(query.toUpperCase()));
          if (!filtered.length) return null;
          const cat = CATEGORIES[group] || { icon: '•', color: '#888' };
          return (
            <div key={group}>
              {/* Category header */}
              <div className="px-3 py-2 flex items-center gap-2 mt-1 first:mt-0">
                <span className="w-5 h-5 rounded-md flex items-center justify-center text-xs" style={{ backgroundColor: cat.color + '15', color: cat.color }}>
                  {cat.icon}
                </span>
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">{group}</span>
                <span className="text-[9px] text-neutral-700 ml-auto tabular-nums font-medium">{filtered.length}</span>
              </div>
              {/* Symbol rows */}
              {filtered.map(s => {
                const isActive = s === current;
                return (
                  <div
                    key={s}
                    ref={isActive ? activeRef : undefined}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect(s)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(s); } }}
                    className={`w-full text-left px-3 py-[8px] text-[13px] flex items-center gap-3 transition-all group cursor-pointer
                      ${isActive
                        ? 'bg-hub-yellow/[0.08] text-hub-yellow'
                        : 'text-neutral-300 hover:bg-white/[0.04] hover:text-white'
                      }`}
                  >
                    <CoinLogo symbol={s} size={22} />
                    <span className="font-semibold">{s}</span>
                    <span className="text-[10px] text-neutral-600 font-normal">Perp</span>
                    <span className="ml-auto flex items-center gap-2">
                      <WatchlistStar symbol={s} />
                      {isActive && (
                        <ChevronRight className="w-3.5 h-3.5 text-hub-yellow" />
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Dynamic / discovered symbols */}
        {dynamicSymbols.length > 0 && (() => {
          const filtered = dynFiltered;
          if (!filtered.length) return null;
          return (
            <div>
              <div className="px-3 py-2 flex items-center gap-2 mt-1">
                <span className="w-5 h-5 rounded-md flex items-center justify-center text-xs bg-emerald-500/10 text-emerald-400">
                  ✦
                </span>
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">Discovered</span>
                <span className="text-[9px] text-neutral-700 ml-auto tabular-nums font-medium">{filtered.length}</span>
              </div>
              {filtered.slice(0, query ? 50 : 20).map(s => {
                const isActive = s === current;
                return (
                  <div
                    key={s}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect(s)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(s); } }}
                    className={`w-full text-left px-3 py-[8px] text-[13px] flex items-center gap-3 transition-all group cursor-pointer
                      ${isActive
                        ? 'bg-hub-yellow/[0.08] text-hub-yellow'
                        : 'text-neutral-300 hover:bg-white/[0.04] hover:text-white'
                      }`}
                  >
                    <CoinLogo symbol={s} size={22} />
                    <span className="font-semibold">{s}</span>
                    <span className="text-[10px] text-neutral-600 font-normal">Perp</span>
                    <span className="ml-auto flex items-center gap-2">
                      <WatchlistStar symbol={s} />
                      {isActive && (
                        <ChevronRight className="w-3.5 h-3.5 text-hub-yellow" />
                      )}
                    </span>
                  </div>
                );
              })}
              {!query && filtered.length > 20 && (
                <p className="px-3 py-2 text-[10px] text-neutral-600 italic">
                  Type to search {filtered.length - 20} more...
                </p>
              )}
            </div>
          );
        })()}
      </div>

      {/* Empty state */}
      {totalResults === 0 && query && (
        <div className="px-4 py-10 text-center">
          <p className="text-sm text-neutral-400">No symbols found</p>
          <p className="text-[10px] text-neutral-600 mt-1.5">Try a different search term</p>
        </div>
      )}
    </div>
  );
}

export const SymbolPicker = memo(SymbolPickerInner);
