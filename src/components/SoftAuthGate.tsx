'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ArrowRight, Unlock } from 'lucide-react';

interface SoftAuthGateProps {
  /** Number of items visible without auth */
  freeLimit?: number;
  /** Total items available */
  totalCount?: number;
  /** What kind of data is behind the gate */
  dataLabel?: string;
}

/**
 * Soft auth gate — shows a blur overlay + CTA after the free preview rows.
 * Place this below the visible rows in a table/list. Only renders for
 * unauthenticated users.
 */
export default function SoftAuthGate({
  freeLimit = 20,
  totalCount,
  dataLabel = 'pairs',
}: SoftAuthGateProps) {
  const { status } = useSession();

  if (status !== 'unauthenticated') return null;

  const countText = totalCount
    ? `all ${totalCount.toLocaleString()}+ ${dataLabel}`
    : `all ${dataLabel}`;

  return (
    <div className="relative mt-[-40px] pt-10">
      {/* Gradient fade from transparent to background */}
      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-transparent to-hub-black pointer-events-none" />

      {/* CTA card */}
      <div className="relative bg-hub-black border border-white/[0.06] rounded-xl p-6 text-center">
        <div className="w-10 h-10 rounded-full bg-hub-yellow/10 border border-hub-yellow/20 flex items-center justify-center mx-auto mb-3">
          <Unlock className="w-4 h-4 text-hub-yellow" />
        </div>

        <p className="text-sm text-neutral-400 mb-4">
          Showing top {freeLimit} — sign up free to see {countText}
        </p>

        <div className="flex items-center justify-center gap-3">
          <Link
            href="/signup"
            className="h-9 px-5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-yellow-500/15 transition-all"
          >
            Create free account
            <ArrowRight size={13} />
          </Link>
          <Link
            href="/login"
            className="h-9 px-5 rounded-lg bg-white/[0.06] border border-white/[0.1] hover:bg-white/[0.1] text-neutral-300 text-xs flex items-center transition-all"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Helper hook — returns the slice limit for data arrays.
 * Usage: const limit = useAuthLimit(20);
 *        const visibleData = data.slice(0, limit);
 */
export function useAuthLimit(freeLimit: number = 20): number | undefined {
  const { status } = useSession();
  if (status === 'unauthenticated') return freeLimit;
  return undefined; // no limit for authenticated users
}
