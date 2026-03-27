'use client';

import { memo } from 'react';
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
  return (
    <div className="absolute top-full mt-1 left-0 z-50 w-52 max-h-72 overflow-y-auto rounded-xl bg-[#141418] border border-white/[0.08] shadow-2xl">
      <div className="p-2 border-b border-white/[0.06] sticky top-0 bg-[#141418] z-10">
        <p className="text-[9px] text-neutral-600 uppercase tracking-wider font-semibold px-1 mb-1">
          Select exchanges ({selected.length}/{ALL_EXCHANGES.length})
        </p>
      </div>
      <div className="py-1">
        <p className="px-3 py-1 text-[8px] text-neutral-600 uppercase tracking-wider">
          CEX ({CEX_EXCHANGES.length})
        </p>
        {CEX_EXCHANGES.map(e => (
          <ExchangeRow key={e} exchange={e} selected={selected.includes(e)} hasKline={!!klineData?.[e]} tf={tf} onToggle={onToggle} />
        ))}
        <p className="px-3 py-1 text-[8px] text-neutral-600 uppercase tracking-wider mt-1 border-t border-white/[0.06] pt-2">
          DEX ({DEX_EXCHANGES.length})
        </p>
        {DEX_EXCHANGES.map(e => (
          <ExchangeRow key={e} exchange={e} selected={selected.includes(e)} hasKline={!!klineData?.[e]} tf={tf} onToggle={onToggle} />
        ))}
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
      className={`w-full text-left px-3 py-2 text-xs hover:bg-white/[0.04] flex items-center justify-between ${
        selected ? 'text-hub-yellow' : 'text-neutral-400'
      }`}
    >
      <span className="flex items-center gap-2.5">
        <ExchangeLogo exchange={exchange} size={18} />
        {exchange}
        {tf !== 'live' && !hasKline && (
          <span className="text-[7px] px-1 py-[0.5px] rounded bg-neutral-800 text-neutral-500">table only</span>
        )}
      </span>
      {selected ? (
        <span className="w-4 h-4 rounded bg-hub-yellow/20 flex items-center justify-center text-hub-yellow text-[10px]">✓</span>
      ) : (
        <span className="w-4 h-4 rounded border border-white/[0.1]" />
      )}
    </button>
  );
});

export const ExchangePicker = memo(ExchangePickerInner);
