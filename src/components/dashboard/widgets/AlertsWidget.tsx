'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';

export default function AlertsWidget() {
  const [alerts, setAlerts] = useState<any[] | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/user/data');
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) setAlerts((data.alerts || []).filter((a: any) => a.enabled !== false));
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  if (alerts === null) {
    return <div className="h-12 flex items-center justify-center"><div className="w-5 h-5 border-2 border-hub-yellow/30 border-t-hub-yellow rounded-full animate-spin" /></div>;
  }

  if (alerts.length === 0) {
    return (
      <div className="text-center py-2">
        <Bell className="w-5 h-5 text-neutral-700 mx-auto mb-1" />
        <p className="text-xs text-neutral-600">No active alerts</p>
        <Link href="/alerts" className="text-[10px] text-hub-yellow hover:underline">Create alert</Link>
      </div>
    );
  }

  return (
    <div>
      <p className="text-lg font-bold text-white mb-2">{alerts.length} active</p>
      <div className="space-y-1">
        {alerts.slice(0, 4).map((a: any, i: number) => (
          <div key={a.id || i} className="text-xs text-neutral-500 truncate">
            {a.symbol} {a.metric} {a.operator === 'gt' ? '>' : '<'} {a.value}
          </div>
        ))}
        {alerts.length > 4 && (
          <div className="text-[10px] text-neutral-600">+{alerts.length - 4} more</div>
        )}
      </div>
    </div>
  );
}
