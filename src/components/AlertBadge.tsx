'use client';

import { useState, useEffect } from 'react';
import { getUndismissedCount } from '@/lib/storage/alerts';

/**
 * Small red badge showing count of undismissed triggered alerts.
 * Re-checks every 10 seconds.
 */
export default function AlertBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const check = () => setCount(getUndismissedCount());
    check();
    const interval = setInterval(check, 10_000);
    return () => clearInterval(interval);
  }, []);

  if (count === 0) return null;

  return (
    <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
      {count > 9 ? '9+' : count}
    </span>
  );
}
