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

  useEffect(() => {
    fetch('/api/admin/monitoring/database')
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <TableSkeleton rows={6} />;

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
