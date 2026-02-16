'use client';

import { HealthResponse } from '@/lib/types';

export default function ErrorLog({ data }: { data: HealthResponse }) {
  const errors = data.errors;

  if (errors.length === 0) {
    return (
      <div className="admin-card text-center py-6">
        <div
          className="inline-flex items-center justify-center w-8 h-8 rounded-full mb-2"
          style={{ background: 'rgb(var(--admin-accent-rgb) / 0.1)' }}
        >
          <svg className="w-4 h-4" style={{ color: 'var(--admin-accent)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--admin-text-muted)' }}>
          All systems operational
        </p>
      </div>
    );
  }

  return (
    <div className="admin-card admin-card-accent !p-0 overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--admin-border)' }}>
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--admin-text-muted)' }}>
            Error Log
          </span>
          {/* Pulsing red dot */}
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        </div>
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded"
          style={{ color: '#f87171', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
        >
          {errors.length} error{errors.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="max-h-64 overflow-y-auto">
        {errors.map((err, i) => (
          <div
            key={i}
            className="flex items-start gap-3 px-4 py-2.5 text-xs transition-colors"
            style={{
              borderBottom: '1px solid var(--admin-border)',
              borderLeft: '2px solid rgba(239, 68, 68, 0.3)',
            }}
          >
            <span className="shrink-0" style={{ color: 'var(--admin-text-muted)' }}>
              {new Date(data.timestamp).toLocaleTimeString()}
            </span>
            <span className="text-white font-medium shrink-0 w-20">{err.exchange}</span>
            <span className="shrink-0 w-16" style={{ color: 'var(--admin-text-muted)' }}>/{err.route}</span>
            <span className="flex-1 truncate" style={{ color: 'rgba(248, 113, 113, 0.8)' }}>{err.error}</span>
            <span className="shrink-0" style={{ color: 'var(--admin-text-muted)' }}>
              {(err.latencyMs / 1000).toFixed(1)}s
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
