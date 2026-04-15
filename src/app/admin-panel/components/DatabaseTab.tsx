'use client';

import { useEffect, useState } from 'react';
import DatabasePanel from './DatabasePanel';
import { TableSkeleton } from './AdminSkeletons';

function downloadCSV(data: any, filename: string) {
  if (!data?.tables?.length) return;
  const header = 'Table,Rows,Size,Growth 7d\n';
  const rows = data.tables.map((t: any) =>
    `"${t.name}",${t.rows},"${t.size}","${t.growth7d || ''}"`,
  );
  const blob = new Blob([header + rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DatabaseTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/monitoring/database', { signal: AbortSignal.timeout(15000) })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData)
      .catch((e) => setError(e?.message || 'Failed to load database stats'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <TableSkeleton rows={6} />;

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/[0.03] p-6 text-center">
        <p className="text-sm text-red-400 mb-2">Failed to load database stats: {error}</p>
        <button onClick={() => window.location.reload()} className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-500">Database size, growth, and table details</p>
        {data && (
          <button
            onClick={() => downloadCSV(data, `database-${new Date().toISOString().slice(0, 10)}.csv`)}
            className="text-[11px] px-2.5 py-1 rounded-lg border border-white/[0.08] text-neutral-400 hover:text-white hover:bg-white/[0.04] transition-colors"
          >
            Export CSV
          </button>
        )}
      </div>

      <DatabasePanel data={data} />
    </div>
  );
}
