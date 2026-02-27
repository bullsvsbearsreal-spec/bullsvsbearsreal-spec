'use client';

import { useEffect, useState } from 'react';
import { TimelineSkeleton } from './AdminSkeletons';

interface AuditEvent {
  id?: string;
  metric: string;
  value: number;
  recorded_at: string;
  details?: Record<string, any>;
}

const ICONS: Record<string, { icon: React.ReactNode; color: string }> = {
  cache_flush: {
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
      </svg>
    ),
    color: 'text-red-400 bg-red-500/10',
  },
  health_check: {
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
    ),
    color: 'text-emerald-400 bg-emerald-500/10',
  },
  broadcast: {
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783" />
      </svg>
    ),
    color: 'text-blue-400 bg-blue-500/10',
  },
};

const DEFAULT_ICON = {
  icon: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  color: 'text-neutral-400 bg-white/[0.06]',
};

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return d.toLocaleDateString();
}

function eventLabel(metric: string): string {
  const type = metric.replace('audit_', '');
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AuditTimeline({ limit = 10 }: { limit?: number }) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/audit-log?limit=${limit}`)
      .then((r) => r.json())
      .then((d) => setEvents(d.events ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [limit]);

  if (loading) return <TimelineSkeleton items={5} />;

  if (events.length === 0) {
    return <p className="text-xs text-neutral-600 py-4 text-center">No audit events yet</p>;
  }

  return (
    <div className="space-y-0">
      {events.map((ev, i) => {
        const type = ev.metric.replace('audit_', '');
        const { icon, color } = ICONS[type] || DEFAULT_ICON;
        return (
          <div key={`${ev.recorded_at}-${i}`} className="flex items-start gap-3 py-2">
            <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${color}`}>
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white">{eventLabel(ev.metric)}</p>
              {ev.details && (
                <p className="text-[10px] text-neutral-500 truncate">
                  {ev.details.admin && `by ${ev.details.admin}`}
                  {ev.details.clearedEntries != null && ` — ${ev.details.clearedEntries} entries`}
                  {ev.details.status && ` — ${ev.details.status}`}
                </p>
              )}
            </div>
            <span className="text-[10px] text-neutral-600 shrink-0">{formatTime(ev.recorded_at)}</span>
          </div>
        );
      })}
    </div>
  );
}
