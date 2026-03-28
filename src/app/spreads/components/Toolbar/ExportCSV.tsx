'use client';

import { memo, useCallback } from 'react';
import { Download } from 'lucide-react';
import type { Pt } from '../../lib/types';

interface ExportCSVProps {
  data: Pt[];
  exchanges: string[];
  symbol: string;
}

/** Escape a CSV field — wrap in quotes if it contains comma, quote, or newline */
function escapeCSV(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}

function ExportCSVInner({ data, exchanges, symbol }: ExportCSVProps) {
  const handleExport = useCallback(() => {
    if (data.length === 0) return;

    const headers = [
      'Timestamp_UTC',
      'Time_Label',
      ...exchanges.map(e => escapeCSV(e + '_Price')),
      ...exchanges.map(e => escapeCSV(e + '_Deviation_%')),
      'Spread_USD',
      'Spread_Pct',
      'Spread_BPS',
    ];

    const rows = data.map(pt => {
      const vals = [
        new Date(pt.time).toISOString(),
        escapeCSV(pt.label || ''),
        ...exchanges.map(e => typeof pt[e] === 'number' ? (pt[e] as number).toFixed(8) : ''),
        ...exchanges.map(e => {
          const dev = pt[e + '_dev'];
          return typeof dev === 'number' ? dev.toFixed(6) : '';
        }),
        pt._spread != null ? pt._spread.toFixed(8) : '',
        pt._spreadPct != null ? pt._spreadPct.toFixed(6) : '',
        pt._spreadPct != null ? (pt._spreadPct * 100).toFixed(2) : '',
      ];
      return vals.join(',');
    });

    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n'); // BOM for Excel UTF-8
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${symbol}_spreads_${exchanges.length}ex_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data, exchanges, symbol]);

  return (
    <button
      onClick={handleExport}
      disabled={data.length === 0}
      className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-neutral-400 hover:text-white transition flex items-center gap-1.5 disabled:opacity-30"
      title={`Export ${data.length} data points across ${exchanges.length} exchanges as CSV`}
    >
      <Download className="w-3.5 h-3.5" />
      CSV
    </button>
  );
}

export const ExportCSV = memo(ExportCSVInner);
