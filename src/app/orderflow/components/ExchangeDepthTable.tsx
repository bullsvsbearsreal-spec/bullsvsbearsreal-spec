'use client';

import { useMemo, useState } from 'react';

/* ─── Types ──────────────────────────────────────────────────────── */

interface VenueData {
  exchange: string;
  available: boolean;
  midPrice: number;
  bidDepthUsd: number;
  askDepthUsd: number;
  slippage: Record<number, { bid: number; ask: number }>;
  error?: string;
}

interface ExchangeDepthTableProps {
  venues: VenueData[];
  depthSizes: number[];
}

/* ─── Constants ──────────────────────────────────────────────────── */

const EXCHANGE_DOT_COLORS: Record<string, string> = {
  'Binance': '#EAB308',
  'Bybit': '#F97316',
  'OKX': '#FFFFFF',
  'Bitget': '#22D3EE',
  'Hyperliquid': '#4ADE80',
  'dYdX': '#A855F7',
  'Drift': '#A78BFA',
  'Aster': '#EC4899',
  'Aevo': '#FB7185',
  'Lighter': '#34D399',
};

/* ─── Helpers ────────────────────────────────────────────────────── */

function formatUsd(v: number): string {
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
  return '$' + v.toFixed(0);
}

function formatPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(4);
  return p.toFixed(6);
}

function slippageColor(bps: number): string {
  if (bps < 0.05) return 'text-green-400';
  if (bps < 0.2) return 'text-yellow-400';
  return 'text-red-400';
}

function formatSize(size: number): string {
  if (size >= 1e6) return '$' + (size / 1e6).toFixed(0) + 'M';
  if (size >= 1e3) return '$' + (size / 1e3).toFixed(0) + 'K';
  return '$' + size;
}

type SortKey = 'exchange' | 'midPrice' | 'bidDepth' | 'askDepth' | 'totalDepth';

/* ─── Component ──────────────────────────────────────────────────── */

export default function ExchangeDepthTable({ venues, depthSizes }: ExchangeDepthTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('totalDepth');
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sorted = useMemo(() => {
    const available = venues.filter(v => v.available);
    return [...available].sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0;
      switch (sortKey) {
        case 'exchange': va = a.exchange; vb = b.exchange; break;
        case 'midPrice': va = a.midPrice; vb = b.midPrice; break;
        case 'bidDepth': va = a.bidDepthUsd; vb = b.bidDepthUsd; break;
        case 'askDepth': va = a.askDepthUsd; vb = b.askDepthUsd; break;
        case 'totalDepth': va = a.bidDepthUsd + a.askDepthUsd; vb = b.bidDepthUsd + b.askDepthUsd; break;
      }
      if (typeof va === 'string') return sortAsc ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [venues, sortKey, sortAsc]);

  const unavailable = venues.filter(v => !v.available);

  const SortHeader = ({ label, sKey, className = '' }: { label: string; sKey: SortKey; className?: string }) => (
    <th
      className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 cursor-pointer hover:text-neutral-300 transition-colors ${className}`}
      onClick={() => handleSort(sKey)}
    >
      {label} {sortKey === sKey ? (sortAsc ? '↑' : '↓') : ''}
    </th>
  );

  return (
    <div className="rounded-xl border border-white/[0.06] bg-hub-darker overflow-hidden">
      <div className="p-4 border-b border-white/[0.06]">
        <h3 className="text-sm font-semibold text-white">Exchange Depth Comparison</h3>
        <p className="text-xs text-neutral-600 mt-0.5">Slippage at various order sizes (bid+ask average)</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <SortHeader label="Exchange" sKey="exchange" className="text-left" />
              <SortHeader label="Mid Price" sKey="midPrice" className="text-right" />
              <SortHeader label="Bid Depth" sKey="bidDepth" className="text-right" />
              <SortHeader label="Ask Depth" sKey="askDepth" className="text-right" />
              <SortHeader label="Total" sKey="totalDepth" className="text-right" />
              {depthSizes.map(size => (
                <th key={size} className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 text-right">
                  {formatSize(size)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(v => {
              const totalDepth = v.bidDepthUsd + v.askDepthUsd;
              return (
                <tr key={v.exchange} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: EXCHANGE_DOT_COLORS[v.exchange] || '#6B7280' }} />
                      <span className="text-xs font-medium text-white">{v.exchange}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs font-mono text-neutral-300 text-right">
                    {formatPrice(v.midPrice)}
                  </td>
                  <td className="px-3 py-2.5 text-xs font-mono text-green-400 text-right">
                    {formatUsd(v.bidDepthUsd)}
                  </td>
                  <td className="px-3 py-2.5 text-xs font-mono text-red-400 text-right">
                    {formatUsd(v.askDepthUsd)}
                  </td>
                  <td className="px-3 py-2.5 text-xs font-mono text-white font-medium text-right">
                    {formatUsd(totalDepth)}
                  </td>
                  {depthSizes.map(size => {
                    const slip = v.slippage[size];
                    if (!slip) return <td key={size} className="px-3 py-2.5 text-xs text-neutral-600 text-right">—</td>;
                    const avg = (slip.bid + slip.ask) / 2;
                    return (
                      <td key={size} className={`px-3 py-2.5 text-xs font-mono text-right ${slippageColor(avg)}`}>
                        {avg.toFixed(3)}%
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {unavailable.map(v => (
              <tr key={v.exchange} className="border-b border-white/[0.03] opacity-40">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0 bg-neutral-600" />
                    <span className="text-xs text-neutral-500">{v.exchange}</span>
                  </div>
                </td>
                <td colSpan={4 + depthSizes.length} className="px-3 py-2.5 text-xs text-neutral-600">
                  {v.error === 'unsupported' ? 'Not supported' : 'Offline / Error'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
