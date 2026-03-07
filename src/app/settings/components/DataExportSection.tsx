'use client';

import { useState } from 'react';
import { Download, FileJson, FileSpreadsheet, Loader2 } from 'lucide-react';

export default function DataExportSection() {
  const [exporting, setExporting] = useState(false);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/user/data');
      if (!res.ok) throw new Error();
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `infohub-data-${new Date().toISOString().split('T')[0]}.json`);
    } catch {}
    setExporting(false);
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/user/data');
      if (!res.ok) throw new Error();
      const data = await res.json();

      const lines: string[] = ['Type,Symbol,Quantity,EntryPrice,Notes'];
      (data.watchlist || []).forEach((sym: string) => {
        lines.push(`Watchlist,${sym},,,`);
      });
      (data.portfolio || []).forEach((h: { symbol?: string; quantity?: number; entryPrice?: number; notes?: string }) => {
        lines.push(`Portfolio,${h.symbol || ''},${h.quantity || ''},${h.entryPrice || ''},${h.notes || ''}`);
      });

      const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
      downloadBlob(blob, `infohub-data-${new Date().toISOString().split('T')[0]}.csv`);
    } catch {}
    setExporting(false);
  };

  return (
    <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-4">
      <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
        <Download className="w-4 h-4 text-hub-yellow" />
        Export Data
      </h2>
      <p className="text-xs text-neutral-600 mb-3">
        Download your watchlists, alerts, portfolio, wallets, and screener presets.
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleExportJSON}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-neutral-300 hover:text-white hover:bg-white/[0.08] transition-colors disabled:opacity-50"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileJson className="w-4 h-4" />}
          JSON
        </button>
        <button
          onClick={handleExportCSV}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-neutral-300 hover:text-white hover:bg-white/[0.08] transition-colors disabled:opacity-50"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
          CSV
        </button>
      </div>
    </div>
  );
}
