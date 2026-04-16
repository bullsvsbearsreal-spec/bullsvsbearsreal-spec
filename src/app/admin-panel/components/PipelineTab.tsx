'use client';

import { useEffect, useState } from 'react';
import ExchangeStatusBoard from './ExchangeStatusBoard';
import CollectorHealth from './CollectorHealth';
import WorkerHealthCard from './WorkerHealthCard';
import DataQualityPanel from './DataQualityPanel';
import { TableSkeleton, ChartSkeleton } from './AdminSkeletons';

function downloadJSON(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PipelineTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/monitoring/pipeline', { signal: AbortSignal.timeout(15000) })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData)
      .catch((e) => setError(e?.message || 'Failed to load pipeline data'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <TableSkeleton rows={6} />
        <ChartSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/[0.03] p-6 text-center">
        <p className="text-sm text-red-400 mb-2">Failed to load pipeline data: {error}</p>
        <button onClick={() => window.location.reload()} className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-500">Exchange pipeline health and data quality</p>
        {data && (
          <button
            onClick={() => downloadJSON(data, `pipeline-${new Date().toISOString().slice(0, 10)}.json`)}
            className="text-[11px] px-2.5 py-1 rounded-lg border border-white/[0.08] text-neutral-400 hover:text-white hover:bg-white/[0.04] transition-colors"
          >
            Export JSON
          </button>
        )}
      </div>

      <ExchangeStatusBoard
        exchangeHealth={data?.exchangeHealth ?? null}
        staleExchanges={data?.staleExchanges ?? []}
      />

      <CollectorHealth collector={data?.collector ?? null} />

      <WorkerHealthCard />

      <DataQualityPanel
        outliers={data?.outliers ?? []}
        anomalies={data?.anomalies ?? { zeroOI: [], nullFunding: [], totalZeroOI: 0, totalNullFunding: 0 }}
        coverage={data?.coverage ?? []}
      />
    </div>
  );
}
