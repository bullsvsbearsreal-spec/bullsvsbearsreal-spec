'use client';

import { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import WidgetSkeleton from '../WidgetSkeleton';
import UpdatedAgo from '../UpdatedAgo';

interface EconomicEvent {
  id: string;
  name: string;
  date: string;
  time?: string;
  impact: 'high' | 'medium' | 'low';
  category: string;
  country: string;
  forecast?: string;
  previous?: string;
  actual?: string;
}

const impactColors: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-yellow-500',
  low: 'bg-neutral-600',
};

export default function EconomicCalendarWidget({ wide }: { wide?: boolean }) {
  const [events, setEvents] = useState<EconomicEvent[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch('/api/economic-calendar');
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        const filtered = (data.events || [])
          .filter((e: EconomicEvent) => e.impact !== 'low')
          .slice(0, wide ? 8 : 5);
        setEvents(filtered);
        setUpdatedAt(Date.now());
      } catch {}
    };
    load();
    const interval = setInterval(load, 300_000); // 5 min
    return () => { mounted = false; clearInterval(interval); };
  }, [wide]);

  if (!events) return <WidgetSkeleton variant="list" />;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-xs font-medium text-neutral-300">Economic Calendar</span>
        </div>
        {updatedAt && <UpdatedAgo ts={updatedAt} />}
      </div>
      {events.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs text-neutral-600">
          No upcoming events
        </div>
      ) : (
        <div className="flex-1 space-y-1.5 overflow-y-auto">
          {events.map(e => (
            <div key={e.id} className="flex items-start gap-2 py-1 px-1.5 rounded hover:bg-neutral-800/50 transition-colors">
              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${impactColors[e.impact]}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-neutral-200 leading-tight truncate">{e.name}</p>
                <div className="flex items-center gap-2 text-[10px] text-neutral-500 mt-0.5">
                  <span>{e.country}</span>
                  <span>{e.date}{e.time ? ` ${e.time}` : ''}</span>
                  {e.forecast && <span>F: {e.forecast}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
