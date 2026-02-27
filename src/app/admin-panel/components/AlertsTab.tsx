'use client';

import { useEffect, useState } from 'react';
import AlertHealthPanel from './AlertHealthPanel';
import HeatmapChart from './HeatmapChart';
import { TableSkeleton, ChartSkeleton } from './AdminSkeletons';

function downloadCSV(data: any, filename: string) {
  if (!data?.recent?.length) return;
  const header = 'Type,Symbol,Exchange,Message,Sent At\n';
  const rows = data.recent.map((n: any) =>
    `"${n.type}","${n.symbol}","${n.exchange || ''}","${(n.message || '').replace(/"/g, '""')}","${n.sent_at}"`,
  );
  const blob = new Blob([header + rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AlertsTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/monitoring/alerts')
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <TableSkeleton rows={4} />
        <ChartSkeleton height={80} />
      </div>
    );
  }

  // Build hourly heatmap from recent alerts
  const hourly = Array(24).fill(0);
  if (data?.recent) {
    for (const n of data.recent) {
      const h = new Date(n.sent_at).getHours();
      hourly[h]++;
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-500">Alert system health and notification history</p>
        {data && (
          <button
            onClick={() => downloadCSV(data, `alerts-${new Date().toISOString().slice(0, 10)}.csv`)}
            className="text-[11px] px-2.5 py-1 rounded-lg border border-white/[0.08] text-neutral-400 hover:text-white hover:bg-white/[0.04] transition-colors"
          >
            Export CSV
          </button>
        )}
      </div>

      <AlertHealthPanel data={data} />

      {data?.recent?.length > 0 && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-3">
          <HeatmapChart data={hourly} label="Alerts by Hour (24h)" />
        </div>
      )}
    </div>
  );
}
