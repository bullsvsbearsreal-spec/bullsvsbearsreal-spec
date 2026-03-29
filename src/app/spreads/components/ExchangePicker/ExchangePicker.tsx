'use client';

import { memo, useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Search, X, Check, ChevronRight, Globe, Layers } from 'lucide-react';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { CEX_EXCHANGES, DEX_EXCHANGES, ALL_EXCHANGES } from '../../lib/symbols';
import type { Candle } from '../../lib/types';

interface ExchangePickerProps {
  selected: string[];
  klineData: Record<string, Candle[]> | null;
  tf: string;
  onToggle: (exchange: string) => void;
  onSetExchanges: (exchanges: string[]) => void;
}

function ExchangePickerInner({ selected, klineData, tf, onToggle, onSetExchanges }: ExchangePickerProps) {
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const q = search.toLowerCase();

  useEffect(() => { inputRef.current?.focus(); }, []);

  const filteredCex = useMemo(() =>
    CEX_EXCHANGES.filter(e => e.toLowerCase().includes(q)), [q]);
  const filteredDex = useMemo(() =>
    DEX_EXCHANGES.filter(e => e.toLowerCase().includes(q)), [q]);

  const selectAll = useCallback(() => {
    onSetExchanges([...ALL_EXCHANGES]);
  }, [onSetExchanges]);

  const selectNone = useCallback(() => {
    onSetExchanges([]);
  }, [onSetExchanges]);

  const cexSelected = CEX_EXCHANGES.filter(e => selected.includes(e)).length;
  const dexSelected = DEX_EXCHANGES.filter(e => selected.includes(e)).length;
  const totalSelected = selected.length;
  const totalExchanges = ALL_EXCHANGES.length;
  const fillPct = Math.round((totalSelected / totalExchanges) * 100);

  return (
    <div className="absolute top-full mt-1 left-0 z-50 w-72 max-h-[28rem] overflow-hidden rounded-2xl bg-[#111114] border border-white/[0.08] shadow-2xl flex flex-col">
      {/* Header with count + progress */}
      <div className="p-3 pb-2.5 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-hub-yellow/10 flex items-center justify-center">
              <Layers className="w-3 h-3 text-hub-yellow" />
            </div>
            <div>
              <span className="text-xs font-semibold text-white">Exchanges</span>
              <span className="ml-1.5 text-xs tabular-nums">
                <span className="text-hub-yellow font-bold">{totalSelected}</span>
                <span className="text-neutral-600">/{totalExchanges}</span>
              </span>
            </div>
          </div>
          <div className="flex gap-1">
            <button onClick={selectAll}
              className="text-[9px] px-2 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-neutral-400 hover:text-white transition font-medium">
              All
            </button>
            <button onClick={selectNone}
              className="text-[9px] px-2 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-neutral-400 hover:text-white transition font-medium">
              None
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-[3px] rounded-full bg-white/[0.04] mb-2.5 overflow-hidden">
          <div className="h-full rounded-full bg-hub-yellow/40 transition-all duration-300" style={{ width: `${fillPct}%` }} />
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] focus-within:border-hub-yellow/30 transition-colors">
          <Search className="w-3.5 h-3.5 text-neutral-500 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Filter exchanges..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-transparent text-xs text-white placeholder:text-neutral-600 outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-neutral-500 hover:text-white transition">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable list */}
      <div className="overflow-y-auto flex-1 py-1 scrollbar-thin">
        {/* CEX section */}
        {filteredCex.length > 0 && (
          <div>
            <div className="px-3 py-2 flex items-center gap-2">
              <Globe className="w-3 h-3 text-blue-400" />
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">CEX</span>
              <span className="text-[9px] tabular-nums text-blue-400/60 font-medium">{cexSelected}/{CEX_EXCHANGES.length}</span>
              <div className="flex-1 h-px bg-white/[0.04]" />
            </div>
            {filteredCex.map(e => (
              <ExchangeRow key={e} exchange={e} selected={selected.includes(e)} hasKline={!!klineData?.[e]} tf={tf} onToggle={onToggle} />
            ))}
          </div>
        )}
        {/* DEX section */}
        {filteredDex.length > 0 && (
          <div>
            <div className="px-3 py-2 flex items-center gap-2 mt-0.5">
              <Layers className="w-3 h-3 text-purple-400" />
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">DEX</span>
              <span className="text-[9px] tabular-nums text-purple-400/60 font-medium">{dexSelected}/{DEX_EXCHANGES.length}</span>
              <div className="flex-1 h-px bg-white/[0.04]" />
            </div>
            {filteredDex.map(e => (
              <ExchangeRow key={e} exchange={e} selected={selected.includes(e)} hasKline={!!klineData?.[e]} tf={tf} onToggle={onToggle} />
            ))}
          </div>
        )}
        {filteredCex.length === 0 && filteredDex.length === 0 && (
          <div className="px-4 py-6 text-center">
            <p className="text-[11px] text-neutral-500">No exchanges match &ldquo;{search}&rdquo;</p>
          </div>
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
      className={`group w-full text-left px-3 py-[7px] text-xs flex items-center justify-between transition-all ${
        selected
          ? 'text-white hover:bg-white/[0.04]'
          : 'text-neutral-500 hover:bg-white/[0.03] hover:text-neutral-300'
      }`}
    >
      <span className="flex items-center gap-2.5 min-w-0">
        <span className={`shrink-0 transition-all ${selected ? 'opacity-100 scale-100' : 'opacity-40 scale-95 group-hover:opacity-60'}`}>
          <ExchangeLogo exchange={exchange} size={20} />
        </span>
        <span className={`truncate font-medium transition-colors ${selected ? 'text-white' : ''}`}>{exchange}</span>
        {tf !== 'live' && !hasKline && selected && (
          <span className="shrink-0 text-[7px] px-1.5 py-[1px] rounded-full bg-amber-500/10 text-amber-500/60 font-medium">table only</span>
        )}
      </span>
      <span
        className={`shrink-0 w-[18px] h-[18px] rounded-md flex items-center justify-center transition-all ${
          selected
            ? 'bg-hub-yellow text-black'
            : 'border border-white/[0.1] group-hover:border-white/[0.2]'
        }`}
      >
        {selected && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
      </span>
    </button>
  );
});

export const ExchangePicker = memo(ExchangePickerInner);
