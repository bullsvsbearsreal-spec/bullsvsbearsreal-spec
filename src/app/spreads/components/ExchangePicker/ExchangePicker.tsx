'use client';

import { memo, useState, useMemo, useCallback } from 'react';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { CEX_EXCHANGES, DEX_EXCHANGES, ALL_EXCHANGES } from '../../lib/symbols';
import type { Candle } from '../../lib/types';

interface ExchangePickerProps {
  selected: string[];
  klineData: Record<string, Candle[]> | null;
  tf: string;
  onToggle: (exchange: string) => void;
}

function ExchangePickerInner({ selected, klineData, tf, onToggle }: ExchangePickerProps) {
  const [search, setSearch] = useState('');
  const q = search.toLowerCase();

  const filteredCex = useMemo(() =>
    CEX_EXCHANGES.filter(e => e.toLowerCase().includes(q)), [q]);
  const filteredDex = useMemo(() =>
    DEX_EXCHANGES.filter(e => e.toLowerCase().includes(q)), [q]);

  const selectAll = useCallback(() => {
    ALL_EXCHANGES.forEach(e => { if (!selected.includes(e)) onToggle(e); });
  }, [selected, onToggle]);

  const selectNone = useCallback(() => {
    selected.forEach(e => onToggle(e));
  }, [selected, onToggle]);

  const cexSelected = CEX_EXCHANGES.filter(e => selected.includes(e)).length;
  const dexSelected = DEX_EXCHANGES.filter(e => selected.includes(e)).length;

  return (
    <div className="absolute top-full mt-1 left-0 z-50 w-64 max-h-[26rem] overflow-hidden rounded-xl bg-[#141418] border border-white/[0.08] shadow-2xl flex flex-col">
      {/* Header */}
      <div className="p-2.5 pb-2 border-b border-white/[0.06] bg-[#141418] z-10 shrink-0">
        <div className="flex items-center justify-between mb-2 px-0.5">
          <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">
            Exchanges
            <span className="ml-1.5 text-hub-yellow">{selected.length}</span>
            <span className="text-neutral-600">/{ALL_EXCHANGES.length}</span>
          </p>
          <div className="flex gap-1.5">
            <button
              onClick={selectAll}
              className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              All
            </button>
            <button
              onClick={selectNone}
              className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              None
            </button>
          </div>
        </div>
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Filter..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg pl-7 pr-2 py-1.5 text-[11px] text-neutral-300 placeholder:text-neutral-600 outline-none focus:border-hub-yellow/30 transition-colors"
          />
        </div>
      </div>

      {/* Scrollable list */}
      <div className="overflow-y-auto flex-1 py-1 scrollbar-thin">
        {/* CEX section */}
        {filteredCex.length > 0 && (
          <>
            <div className="px-3 py-1.5 flex items-center gap-2">
              <p className="text-[9px] text-neutral-600 uppercase tracking-wider font-medium">
                CEX
              </p>
              <span className="text-[9px] text-neutral-700">{cexSelected}/{CEX_EXCHANGES.length}</span>
              <div className="flex-1 h-px bg-white/[0.04]" />
            </div>
            {filteredCex.map(e => (
              <ExchangeRow key={e} exchange={e} selected={selected.includes(e)} hasKline={!!klineData?.[e]} tf={tf} onToggle={onToggle} />
            ))}
          </>
        )}
        {/* DEX section */}
        {filteredDex.length > 0 && (
          <>
            <div className="px-3 py-1.5 flex items-center gap-2 mt-1">
              <p className="text-[9px] text-neutral-600 uppercase tracking-wider font-medium">
                DEX
              </p>
              <span className="text-[9px] text-neutral-700">{dexSelected}/{DEX_EXCHANGES.length}</span>
              <div className="flex-1 h-px bg-white/[0.04]" />
            </div>
            {filteredDex.map(e => (
              <ExchangeRow key={e} exchange={e} selected={selected.includes(e)} hasKline={!!klineData?.[e]} tf={tf} onToggle={onToggle} />
            ))}
          </>
        )}
        {filteredCex.length === 0 && filteredDex.length === 0 && (
          <p className="px-3 py-4 text-[11px] text-neutral-600 text-center">No exchanges match &ldquo;{search}&rdquo;</p>
        )}
      </div>
    </div>
  );
}

const ExchangeRow = memo(function ExchangeRow({
  exchange,
  selected,
  hasKline,
  tf,
  onToggle,
}: {
  exchange: string;
  selected: boolean;
  hasKline: boolean;
  tf: string;
  onToggle: (e: string) => void;
}) {
  return (
    <button
      onClick={() => onToggle(exchange)}
      className={`group w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition-colors ${
        selected
          ? 'text-neutral-200 hover:bg-white/[0.04]'
          : 'text-neutral-500 hover:bg-white/[0.03] hover:text-neutral-400'
      }`}
    >
      <span className="flex items-center gap-2.5 min-w-0">
        <span className={`shrink-0 transition-opacity ${selected ? 'opacity-100' : 'opacity-50 group-hover:opacity-70'}`}>
          <ExchangeLogo exchange={exchange} size={20} />
        </span>
        <span className="truncate font-medium">{exchange}</span>
        {tf !== 'live' && !hasKline && (
          <span className="shrink-0 text-[7px] px-1 py-[1px] rounded bg-neutral-800/80 text-neutral-600">table only</span>
        )}
      </span>
      <span
        className={`shrink-0 w-[18px] h-[18px] rounded-md flex items-center justify-center transition-all ${
          selected
            ? 'bg-hub-yellow/20 text-hub-yellow shadow-[0_0_6px_rgba(var(--hub-accent-rgb),0.15)]'
            : 'border border-white/[0.08] group-hover:border-white/[0.15]'
        }`}
      >
        {selected && (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
    </button>
  );
});

export const ExchangePicker = memo(ExchangePickerInner);
