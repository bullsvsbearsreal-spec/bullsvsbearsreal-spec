'use client';

import { memo, useCallback } from 'react';
import { Download } from 'lucide-react';
import type { Pt } from '../../lib/types';

interface ExportCSVProps {
  data: Pt[];
  exchanges: string[];
  symbol: string;
}

function ExportCSVInner({ data, exchanges, symbol }: ExportCSVProps) {
  const handleExport = useCallback(() => {
    if (data.length === 0) return;

    const headers = ['Time', ...exchanges, 'Spread_USD', 'Spread_Pct'];
    const rows = data.map(pt => {
      const vals = [
        pt.label || new Date(pt.time).toISOString(),
        ...exchanges.map(e => typeof pt[e] === 'number' ? (pt[e] as number).toString() : ''),
        pt._spread?.toString() || '',
        pt._spreadPct?.toString() || '',
      ];
      return vals.join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${symbol}_spreads_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data, exchanges, symbol]);

  return (
    <button
      onClick={handleExport}
      disabled={data.length === 0}
      className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-neutral-400 hover:text-white transition flex items-center gap-1.5 disabled:opacity-30"
      title="Export chart data as CSV"
    >
      <Download className="w-3.5 h-3.5" />
      CSV
    </button>
  );
}

export const ExportCSV = memo(ExportCSVInner);
