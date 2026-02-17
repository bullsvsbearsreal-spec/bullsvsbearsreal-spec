'use client';

import { useTimeAgo } from '@/hooks/useTimeAgo';

/**
 * Compact "Updated Xs ago" badge for section headers.
 * Ticks every second to stay current.
 */
export default function UpdatedAgo({ date }: { date: Date | null }) {
  const label = useTimeAgo(date);
  if (!label) return null;

  return (
    <span className="text-[10px] font-mono text-neutral-600 bg-white/[0.03] px-1.5 py-0.5 rounded">
      {label}
    </span>
  );
}
