'use client';

// Platform is open — SoftAuthGate is disabled.
// Kept as a no-op so existing usages don't need to be removed everywhere.

interface SoftAuthGateProps {
  freeLimit?: number;
  totalCount?: number;
  dataLabel?: string;
}

export default function SoftAuthGate(_props: SoftAuthGateProps) {
  return null;
}

/**
 * Helper hook — returns undefined (no limit) since platform is open.
 */
export function useAuthLimit(_freeLimit: number = 20): number | undefined {
  return undefined;
}
