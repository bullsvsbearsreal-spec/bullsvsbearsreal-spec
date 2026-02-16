'use client';

import { HealthResponse } from '@/lib/types';

export default function ErrorLog({ data }: { data: HealthResponse }) {
  const errors = data.errors;

  if (errors.length === 0) {
    return (
      <div className="admin-card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-neutral-500 uppercase tracking-wider">Error Log</span>
          <span className="text-emerald-400 text-xs">No errors</span>
        </div>
        <p className="text-neutral-700 text-xs">All exchanges reporting OK</p>
      </div>
    );
  }

  return (
    <div className="admin-card !p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-terminal-border flex items-center justify-between">
        <span className="text-[11px] text-neutral-500 uppercase tracking-wider">
          Error Log
          <span className="text-red-400 ml-2">{errors.length} errors</span>
        </span>
      </div>

      <div className="max-h-48 overflow-y-auto">
        {errors.map((err, i) => (
          <div
            key={i}
            className="flex items-start gap-3 px-4 py-2 border-b border-terminal-border text-xs hover:bg-red-500/[0.02]"
          >
            <span className="text-neutral-600 shrink-0">
              {new Date(data.timestamp).toLocaleTimeString()}
            </span>
            <span className="text-white font-medium shrink-0 w-20">{err.exchange}</span>
            <span className="text-neutral-500 shrink-0 w-16">/{err.route}</span>
            <span className="text-red-400/80 flex-1 truncate">{err.error}</span>
            <span className="text-neutral-600 shrink-0">
              {(err.latencyMs / 1000).toFixed(1)}s
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
